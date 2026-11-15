/// <reference types="vite/client" />
import {useRef,useState} from 'react';
import {AlertCircle,ArrowRight,CheckCircle2,Copy,ExternalLink,KeyRound,Loader2,RotateCcw,Volleyball} from 'lucide-react';
import {ModeSwitch,modeHref} from './ModeHome';
import {completeFirebaseSetup} from './provisionFirebase';
import {activateGroup,encodeGroup,validateGroup,GROUP_STORAGE_KEY,type GroupConnection} from './groupConnection';
import {allocateCheckpoint,clearCheckpoint,COMPLETED_KEY,ensureCloudProject,readCheckpoint,saveCheckpoint,type SetupCheckpoint} from './cloudProject';

const OAUTH_ID_KEY='volleyball-night-oauth-pilot-client-id';
const CONFIGURED_ID=import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string|undefined;
const SCOPE='https://www.googleapis.com/auth/cloud-platform';
const FIREBASE_TERMS_URL='https://console.firebase.google.com/?forceCheckTos=true';
type TokenResponse={access_token?:string;error?:string;error_description?:string};
type TokenClient={requestAccessToken:(options?:{prompt?:string})=>void};
type OAuthGoogle={accounts:{oauth2:{initTokenClient:(config:{
 client_id:string;scope:string;callback:(r:TokenResponse)=>void;
 error_callback?:(e:{type?:string})=>void
})=>TokenClient}}};
declare global {interface Window{google?:OAuthGoogle}}

function completedFor(checkpoint:SetupCheckpoint|null):GroupConnection|null{
 if(!checkpoint)return null;
 try{
  const stored=localStorage.getItem(COMPLETED_KEY);
  if(stored){
   const item=JSON.parse(stored) as {projectId?:string;group?:unknown};
   if(item.projectId===checkpoint.projectId)return validateGroup(item.group);
  }
  // Migrate a group that was successfully connected through the old two-button pilot.
  const legacy=localStorage.getItem(GROUP_STORAGE_KEY);
  if(legacy){
   const group=validateGroup(JSON.parse(legacy));
   if(group.config.projectId===checkpoint.projectId)return group;
  }
 }catch{/* No matching previously completed group. */}
 return null;
}
function getShareLink(group:GroupConnection){
 const url=new URL(location.href);
 url.search='';url.hash='';url.searchParams.set('g',encodeGroup(group));
 return url.toString();
}
type ProgressStep=0|1|2|3;
const progressLabels=['Google account','Group project','Database and workspace','Ready to play'];
function progressOf(step:ProgressStep,active:ProgressStep){
 return step<active?'done':step===active?'active':'future';
}
export function GoogleSetupPilot(){
 const initialCheckpoint=readCheckpoint();
 const [checkpoint,setCheckpoint]=useState<SetupCheckpoint|null>(initialCheckpoint);
 const checkpointRef=useRef<SetupCheckpoint|null>(initialCheckpoint);
 const [name,setName]=useState(initialCheckpoint?.groupName||'');
 const [region,setRegion]=useState(initialCheckpoint?.region||'us-central1');
 const [agreed,setAgreed]=useState(false);
 const [clientId,setClientId]=useState(()=>CONFIGURED_ID||localStorage.getItem(OAUTH_ID_KEY)||'');
 const [showDev,setShowDev]=useState(false);
 const [showAdvanced,setShowAdvanced]=useState(false);
 const [manualId,setManualId]=useState('');
 const [busy,setBusy]=useState(false);
 const busyRef=useRef(false);
 const [authorizing,setAuthorizing]=useState(false);
 const authorizingRef=useRef(false);
 const [phase,setPhase]=useState<ProgressStep>(initialCheckpoint?.stage==='complete'?3:0);
 const [status,setStatus]=useState(initialCheckpoint?.stage==='complete'?'':initialCheckpoint?'Your earlier setup was saved. Continue with Google to finish it.':'');
 const [technical,setTechnical]=useState('');
 const technicalRef=useRef('');
 const [error,setError]=useState('');
 const [needTerms,setNeedTerms]=useState(false);
 const [ready,setReady]=useState<GroupConnection|null>(()=>completedFor(initialCheckpoint));
 const [copied,setCopied]=useState(false);

 function remember(next:SetupCheckpoint){
  checkpointRef.current=next;
  setCheckpoint(next);
  saveCheckpoint(next);
 }
 function progress(message:string){
  technicalRef.current=message;
  setTechnical(message);
  const s=message.toLowerCase();
  if(s.includes('firestore')||s.includes('database')||s.includes('rules')||s.includes('web app')||s.includes('session')){
   setPhase(2);
   setStatus('Preparing your group database and volleyball workspace…');
  }else if(s.includes('firebase')||s.includes('api')){
   setPhase(2);
   setStatus('Connecting Firebase to your group…');
  }else{
   setStatus('Setting up your group…');
  }
 }
 async function finishWithToken(token:string){
  const current=checkpointRef.current||allocateCheckpoint(name.trim(),region);
  // Persist before the first network request. An interrupted POST can then be resumed
  // with exactly the same project ID instead of making an unwanted second project.
  remember(current);
  setBusy(true);busyRef.current=true;
  setError('');setNeedTerms(false);setReady(null);setCopied(false);
  try{
   setPhase(1);
   await ensureCloudProject(current,token,message=>{
    technicalRef.current=message;
    setTechnical(message);
    setStatus('Creating your group-owned cloud project…');
   });
   const created={...current,stage:'created' as const,updatedAt:Date.now()};
   remember(created);
   setPhase(2);setStatus('Preparing Firebase and your player database…');
   const group=await completeFirebaseSetup({
    projectId:created.projectId,groupName:created.groupName,
    region:created.region,token,notify:progress
   });
   const done={...created,stage:'complete' as const,updatedAt:Date.now()};
   localStorage.setItem(COMPLETED_KEY,JSON.stringify({projectId:done.projectId,group}));
   remember(done);
   setReady(group);setPhase(3);setStatus('Your group is ready!');setTechnical('');
  }catch(err){
   const message=(err as Error)?.message||String(err);
   setError(message);
   const firebaseStep=/firebase|adding firebase|firebase.googleapis.com/i.test(technicalRef.current);
   setNeedTerms(/terms of service|firebase terms|accept.*terms|\btos\b/i.test(message)||
    (message.includes('403')&&firebaseStep));
   setStatus('Setup paused. Your progress is saved; continuing will reuse the same project.');
  }finally{busyRef.current=false;setBusy(false);}
 }
 function continueWithGoogle(){
  if(busyRef.current||authorizingRef.current)return;
  setError('');setNeedTerms(false);
  if(!checkpointRef.current&&(!name.trim()||!agreed)){
   setError('Enter a group name and accept the setup agreement first.');return;
  }
  if(checkpointRef.current&&!agreed){
   setError('Please confirm the setup agreement before continuing.');return;
  }
  if(!clientId.trim()){
   setShowDev(true);
   setError('Our Google OAuth client needs to be configured once by the developer before this preview can run.');return;
  }
  if(!/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId.trim())){
   setShowDev(true);setError('The Google OAuth Client ID should end in .apps.googleusercontent.com.');return;
  }
  if(!window.google?.accounts?.oauth2){
   setError('Google sign-in is still loading. Refresh this page and try again.');return;
  }
  localStorage.setItem(OAUTH_ID_KEY,clientId.trim());
  setStatus('Opening Google sign-in…');setPhase(0);
  authorizingRef.current=true;setAuthorizing(true);
  try{
   const client=window.google.accounts.oauth2.initTokenClient({
    client_id:clientId.trim(),scope:SCOPE,
    callback:r=>{
     authorizingRef.current=false;setAuthorizing(false);
     if(!r.access_token||r.error){
      setError(r.error_description||r.error||'Google did not provide authorization.');
      setStatus('');return;
     }
     // Access token is used only in this callback's memory, never in storage or URLs.
     void finishWithToken(r.access_token);
    },
    error_callback:e=>{
     authorizingRef.current=false;setAuthorizing(false);
     setError('Google sign-in was interrupted: '+(e.type||'popup closed'));
     setStatus('Your setup is still saved. Continue again whenever you are ready.');
    }
   });
   client.requestAccessToken({prompt:'consent'});
  }catch(err){
   authorizingRef.current=false;setAuthorizing(false);
   setError((err as Error).message);setStatus('');
  }
 }
 function startNew(){
  if(busyRef.current||authorizingRef.current)return;
  if(checkpointRef.current&&!window.confirm(
   'Start setting up a DIFFERENT group? This will clear only the saved setup progress in this browser. Any Google Cloud project already created will remain in your Google account.'))return;
  clearCheckpoint();localStorage.removeItem(COMPLETED_KEY);
  checkpointRef.current=null;setCheckpoint(null);setName('');setRegion('us-central1');
  setAgreed(false);setReady(null);setError('');setNeedTerms(false);setPhase(0);
  setStatus('');setTechnical('');setManualId('');setCopied(false);
 }
 function restoreProject(){
  if(busyRef.current||authorizingRef.current)return;
  const id=manualId.trim();
  if(!/^vn-[a-z0-9-]{3,54}$/.test(id)){setError('Enter a Volleyball Night test project ID starting with vn-.');return;}
  if(!name.trim()){setError('Enter the original group name before resuming a project.');return;}
  if(checkpointRef.current?.projectId!==id&&!window.confirm(
   'Resume the project '+id+'? Make sure it is the project you created and own. This will replace the saved setup checkpoint in this browser.'))return;
  remember({version:1,projectId:id,groupName:name.trim(),region,stage:'created',updatedAt:Date.now()});
  setReady(null);setError('');setStatus('Project saved. Continue with Google to finish this group.');
  setShowAdvanced(false);
 }
 const groupLink=ready?getShareLink(ready):'';
 const subtitle=ready?'Everything is connected. Your players and games are stored in your group’s own Firebase project.':
  checkpoint?'Your group setup is saved and will continue without creating another project.':
  'Create a separate cloud workspace for your volleyball group. No GitHub account or manual Firebase configuration needed.';
 return <div className="group-setup-shell">
  <header className="group-setup-bar"><div className="vn-home-logo"><Volleyball size={24}/><span>VOLLEYBALL <b>NIGHT</b></span></div><ModeSwitch/></header>
  <main className="group-setup-main vn-wizard-main">
   <div className="group-setup-heading"><span className="eyebrow">SET UP YOUR GROUP</span>
    <h1>{ready?'Your group is ready!':checkpoint?'Finish your group setup':'Welcome to Volleyball Night'}</h1>
    <p>{subtitle}</p>
   </div>
   <section className="group-setup-card vn-wizard-card">
    {!ready&&<>
     <div className="group-setup-fields">
      <label htmlFor="wizard-name">Group name
       <input id="wizard-name" maxLength={55} value={name} disabled={!!checkpoint||busy}
        onChange={e=>setName(e.target.value)} placeholder="e.g. Community Volleyball"/>
      </label>
     </div>
     <label className="oauth-agreement">
      <input type="checkbox" checked={agreed} disabled={busy} onChange={e=>setAgreed(e.target.checked)}/>
      <span>I authorize Volleyball Night to create and configure a Google Cloud/Firebase project in my Google account. I understand that I own the project and any future billing or upgrades.</span>
     </label>
     <div className="vn-wizard-region-note">
      Database region: <strong>{region==='us-central1'?'United States (Iowa)':region==='nam5'?'United States (multi-region)':region==='europe-west1'?'Europe (Belgium)':'Europe (multi-region)'}</strong>
      <button type="button" disabled={busy||!!checkpoint} onClick={()=>setShowAdvanced(v=>!v)}>Change</button>
     </div>
     {showAdvanced&&!checkpoint&&<label className="vn-wizard-region-select" htmlFor="wizard-region">Database region (can't be changed after creation)
      <select id="wizard-region" value={region} onChange={e=>setRegion(e.target.value)}>
       <option value="us-central1">United States · Iowa</option>
       <option value="nam5">United States · Multi-region</option>
       <option value="europe-west1">Europe · Belgium</option>
       <option value="eur3">Europe · Multi-region</option>
      </select>
     </label>}
     <button type="button" className="btn primary oauth-google-button vn-wizard-button"
      onClick={continueWithGoogle} disabled={busy||authorizing||!agreed||(!checkpoint&&!name.trim())}>
      {(busy||authorizing)?<Loader2 size={18} className="vn-wizard-spinner"/>:<KeyRound size={18}/>}
      {busy?'Setting up your group…':authorizing?'Waiting for Google…':checkpoint?'Continue setup with Google':'Continue with Google'}
      {!busy&&!authorizing&&<ArrowRight size={17}/>}
     </button>
    </>}
    {(busy||status||error)&&!ready&&<div className="vn-wizard-progress" role="status">
      <div className="vn-wizard-steps">
       {progressLabels.map((label,i)=>{
        const at=i as ProgressStep,cls=progressOf(at,phase);
        return <div className={'vn-wizard-step '+cls} key={label}>
         {cls==='done'?<CheckCircle2 size={17}/>:cls==='active'&&busy?<Loader2 size={17} className="vn-wizard-spinner"/>:<span>{i+1}</span>}
         <small>{label}</small>
        </div>;
       })}
      </div>
      {status&&<p className="vn-wizard-status">{status}</p>}
     </div>}
    {error&&<div className="vn-wizard-error" role="alert">
      <div><AlertCircle size={20}/><strong>{needTerms?'Google needs one more account step':'We couldn’t finish that step'}</strong></div>
      <p>{needTerms?'If this is your first Firebase project, Google may require you to accept its official Firebase Terms of Service in the Firebase Console. You only do this once per Google account. A 403 can also mean your account lacks project permissions.':'Your existing project has been remembered. You can continue with the same Google account without creating another project.'}</p>
      {needTerms&&<a className="btn secondary" href={FIREBASE_TERMS_URL} target="_blank" rel="noreferrer">
       Accept Firebase terms in Google Console <ExternalLink size={16}/>
      </a>}
      <details><summary>Technical error details</summary><pre>{error}</pre>{technical&&<p>Last operation: {technical}</p>}</details>
    </div>}
    {ready&&<div className="vn-wizard-success">
      <CheckCircle2 size={48}/>
      <h2>{ready.name}</h2>
      <p>Google Firebase is connected. Your group can start using check-in, teams, scorekeeping, and TV mode.</p>
      <button type="button" className="btn primary" onClick={()=>activateGroup(ready)}>
       Open my Volleyball Night <ArrowRight size={17}/>
      </button>
      <label htmlFor="wizard-share">Share with volunteers</label>
      <div className="vn-wizard-share">
       <input id="wizard-share" value={groupLink} readOnly onFocus={e=>e.currentTarget.select()}/>
       <button type="button" className="btn secondary" onClick={async()=>{
        try{await navigator.clipboard.writeText(groupLink);setCopied(true)}
        catch{window.prompt('Copy the group link:',groupLink)}
       }}><Copy size={16}/>{copied?'Copied':'Copy link'}</button>
      </div>
      <p className="group-setup-muted">Volunteers use this link to connect to your group's database. They don't need a Google account.</p>
     </div>}
    {checkpoint&&<button type="button" className="vn-wizard-reset" disabled={busy} onClick={startNew}>
     <RotateCcw size={16}/> Set up a different group
    </button>}
   </section>
   <details className="vn-wizard-advanced"><summary>Developer tools and recovery</summary>
    <div className="vn-wizard-developer">
     <p>These settings are for testing the onboarding process. Future groups won't need them.</p>
     <button type="button" className="oauth-settings-toggle" onClick={()=>setShowDev(v=>!v)}>
      {showDev?'Hide':'Show'} Google OAuth developer configuration
     </button>
     {(showDev||!clientId)&&<div className="oauth-instructions">
      <p>Create a Google OAuth <strong>Web application</strong> client in the original Volleyball Night Google Cloud project. Add <code>{location.origin}</code> as an authorized JavaScript origin, and add your Google account under OAuth Test users.</p>
      <a href="https://console.cloud.google.com/auth/clients?project=volleyball-night" target="_blank" rel="noreferrer">Open Google Auth Platform <ExternalLink size={14}/></a>
      <label htmlFor="wizard-oauth-client">OAuth Web Client ID (public identifier, not a secret)</label>
      <input id="wizard-oauth-client" value={clientId} onChange={e=>setClientId(e.target.value)}
       placeholder="123456789-abc.apps.googleusercontent.com"/>
      <p>We never store Google access tokens in the browser or GitHub.</p>
     </div>}
     <div className="vn-wizard-recover">
      <h3>Resume an existing test project</h3>
      <p>Only use this if the saved setup was lost, such as after changing browsers. Do not create a new project to fix an interrupted setup.</p>
      <label htmlFor="wizard-manual-id">Project ID</label>
      <input id="wizard-manual-id" value={manualId} onChange={e=>setManualId(e.target.value)}
       placeholder="vn-community-volley-abc123"/>
      <button type="button" className="btn secondary" onClick={restoreProject}>Resume this project</button>
      {checkpoint&&<p className="group-setup-muted">Currently remembered: {checkpoint.projectId}</p>}
     </div>
     <p>Already have a Firebase project? <a href={modeHref('manual-setup')}>Use manual connection instead.</a></p>
    </div>
   </details>
  </main>
 </div>;
}
