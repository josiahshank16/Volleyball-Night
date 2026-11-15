/// <reference types="vite/client" />
import {useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,ExternalLink,FolderOpen,Loader2,RefreshCw,ShieldCheck,Volleyball} from 'lucide-react';
import {ModeSwitch} from './ModeHome';
import {encodeGroup,validateGroup,type GroupConnection} from './groupConnection';

// Discovery is read-only. Google access tokens are used in memory only.
const CONFIGURED_ID=import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string|undefined;
const SCOPE='https://www.googleapis.com/auth/firebase.readonly';
// Google Identity Services types are declared by GoogleSetupPilot.
type FirebaseProject={projectId?:string;displayName?:string;state?:string};
type ProjectPage={results?:FirebaseProject[];nextPageToken?:string};
type WebApp={name?:string;displayName?:string};
type WebAppsPage={apps?:WebApp[];nextPageToken?:string};
type ListedGroup={id:string;name:string;group?:GroupConnection;issue?:string};

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
    return {id,name:label,group};
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
 function findGroups(){
  if(loading)return;
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
 return <div className="group-setup-shell">
  <header className="group-setup-bar"><div className="vn-home-logo"><Volleyball size={24}/><span>VOLLEYBALL <b>NIGHT</b></span></div><ModeSwitch/></header>
  <main className="group-setup-main vn-wizard-main">
   <div className="group-setup-heading"><span className="eyebrow">YOUR VOLLEYBALL GROUPS</span>
    <h1>Find my groups</h1>
    <p>Sign in with Google to find the Volleyball Night groups whose Firebase projects you can access. You can open a group from any browser, even if you've never used that browser before.</p>
   </div>
   <section className="group-setup-card vn-my-groups">
    <button className="btn primary vn-my-groups-signin" type="button" disabled={loading} onClick={findGroups}>
     {loading?<Loader2 size={19} className="vn-wizard-spinner"/>:groups?<RefreshCw size={19}/>:<ShieldCheck size={19}/>}
     {loading?'Finding your groups…':groups?'Search another Google account':'Find groups with Google'}
    </button>
    {loading&&<p className="vn-my-groups-status" role="status"><Loader2 size={15} className="vn-wizard-spinner"/>{status}</p>}
    {error&&<div className="vn-wizard-error" role="alert"><strong>We couldn't finish finding your groups</strong><p>{error}</p><p>Nothing was changed in any Firebase project. You can select your account again.</p></div>}
    {groups!==null&&!loading&&<div className="vn-my-groups-results">
     <div className="vn-my-groups-results-head"><h2>{finished?'Your groups':'No completed groups found'}</h2><span>{finished} ready · {groups.length} project{groups.length===1?'':'s'} found</span></div>
     {!groups.length&&<p>No Volleyball Night Firebase projects were visible to that Google account. If you created your group using a different Google account, select it above.</p>}
     {groups.map(item=>{
      const url=item.group?'https://volleyball-night.web.app/?g='+encodeGroup(item.group):'';
      return <div className="vn-my-group-item" key={item.id}>
       <div className="vn-my-group-icon"><FolderOpen size={23}/></div>
       <div className="vn-my-group-details"><strong>{item.name}</strong><small>{item.id}</small>
        {item.group?<span className="vn-my-group-ready"><CheckCircle2 size={14}/> Ready to open</span>:
         <span className="vn-my-group-unavailable">{item.issue}</span>}
       </div>
       {item.group?<a className="btn primary" href={url}>Open group <ArrowRight size={16}/></a>:
        <a className="btn secondary" href={'https://console.firebase.google.com/project/'+item.id+'/overview'} target="_blank" rel="noopener noreferrer">View project <ExternalLink size={15}/></a>}
      </div>;
     })}
     <p className="vn-my-groups-note">This shows Google Cloud/Firebase projects accessible to the Google account you selected. Groups you joined only with a share link may not appear here; those links still work. For now, Open group uses the central website while independent Hosting is being tested.</p>
    </div>}
   </section>
   <a className="vn-my-groups-create" href="/?mode=setup"><ArrowLeft size={16}/> Need a new group? Create one here</a>
  </main>
 </div>;
}
