import {useState} from 'react';
import {AlertCircle,ArrowRight,CheckCircle2,ExternalLink,KeyRound,Loader2,Volleyball} from 'lucide-react';
import {ModeSwitch,modeHref} from './ModeHome';

const STORED_ID='volleyball-night-oauth-pilot-client-id';
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
 const [groupName,setGroupName]=useState('');
 const [agreed,setAgreed]=useState(false);
 const [authorized,setAuthorized]=useState(false);
 const [token,setToken]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const [failure,setFailure]=useState('');
 const [projectId,setProjectId]=useState('');
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
   if(created.name){
    setStatus('Google accepted the project creation request. Waiting for it to finish…');
    await waitOperation('https://cloudresourcemanager.googleapis.com/v3',created.name,token);
   }
   setStatus('Success! Google created your independent Cloud project. The next phase is automatically adding Firebase and Firestore to this project.');
  }catch(e){
   setFailure((e as Error).message);
   setStatus(projectId?'The earlier project may already exist. Check the Cloud Console.':'The setup stopped before completing project creation.');
  }finally{setBusy(false);}
 }
 return <div className="group-setup-shell"><header className="group-setup-bar"><div className="vn-home-logo"><Volleyball size={24}/><span>VOLLEYBALL <b>NIGHT</b></span></div><ModeSwitch/></header>
 <main className="group-setup-main">
 <div className="group-setup-heading"><span className="eyebrow">AUTOMATIC SETUP EXPERIMENT</span><h1>Create your volleyball group</h1><p>We're testing whether Google can create each group's own cloud project with a simple sign-in, without GitHub or manual Firebase configuration.</p></div>
 <section className="group-setup-card oauth-pilot-card">
  <div className="group-setup-fields"><label htmlFor="oauth-group-name">Group name<input id="oauth-group-name" placeholder="e.g. Grace Volleyball" value={groupName} maxLength={55} onChange={e=>setGroupName(e.target.value)}/></label></div>
  <label className="oauth-agreement"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I authorize Volleyball Night to request Google Cloud project creation on my behalf. I understand this test creates resources under my Google account and that I control any future billing or upgrades.</span></label>
  <button type="button" className="btn primary oauth-google-button" onClick={connect} disabled={busy||!agreed||!groupName.trim()}><KeyRound size={18}/> Continue with Google</button>
  {status&&<p className="oauth-status" role="status">{busy&&<Loader2 size={17}/>} {status}</p>}
  {failure&&<p className="fb-error oauth-error" role="alert"><AlertCircle size={17}/> {failure}</p>}
  {authorized&&<div className="group-setup-ready"><h3><CheckCircle2 size={19}/> Google authorization works!</h3>
   <p>Your browser has successfully accessed the Cloud project-management API using your Google account. This is the first OAuth milestone.</p>
   {!projectId&&<button type="button" className="btn primary" onClick={createProject} disabled={busy}><ArrowRight size={18}/> Create a separate test Cloud project</button>}
   {projectId&&<p>Test project ID: <code>{projectId}</code></p>}
  </div>}
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
