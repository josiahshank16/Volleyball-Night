import {firebaseConfig} from './firebase';
import {activeGroup,isIndependentGroupSite} from './groupConnection';
import {installIndependentGroupWebsite} from './hostingInstaller';
import {exportState,type AppState} from './model';
import {toPublicTV} from './publicViews';
import {enableLeaderAuthentication,googleAccount,ownerApi,setLeaderPin,verifyOwnerProject} from './accessAdmin';
import {PROTECTED_GROUP_RULES} from './protectedRules';

type FireValue={stringValue?:string;integerValue?:string;booleanValue?:boolean;
 nullValue?:null;arrayValue?:{values?:FireValue[]};mapValue?:{fields:Record<string,FireValue>};timestampValue?:string};
type FireDoc={fields?:Record<string,FireValue>};
type RuleRelease={name?:string;rulesetName?:string};
const field=(value:unknown):FireValue=>{
 if(value===null||value===undefined)return {nullValue:null};
 if(typeof value==='string')return {stringValue:value};
 if(typeof value==='number'&&Number.isInteger(value))return {integerValue:String(value)};
 if(typeof value==='boolean')return {booleanValue:value};
 if(Array.isArray(value))return {arrayValue:{values:value.map(field)}};
 if(typeof value==='object')return {mapValue:{fields:Object.fromEntries(
  Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,field(item)])
 )}};
 throw Error('Unsupported group data while preparing the protected display.');
};
const fields=(value:Record<string,unknown>)=>Object.fromEntries(
 Object.entries(value).map(([key,item])=>[key,field(item)]));
const path=(projectId:string,document:string)=>
 'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(projectId)+
 '/databases/(default)/documents/'+document;
const missing=(e:unknown)=>(e as {status?:number}).status===404;

async function readAdminDoc(projectId:string,document:string,token:string):Promise<FireDoc|null>{
 try{return await ownerApi<FireDoc>(path(projectId,document),token)}
 catch(e){if(missing(e))return null;throw e}
}
async function putAdminDoc(projectId:string,document:string,token:string,data:Record<string,unknown>){
 await ownerApi(path(projectId,document),token,'PATCH',{fields:fields(data)});
}
async function publishProtectedRules(projectId:string,token:string){
 const base='https://firebaserules.googleapis.com/v1';
 const releaseName='projects/'+projectId+'/releases/cloud.firestore';
 const current=await ownerApi<RuleRelease>(base+'/'+releaseName,token);
 if(current.rulesetName){
  const published=await ownerApi<{source?:{files?:Array<{content?:string}>}}>(base+'/'+current.rulesetName,token);
  if(published.source?.files?.some(file=>file.content?.trim()===PROTECTED_GROUP_RULES.trim()))return;
 }
 const ruleset=await ownerApi<{name?:string}>(base+'/projects/'+projectId+'/rulesets',token,'POST',
  {source:{files:[{name:'firestore.rules',content:PROTECTED_GROUP_RULES}]}});
 if(!ruleset.name)throw Error('Firebase did not return a protected ruleset.');
 await ownerApi(base+'/'+releaseName,token,'PATCH',
  {release:{name:releaseName,rulesetName:ruleset.name},updateMask:'rulesetName'});
 const verified=await ownerApi<RuleRelease>(base+'/'+releaseName,token);
 if(verified.rulesetName!==ruleset.name)throw Error('Firebase has not finished publishing the protected rules. Retry this group.');
}

/** Owner-authorized, resumable conversion. Caller first downloads a JSON backup. */
export async function protectGroup(pin:string,token:string,notify:(message:string)=>void){
 const projectId=firebaseConfig.projectId,apiKey=firebaseConfig.apiKey;
 if(!/^vn-[a-z0-9-]{3,54}$/.test(projectId)||!apiKey)
  throw Error('This security upgrade is for independent group projects.');
 if(!activeGroup||activeGroup.config.projectId!==projectId||isIndependentGroupSite)
  throw Error('Open group access from the main Volleyball Night website to continue.');
 if(!/^\d{6}$/.test(pin))throw Error('Choose exactly six digits for the leader PIN.');
 notify('Checking the group owner account…');
 const owner=await googleAccount(token);
 await verifyOwnerProject(projectId,token);
 const previous=await readAdminDoc(projectId,'access/config',token);
 const boundOwner=previous?.fields?.ownerSub?.stringValue;
 if(boundOwner&&boundOwner!==owner.sub)
  throw Error('This group was bound to a different Google owner account. No PIN or rules were changed.');
 const live=await readAdminDoc(projectId,'liveSessions/current',token);
 if(!live)throw Error('No existing group session was found. Nothing was changed.');
 const raw=live.fields?.payload?.mapValue?.fields?.json?.stringValue;
 if(typeof raw!=='string')throw Error('The existing group session is incompatible with this upgrade.');
 const state=JSON.parse(raw) as AppState;
 if(!Array.isArray(state.players)||!state.session||!Array.isArray(state.session.checkedIn))
  throw Error('The existing player data is invalid. Nothing was changed.');
 notify('Downloading a backup of the current group data…');
 exportState(state);
 if(!(await readAdminDoc(projectId,'ownerBackups/pre-access',token)))
  await putAdminDoc(projectId,'ownerBackups/pre-access',token,{json:raw,createdAt:new Date().toISOString()});
 notify('Preparing group PIN authentication…');
 await enableLeaderAuthentication(projectId,token);
 const leaderUid=await setLeaderPin(projectId,apiKey,token,pin);
 const priorUid=previous?.fields?.leaderUid?.stringValue;
 if(priorUid&&priorUid!==leaderUid)throw Error('The existing leader account ID does not match. No rules were changed.');
 notify('Creating the public player directory…');
 for(let offset=0;offset<state.players.length;offset+=100){
  const writes=state.players.slice(offset,offset+100).map(player=>({update:{
   name:'projects/'+projectId+'/databases/(default)/documents/publicPlayers/'+player.id,
   fields:{name:{stringValue:player.name}}
  }}));
  const result=await ownerApi<{writeResults?:unknown[];status?:Array<{code?:number;message?:string}>}>(
   path(projectId,'').replace(/\/$/,'')+':batchWrite',token,'POST',{writes});
  const failure=result.status?.find(item=>item.code&&item.code!==0);
  if(failure)throw Error('Could not copy the public player directory: '+(failure.message||failure.code));
 }
 if(!(await readAdminDoc(projectId,'attendance/current',token)))
  await putAdminDoc(projectId,'attendance/current',token,{checkedIn:state.session.checkedIn});
 if(!(await readAdminDoc(projectId,'publicDisplays/current',token)))
  await putAdminDoc(projectId,'publicDisplays/current',token,
   {...toPublicTV({...state,publicTVEnabled:true}),updatedAt:new Date().toISOString()});
 notify('Publishing the protected-access capable group website…');
 await installIndependentGroupWebsite({group:activeGroup,token,notify});
 const rotation=Math.floor(Date.now()/1000)+2;
 await putAdminDoc(projectId,'access/config',token,{
  ownerSub:owner.sub,leaderUid,pinChangedAt:rotation
 });
 notify('Publishing protected database rules…');
 await publishProtectedRules(projectId,token);
 // Clients switch routes only after the rules are published. This write is
 // administrative and remains possible even when client access is locked.
 await putAdminDoc(projectId,'access/status',token,{protected:true,schemaVersion:1});
 // Firebase Auth token auth_time is in whole seconds. Give the new cutoff
 // time to pass so the freshly entered PIN can sign in immediately.
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,rotation*1000-Date.now()+1000)));
 notify('Protected access is active. Use the PIN to test organizer and scorekeeper.');
 return {ownerEmail:owner.email,projectId};
}
