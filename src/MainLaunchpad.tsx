import {useEffect,useState,type ReactNode} from 'react';
import {ArrowRight,FolderOpen,Globe2,LockKeyhole,LogOut,ShieldCheck,Volleyball} from 'lucide-react';
import {googleAccount} from './accessAdmin';

const CLIENT_ID=import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string|undefined;
const OWNER_FINGERPRINT=(import.meta.env.VITE_HUB_OWNER_EMAIL_SHA256 as string|undefined)?.trim().toLowerCase();

async function emailFingerprint(email:string){
 const bytes=new TextEncoder().encode(email.trim().toLowerCase());
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

function googleLogin(onSuccess:(email:string)=>void,onError:(message:string)=>void){
 if(!OWNER_FINGERPRINT){onError('Admin access has not been configured yet.');return}
 if(!CLIENT_ID||!window.google?.accounts?.oauth2){onError('Google sign-in is unavailable. Refresh this page and try again.');return}
 try{
  const client=window.google.accounts.oauth2.initTokenClient({
   client_id:CLIENT_ID,scope:'openid email profile',
   callback:result=>{
    if(!result.access_token||result.error){onError(result.error_description||result.error||'Google sign-in was cancelled.');return}
    void googleAccount(result.access_token).then(async account=>{
     if(await emailFingerprint(account.email)!==OWNER_FINGERPRINT){onError('This Google account does not have hub admin access. Choose the designated account.');return}
     onSuccess(account.email);
    }).catch(error=>onError((error as Error).message));
   },
   error_callback:e=>onError(e.type==='popup_closed'?'Google sign-in was cancelled.':'Google sign-in could not open. Check popup permissions and try again.')
  });
  client.requestAccessToken({prompt:'select_account'});
 }catch(error){onError((error as Error).message)}
}

export function HubHeader(){
 return <header className="hub-header"><a className="hub-brand" href="/" aria-label="Volleyball Night home"><span className="hub-brand-mark"><Volleyball size={25}/></span><span>VOLLEYBALL <b>NIGHT</b></span></a>
  <nav aria-label="Main navigation"><a href="/?mode=guide">How it works</a><a className="hub-header-owner" href="/?mode=admin"><LockKeyhole size={16}/> Admin settings</a></nav></header>;
}

export function HubFooter(){return <footer className="hub-footer"><span>VOLLEYBALL NIGHT</span><span>Ready for the next game night.</span></footer>}

export function MainLaunchpad(){
 useEffect(()=>{document.title='Volleyball Night | Your group, your game'},[]);
 return <div className="hub-page"><HubHeader/><main className="hub-simple-main">
  <section className="hub-simple-hero"><span className="hub-kicker">YOUR VOLLEYBALL NIGHT STARTS HERE</span>
   <h1>Less setup.<br/>More playing.</h1>
   <p>Run check-in, balanced teams, a game schedule, and live scores from one shared website for your group.</p>
   <div className="hub-simple-actions"><a className="hub-button-primary" href="/?mode=setup">Create a group <ArrowRight size={19}/></a><a className="hub-button-outline" href="/?mode=groups">Find my groups <FolderOpen size={18}/></a></div>
   <p className="hub-simple-note">Each group gets its own website and saved data. Already have a group link? Open it directly.</p>
  </section>
  <div className="hub-simple-strip" aria-label="App features"><span>Easy check-in</span><i/><span>Fair teams</span><i/><span>Live scores</span><i/><span>TV display</span></div>
 </main><HubFooter/></div>;
}

export function AdminSettings({ownerTools}:{ownerTools:ReactNode}){
 const [email,setEmail]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{document.title='Admin settings | Volleyball Night'},[]);
 const login=()=>{
  setBusy(true);setError('');
  googleLogin(account=>{setEmail(account);setBusy(false)},message=>{setError(message);setBusy(false)});
 };
 return <div className="hub-page"><HubHeader/><main className="hub-admin-main">
  <a className="hub-back" href="/">← Back to launch page</a>
  <div className="hub-admin-intro"><span className="hub-kicker">PRIVATE HUB TOOLS</span><h1>Admin settings</h1><p>Global controls for the Volleyball Night hub. Group creation, updates, and gameplay remain on their own paths and accounts.</p></div>
  <section className="hub-admin-panel" aria-label="Admin sign-in">
   {email?<><div className="hub-admin-signed"><ShieldCheck size={23}/><div><strong>Signed in</strong><p>{email}</p></div><button type="button" onClick={()=>setEmail('')}><LogOut size={16}/> Sign out</button></div>{ownerTools}</>
    :<><div className="hub-owner-icon"><LockKeyhole size={24}/></div><h2>Continue with the hub admin account</h2><p>Only the designated Google account can open these controls.</p>
     <button className="hub-owner-button" disabled={busy||!OWNER_FINGERPRINT} onClick={login} type="button"><ShieldCheck size={19}/>{busy?'Checking Google account…':'Continue with Google'}</button></>}
   {error&&<p className="hub-owner-error" role="alert">{error}</p>}
   {!OWNER_FINGERPRINT&&<p className="hub-owner-error" role="status">Admin sign-in is awaiting account setup.</p>}
  </section>
 </main><HubFooter/></div>;
}

export function GroupSiteHandoff({projectId,mode}:{projectId:string;mode:string|null}){
 const url=new URL('https://'+projectId+'.web.app/');
 if(mode&&['home','kiosk','tv','organizer','scorekeeper','pin-settings','change-pin'].includes(mode)&&mode!=='home')url.searchParams.set('mode',mode);
 return <div className="hub-page"><HubHeader/><main className="hub-handoff"><div className="hub-handoff-icon"><Globe2 size={31}/></div><span className="hub-kicker">GROUP WEBSITE</span><h1>This group has its own court.</h1>
  <p>Its app and saved data belong on the independent group website. If that website has not been published yet, find the group from the hub to finish setup.</p>
  <div className="hub-simple-actions"><a className="hub-button-primary" href={url.toString()}>Open group website <ArrowRight size={18}/></a><a className="hub-button-outline" href="/?mode=groups">Find my groups <FolderOpen size={18}/></a></div>
 </main><HubFooter/></div>;
}
