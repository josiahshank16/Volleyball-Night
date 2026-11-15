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
 try{
  await api(db,token);
  notify('The default Firestore database already exists.');
  return;
 }catch(e){if(statusOf(e)!==404)throw e;}
 notify(`Creating Firestore database in ${locationId}…`);
 const url=`${base}/projects/${projectId}/databases?databaseId=%28default%29`;
 const op=await api<Operation>(url,token,'POST',{type:'FIRESTORE_NATIVE',locationId});
 if(op.name)await waitFor(base,op.name,token,notify);
 notify('Firestore database created.');
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
 const ruleset=await api<{name:string}>(`${base}/projects/${projectId}/rulesets`,token,'POST',{source:{files:[{name:'firestore.rules',content:RULES_SOURCE}]}});
 if(!ruleset.name)throw Error('Google did not return a Firestore ruleset name.');
 const releaseName=`projects/${projectId}/releases/cloud.firestore`;
 notify('Publishing the Firestore rules in your new project…');
 try{
  await api(`${base}/${releaseName}`,token,'GET');
  await api(`${base}/${releaseName}`,token,'PATCH',{release:{name:releaseName,rulesetName:ruleset.name}});
 }catch(e){
  if(statusOf(e)!==404)throw e;
  await api(`${base}/projects/${projectId}/releases`,token,'POST',{name:releaseName,rulesetName:ruleset.name});
 }
 notify('Firestore rules published.');
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
 notify('Testing the new Firestore connection and initializing a blank group…');
 const app=initializeApp(group.config,'new-group-test-'+crypto.randomUUID());
 try{
  const db=getFirestore(app);
  const ref=doc(db,'liveSessions','current');
  for(let attempt=0;attempt<5;attempt++){
   try{
    const snap=await getDoc(ref);
    if(snap.exists()){notify('An existing session was found and preserved.');return;}
    await runTransaction(db,async tx=>{
     const current=await tx.get(ref);
     if(!current.exists())tx.set(ref,{schemaVersion:1,payload:{json:JSON.stringify(initial())},updatedAt:serverTimestamp(),updatedBy:'open-prototype'});
    });
    notify('Your empty Volleyball Night session is ready!');
    return;
   }catch(err){
    if(attempt===4)throw err;
    notify('Waiting for Firestore rules to become active…');
    await pause(2000*(attempt+1));
   }
  }
 }finally{await deleteApp(app).catch(()=>{});}
}
export async function completeFirebaseSetup(args:{projectId:string;groupName:string;region:string;token:string;notify:(message:string)=>void}):Promise<GroupConnection>{
 const {projectId,groupName,region,token,notify}=args;
 if(!/^vn-[a-z0-9-]{3,54}$/.test(projectId))throw Error('Please use the test project ID previously created by Volleyball Night.');
 await api(`https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`,token);
 await enableService(projectId,'firebase.googleapis.com',token,notify);
 await addFirebase(projectId,token,notify);
 await enableService(projectId,'firestore.googleapis.com',token,notify);
 await enableService(projectId,'firebaserules.googleapis.com',token,notify);
 await makeFirestore(projectId,token,region,notify);
 await installRules(projectId,token,notify);
 const web=await findOrCreateWebApp(projectId,token,notify);
 const group=validateGroup({version:1,name:groupName||projectId,config:web});
 await seedSession(group,notify);
 return group;
}
