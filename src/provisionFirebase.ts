import {initializeApp,deleteApp} from 'firebase/app';
import {doc,getDoc,getFirestore,runTransaction,serverTimestamp} from 'firebase/firestore';
import {initial} from './model';
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


async function waitFor(base:string,name:string,token:string,notify:(message:string)=>void){
 for(let i=0;i<90;i++){
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

async function addFirebase(projectId:string,token:string,notify:(message:string)=>void){
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
async function enableService(projectId:string,service:string,token:string,notify:(message:string)=>void){
 const base='https://serviceusage.googleapis.com/v1';
 notify(`Checking ${service} API…`);
 const url=`${base}/projects/${projectId}/services/${service}`;
 const state=await api<{state?:string}>(url,token);
 if(state.state==='ENABLED')return;
 notify(`Enabling ${service} API…`);
 const op=await api<Operation>(url+':enable',token,'POST',{});
 if(op.name)await waitFor(base,op.name,token,notify);
}
async function makeFirestore(projectId:string,token:string,locationId:string,notify:(message:string)=>void){
 const base='https://firestore.googleapis.com/v1';
 const db=`${base}/projects/${projectId}/databases/%28default%29`;
 const url=`${base}/projects/${projectId}/databases?databaseId=%28default%29`;
 // Service Usage can finish its enable operation before Firestore actually
 // accepts requests in a newly-created project. Keep the project ID and
 // retry only Google's explicit API-disabled/not-yet-active response.
 for(let attempt=0;attempt<9;attempt++){
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
   notify(`Google is still activating Cloud Firestore for ${projectId}. Waiting and retrying automatically (attempt ${attempt+1}/9)…`);
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
async function installRules(projectId:string,token:string,notify:(message:string)=>void){
 const base='https://firebaserules.googleapis.com/v1';
 notify('Creating Volleyball Night Firestore rules…');
 // Rulesets are immutable. In the prototype, repeating this step can
 // create a new ruleset but safely updates only THIS group's release.
 let ruleset:{name:string}|undefined;
 for(let attempt=0;attempt<5;attempt++){
  try{
   ruleset=await api<{name:string}>(`${base}/projects/${projectId}/rulesets`,token,'POST',{source:{files:[{name:'firestore.rules',content:RULES_SOURCE}]}});
   break;
  }catch(e){
   // Google may still be activating Rules after projects.addFirebase.
   // Retry only a *specific* API-not-enabled response, not general 403
   // permission errors (those need IAM/account troubleshooting).
   if(!serviceNotActive(e))throw e;
   if(attempt===4){
    throw new Error(`Google still reports Firebase Rules API as disabled in project ${projectId}. Open https://console.cloud.google.com/apis/library/firebaserules.googleapis.com?project=${projectId}, enable it if necessary, then continue the SAME group setup. Details: ${(e as Error).message}`);
   }
   notify('Google is activating Firebase Rules for this project. Retrying automatically…');
   await pause(2000*(attempt+1));
  }
 }
 if(!ruleset)throw Error('Google did not create a Firestore ruleset.');
 if(!ruleset.name)throw Error('Google did not return a Firestore ruleset name.');
 const releaseName=`projects/${projectId}/releases/cloud.firestore`;
 notify('Publishing the Firestore rules in your new project…');
 try{
  await api(`${base}/${releaseName}`,token,'GET');
  await api(`${base}/${releaseName}`,token,'PATCH',{release:{name:releaseName,rulesetName:ruleset.name},updateMask:'rulesetName'});
 }catch(e){
  if(statusOf(e)!==404)throw e;
  await api(`${base}/projects/${projectId}/releases`,token,'POST',{name:releaseName,rulesetName:ruleset.name});
 }
 // Firebase's release API can accept a request before the effective rules
 // are available to Firestore. Verify that the release actually points to
 // the ruleset we just published before testing the browser SDK.
 const live=await api<{rulesetName?:string}>(`${base}/${releaseName}`,token);
 if(live.rulesetName!==ruleset.name){
  throw new Error(`Firestore rules publication did not activate the expected ruleset for project ${projectId}. Expected ${ruleset.name}, got ${live.rulesetName??'no ruleset'}. Continue the SAME group setup to retry.`);
 }
 notify('Firestore rules release verified. Waiting for Firestore to apply it…');
}
async function findOrCreateWebApp(projectId:string,token:string,notify:(message:string)=>void):Promise<WebConfig>{
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
async function seedSession(group:GroupConnection,notify:(message:string)=>void){
 // This is a REAL CLIENT SDK check. Admin access to the Cloud project
 // does not bypass Firestore security rules in the browser. A successful
 // ruleset publish may take a minute to propagate to new client reads.
 notify('Verifying Firestore access and initializing your first empty session…');
 const app=initializeApp(group.config,'new-group-test-'+crypto.randomUUID());
 try{
  const db=getFirestore(app);
  const ref=doc(db,'liveSessions','current');
  let lastPermissionError:unknown=null;
  let failedAt:'read'|'create'='read';
  const attempts=18; // ~65+ seconds of retries; Google's rules may take a minute.
  for(let attempt=0;attempt<attempts;attempt++){
   try{
    failedAt='read';
    const snap=await getDoc(ref);
    if(snap.exists()){notify('An existing session was found and preserved.');return;}
    failedAt='create';
    await runTransaction(db,async tx=>{
     const current=await tx.get(ref);
     if(!current.exists())tx.set(ref,{
      schemaVersion:1,payload:{json:JSON.stringify(initial())},
      updatedAt:serverTimestamp(),updatedBy:'open-prototype'
     });
    });
    // Verify client visibility. Never claim success for an unusable group.
    failedAt='read';
    const created=await getDoc(ref);
    if(!created.exists())throw Error('Firestore wrote the session but could not read it back. Retry this same group.');
    notify('Your empty Volleyball Night session is ready!');
    return;
   }catch(err){
    const error=err as {code?:string;message?:string};
    const retryable=error.code==='permission-denied'||error.code==='unavailable';
    if(!retryable){
     throw new Error(\`Firestore \${failedAt==='read'?'read':'session creation'} failed in \${group.config.projectId}: \${error.message??String(err)}\`);
    }
    lastPermissionError=err;
    if(attempt===attempts-1)break;
    notify(\`Waiting for Firestore client access rules to activate… (\${attempt+1}/\${attempts})\`);
    await pause(4000);
   }
  }
  const detail=(lastPermissionError as {message?:string})?.message??'Access denied';
  throw new Error(\`Firestore client \${failedAt==='read'?'READ':'CREATE'} permission was denied for liveSessions/current in \${group.config.projectId}, even after waiting for the new rules. The group's Cloud project and published rules were preserved. Open the Firebase Console → Firestore Database → Rules for THIS project and confirm that the rules allow get and create on liveSessions/current. Then continue setup using the same project. Original error: \${detail}\`);
 }finally{await deleteApp(app).catch(()=>{});}
}
export async function completeFirebaseSetup(args:{projectId:string;groupName:string;region:string;token:string;notify:(message:string)=>void}):Promise<GroupConnection>{
 const {projectId,groupName,region,token,notify}=args;
 if(!/^vn-[a-z0-9-]{3,54}$/.test(projectId))throw Error('Please use the test project ID previously created by Volleyball Night.');
 await api(`https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`,token);
 await enableService(projectId,'firebase.googleapis.com',token,notify);
 await addFirebase(projectId,token,notify);
 await enableService(projectId,'firestore.googleapis.com',token,notify);
 // Google's projects.addFirebase enables the Firebase Rules API itself.
 // A redundant Service Usage GET against firebaserules.googleapis.com can
 // return a misleading 403 in newly provisioned projects, even though
 // addFirebase succeeded. Check the rules service by USING it instead.
 await makeFirestore(projectId,token,region,notify);
 await installRules(projectId,token,notify);
 const web=await findOrCreateWebApp(projectId,token,notify);
 const group=validateGroup({version:1,name:groupName||projectId,config:web});
 await seedSession(group,notify);
 return group;
}
