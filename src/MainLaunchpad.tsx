import {useState,type ReactNode} from 'react';
import {ArrowRight,Check,ExternalLink,FolderOpen,Globe2,LockKeyhole,LogOut,ShieldCheck,Volleyball} from 'lucide-react';
import {googleAccount} from './accessAdmin';

const CLIENT_ID=import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string|undefined;
const OWNER_FINGERPRINT=(import.meta.env.VITE_HUB_OWNER_EMAIL_SHA256 as string|undefined)?.trim().toLowerCase();

async function emailFingerprint(email:string){
 const bytes=new TextEncoder().encode(email.trim().toLowerCase());
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

function googleLogin(onSuccess:(email:string)=>void,onError:(message:string)=>void){
 if(!OWNER_FINGERPRINT){onError('Owner access has not been configured yet.');return}
 if(!CLIENT_ID||!window.google?.accounts?.oauth2){onError('Google sign-in is unavailable. Refresh this page and try again.');return}
 try{
  const client=window.google.accounts.oauth2.initTokenClient({
   client_id:CLIENT_ID,scope:'openid email profile',
   callback:result=>{
    if(!result.access_token||result.error){onError(result.error_description||result.error||'Google sign-in was cancelled.');return}
    void googleAccount(result.access_token).then(async account=>{
     if(await emailFingerprint(account.email)!==OWNER_FINGERPRINT){onError('This Google account is not the hub owner account. Choose the designated account.');return}
     onSuccess(account.email);
    }).catch(error=>onError((error as Error).message));
   },
   error_callback:e=>onError(e.type==='popup_closed'?'Google sign-in was cancelled.':'Google sign-in could not open. Check popup permissions and try again.')
  });
  client.requestAccessToken({prompt:'select_account'});
 }catch(error){onError((error as Error).message)}
}

function OwnerArea({ownerTools}:{ownerTools:ReactNode}){
 const [email,setEmail]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const login=()=>{
  setBusy(true);setError('');
  googleLogin(account=>{setEmail(account);setBusy(false)},message=>{setError(message);setBusy(false)});
 };
 return <section className="hub-owner" id="owner" aria-labelledby="hub-owner-title">
  <div className="hub-owner-icon"><LockKeyhole size={24}/></div>
  <div className="hub-owner-copy"><span className="hub-kicker">HUB OWNER</span><h2 id="hub-owner-title">Your private hub controls</h2>
   {email?<><p>Signed in as <strong>{email}</strong>. Manage your groups through their own Google accounts.</p>
    <div className="hub-owner-actions"><a href="/?mode=groups">Manage group websites <ArrowRight size={17}/></a>
     <a href="/?mode=setup">Create a group <ArrowRight size={17}/></a>
     <button type="button" onClick={()=>setEmail('')}><LogOut size={16}/> Sign out here</button></div>
    {ownerTools}</>
    :<><p>Sign in with the designated Google account to open the hub owner's tools.</p>
     <button className="hub-owner-button" disabled={busy||!OWNER_FINGERPRINT} onClick={login} type="button"><ShieldCheck size={19}/>{busy?'Checking Google account…':'Continue with Google'}</button></>}
   {error&&<p className="hub-owner-error" role="alert">{error}</p>}
   {!OWNER_FINGERPRINT&&<p className="hub-owner-error" role="status">Owner sign-in is awaiting account setup. Group creation and discovery are available above.</p>}
  </div>
 </section>;
}

export function MainLaunchpad({ownerTools}:{ownerTools:ReactNode}){
 return <div className="hub-page">
  <header className="hub-header"><a className="hub-brand" href="/" aria-label="Volleyball Night home"><span className="hub-brand-mark"><Volleyball size={25}/></span><span>VOLLEYBALL <b>NIGHT</b></span></a>
   <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="/?mode=groups">Find my groups</a><a className="hub-header-owner" href="#owner"><LockKeyhole size={16}/> Owner access</a></nav></header>
  <main>
   <section className="hub-hero"><div className="hub-hero-glow" aria-hidden="true"/><div className="hub-hero-content">
    <span className="hub-kicker"><span className="hub-kicker-dot"/> A HOME FOR EVERY VOLLEYBALL NIGHT</span>
    <h1>Your group.<br/><em>Your court.</em></h1>
    <p>Create an independent space for check-in, fair teams, scheduling, live scoring, and the TV display. Every group has its own website and saved data.</p>
    <div className="hub-hero-actions"><a className="hub-button-primary" href="/?mode=setup">Create a new group <ArrowRight size={19}/></a><a className="hub-button-ghost" href="/?mode=groups">Find my groups <FolderOpen size={18}/></a></div>
    <div className="hub-hero-note"><Check size={17}/> Already have a group link? Open that group's website directly.</div>
   </div><div className="hub-hero-visual" aria-hidden="true"><div className="hub-court"><span className="hub-court-net"/><span className="hub-court-circle"/><span className="hub-court-dot a"/><span className="hub-court-dot b"/><span className="hub-court-dot c"/><span className="hub-court-dot d"/><span className="hub-court-dot e"/><span className="hub-court-dot f"/></div><div className="hub-visual-chip"><Globe2 size={19}/> One site per group</div></div>
   </section>
   <section className="hub-paths" id="how-it-works" aria-labelledby="hub-paths-title"><div className="hub-section-heading"><span className="hub-kicker">GET STARTED</span><h2 id="hub-paths-title">Where would you like to go?</h2></div>
    <div className="hub-path-grid"><a className="hub-path-card" href="/?mode=setup"><span className="hub-path-icon create"><Volleyball size={27}/></span><span className="hub-path-number">01 / START FRESH</span><h3>Create a group</h3><p>Set up a separate website and database for your volleyball night with your Google account.</p><span className="hub-path-link">Start setup <ArrowRight size={18}/></span></a>
     <a className="hub-path-card" href="/?mode=groups"><span className="hub-path-icon find"><FolderOpen size={27}/></span><span className="hub-path-number">02 / PICK UP WHERE YOU LEFT OFF</span><h3>Find my groups</h3><p>Open a group you own, or publish the latest app version to its independent website.</p><span className="hub-path-link">Browse groups <ArrowRight size={18}/></span></a></div>
    <p className="hub-path-foot"><ExternalLink size={16}/> Check-in, Organizer, Scorekeeper, and TV run on each group's own website.</p>
   </section>
   <OwnerArea ownerTools={ownerTools}/>
  </main><footer className="hub-footer"><span>VOLLEYBALL NIGHT</span><span>Built for the next game night.</span></footer>
 </div>;
}

export function GroupSiteHandoff({projectId,mode}:{projectId:string;mode:string|null}){
 const url=new URL('https://'+projectId+'.web.app/');
 if(mode&&['home','kiosk','tv','organizer','scorekeeper','pin-settings','change-pin'].includes(mode)&&mode!=='home')url.searchParams.set('mode',mode);
 return <div className="hub-page"><header className="hub-header"><a className="hub-brand" href="/"><span className="hub-brand-mark"><Volleyball size={25}/></span><span>VOLLEYBALL <b>NIGHT</b></span></a></header>
  <main className="hub-handoff"><div className="hub-path-icon find"><Globe2 size={31}/></div><span className="hub-kicker">GROUP WEBSITE</span><h1>This group has its own court.</h1>
   <p>Its app and saved data belong on the independent group website. If that website has not been published yet, find the group from the hub to finish setup.</p>
   <div className="hub-hero-actions"><a className="hub-button-primary" href={url.toString()}>Open group website <ArrowRight size={18}/></a><a className="hub-button-ghost" href="/?mode=groups">Find my groups <FolderOpen size={18}/></a></div>
  </main></div>;
}
