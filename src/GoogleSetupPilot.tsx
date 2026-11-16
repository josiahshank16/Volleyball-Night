/// <reference types="vite/client" />
import {useRef,useState} from 'react';
import {AlertCircle,ArrowRight,CheckCircle2,Copy,ExternalLink,FolderOpen,Globe2,KeyRound,Loader2,RotateCcw,ShieldCheck,Volleyball} from 'lucide-react';
import {ModeSwitch,modeHref} from './ModeHome';
import {completeFirebaseSetup} from './provisionFirebase';
import {installIndependentGroupWebsite} from './hostingInstaller';
import {advanceSetupProgress,SETUP_PROGRESS_SLOTS,type SetupProgressEvent} from './setupProgress';
import {encodeGroup,validateGroup,GROUP_STORAGE_KEY,type GroupConnection} from './groupConnection';
import {allocateCheckpoint,clearCheckpoint,COMPLETED_KEY,ensureCloudProject,readCheckpoint,saveCheckpoint,type SetupCheckpoint} from './cloudProject';

const OAUTH_ID_KEY='volleyball-night-oauth-pilot-client-id';
const TERMS_PENDING_KEY='volleyball-night-firebase-terms-pending-project';
const CONFIGURED_ID=import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string|undefined;
const SCOPE='https://www.googleapis.com/auth/cloud-platform openid email profile';
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
function installedWebsiteFor(projectId:string):string{
 try{
  const entry=JSON.parse(localStorage.getItem(COMPLETED_KEY)||'{}') as {projectId?:string;siteUrl?:string};
  if(entry.projectId!==projectId||!entry.siteUrl)return '';
  const url=new URL(entry.siteUrl);
  return url.protocol==='https:'&&url.hostname.endsWith('.web.app')?url.origin+'/':'';
 }catch{return ''}
}
type ProgressStep=0|1|2|3;
const progressLabels=['Google account','Group project','Database and website','Ready to play'];
function progressOf(step:ProgressStep,active:ProgressStep){
 return step<active?'done':step===active?'active':'future';
}
/** The last segment never fills until the database and website are ready. */
function SetupProgressMeter({completedSlots}:{completedSlots:number}){
 const slots=Math.max(0,Math.min(SETUP_PROGRESS_SLOTS,Math.floor(completedSlots)));
 return <div className="vn-wizard-meter-wrap">
  <div className="vn-wizard-meter" role="progressbar"
   aria-label="Group setup progress"
   aria-valuemin={0} aria-valuemax={SETUP_PROGRESS_SLOTS} aria-valuenow={slots}
   aria-valuetext={slots===SETUP_PROGRESS_SLOTS?'Group setup complete':'Group setup is still in progress'}>
   <div className="vn-wizard-meter-fill" aria-hidden="true"
    style={{width:`${slots/SETUP_PROGRESS_SLOTS*100}%`}}/>
  </div>
  <div className="vn-wizard-meter-caption">
   <span>Cloud workspace</span><span>Database and website</span>
  </div>
 </div>;
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
 const [progressSlots,setProgressSlots]=useState(()=>initialCheckpoint&&installedWebsiteFor(initialCheckpoint.projectId)?SETUP_PROGRESS_SLOTS:completedFor(initialCheckpoint)?SETUP_PROGRESS_SLOTS-1:initialCheckpoint?.stage==='created'?4:0);
 const busyRef=useRef(false);
 const [authorizing,setAuthorizing]=useState(false);
 const authorizingRef=useRef(false);
 const [phase,setPhase]=useState<ProgressStep>(initialCheckpoint&&installedWebsiteFor(initialCheckpoint.projectId)?3:completedFor(initialCheckpoint)?2:initialCheckpoint?.stage==='created'&&localStorage.getItem(TERMS_PENDING_KEY)===initialCheckpoint.projectId?2:0);
 const [status,setStatus]=useState(initialCheckpoint?.stage==='complete'?'':initialCheckpoint&&localStorage.getItem(TERMS_PENDING_KEY)===initialCheckpoint.projectId?'One-time Google approval needed to finish setup.':initialCheckpoint?'Your earlier setup was saved. Continue with Google to finish it.':'');
 const [technical,setTechnical]=useState('');
 const technicalRef=useRef('');
 const [error,setError]=useState('');
 const [needTerms,setNeedTerms]=useState(()=>!!initialCheckpoint&&localStorage.getItem(TERMS_PENDING_KEY)===initialCheckpoint.projectId);
 const [ready,setReady]=useState<GroupConnection|null>(()=>completedFor(initialCheckpoint));
 const [copied,setCopied]=useState(false);
 const [installedUrl,setInstalledUrl]=useState(()=>initialCheckpoint?installedWebsiteFor(initialCheckpoint.projectId):'');
 const [installing,setInstalling]=useState(false);
 const [installAuthorizing,setInstallAuthorizing]=useState(false);
 const [installStatus,setInstallStatus]=useState('');
 const [installError,setInstallError]=useState('');
 const isComplete=!!ready&&!!installedUrl;

 function remember(next:SetupCheckpoint){
  checkpointRef.current=next;
  setCheckpoint(next);
  saveCheckpoint(next);
 }
 function progress(message:string,event?:SetupProgressEvent){
  if(event)setProgressSlots(previous=>advanceSetupProgress(previous,event));
  technicalRef.current=message;
  setTechnical(message);
  const s=message.toLowerCase();
  if(/still activating|still finishing|waiting for|checking automatically|may take a few minutes|retrying automatically/.test(s)){
   setPhase(2);
   setStatus('Finishing your cloud setup…');
  }else if(s.includes('firestore')||s.includes('database')||s.includes('rules')||s.includes('web app')||s.includes('session')){
   setPhase(2);
   setStatus('Preparing your group database and workspace…');
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
  const existing=completedFor(current);
  setProgressSlots(existing?SETUP_PROGRESS_SLOTS-1:current.stage==='created'?4:0);
  setError('');setInstallError('');setNeedTerms(false);setReady(existing);setCopied(false);
  let databaseReady=!!existing;
  try{
   setPhase(1);
   if(!existing)await ensureCloudProject(current,token,(message,event)=>{
     if(event)setProgressSlots(previous=>advanceSetupProgress(previous,event));
     technicalRef.current=message;
     setTechnical(message);
     setStatus('Creating your group-owned cloud project…');
    });
   const created={...current,stage:'created' as const,updatedAt:Date.now()};
   remember(created);
   setPhase(2);setStatus(existing?'Publishing your group website…':'Preparing Firebase and your player database…');
   const group=existing||await completeFirebaseSetup({
    projectId:created.projectId,groupName:created.groupName,
    region:created.region,token,notify:progress
   });
   // Save the verified database before Hosting. An interrupted installation
   // resumes this same project without recreating the database or web app.
   localStorage.setItem(COMPLETED_KEY,JSON.stringify({projectId:created.projectId,group}));
   databaseReady=true;
   setReady(group);setProgressSlots(SETUP_PROGRESS_SLOTS-1);
   setStatus('Publishing your independent website…');
   setInstalling(true);
   const siteUrl=await installIndependentGroupWebsite({group,token,notify:message=>{
    setInstallStatus(message);setStatus(message);
   }});
   localStorage.setItem(COMPLETED_KEY,JSON.stringify({projectId:created.projectId,group,siteUrl}));
   const done={...created,stage:'complete' as const,updatedAt:Date.now()};
   if(localStorage.getItem(TERMS_PENDING_KEY)===done.projectId)localStorage.removeItem(TERMS_PENDING_KEY);
   remember(done);
   setInstalledUrl(siteUrl);
   setProgressSlots(SETUP_PROGRESS_SLOTS);
   setReady(group);setPhase(3);setStatus('Your group is ready!');setTechnical('');
  }catch(err){
   const message=(err as Error)?.message||String(err);
   if(databaseReady){setInstallError(message);setError('')}
   else setError(message);
   // Show the friendly approval step ONLY for an explicit Terms response.
   // A generic Google 403 is not evidence of missing Firebase Terms.
   const requiresTerms=!databaseReady&&/terms of service|firebase terms|accept.*terms|\btos\b|TOS_NOT_ACCEPTED/i.test(message);
   setNeedTerms(requiresTerms);
   if(requiresTerms){
    localStorage.setItem(TERMS_PENDING_KEY,current.projectId);
    setPhase(2);
    setStatus('One-time Google approval needed to finish setup.');
   }else{
    if(localStorage.getItem(TERMS_PENDING_KEY)===current.projectId)localStorage.removeItem(TERMS_PENDING_KEY);
    setStatus(databaseReady?'Your database is ready. Website installation can be retried here.':'Setup paused. Your progress is saved; continuing will reuse the same project.');
   }
  }finally{busyRef.current=false;setBusy(false);setInstalling(false);}
 }
 function installWebsite(){
  if(!ready||installing||installAuthorizing||busyRef.current||authorizingRef.current)return;
  setInstallError('');setInstallStatus('Opening Google sign-in…');
  if(!clientId.trim()||!window.google?.accounts?.oauth2){
   setInstallError('Google sign-in is not ready. Refresh this page and try again.');
   return;
  }
  setInstallAuthorizing(true);
  try{
   const client=window.google.accounts.oauth2.initTokenClient({
    client_id:clientId.trim(),scope:SCOPE,
    callback:result=>{
     setInstallAuthorizing(false);
     if(!result.access_token||result.error){
      setInstallError(result.error_description||result.error||'Google did not provide authorization.');
      return;
     }
     const group=ready;
     const token=result.access_token;
     setInstalling(true);
     void (async()=>{
      try{
       const url=await installIndependentGroupWebsite({group,token,notify:setInstallStatus});
       localStorage.setItem(COMPLETED_KEY,JSON.stringify({projectId:group.config.projectId,group,siteUrl:url}));
       if(checkpointRef.current?.projectId===group.config.projectId){
        remember({...checkpointRef.current,stage:'complete',updatedAt:Date.now()});
       }
       setInstalledUrl(url);setInstallStatus('Independent website published. Open the site to verify it.');
       setProgressSlots(SETUP_PROGRESS_SLOTS);setPhase(3);setError('');
       setCopied(false);
      }catch(err){
       setInstallError((err as Error)?.message||String(err));
      }finally{setInstalling(false)}
     })();
    },
    error_callback:e=>{
     setInstallAuthorizing(false);
     setInstallError('Google authorization was interrupted: '+(e.type||'popup closed'));
    }
   });
   client.requestAccessToken({prompt:'select_account consent'});
  }catch(err){
   setInstallAuthorizing(false);
   setInstallError((err as Error)?.message||String(err));
  }
 }
 function continueWithGoogle(){
  if(busyRef.current||authorizingRef.current)return;
  setError('');setNeedTerms(false);
  if(!checkpointRef.current&&(!name.trim()||!agreed)){
   setError('Enter a group name and accept the setup agreement first.');return;
  }
  // The user's original approval was already given before we reached the
  // Google Terms handoff. A page reload must not block resuming that step.
  if(checkpointRef.current&&!agreed&&!needTerms){
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
  if(busyRef.current||authorizingRef.current||installing||installAuthorizing)return;
  if(checkpointRef.current&&!window.confirm(
   'Start setting up a DIFFERENT group? This will clear only the saved setup progress in this browser. Any Google Cloud project already created will remain in your Google account.'))return;
  clearCheckpoint();localStorage.removeItem(COMPLETED_KEY);localStorage.removeItem(TERMS_PENDING_KEY);
  checkpointRef.current=null;setCheckpoint(null);setName('');setRegion('us-central1');
  setAgreed(false);setReady(null);setError('');setNeedTerms(false);setPhase(0);setProgressSlots(0);
  setStatus('');setTechnical('');setManualId('');setCopied(false);setInstalledUrl('');setInstallError('');setInstallStatus('');
 }
 function restoreProject(){
  if(busyRef.current||authorizingRef.current)return;
  const id=manualId.trim();
  if(!/^vn-[a-z0-9-]{3,54}$/.test(id)){setError('Enter a Volleyball Night test project ID starting with vn-.');return;}
  if(!name.trim()){setError('Enter the original group name before resuming a project.');return;}
  if(checkpointRef.current?.projectId!==id&&!window.confirm(
   'Resume the project '+id+'? Make sure it is the project you created and own. This will replace the saved setup checkpoint in this browser.'))return;
  remember({version:1,projectId:id,groupName:name.trim(),region,stage:'created',updatedAt:Date.now()});
  localStorage.removeItem(TERMS_PENDING_KEY);
  setNeedTerms(false);setReady(null);setError('');setProgressSlots(4);setStatus('Project saved. Continue with Google to finish this group.');
  setShowAdvanced(false);
 }
 const groupLink=installedUrl;
 const firestoreClientIssue=!needTerms&&(
  /Firestore client|Missing or insufficient permissions|permission-denied|liveSessions\/current/i.test(error)||
  /Waiting for Firestore rules to become active|Waiting for Firestore client access rules|Verifying Firestore access/i.test(technical)
 );
 const permissionIssue=!needTerms&&!firestoreClientIssue&&/permission|403|access denied/i.test(error);
 const rulesStep=/rules|firebaserules/i.test(technical)||/Firebase Rules/i.test(error);
 const subtitle=isComplete?'Your group has its own website and database. Share its address to start playing.':
  ready?'Your database is ready. Finish publishing your group’s website to get its permanent link.':
  needTerms?'Your group is almost ready. Google has one quick, first-time approval before we can finish.':
  checkpoint?'Your group setup is saved and will continue without creating another project.':
  'Create a separate cloud workspace for your volleyball group. No GitHub account or manual Firebase configuration needed.';
 return <div className="group-setup-shell">
  <header className="group-setup-bar"><div className="vn-home-logo"><Volleyball size={24}/><span>VOLLEYBALL <b>NIGHT</b></span></div><ModeSwitch/></header>
  <main className="group-setup-main vn-wizard-main">
   <div className="group-setup-heading"><span className="eyebrow">SET UP YOUR GROUP</span>
    <h1>{isComplete?'Your group is ready!':checkpoint?'Finish your group setup':'Welcome to Volleyball Night'}</h1>
    <p>{subtitle}</p>
    <a className="vn-my-groups-create" href="/?mode=groups"><FolderOpen size={16}/> Already have a group? Find my groups</a>
   </div>
   <section className="group-setup-card vn-wizard-card">
    {!ready&&!needTerms&&<>
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
         {cls==='done'?<CheckCircle2 size={17}/>:cls==='active'&&busy?<Loader2 size={17} className="vn-wizard-spinner"/>:<span aria-hidden="true" className="vn-wizard-step-dot"/>}
         <small>{label}</small>
        </div>;
       })}
      </div>
      <SetupProgressMeter completedSlots={progressSlots}/>
      {busy&&<div className="vn-wizard-activity" aria-label="Setup is still running">
       <Loader2 size={35} className="vn-wizard-spinner" aria-hidden="true"/>
      </div>}
      {status&&<p className="vn-wizard-status">{status}</p>}
      {busy&&<p className="vn-wizard-wait-copy">Google may need a few minutes to finish. Keep this page open; we'll continue automatically.</p>}
     </div>}
    {needTerms&&!ready&&<section className="vn-wizard-terms" aria-labelledby="vn-terms-title">
      <div className="vn-wizard-terms-heading">
       <span className="vn-wizard-terms-icon"><ShieldCheck size={25}/></span>
       <div>
        <span className="vn-wizard-terms-kicker">ONE-TIME GOOGLE SETUP</span>
        <h2 id="vn-terms-title">Accept Firebase's terms to continue</h2>
       </div>
      </div>
      <p>Google needs you to accept its Firebase terms the first time you use Firebase. This is a normal step in creating your group's workspace, not a problem with your account.</p>
      <ol>
       <li>Open Firebase in a new tab using the same Google account you just authorized.</li>
       <li>Review and accept Google's Firebase terms if prompted. You don't need to create a project manually.</li>
       <li>Return here and select <strong>I've accepted — Continue setup</strong>.</li>
      </ol>
      <a className="btn primary vn-wizard-terms-link" href={FIREBASE_TERMS_URL} target="_blank" rel="noopener noreferrer">
       Open Firebase to accept terms <ExternalLink size={16}/>
      </a>
      <button type="button" className="btn secondary vn-wizard-terms-continue" onClick={continueWithGoogle} disabled={busy||authorizing}>
       {authorizing?<Loader2 size={17} className="vn-wizard-spinner"/>:<ArrowRight size={17}/>}
       {authorizing?'Connecting with Google…':"I've accepted — Continue setup"}
      </button>
      <p className="vn-wizard-terms-reassurance"><CheckCircle2 size={16}/> Your group project is saved. You won't need to start again.</p>
      <details className="vn-wizard-terms-diagnostics">
       <summary>Technical details (if needed)</summary>
       <pre>{error}</pre>
      </details>
     </section>}
    {error&&!needTerms&&<div className="vn-wizard-error" role="alert">
      <div><AlertCircle size={20}/><strong>{needTerms?'Google requires Firebase terms acceptance':firestoreClientIssue?'Firestore access is not ready':permissionIssue?'Google API access was denied':'We couldn’t finish that step'}</strong></div>
      <p>{needTerms?
       'Google specifically requested Firebase Terms acceptance. Open the official Firebase Console, accept its terms, then continue this saved setup.':
       firestoreClientIssue?
       'Google may still be applying the new Firestore access rules. We checked automatically for several minutes before stopping. Wait another minute or two, then select Continue setup with Google. Your project is saved and no duplicate will be created. If it keeps failing, check the Firestore rules.':
       permissionIssue?
       'Google may still be applying permissions or enabling an API for your new project. We retried automatically, but the request is still being denied. Wait another minute or two and continue this saved setup. If it repeatedly fails, verify that you are using the project owner’s Google account and check the API permissions.':
       'Your existing project has been remembered. You can continue with the same Google account without creating another project.'}</p>
      {firestoreClientIssue&&checkpoint&&<div className="vn-wizard-help-links">
       <a href={`https://console.firebase.google.com/project/${checkpoint.projectId}/firestore/rules`} target="_blank" rel="noreferrer">Inspect the active Firestore rules <ExternalLink size={15}/></a>
      </div>}
      {permissionIssue&&checkpoint&&<div className="vn-wizard-help-links">
       {rulesStep&&<a href={`https://console.cloud.google.com/apis/library/firebaserules.googleapis.com?project=${checkpoint.projectId}`} target="_blank" rel="noreferrer">Check Firebase Rules API <ExternalLink size={15}/></a>}
       <a href={`https://console.cloud.google.com/iam-admin/iam?project=${checkpoint.projectId}`} target="_blank" rel="noreferrer">Review project permissions <ExternalLink size={15}/></a>
      </div>}
      <details><summary>Technical error details</summary><pre>{error}</pre>{technical&&<p>Last operation: {technical}</p>}</details>
    </div>}
    {ready&&<div className="vn-wizard-success">
      {isComplete?<CheckCircle2 size={48}/>:<Globe2 size={48}/>}
      <SetupProgressMeter completedSlots={progressSlots}/>
      <h2>{ready.name}</h2>
      <p>{isComplete?'Your independent group website is ready for check-in, teams, scorekeeping, and TV mode.':'Your player database is connected. We’re preparing the independent website in the same Firebase project.'}</p>
      <section className="vn-install-panel">
       <div className="vn-install-head"><Globe2 size={21}/>
        <div><strong>{isComplete?'Your independent website is published':installing?'Publishing your website…':'Finish website installation'}</strong>
         <p>{isComplete?'This group’s pages and data live in its own Firebase project. Future hub updates do not change this installed copy.':'Installation can be retried without creating another group or database.'}</p>
         {!isComplete&&!installing&&<p><strong>When Google asks:</strong> Select the account that created this group.</p>}
        </div>
       </div>
       <button type="button" className="btn secondary vn-install-action" disabled={busy||installing||installAuthorizing}
        onClick={installWebsite}>
        {installing||installAuthorizing?<Loader2 size={17} className="vn-wizard-spinner"/>:<Globe2 size={17}/>}
        {installing?'Publishing website…':installAuthorizing?'Waiting for Google…':isComplete?'Update this group’s website':'Retry website installation'}
       </button>
       {installStatus&&<p className="vn-install-feedback" role="status">{installStatus}</p>}
       {installError&&<div className="vn-install-failure" role="alert">
        <strong>Website installation hasn't finished.</strong>
        <p>{installError}</p>
        <small>Your database is saved. Make sure you select the project owner's Google account, then retry this installation.</small>
        <a href={`https://console.firebase.google.com/project/${ready.config.projectId}/overview`} target="_blank" rel="noopener noreferrer">Check this group’s Google account <ExternalLink size={14}/></a>
        <a href={`https://console.cloud.google.com/apis/library/firebasehosting.googleapis.com?project=${ready.config.projectId}`} target="_blank" rel="noopener noreferrer">Check its Firebase Hosting API <ExternalLink size={14}/></a>
       </div>}
       {installedUrl&&<a className="vn-install-link" href={installedUrl} target="_blank" rel="noopener noreferrer">
        Open independent group website <ExternalLink size={15}/>
       </a>}
      </section>
      {isComplete&&<><p className="group-setup-muted">Finish group setup by setting the leader PIN before sharing this website.</p>
      <a className="btn primary" href={'/?g='+encodeGroup(ready)+'&mode=owner-settings'}>
       <ShieldCheck size={17}/> Set leader PIN
      </a>
      <button type="button" className="btn secondary" onClick={()=>window.location.assign(installedUrl)}>
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
      <p className="group-setup-muted">Share your group’s own website. Volunteers do not need a Google account to check in.</p></>}
     </div>}
    {checkpoint&&<button type="button" className="vn-wizard-reset" disabled={busy||installing||installAuthorizing} onClick={startNew}>
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
