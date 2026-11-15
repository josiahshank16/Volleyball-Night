/// <reference types="vite/client" />
import {useState} from 'react';
import {AlertCircle,ArrowRight,CheckCircle2,ExternalLink,KeyRound,Loader2,Volleyball} from 'lucide-react';
import {ModeSwitch,modeHref} from './ModeHome';
import {completeFirebaseSetup} from './provisionFirebase';
import {activateGroup,encodeGroup,type GroupConnection} from './groupConnection';

const STORED_ID='volleyball-night-oauth-pilot-client-id';
const LAST_PROJECT='volleyball-night-last-test-project';
const LAST_GROUP='volleyball-night-last-test-group';
const CONFIGURED_ID=import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string|undefined;
const SCOPE='https://www.googleapis.com/auth/cloud-platform';
type TokenResponse={access_token?:string;error?:string;error_description?:string;scope?:string};
type TokenClient={requestAccessToken:(options?:{prompt?:string})=>void};
type GoogleOAuth={accounts:{oauth2:{initTokenClient:(config:{client_id:string;scope:string;callback:(r:TokenResponse)=>void;error_callback?:(e:{type?:string})=>void})=>TokenClient}}};
declare global {interface Window{google?:GoogleOAuth}}
type Operation={name?:string;done?:boolean;error?:{message?:string;code?:number};response?:unknown};
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function projectIdFor(name:string){
 const slug=name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,15).replace(/-+$/,'')||'group';
 const random=Array.from(crypto.getRandomValues(new Uint8Array(5)),n=>(n%36).toString(36)).join('');
 return `vn-${slug}-${random}`;
}
async function googleRequest<T>(url:string,token:string,method='GET',body?:unknown):Promise<T>{
 let response:Response;
 try{response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
 catch{throw Error('Browser could not reach this Google API. Check network access, browser console, and whether the endpoint permits browser requests.');}
 const raw=await response.text();
 let payload:unknown;
 try{payload=raw?JSON.parse(raw):{};}catch{payload={message:raw.slice(0,500)};}
 if(!response.ok){
  const info=payload as {error?:{message?:string;status?:string};message?:string};
  throw Error(`Google API ${response.status}: ${info.error?.message??info.message??response.statusText}`);
 }
 return payload as T;
}
async function waitOperation(base:string,name:string,token:string){
 for(let i=0;i<30;i++){
  const result=await googleRequest<Operation>(base+'/'+name,token);
  if(result.done){
   if(result.error)throw Error('Google project setup failed: '+(result.error.message??'Unknown operation error.'));
   return result;
  }
  await sleep(1500);
 }
 throw Error('Google accepted the request, but is still processing it. Check your Google Cloud Console before trying another project.');
}
export function GoogleSetupPilot(){
 const [clientId,setClientId]=useState(()=>CONFIGURED_ID||localStorage.getItem(STORED_ID)||'');
 const [groupName,setGroupName]=useState(()=>localStorage.getItem(LAST_GROUP)||'');
 const [agreed,setAgreed]=useState(false);
 const [authorized,setAuthorized]=useState(false);
 const [token,setToken]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const [failure,setFailure]=useState('');
 const [projectId,setProjectId]=useState(()=>localStorage.getItem(LAST_PROJECT)||'');
 const [region,setRegion]=useState('us-central1');
 const [readyGroup,setReadyGroup]=useState<GroupConnection|null>(null);
 const [showTech,setShowTech]=useState(!CONFIGURED_ID);
 async function connect(){
  setFailure('');setStatus('Opening Google authorization…');setAuthorized(false);setToken('');
  if(!clientId.trim()){setFailure('First enter the Google OAuth Web Client ID in the one-time testing settings below.');return;}
  if(!/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId.trim())){setFailure('That does not look like a Google OAuth Web Client ID. It should end in .apps.googleusercontent.com.');return;}
  try{
   localStorage.setItem(STORED_ID,clientId.trim());
   if(!window.google?.accounts?.oauth2)throw Error('Google Identity Services is still loading. Refresh the page and try again.');
   const google=window.google;
   const client=google.accounts.oauth2.initTokenClient({
    client_id:clientId.trim(),scope:SCOPE,
    callback:async r=>{
     if(r.error||!r.access_token){setFailure(r.error_description||r.error||'Google did not provide an access token.');setStatus('');return;}
     // Do not save or display OAuth tokens. The one-time access token stays in component memory.
     setToken(r.access_token);setStatus('Checking Google Cloud API access…');setBusy(true);
     try{
      const result=await googleRequest<{projectId?:string;name?:string}>('https://cloudresourcemanager.googleapis.com/v3/projects/992829373528',r.access_token);
      setAuthorized(true);
      setStatus('Google authorization succeeded. Your browser can reach the Google Cloud project-management API'+(result.name?' for '+result.name:'')+'.');
     }catch(e){setAuthorized(false);setFailure((e as Error).message+' The Google OAuth login worked, but project API access is the next hurdle.');setStatus('');}
     finally{setBusy(false);}
    },
    error_callback:e=>{setFailure('Google sign-in was interrupted: '+(e.type??'unknown popup error'));setStatus('');}
   });
   client.requestAccessToken({prompt:'consent'});
  }catch(e){setFailure((e as Error).message);setStatus('');}
 }
 async function createProject(){
  if(!token||!authorized||!agreed||!groupName.trim())return;
  const id=projectIdFor(groupName);
  if(!window.confirm(`Create a NEW Google Cloud project named "${groupName.trim()}" under the Google account you authorized? Its unique project ID will be "${id}". This test will not modify the existing Volleyball Night project.`))return;
  setBusy(true);setFailure('');setStatus('Requesting a new Google Cloud project…');
  try{
   const created=await googleRequest<Operation>('https://cloudresourcemanager.googleapis.com/v3/projects',token,'POST',{projectId:id,displayName:'Volleyball Night - '+groupName.trim().slice(0,50)});
   setProjectId(id);
   localStorage.setItem(LAST_PROJECT,id);
   localStorage.setItem(LAST_GROUP,groupName.trim());
   if(created.name){
    setStatus('Google accepted the project creation request. Waiting for it to finish…');
    await waitOperation('https://cloudresourcemanager.googleapis.com/v3',created.name,token);
   }
   setStatus('Your independent Cloud project was created! Select Finish Firebase setup to provision the database, rules, web app, and empty session.');
  }catch(e){
   setFailure((e as Error).message);
   setStatus(projectId?'The earlier project may already exist. Check the Cloud Console.':'The setup stopped before completing project creation.');
  }finally{setBusy(false);}
 }

 async function finishFirebase(){
  if(!token||!authorized||!agreed||!projectId||!groupName.trim())return;
  if(!window.confirm(`Complete setup of the existing project ${projectId}? This will enable Firebase APIs, create the default Firestore database in ${region} if missing, publish open prototype rules for this new project, register a web app, and initialize the Volleyball Night session. The database location can't be changed later.`))return;
  setBusy(true);setFailure('');setReadyGroup(null);
  try{
   const group=await completeFirebaseSetup({projectId,groupName,region,token,notify:setStatus});
   setReadyGroup(group);
   setStatus('Success! Firebase, Firestore, rules, a web app, and the first empty session are configured for this group.');
  }catch(e){
   setFailure((e as Error).message);
   setStatus('Setup paused. The successfully completed steps remain in this project. You can retry with the SAME project ID after resolving the error.');
  }finally{setBusy(false);}
 }
 const groupShareUrl=readyGroup?(()=>{
  const u=new URL(location.href);u.search='';u.hash='';
  u.searchParams.set('g',encodeGroup(readyGroup));
  return u.toString();
 })():'';
 function rememberProjectId(v:string){
  setProjectId(v);setReadyGroup(null);
  if(v)localStorage.setItem(LAST_PROJECT,v);
  else localStorage.removeItem(LAST_PROJECT);
 }
 return <div className="group-setup-shell"><header className="group-setup-bar"><div className="vn-home-logo"><Volleyball size={24}/><span>VOLLEYBALL <b>NIGHT</b></span></div><ModeSwitch/></header>
 <main className="group-setup-main">
 <div className="group-setup-heading"><span className="eyebrow">AUTOMATIC SETUP EXPERIMENT</span><h1>Create your volleyball group</h1><p>We're testing whether Google can create each group's own cloud project with a simple sign-in, without GitHub or manual Firebase configuration.</p></div>
 <section className="group-setup-card oauth-pilot-card">
  <div className="group-setup-fields"><label htmlFor="oauth-group-name">Group name<input id="oauth-group-name" placeholder="e.g. Grace Volleyball" value={groupName} maxLength={55} onChange={e=>{setGroupName(e.target.value);localStorage.setItem(LAST_GROUP,e.target.value)}}/></label></div>
  <label className="oauth-agreement"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I authorize Volleyball Night to request Google Cloud project creation on my behalf. I understand this test creates resources under my Google account and that I control any future billing or upgrades.</span></label>
  <button type="button" className="btn primary oauth-google-button" onClick={connect} disabled={busy||!agreed||!groupName.trim()}><KeyRound size={18}/> Continue with Google</button>
  {status&&<p className="oauth-status" role="status">{busy&&<Loader2 size={17}/>} {status}</p>}
  {failure&&<p className="fb-error oauth-error" role="alert"><AlertCircle size={17}/> {failure}</p>}
  {authorized&&<div className="group-setup-ready"><h3><CheckCircle2 size={19}/> Google authorization works!</h3>
   <p>Your browser has successfully accessed the Cloud project-management API using your Google account. This is the first OAuth milestone.</p>
   {!projectId&&<button type="button" className="btn primary" onClick={createProject} disabled={busy}><ArrowRight size={18}/> Create a separate test Cloud project</button>}
   {projectId&&<div className="oauth-finish">
     <p>Existing test project: <code>{projectId}</code></p>
     <p>Next, Volleyball Night will try to add Firebase, create a Firestore database, publish the rules, register a web app, and initialize the first session.</p>
     <label htmlFor="db-region">Firestore location (cannot change later)</label>
     <select id="db-region" value={region} onChange={e=>setRegion(e.target.value)} disabled={busy||!!readyGroup}>
      <option value="us-central1">United States · Iowa (us-central1)</option>
      <option value="nam5">United States · Multi-region (nam5)</option>
      <option value="europe-west1">Europe · Belgium (europe-west1)</option>
      <option value="eur3">Europe · Multi-region (eur3)</option>
     </select>
     {!readyGroup&&<button type="button" className="btn primary" onClick={finishFirebase} disabled={busy||!groupName.trim()}><ArrowRight size={18}/> Finish Firebase and Firestore setup</button>}
     {readyGroup&&<div className="oauth-group-complete">
      <h3><CheckCircle2 size={19}/> {readyGroup.name} is ready!</h3>
      <p>Firebase project: <code>{readyGroup.config.projectId}</code></p>
      <button type="button" className="btn primary" onClick={()=>activateGroup(readyGroup)}>Open this group's Volleyball Night</button>
      <label htmlFor="oauth-share-link">Group link for volunteers</label>
      <input id="oauth-share-link" type="text" readOnly value={groupShareUrl} onFocus={e=>e.currentTarget.select()}/>
      <button type="button" className="btn secondary" onClick={()=>{void navigator.clipboard.writeText(groupShareUrl).catch(()=>window.prompt('Copy your group link:',groupShareUrl))}}>Copy group link</button>
     </div>}
   </div>}
  </div>}
  <details className="oauth-resume-panel"><summary>Resume a project created earlier</summary>
   <p>If you created the test Cloud project before this feature was added, copy its project ID from Google Cloud Console. This resumes setup without creating a second project.</p>
   <label htmlFor="resume-project">Existing test project ID</label>
   <input id="resume-project" value={projectId} onChange={e=>rememberProjectId(e.target.value.trim())} placeholder="vn-grace-volley-abc12"/>
   <p className="group-setup-muted">Your Google authorization is still required. This only remembers the project ID, never the OAuth token.</p>
  </details>
 </section>
 <section className="group-setup-current oauth-advanced">
  <button type="button" className="oauth-settings-toggle" onClick={()=>setShowTech(x=>!x)}>{showTech?'Hide':'Show'} one-time developer configuration</button>
  {showTech&&<div className="oauth-instructions">
   <p>To try OAuth, we must first register <strong>this website</strong> as a Google OAuth client. This is a one-time developer setup, not something future groups will do.</p>
   <ol>
    <li>Open <a href="https://console.cloud.google.com/auth/clients?project=volleyball-night" target="_blank" rel="noreferrer">Google Auth Platform → Clients <ExternalLink size={13}/></a> in the <code>volleyball-night</code> project.</li>
    <li>Configure the OAuth consent screen under Branding / Audience, using <strong>External → Testing</strong> and add your own Google account as a test user. In Data Access, add the <code>https://www.googleapis.com/auth/cloud-platform</code> scope if requested.</li>
    <li>Create a new <strong>Web application</strong> OAuth client. Under <strong>Authorized JavaScript origins</strong> add the <strong>exact origin</strong> of this hosted website (no path or trailing slash): <code>{window.location.origin}</code>.</li>
    <li>Paste its <strong>Client ID</strong> below. This is a public identifier, not a client secret. The app remembers it only in this browser until we configure it centrally.</li>
    <li>If Google says the Cloud Resource Manager API is disabled, enable it in the <code>volleyball-night</code> project and retry. We are testing with your own authorized Google account first.</li>
   </ol>
   <label htmlFor="oauth-client-id">Google OAuth Web Client ID</label>
   <input id="oauth-client-id" placeholder="123456789-abc...apps.googleusercontent.com" value={clientId} onChange={e=>setClientId(e.target.value)}/>
   <p className="group-setup-muted">Do not paste client secrets, service-account files, or login tokens. We never save Google access tokens in local storage.</p>
  </div>}
 </section>
 <p className="oauth-back-link">Already have a Firebase project? <a href={modeHref('manual-setup')}>Use the existing manual Connect Firebase wizard</a>.</p>
 </main></div>;
}
