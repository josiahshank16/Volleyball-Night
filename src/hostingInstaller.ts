import {validateGroup,type GroupConnection} from './groupConnection';

/**
 * Owner-authorized, browser-only installer. No Google credentials or bearer
 * tokens are saved, placed in URLs, or sent to Volleyball Night's own backend.
 *
 * Downloads the currently published static build once, embeds the group's
 * public Firebase configuration in index.html, and uploads it to the owner's
 * Firebase Hosting project via Google's REST API.
 */
type InstallNotify=(message:string)=>void;
type ApiError=Error&{status?:number};
type HostingSite={name?:string;type?:string;defaultUrl?:string};
type HostingVersion={name?:string;status?:string};
type InstallManifest={kind?:string;version?:number;files?:string[]};
type PopulateFiles={uploadUrl?:string;uploadRequiredHashes?:string[]};
const hostingApi='https://firebasehosting.googleapis.com/v1beta1';
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

async function googleApi<T>(url:string,token:string,method='GET',body?:unknown):Promise<T>{
 let response:Response;
 try{
  response=await fetch(url,{method,headers:{
   Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})
  },...(body===undefined?{}:{body:JSON.stringify(body)})});
 }catch{
  throw Error('The browser could not connect to the Firebase Hosting API. Check your browser console for a blocked request or CORS error, then retry this same group.');
 }
 const raw=await response.text();
 let result:unknown={};
 try{result=raw?JSON.parse(raw):{}}catch{result={message:raw.slice(0,250)}}
 if(!response.ok){
  const payload=result as {error?:{message?:string};message?:string};
  const error=new Error('Google Hosting API '+response.status+': '+(payload.error?.message||payload.message||response.statusText)) as ApiError;
  error.status=response.status;
  throw error;
 }
 return result as T;
}

async function enableHostingApi(projectId:string,token:string,notify:InstallNotify){
 const base='https://serviceusage.googleapis.com/v1/projects/'+projectId+'/services/firebasehosting.googleapis.com';
 const service=await googleApi<{state?:string}>(base,token);
 if(service.state==='ENABLED')return;
 notify('Enabling Firebase Hosting for your project…');
 const operation=await googleApi<{name?:string}>(base+':enable',token,'POST',{});
 if(operation.name){
  for(let i=0;i<65;i++){
   const status=await googleApi<{done?:boolean;error?:{message?:string}}>('https://serviceusage.googleapis.com/v1/'+operation.name,token);
   if(status.done){
    if(status.error)throw Error('Google could not enable Hosting: '+(status.error.message||'Unknown error'));
    break;
   }
   if(i===64)throw Error('Google is still enabling Hosting. Retry this same installation shortly.');
   await sleep(1500);
  }
 }
}

async function ensureHostingSite(projectId:string,token:string,notify:InstallNotify){
 const url=hostingApi+'/projects/'+projectId+'/sites';
 for(let attempt=0;attempt<15;attempt++){
  try{
   const list=await googleApi<{sites?:HostingSite[]}>(url,token);
   const existing=list.sites?.find(s=>s.type==='DEFAULT_SITE');
   if(existing){
    const id=existing.name?.split('/').pop();
    if(!id)throw Error('Google listed a Hosting site without an ID.');
    return {siteId:id,url:existing.defaultUrl||'https://'+id+'.web.app'};
   }
   if(projectId.length>30)throw Error('This project ID is too long for a default Hosting site. Use a new group project with a shorter ID.');
   notify('Creating your group’s independent Hosting site…');
   try{
    const created=await googleApi<HostingSite>(url+'?siteId='+encodeURIComponent(projectId),token,'POST',{});
    const id=created.name?.split('/').pop();
    if(!id)throw Error('Google did not return the new Hosting site ID.');
    return {siteId:id,url:created.defaultUrl||'https://'+id+'.web.app'};
   }catch(e){
    if((e as ApiError).status===409)continue; // Retry listing after an interrupted create.
    throw e;
   }
  }catch(e){
   const error=e as ApiError;
   const temporary=error.status===403&&/has not been used|is disabled|SERVICE_DISABLED|not enabled/i.test(error.message);
   if(!temporary||attempt===14)throw e;
   notify('Google is activating Firebase Hosting. Checking again…');
   await sleep(5000);
  }
 }
 throw Error('Hosting site creation did not finish. You can retry this group without creating another project.');
}

async function loadBuildFiles(group:GroupConnection,notify:InstallNotify){
 notify('Preparing the complete Volleyball Night website…');
 const manifestResponse=await fetch('/group-install-manifest.json',{cache:'no-store'});
 if(!manifestResponse.ok)throw Error('The latest website installer manifest is unavailable. Please retry after the hub website finishes deploying.');
 const manifest=await manifestResponse.json() as InstallManifest;
 if(manifest.kind!=='volleyball-night-install-manifest'||manifest.version!==1||
  !Array.isArray(manifest.files)||manifest.files.length===0||manifest.files.length>500||
  !manifest.files.includes('/index.html')){
  throw Error('The published website file manifest is invalid. Installation was not started.');
 }
 const files=new Map<string,ArrayBuffer>();
 const config=JSON.stringify(validateGroup(group)).replace(/</g,'\\u003c')
  .replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 for(const path of manifest.files){
  if(!/^\/[A-Za-z0-9_.\/-]+$/.test(path)||path.split('/').includes('..')||files.has(path)){
   throw Error('The website installer manifest contains an invalid file path.');
  }
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw Error('Could not download website asset '+path+' (HTTP '+response.status+').');
  let data=await response.arrayBuffer();
  if(path==='/index.html'){
   const html=new TextDecoder().decode(data);
   if(!/<\/head>/i.test(html))throw Error('The website build has no HTML head section.');
   const code='<script>window.__VOLLEYBALL_GROUP_CONFIG__='+config+';</script>';
   data=new TextEncoder().encode(html.replace(/<\/head>/i,code+'</head>')).buffer as ArrayBuffer;
  }
  files.set(path,data);
 }
 return files;
}

async function packFiles(files:Map<string,ArrayBuffer>){
 if(typeof CompressionStream==='undefined')throw Error('Your browser does not support gzip compression needed to install Hosting. Please try a current version of Chrome, Firefox, or Safari.');
 const payload=new Map<string,{hash:string;compressed:ArrayBuffer}>();
 for(const [path,data] of files){
  const compressed=await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',compressed);
  const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  payload.set(path,{hash,compressed});
 }
 return payload;
}

async function uploadRequired(url:string,hash:string,buffer:ArrayBuffer,token:string){
 const uploadBase=new URL(url);
 if(uploadBase.protocol!=='https:'||uploadBase.hostname!=='upload-firebasehosting.googleapis.com'){
  throw Error('Google supplied an unexpected Hosting upload location. The installation was stopped.');
 }
 let response:Response;
 try{
  response=await fetch(url.replace(/\/$/,'')+'/'+hash,{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:buffer
  });
 }catch{
  throw Error('The browser could not upload an app file to Firebase Hosting (possibly a browser CORS restriction). The original group website still works; retrying will not create another group.');
 }
 if(!response.ok)throw Error('Hosting file upload failed (HTTP '+response.status+'): '+(await response.text()).slice(0,220));
}

export async function installIndependentGroupWebsite(input:{
 group:GroupConnection;token:string;notify:InstallNotify;
}):Promise<string>{
 const {token,notify}=input;
 const group=validateGroup(input.group),projectId=group.config.projectId;
 if(!/^vn-[a-z0-9-]{3,54}$/.test(projectId))throw Error('Automatic installation is currently supported for groups created through Volleyball Night.');
 // Load and validate the full published build before changing the group's Hosting.
 const built=await loadBuildFiles(group,notify);
 const packed=await packFiles(built);
 await enableHostingApi(projectId,token,notify);
 const site=await ensureHostingSite(projectId,token,notify);
 const siteId=site.siteId;
 notify('Creating a website release for your group…');
 const version=await googleApi<HostingVersion>(hostingApi+'/sites/'+siteId+'/versions',token,'POST',{
  config:{
   rewrites:[{glob:'**',path:'/index.html'}],
   headers:[
    {glob:'/index.html',headers:{'Cache-Control':'no-cache, no-store, must-revalidate'}},
    {glob:'/assets/**',headers:{'Cache-Control':'public, max-age=31536000, immutable'}}
   ]
  }
 });
 if(!version.name||!version.name.startsWith('sites/'+siteId+'/versions/')){
  throw Error('Google did not provide a valid Hosting release identifier.');
 }
 const fileHashes:Object=Object.fromEntries(Array.from(packed,([path,item])=>[path,item.hash]));
 const populated=await googleApi<PopulateFiles>(hostingApi+'/'+version.name+':populateFiles',token,'POST',{files:fileHashes});
 const required=new Set(populated.uploadRequiredHashes||[]);
 if(required.size&&!populated.uploadUrl)throw Error('Google did not provide a Hosting upload URL.');
 for(const [path,item] of packed){
  if(!required.has(item.hash))continue;
  notify('Uploading website files to your Firebase project…');
  await uploadRequired(populated.uploadUrl!,item.hash,item.compressed,token);
  required.delete(item.hash);
 }
 if(required.size)throw Error('Google requested a website asset that was not in the installer package.');
 notify('Publishing your independent Volleyball Night website…');
 const finalized=await googleApi<HostingVersion>(hostingApi+'/'+version.name+'?update_mask=status',token,'PATCH',{status:'FINALIZED'});
 if(finalized.status!=='FINALIZED')throw Error('Google has not finished preparing the website release.');
 await googleApi(hostingApi+'/sites/'+siteId+'/releases?versionName='+encodeURIComponent(version.name),token,'POST',{});
 notify('Your group’s independent website has been published.');
 return site.url;
}
