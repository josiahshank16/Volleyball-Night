import type {SetupNotify} from './setupProgress';

/** Browser-only project provisioning. Never persist Google access tokens. */
export type SetupStage='allocated'|'created'|'complete';
export type SetupCheckpoint={
 version:1;
 projectId:string;
 groupName:string;
 region:string;
 stage:SetupStage;
 updatedAt:number;
};
export const CHECKPOINT_KEY='volleyball-night-setup-in-progress-v2';
export const COMPLETED_KEY='volleyball-night-last-completed-group-v2';
const LEGACY_PROJECT='volleyball-night-last-test-project';
const LEGACY_GROUP='volleyball-night-last-test-group';

export function readCheckpoint():SetupCheckpoint|null{
 try{
  const raw=localStorage.getItem(CHECKPOINT_KEY);
  if(raw){
   const c=JSON.parse(raw) as SetupCheckpoint;
   if(c.version===1&&validProjectId(c.projectId)&&typeof c.groupName==='string'&&
    ['allocated','created','complete'].includes(c.stage))return c;
  }
  const old=localStorage.getItem(LEGACY_PROJECT);
  if(old&&validProjectId(old))return {version:1,projectId:old,groupName:localStorage.getItem(LEGACY_GROUP)||old,
   region:'us-central1',stage:'created',updatedAt:Date.now()};
 }catch{/* Corrupt local state must not trigger a duplicate project. */}
 return null;
}
export function saveCheckpoint(c:SetupCheckpoint){
 localStorage.setItem(CHECKPOINT_KEY,JSON.stringify(c));
 localStorage.setItem(LEGACY_PROJECT,c.projectId);
 localStorage.setItem(LEGACY_GROUP,c.groupName);
}
export function clearCheckpoint(){
 localStorage.removeItem(CHECKPOINT_KEY);
 localStorage.removeItem(LEGACY_PROJECT);
 localStorage.removeItem(LEGACY_GROUP);
}
export function validProjectId(v:string){return /^vn-[a-z0-9-]{3,54}$/.test(v)}
export function allocateCheckpoint(groupName:string,region:string):SetupCheckpoint{
 const slug=groupName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,15).replace(/-+$/,'')||'group';
 const random=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>(n%36).toString(36)).join('');
 return {version:1,projectId:'vn-'+slug+'-'+random,groupName:groupName.trim(),region,stage:'allocated',updatedAt:Date.now()};
}
type GoogleProject={projectId?:string;name?:string;state?:string};
type Operation={name?:string;done?:boolean;error?:{message?:string;code?:number}};
export class GoogleApiError extends Error{
 constructor(message:string,public status:number){super(message);this.name='GoogleApiError'}
}
async function request<T>(url:string,token:string,method='GET',body?:unknown):Promise<T>{
 let response:Response;
 try{
  response=await fetch(url,{method,headers:{Authorization:'Bearer '+token,...(body!==undefined?{'Content-Type':'application/json'}:{})},
   ...(body!==undefined?{body:JSON.stringify(body)}:{})});
 }catch{
  throw Error('Could not reach Google. Check the network connection, then resume this same setup.');
 }
 const content=await response.text();
 let payload:unknown={};
 try{payload=JSON.parse(content)}catch{payload={message:content.slice(0,450)}}
 if(!response.ok){
  const err=payload as {error?:{message?:string};message?:string};
  throw new GoogleApiError('Google API '+response.status+': '+(err.error?.message||err.message||response.statusText),response.status);
 }
 return payload as T;
}
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function waitOperation(name:string,token:string,notify:SetupNotify){
 for(let i=0;i<65;i++){
  notify('Checking Google project creation…',{stage:'cloud',kind:'check'});
  const op=await request<Operation>('https://cloudresourcemanager.googleapis.com/v3/'+name,token);
  if(op.done){
   if(op.error)throw Error('Google could not create the project: '+(op.error.message||'Unknown error'));
   return;
  }
  if(i%10===0)notify('Google is creating your project. This can take a little while…');
  await sleep(1700);
 }
 throw Error('Google is still creating your project. Reopen this page and continue with the same project. Do not start another setup.');
}
async function waitActive(projectId:string,token:string,notify:SetupNotify,afterCreate=false){
 const url='https://cloudresourcemanager.googleapis.com/v3/projects/'+projectId;
 let lastError:unknown=null;
 for(let i=0;i<32;i++){
  try{
   notify('Checking your Google Cloud project…',{stage:'cloud',kind:'check'});
   const project=await request<GoogleProject>(url,token);
   if(project.state==='ACTIVE'||!project.state)return;
   if(project.state==='DELETE_REQUESTED')throw Error('This project is scheduled for deletion in Google Cloud. It cannot be used for a new group.');
  }catch(e){
   // projects.get returns 403 even when a project doesn't exist.
   // Only treat that as temporary *after* an actual create attempt
   // (or a 409 conflict indicating the same ID may be in progress).
   if(!(e instanceof GoogleApiError)||![403,404].includes(e.status)||(!afterCreate&&e.status===403))throw e;
   lastError=e;
  }
  if(i%5===0)notify('Waiting for Google to finish activating your project…');
  await sleep(1900);
 }
 if(lastError instanceof GoogleApiError&&lastError.status===403){
  throw Error('Google accepted or recognized this project ID, but this Google account still cannot access it. Make sure you used the same account that started this group. Google might still be applying permissions. If the problem continues, check the project in Google Cloud Console. The project ID is saved and will NOT change.');
 }
 throw Error('Google has not finished creating this project yet. Return to this page to resume the same project ID; do not create another.');
}
/** New checkpoints POST first; saved created projects are only read, never recreated. */
export async function ensureCloudProject(checkpoint:SetupCheckpoint,token:string,notify:SetupNotify){
 if(checkpoint.stage!=='allocated'){
  notify('Checking your saved group project…',{stage:'cloud',kind:'check'});
  await waitActive(checkpoint.projectId,token,notify);
  notify('Your group project is ready.');
  return;
 }
 // We previously used projects.get as a preflight, but Google returns
 // PERMISSION_DENIED (403) for IDs that do not yet exist. Instead send
 // projects.create with our pre-allocated, persisted ID straight away.
 // If a prior POST succeeded and the browser closed, the retry receives
 // a conflict (409) and simply waits to read the SAME project.
 notify('Creating your group-owned Google Cloud project…',{stage:'cloud',kind:'check'});
 let operation:Operation|undefined;
 try{
  operation=await request<Operation>('https://cloudresourcemanager.googleapis.com/v3/projects',token,'POST',{
   // Google Cloud project display names are limited to 30 characters.
   // The full, user-entered group name is retained in the group's app settings.
   projectId:checkpoint.projectId,displayName:'VN - '+Array.from(checkpoint.groupName.trim()).slice(0,25).join('')
  });
 }catch(err){
  if(!(err instanceof GoogleApiError)||err.status!==409)throw err;
  notify('This project ID is already registered. Checking whether your previous setup created it…');
 }
 if(operation?.name)await waitOperation(operation.name,token,notify);
 await waitActive(checkpoint.projectId,token,notify,true);
 notify('Your group project is ready.');
}
