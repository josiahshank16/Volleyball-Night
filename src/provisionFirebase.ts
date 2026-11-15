import {initializeApp,deleteApp} from 'firebase/app';
import {doc,getDocFromServer,getFirestore,runTransaction,serverTimestamp} from 'firebase/firestore';
import {initial} from './model';
import type {SetupNotify} from './setupProgress';
import {validateGroup,type GroupConnection} from './groupConnection';

/** OAuth token is passed in memory only. Do not save bearer tokens anywhere. */
type APIError=Error&{status?:number};
type Operation={name?:string;done?:boolean;error?:{code?:number;message?:string};response?:unknown};
type WebApp={name:string;displayName?:string;appId?:string};
type WebConfig={apiKey?:string;authDomain?:string;projectId?:string;appId?:string;messagingSenderId?:string;storageBucket?:string};
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

async function api<T>(url:string,token:string,method='GET',body?:unknown):Promise<T>{
 let response:Response;
 try{
  response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 }catch{
  throw new Error('The browser could not reach this Google API. This can be a network or CORS restriction. Check the browser console and tell us which step stopped.');
 }
 const raw=await response.text();
 let result:unknown;
 try{result=raw?JSON.parse(raw):{}}catch{result={message:raw.slice(0,300)}}
 if(!response.ok){
  const error=(result as {error?:{message?:string;status?:string};message?:string});
  const e=new Error(`Google API ${response.status}: ${error.error?.message??error.message??response.statusText}`) as APIError;
  e.status=response.status;
  throw e;
 }
 return result as T;
}
const statusOf=(error:unknown)=>((error as APIError)?.status);
const serviceNotActive=(error:unknown)=>statusOf(error)===403 &&
 /(?:has not been used|is disabled|has been disabled|SERVICE_DISABLED|API has not been used)/i.test((error as Error)?.message??'');


async function waitFor(base:string,name:string,token:string,notify:SetupNotify){
 for(let i=0;i<90;i++){
  notify('Checking Google setup operation…',{stage:'cloud',kind:'check'});
  const op=await api<Operation>(`${base}/${name}`,token);
  if(op.done){
   if(op.error)throw new Error('Google setup operation failed: '+(op.error.message??'Unknown error'));
   return op.response;
  }
  if(i%12===0)notify('Google is still processing this step…');
  await pause(1600);
 }
 throw new Error('Google accepted the request but has not finished it. You can resume setup with this same project ID; do not create a second project.');
}

async function addFirebase(projectId:string,token:string,notify:SetupNotify){
 const base='https://firebase.googleapis.com/v1beta1';
 try{
  await api(`${base}/projects/${projectId}`,token);
  notify('Firebase is already enabled in this project.');
  return;
 }catch(e){if(statusOf(e)!==404)throw e;}
 notify('Adding Firebase to your Google Cloud project…');
 const op=await api<Operation>(`${base}/projects/${projectId}:addFirebase`,token,'POST',{});
 if(op.name)await waitFor(base,op.name,token,notify);
 notify('Firebase is enabled.');
}
async function enableService(projectId:string,service:string,token:string,notify:SetupNotify){
 const base='https://serviceusage.googleapis.com/v1';
 notify(`Checking ${service} API…`);
 const url=`${base}/projects/${projectId}/services/${service}`;
 const state=await api<{state?:string}>(url,token);
 if(state.state==='ENABLED')return;
 notify(`Enabling ${service} API…`);
 const op=await api<Operation>(url+':enable',token,'POST',{});
 if(op.name)await waitFor(base,op.name,token,notify);
}
async function makeFirestore(projectId:string,token:string,locationId:string,notify:SetupNotify){
 const base='https://firestore.googleapis.com/v1';
 const db=`${base}/projects/${projectId}/databases/%28default%29`;
 const url=`${base}/projects/${projectId}/databases?databaseId=%28default%29`;
 // Service Usage can finish its enable operation before Firestore actually
 // accepts requests in a newly-created project. Keep the project ID and
 // retry only Google's explicit API-disabled/not-yet-active response.
 for(let attempt=0;attempt<9;attempt++){
  notify('Checking Cloud Firestore database…',{stage:'cloud',kind:'check'});
  try{
   try{
    await api(db,token);
    notify('The default Firestore database already exists.');
    return;
   }catch(e){if(statusOf(e)!==404)throw e;}
   notify(`Creating Firestore database in ${locationId}…`);
   const op=await api<Operation>(url,token,'POST',{type:'FIRESTORE_NATIVE',locationId});
   if(op.name)await waitFor(base,op.name,token,notify);
   notify('Firestore database created.');
   return;
  }catch(e){
   if(!serviceNotActive(e))throw e;
   if(attempt===8){
    throw new Error(`Cloud Firestore API is not active yet in project ${projectId}. Google reported it as disabled even after retries. Open https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${projectId}, enable it if needed, and retry this SAME project. Do not create another project.`);
   }
   notify('Google is preparing your Firestore database. This may take a few minutes…');
   // Re-check (and enable if necessary) through Google's Service Usage API.
   await enableService(projectId,'firestore.googleapis.com',token,notify);
   await pause(Math.min(12000,2000+attempt*2000));
  }
 }
}
export const RULES_SOURCE=`rules_version = '2';
service cloud.firestore {
 match /databases/{database}/documents {
  match /liveSessions/{sessionId} {
   allow get: if sessionId == 'current';
   allow list, delete: if false;
   allow create, update: if sessionId == 'current'
     && request.resource.data.keys().hasOnly(['payload','schemaVersion','updatedAt','updatedBy'])
     && request.resource.data.schemaVersion == 1
     && request.resource.data.payload is map
     && request.resource.data.payload.keys().hasOnly(['json'])
     && request.resource.data.payload.json is string
     && request.resource.data.updatedBy is string;
  }
  match /{document=**} {allow read, write: if false;}
 }
}`;
async function installRules(projectId:string,token:string,notify:SetupNotify){
 const base='https://firebaserules.googleapis.com/v1';
 const releaseName='projects/'+projectId+'/releases/cloud.firestore';
 // A previous attempt may already have published the correct rules.
 // Do not publish another identical ruleset every time the user resumes:
 // doing so can restart the security-rules propagation delay.
 let existing:{rulesetName?:string}|null=null;
 try{
  existing=await api<{rulesetName?:string}>(base+'/'+releaseName,token);
 }catch(e){
  if(statusOf(e)!==404)throw e;
 }
 if(existing?.rulesetName){
  notify('Checking the rules already published for your group…');
  const current=await api<{source?:{files?:Array<{name?:string;content?:string}>}}>(base+'/'+existing.rulesetName,token);
  if(current.source?.files?.some(file=>file.content?.trim()===RULES_SOURCE.trim())){
   notify('The correct Firestore rules are already published. Waiting for them to become active…');
   return;
  }
 }
 notify('Publishing your group’s Firestore access rules…');
 let ruleset:{name:string}|undefined;
 for(let attempt=0;attempt<5;attempt++){
  try{
   ruleset=await api<{name:string}>(base+'/projects/'+projectId+'/rulesets',token,'POST',
    {source:{files:[{name:'firestore.rules',content:RULES_SOURCE}]}});
   break;
  }catch(e){
   if(!serviceNotActive(e))throw e;
   if(attempt===4){
    throw new Error('Google still reports Firebase Rules API as disabled for project '+projectId+
     '. Open https://console.cloud.google.com/apis/library/firebaserules.googleapis.com?project='+projectId+
     ' and retry this same group. Details: '+(e as Error).message);
   }
   notify('Firebase Rules is still activating. This may take a few minutes; checking again…');
   await pause(4000*(attempt+1));
  }
 }
 if(!ruleset?.name)throw Error('Google did not return a new Firestore ruleset.');
 if(existing){
  await api(base+'/'+releaseName,token,'PATCH',
   {release:{name:releaseName,rulesetName:ruleset.name},updateMask:'rulesetName'});
 }else{
  await api(base+'/projects/'+projectId+'/releases',token,'POST',
   {name:releaseName,rulesetName:ruleset.name});
 }
 const live=await api<{rulesetName?:string}>(base+'/'+releaseName,token);
 if(live.rulesetName!==ruleset.name){
  throw Error('Firestore rules release was not yet updated for project '+projectId+
   '. Your group has been saved. Resume the same project.');
 }
 notify('Firestore rules are published. Waiting for them to become active…');
}
/** Short-lived 403 responses are possible while a newly created Google project is activating.
 * Only retry ambiguous permission errors for a limited period. Terms, IAM and
 * other persistent errors still surface with their original details. */
async function whileGoogleActivates<T>(
 label:string,notify:SetupNotify,work:()=>Promise<T>
):Promise<T>{
 const deadline=Date.now()+120_000;
 while(true){
  try{return await work();}
  catch(e){
   const message=(e as Error)?.message??'';
   const explicitBlock=/terms of service|accept.*terms|TOS_NOT_ACCEPTED|insufficient authentication scopes|billing account|required billing/i.test(message);
   if(statusOf(e)!==403||explicitBlock||Date.now()>=deadline)throw e;
   notify('Google is preparing '+label+'. This may take a few minutes…',{stage:'cloud',kind:'check'});
   await pause(6000);
  }
 }
}
async function findOrCreateWebApp(projectId:string,token:string,notify:SetupNotify):Promise<WebConfig>{
 const base='https://firebase.googleapis.com/v1beta1';
 let apps=(await api<{apps?:WebApp[]}>(`${base}/projects/${projectId}/webApps`,token)).apps??[];
 let app=apps.find(a=>a.displayName==='Volleyball Night');
 if(!app){
  notify('Registering the Volleyball Night web app…');
  const op=await api<Operation>(`${base}/projects/${projectId}/webApps`,token,'POST',{displayName:'Volleyball Night'});
  if(op.name)await waitFor(base,op.name,token,notify);
  apps=(await api<{apps?:WebApp[]}>(`${base}/projects/${projectId}/webApps`,token)).apps??[];
  app=apps.find(a=>a.displayName==='Volleyball Night');
 }
 if(!app)throw Error('Google accepted web app registration but the app is not listed yet. Retry on the same project.');
 notify('Retrieving this group’s Firebase web configuration…');
 return await api<WebConfig>(`${base}/${app.name}/config`,token);
}
async function seedSession(group:GroupConnection,notify:SetupNotify){
 // New Firestore rules may not affect client reads immediately. Keep
 // checking from the server for a bounded period instead of showing
 // an error after the first few permission-denied responses.
 notify('Verifying your new Firestore access rules. This may take a few minutes…');
 const app=initializeApp(group.config,'new-group-test-'+crypto.randomUUID());
 try{
  const db=getFirestore(app);
  const ref=doc(db,'liveSessions','current');
  const deadline=Date.now()+180_000; // Up to three minutes of automatic checking.
  let lastError:unknown=null;
  let failedAt:'read'|'create'='read';
  let checks=0;
  while(true){
   checks++;
   notify('Checking your group’s Firestore connection. This may take a few minutes…',
    {stage:'firestore',kind:'check',attempt:checks});
   try{
    failedAt='read';
    // Force a server read: cached data alone is not proof of access.
    const snap=await getDocFromServer(ref);
    if(snap.exists()){
     notify('An existing session was found and preserved.');
     return;
    }
    failedAt='create';
    await runTransaction(db,async tx=>{
     const current=await tx.get(ref);
     if(!current.exists())tx.set(ref,{
      schemaVersion:1,payload:{json:JSON.stringify(initial())},
      updatedAt:serverTimestamp(),updatedBy:'open-prototype'
     });
    });
    failedAt='read';
    const created=await getDocFromServer(ref);
    if(!created.exists())throw Error('Firestore wrote the session but could not read it back. Please retry this saved group.');
    notify('Your empty Volleyball Night session is ready!');
    return;
   }catch(err){
    const error=err as {code?:string;message?:string};
    if(error.code!=='permission-denied'&&error.code!=='unavailable'){
     throw new Error('Firestore '+(failedAt==='read'?'read':'session creation')+
      ' failed in '+group.config.projectId+': '+(error.message??String(err)));
    }
    lastError=err;
    if(Date.now()>=deadline)break;
    notify('Google is finishing your database and access rules. This may take a few minutes…');
    await pause(5000);
   }
  }
  const detail=(lastError as {message?:string})?.message??'Access denied';
  throw Error('Firestore client '+(failedAt==='read'?'READ':'CREATE')+
   ' access is still not available for liveSessions/current in '+group.config.projectId+
   ' after three minutes of checking. Your project and group setup are saved. Wait another minute or two and select Continue setup with Google to retry; if it still fails, inspect this group’s Firestore security rules. Original error: '+detail);
 }finally{await deleteApp(app).catch(()=>{});}
}
export async function completeFirebaseSetup(args:{projectId:string;groupName:string;region:string;token:string;notify:SetupNotify}):Promise<GroupConnection>{
 const {projectId,groupName,region,token,notify}=args;
 if(!/^vn-[a-z0-9-]{3,54}$/.test(projectId))throw Error('Please use the test project ID previously created by Volleyball Night.');
 await api(`https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`,token);
 notify('Checking your group’s Firebase services…',{stage:'cloud',kind:'check'});
 await whileGoogleActivates('Firebase API access',notify,
  ()=>enableService(projectId,'firebase.googleapis.com',token,notify));
 notify('Firebase API is ready.',{stage:'cloud',kind:'check'});
 await whileGoogleActivates('Firebase activation',notify,
  ()=>addFirebase(projectId,token,notify));
 notify('Firebase has been enabled.',{stage:'cloud',kind:'check'});
 await whileGoogleActivates('Firestore API access',notify,
  ()=>enableService(projectId,'firestore.googleapis.com',token,notify));
 notify('Firestore API is ready.',{stage:'cloud',kind:'check'});
 await whileGoogleActivates('Firestore database',notify,
  ()=>makeFirestore(projectId,token,region,notify));
 notify('Firestore database is ready.',{stage:'cloud',kind:'check'});
 await whileGoogleActivates('Firestore access rules',notify,
  ()=>installRules(projectId,token,notify));
 notify('Firestore rules were published.',{stage:'cloud',kind:'check'});
 const web=await whileGoogleActivates('web app registration',notify,
  ()=>findOrCreateWebApp(projectId,token,notify));
 notify('Firebase web application configured.',{stage:'cloud',kind:'check'});
 const group=validateGroup({version:1,name:groupName||projectId,config:web});
 await seedSession(group,notify);
 return group;
}
