import type {FirebaseOptions} from 'firebase/app';

/**
 * The group connection contains only public Firebase WEB config.
 * Never place OAuth access tokens or service-account credentials here.
 */
export type GroupConnection={
  version:1;
  name:string;
  config:FirebaseOptions & {apiKey:string;projectId:string;appId:string};
};
export const GROUP_STORAGE_KEY='volleyball-night-connected-group-v1';
export const DEMO_GROUP_NAME='Original Volleyball Night';
// Independent Hosting copies embed their public group configuration directly
// in index.html. They must never fall back to the central project's database.
declare global {interface Window {__VOLLEYBALL_GROUP_CONFIG__?:unknown}}


const text=(value:unknown,max:number)=>typeof value==='string'&&value.trim().length>0&&value.length<=max?value.trim():null;

export function validateGroup(raw:unknown):GroupConnection{
 if(!raw||typeof raw!=='object')throw Error('The group connection is not a supported format.');
 const v=raw as {version?:unknown;name?:unknown;config?:unknown};
 if(v.version!==1||!v.config||typeof v.config!=='object')throw Error('The group link has an unsupported version.');
 const c=v.config as Record<string,unknown>;
 const apiKey=text(c.apiKey,300),projectId=text(c.projectId,100),appId=text(c.appId,250);
 const authDomain=c.authDomain==null?undefined:text(c.authDomain,255);
 const messagingSenderId=c.messagingSenderId==null?undefined:text(c.messagingSenderId,100);
 const storageBucket=c.storageBucket==null?undefined:text(c.storageBucket,255);
 if(!apiKey||!projectId||!appId||!/^[a-z0-9][a-z0-9-]{3,99}$/.test(projectId))throw Error('This configuration must include a valid Firebase apiKey, projectId and appId.');
 if((c.authDomain!=null&&!authDomain)||(c.messagingSenderId!=null&&!messagingSenderId)||(c.storageBucket!=null&&!storageBucket))throw Error('Some Firebase configuration fields are invalid.');
 const name=text(v.name,80)||projectId;
 return {version:1,name,config:{apiKey,projectId,appId,...(authDomain?{authDomain}:{}),...(messagingSenderId?{messagingSenderId}:{}),...(storageBucket?{storageBucket}:{})}};
}

export function encodeGroup(group:GroupConnection):string{
 const bytes=new TextEncoder().encode(JSON.stringify(validateGroup(group)));
 let chars='';
 for(const byte of bytes)chars+=String.fromCharCode(byte);
 return btoa(chars).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
export function decodeGroup(encoded:string):GroupConnection{
 if(!encoded||encoded.length>6000||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error('This group link is invalid or too long.');
 try{
  const plain=encoded.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(plain+'='.repeat((4-plain.length%4)%4));
  const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
  return validateGroup(JSON.parse(new TextDecoder().decode(bytes)));
 }catch(err){throw Error('This group link could not be read. '+((err as Error)?.message??''))}
}
function savedGroup():GroupConnection|null{
 try{const item=localStorage.getItem(GROUP_STORAGE_KEY);return item?validateGroup(JSON.parse(item)):null}catch{return null;}
}
const independentConfig=window.__VOLLEYBALL_GROUP_CONFIG__;
let independentGroup:GroupConnection|null=null;
if(independentConfig!==undefined){
 // An invalid embedded configuration must stop the app instead of silently
 // switching to the original Volleyball Night Firestore project.
 independentGroup=validateGroup(independentConfig);
}
export const isIndependentGroupSite=independentGroup!==null;
const param=new URLSearchParams(window.location.search).get('g');
let active:GroupConnection|null=null;
let invalidLink:string|null=null;
if(independentGroup){
 active=independentGroup; // This site's own database always takes precedence.
 localStorage.setItem(GROUP_STORAGE_KEY,JSON.stringify(active));
}else if(param!==null){
 try{
  active=decodeGroup(param);
  localStorage.setItem(GROUP_STORAGE_KEY,JSON.stringify(active));
 }catch(err){invalidLink=(err as Error).message;}
}else active=savedGroup();
export const activeGroup=active;
export const groupLinkError=invalidLink;
export function useGroupLink(mode?:string):string{
 const u=new URL(window.location.href);
 u.search='';u.hash='';
 if(active&&!isIndependentGroupSite)u.searchParams.set('g',encodeGroup(active));
 if(mode)u.searchParams.set('mode',mode);
 return u.toString();
}
export const groupLocalCacheKey=active?'volleyball-night-v01-'+active.config.projectId:undefined;
export function activateGroup(group:GroupConnection){
 const checked=validateGroup(group);
 localStorage.setItem(GROUP_STORAGE_KEY,JSON.stringify(checked));
 const u=new URL(window.location.href);
 u.search='';if(!isIndependentGroupSite)u.searchParams.set('g',encodeGroup(checked));
 window.location.assign(u.toString());
}
export function useOriginalGroup(){
 localStorage.removeItem(GROUP_STORAGE_KEY);
 const u=new URL(window.location.href);u.search='';u.hash='';
 window.location.assign(u.toString());
}

/** Supports the JSON object OR Firebase's "const firebaseConfig = {...}" snippet. */
export function parseFirebaseConfig(input:string):GroupConnection['config']{
 const source=input.trim();
 if(source.length>15000)throw Error('The pasted configuration is too long.');
 const marker=source.match(/\bfirebaseConfig\s*=/);
 const start=source.indexOf('{',marker?marker.index!+marker[0].length:0);
 const end=source.indexOf('}',start+1);
 if(start<0||end<0)throw Error('Paste the Firebase web config object from Project settings → Your apps → Config.');
 let body=source.slice(start,end+1);
 body=body.replace(/^\s*\/\/.*$/gm,'').replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g,'$1"$2"$3').replace(/,\s*([}\]])/g,'$1');
 let raw:Record<string,unknown>;
 try{raw=JSON.parse(body) as Record<string,unknown>}catch{throw Error('The web configuration could not be parsed. Copy the Config snippet from Firebase project settings, not service account JSON.')}
 return validateGroup({version:1,name:raw.projectId,config:raw}).config;
}
