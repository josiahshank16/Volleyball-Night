/// <reference types="vite/client" />
import {useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,ExternalLink,FolderOpen,Globe2,Loader2,RefreshCw,ShieldCheck,Volleyball} from 'lucide-react';
import {ModeSwitch} from './ModeHome';
import {encodeGroup,validateGroup,type GroupConnection} from './groupConnection';
import {installIndependentGroupWebsite} from './hostingInstaller';

// Discovery is read-only. Google access tokens are used in memory only.
const CONFIGURED_ID=import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string|undefined;
const SCOPE='https://www.googleapis.com/auth/firebase.readonly';
const INSTALL_SCOPE='https://www.googleapis.com/auth/cloud-platform';
// Google Identity Services types are declared by GoogleSetupPilot.
type FirebaseProject={projectId?:string;displayName?:string;state?:string};
type ProjectPage={results?:FirebaseProject[];nextPageToken?:string};
type WebApp={name?:string;displayName?:string};
type WebAppsPage={apps?:WebApp[];nextPageToken?:string};
type HostingSite={name?:string;type?:string;defaultUrl?:string};
type ListedGroup={id:string;name:string;group?:GroupConnection;siteUrl?:string;hostingIssue?:string;issue?:string};

async function fetchGoogle<T>(url:string,token:string):Promise<T>{
 let response:Response;
 try{response=await fetch(url,{headers:{Authorization:'Bearer '+token}})}
 catch{throw Error('Could not connect to Google. Check your network connection and try again.')}
 const raw=await response.text();
 if(!response.ok){
  let message=raw.slice(0,200);
  try{message=(JSON.parse(raw) as {error?:{message?:string}}).error?.message||message}catch{/* Original response is enough. */}
  throw Error('Google API '+response.status+': '+message);
 }
 return JSON.parse(raw||'{}') as T;
}

async function publishedGroupUrl(projectId:string,token:string):Promise<string|undefined>{
 let pageToken='';
 for(let page=0;page<10;page++){
  const query=new URLSearchParams({pageSize:'100'});
  if(pageToken)query.set('pageToken',pageToken);
  const result=await fetchGoogle<{sites?:HostingSite[];nextPageToken?:string}>(
   'https://firebasehosting.googleapis.com/v1beta1/projects/'+encodeURIComponent(projectId)+'/sites?'+query,token);
  const site=result.sites?.find(item=>item.type==='DEFAULT_SITE');
  if(site?.name&&site.defaultUrl){
   const siteId=site.name.split('/').pop();
   if(!siteId||!/^[-a-z0-9]{1,30}$/.test(siteId))throw Error('Google returned an invalid Hosting site ID.');
   const url=new URL(site.defaultUrl);
   if(url.protocol!=='https:'||url.hostname!==siteId+'.web.app')throw Error('Google returned an unexpected Hosting address.');
   // An empty site is not a working group website. Check the live channel,
   // rather than mistaking a Hosting site created by a failed install for one.
   const releases=await fetchGoogle<{releases?:unknown[]}>(
    'https://firebasehosting.googleapis.com/v1beta1/sites/'+siteId+'/channels/live/releases?pageSize=1',token);
   return releases.releases?.length?url.origin+'/':undefined;
  }
  pageToken=result.nextPageToken||'';
  if(!pageToken)return undefined;
 }
 throw Error('Google returned too many Hosting sites to check.');
}

async function discoverGroups(token:string,notify:(message:string)=>void):Promise<ListedGroup[]>{
 // Firebase only lists projects visible to the selected Google account.
 // Follow the paginated API instead of assuming the first page is complete.
 const projects:FirebaseProject[]=[];
 let pageToken='';
 const visited=new Set<string>();
 for(let page=0;page<100;page++){
  const query=new URLSearchParams({pageSize:'100'});
  if(pageToken)query.set('pageToken',pageToken);
  const result=await fetchGoogle<ProjectPage>('https://firebase.googleapis.com/v1beta1/projects?'+query,token);
  projects.push(...(result.results||[]));
  if(!result.nextPageToken){pageToken='';break}
  if(visited.has(result.nextPageToken))throw Error('Google returned a repeated project-list page. Please try again.');
  visited.add(result.nextPageToken);
  pageToken=result.nextPageToken;
 }
 if(pageToken)throw Error('The Google account has too many projects to list completely. No partial group list was shown.');
 const candidates=projects.filter(p=>p.projectId?.startsWith('vn-')&&p.state!=='DELETE_REQUESTED');
 notify(candidates.length?'Checking '+candidates.length+' Volleyball Night project(s)…':'No Volleyball Night projects were found.');
 // Keep requests bounded even for accounts with many test groups.
 const output:ListedGroup[]=[];
 for(let i=0;i<candidates.length;i+=4){
  const chunk=candidates.slice(i,i+4);
  const found=await Promise.all(chunk.map(async project=>{
   const id=project.projectId!;
   const label=(project.displayName||id).replace(/^(?:VN - |Volleyball Night - )/i,'').trim()||id;
   try{
    let apps:WebApp[]=[];
    let tokenPage='';
    const seen=new Set<string>();
    for(let page=0;page<25;page++){
     const query=new URLSearchParams({pageSize:'100'});
     if(tokenPage)query.set('pageToken',tokenPage);
     const list=await fetchGoogle<WebAppsPage>('https://firebase.googleapis.com/v1beta1/projects/'+encodeURIComponent(id)+'/webApps?'+query,token);
     apps.push(...(list.apps||[]));
     tokenPage=list.nextPageToken||'';
     if(!tokenPage)break;
     if(seen.has(tokenPage))throw Error('Google returned a repeated app-list page.');
     seen.add(tokenPage);
    }
    const matching=apps.find(app=>app.displayName==='Volleyball Night'&&app.name?.startsWith('projects/'+id+'/webApps/'));
    if(!matching?.name)return {id,name:label,issue:'This project has no completed Volleyball Night web app yet.'};
    const config=await fetchGoogle<unknown>('https://firebase.googleapis.com/v1beta1/'+matching.name+'/config',token);
    const group=validateGroup({version:1,name:label,config});
    try{
     const siteUrl=await publishedGroupUrl(id,token);
     return {id,name:label,group,siteUrl};
    }catch(error){
     // Existing group links still work if Hosting is not enabled or its API
     // cannot be read. Do not guess a group's independent URL.
     return {id,name:label,group,hostingIssue:(error as Error)?.message||'Website status unavailable.'};
    }
   }catch(error){
    return {id,name:label,issue:(error as Error)?.message||'Google could not read this project.'};
   }
  }));
  output.push(...found);
  notify('Found '+output.length+' of '+candidates.length+' project(s)…');
 }
 output.sort((a,b)=>a.name.localeCompare(b.name));
 return output;
}

export function MyGroups(){
 const [loading,setLoading]=useState(false);
 const [status,setStatus]=useState('');
 const [error,setError]=useState('');
 const [groups,setGroups]=useState<ListedGroup[]|null>(null);
 const [updating,setUpdating]=useState<string|null>(null);
 const [updateStatus,setUpdateStatus]=useState<Record<string,string>>({});
 const [updateError,setUpdateError]=useState<Record<string,string>>({});
 function updateWebsite(item:ListedGroup){
  if(!item.group||updating||loading)return;
  if(!window.confirm(`${item.siteUrl?'Update':'Install'} the independent website for ${item.name} (${item.id})? This publishes the current Volleyball Night app to that group's Firebase Hosting project. Its player data stays in its existing Firestore database.`))return;
  if(!CONFIGURED_ID||!window.google?.accounts?.oauth2){
   setUpdateError(v=>({...v,[item.id]:'Google sign-in is unavailable. Refresh the page and try again.'}));return;
  }
  setUpdating(item.id);
  setUpdateError(v=>({...v,[item.id]:''}));
  setUpdateStatus(v=>({...v,[item.id]:'Select the Google account that owns this group…'}));
  try{
   const oauth=window.google.accounts.oauth2.initTokenClient({
    client_id:CONFIGURED_ID,scope:INSTALL_SCOPE,
    callback:result=>{
     if(!result.access_token||result.error){
      setUpdateError(v=>({...v,[item.id]:result.error_description||result.error||'Google authorization was not completed.'}));
      setUpdating(null);return;
     }
     void installIndependentGroupWebsite({group:item.group!,token:result.access_token,
      notify:message=>setUpdateStatus(v=>({...v,[item.id]:message}))})
      .then(siteUrl=>{
       setGroups(current=>current?.map(group=>group.id===item.id?{...group,siteUrl,hostingIssue:undefined}:group)??null);
       setUpdateStatus(v=>({...v,[item.id]:'Website published. Open the group to see the new version.'}));
      })
      .catch(err=>setUpdateError(v=>({...v,[item.id]:(err as Error)?.message||String(err)})))
      .finally(()=>setUpdating(null));
    },
    error_callback:e=>{
     setUpdateError(v=>({...v,[item.id]:'Google sign-in was interrupted: '+(e.type||'popup closed')}));
     setUpdating(null);
    }
   });
   oauth.requestAccessToken({prompt:'select_account'});
  }catch(e){setUpdateError(v=>({...v,[item.id]:(e as Error)?.message||String(e)}));setUpdating(null)}
 }
 function findGroups(){
  if(loading||updating)return;
  setError('');setGroups(null);
  if(!CONFIGURED_ID||!window.google?.accounts?.oauth2){
   setError('Google sign-in is not available yet. Refresh the page and try again.');return;
  }
  setLoading(true);setStatus('Choose your Google account…');
  try{
   const oauth=window.google.accounts.oauth2.initTokenClient({
    client_id:CONFIGURED_ID,scope:SCOPE,
    callback:result=>{
     if(!result.access_token||result.error){
      setLoading(false);setError(result.error_description||result.error||'Google authorization was not completed.');return;
     }
     void discoverGroups(result.access_token,setStatus).then(found=>{
      setGroups(found);setStatus('');
     }).catch(err=>setError((err as Error)?.message||String(err)))
      .finally(()=>setLoading(false));
    },
    error_callback:e=>{
     setLoading(false);setError('Google sign-in was interrupted: '+(e.type||'popup closed'));
    }
   });
   oauth.requestAccessToken({prompt:'select_account'});
  }catch(e){setLoading(false);setError((e as Error)?.message||String(e))}
 }
 const finished=groups?.filter(group=>group.group).length??0;
 const independent=groups?.filter(group=>group.siteUrl).length??0;
 return <div className="group-setup-shell">
  <header className="group-setup-bar"><div className="vn-home-logo"><Volleyball size={24}/><span>VOLLEYBALL <b>NIGHT</b></span></div><ModeSwitch/></header>
  <main className="group-setup-main vn-wizard-main">
   <div className="group-setup-heading"><span className="eyebrow">YOUR VOLLEYBALL GROUPS</span>
    <h1>Find my groups</h1>
    <p>Sign in with Google to find the Volleyball Night groups whose Firebase projects you can access. You can open a group from any browser, even if you've never used that browser before.</p>
   </div>
   <section className="group-setup-card vn-my-groups">
    <button className="btn primary vn-my-groups-signin" type="button" disabled={loading||!!updating} onClick={findGroups}>
     {loading?<Loader2 size={19} className="vn-wizard-spinner"/>:groups?<RefreshCw size={19}/>:<ShieldCheck size={19}/>}
     {loading?'Finding your groups…':groups?'Search another Google account':'Find groups with Google'}
    </button>
    {loading&&<p className="vn-my-groups-status" role="status"><Loader2 size={15} className="vn-wizard-spinner"/>{status}</p>}
    {error&&<div className="vn-wizard-error" role="alert"><strong>We couldn't finish finding your groups</strong><p>{error}</p><p>Nothing was changed in any Firebase project. You can select your account again.</p></div>}
    {groups!==null&&!loading&&<div className="vn-my-groups-results">
     <div className="vn-my-groups-results-head"><h2>{finished?'Your groups':'No completed groups found'}</h2><span>{independent} independent · {finished} group{finished===1?'':'s'} found</span></div>
     {!groups.length&&<p>No Volleyball Night Firebase projects were visible to that Google account. If you created your group using a different Google account, select it above.</p>}
     {groups.map(item=>{
      const url=item.siteUrl|| (item.group?'https://volleyball-night.web.app/?g='+encodeGroup(item.group):'');
      return <div className="vn-my-group-item" key={item.id}>
       <div className="vn-my-group-icon"><FolderOpen size={23}/></div>
       <div className="vn-my-group-details"><strong>{item.name}</strong><small>{item.id}</small>
        {item.group?<span className="vn-my-group-ready"><CheckCircle2 size={14}/>{item.siteUrl?'Independent website':'Legacy group link'}</span>:
         <span className="vn-my-group-unavailable">{item.issue}</span>}
        {item.hostingIssue&&<small>Website status could not be checked. The legacy link is available.</small>}
       </div>
       {item.group?<div className="vn-my-group-actions"><a className="btn primary" href={url}>{item.siteUrl?'Open group':'Open legacy group'} <ArrowRight size={16}/></a>
        <button className="btn secondary" type="button" disabled={!!updating} onClick={()=>updateWebsite(item)}>
         {updating===item.id?<Loader2 size={16} className="vn-wizard-spinner"/>:<Globe2 size={16}/>}
         {updating===item.id?'Publishing…':item.siteUrl?'Update website':'Install website'}
        </button></div>:
        <a className="btn secondary" href={'https://console.firebase.google.com/project/'+item.id+'/overview'} target="_blank" rel="noopener noreferrer">View project <ExternalLink size={15}/></a>}
       {(updateStatus[item.id]||updateError[item.id])&&<div className="vn-my-group-feedback" role={updateError[item.id]?'alert':'status'}>
        {updateError[item.id]||updateStatus[item.id]}
       </div>}
      </div>;
     })}
     <p className="vn-my-groups-note">Independent groups open on their own websites. Website updates require the Google account with access to that group and change its app files, not its saved players or games. Older groups without a published site can still use their original link. Groups you joined only with a share link may not appear here.</p>
    </div>}
   </section>
   <a className="vn-my-groups-create" href="/?mode=setup"><ArrowLeft size={16}/> Need a new group? Create one here</a>
  </main>
 </div>;
}
