/// <reference types="vite/client" />
import {useState} from 'react';
import {KeyRound,Loader2,ShieldCheck} from 'lucide-react';
import {ModeSwitch,modeHref} from './ModeHome';
import {firebaseConfig} from './firebase';
import {protectGroup} from './migrateAccess';

const CLIENT_ID=import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string|undefined;
const SCOPE='https://www.googleapis.com/auth/cloud-platform openid email profile';

export function OwnerAccess({protectedMode}:{protectedMode:boolean}){
 const [pin,setPin]=useState(''),[again,setAgain]=useState('');
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [done,setDone]=useState(false);
 const start=()=>{
  if(busy)return;
  if(!/^\d{6}$/.test(pin)||pin!==again){setError('Enter the same six-digit PIN twice.');return}
  if(location.hostname!=='volleyball-night.web.app'){
   setError('Open this page from the main Volleyball Night website to use Google sign-in.');return;
  }
  if(!CLIENT_ID||!window.google?.accounts?.oauth2){
   setError('Google sign-in is not ready. Refresh this page and try again.');return;
  }
  if(!window.confirm(`${protectedMode?'Change':'Activate'} protected access for ${firebaseConfig.projectId}? This will use your Google account to ${protectedMode?'rotate the group PIN':'move the group to separate public kiosk and private leader data'}. A backup will be created first and the group website will be updated.`))return;
  const chosenPin=pin;setPin('');setAgain('');setBusy(true);setError('');
  setStatus('Choose the Google account that owns this group…');
  try{
   const client=window.google.accounts.oauth2.initTokenClient({
    client_id:CLIENT_ID,scope:SCOPE,
    callback:result=>{
     if(!result.access_token||result.error){
      setError(result.error_description||result.error||'Google did not authorize this request.');
      setBusy(false);return;
     }
     void protectGroup(chosenPin,result.access_token,setStatus)
      .then(()=>{setDone(true);setStatus('Protected access is active. Test the PIN in Organizer and Scorekeeper.')})
      .catch(e=>setError((e as Error)?.message||String(e)))
      .finally(()=>setBusy(false));
    },
    error_callback:e=>{setError('Google sign-in was interrupted: '+(e.type||'popup closed'));setBusy(false)}
   });
   client.requestAccessToken({prompt:'select_account'});
  }catch(e){setError((e as Error)?.message||String(e));setBusy(false)}
 };
 return <div className="group-setup-shell"><header className="group-setup-bar">
  <strong>VOLLEYBALL NIGHT</strong><ModeSwitch/>
 </header><main className="group-setup-main vn-wizard-main">
  <section className="group-setup-heading"><div className="eyebrow">GOOGLE OWNER SETTINGS</div>
   <h1>Group access & PIN</h1>
   <p>{protectedMode?'Change the six-digit leader PIN with the Google account that owns this group.':
    'Protect this group with your Google account, then choose the six-digit PIN leaders will use for Organizer and Scorekeeper.'}</p>
  </section>
  <section className="group-setup-card vn-owner-access">
   <div className="vn-install-head"><ShieldCheck size={24}/><div>
    <strong>{protectedMode?'Protected group':'Open prototype group'}</strong>
    <p>Check-in and TV stay open. Google access is required to manage this PIN.</p>
   </div></div>
   <p>Firebase project: <code>{firebaseConfig.projectId}</code></p>
   <div className="group-setup-fields">
    <label htmlFor="new-pin">{protectedMode?'New leader PIN':'Create leader PIN'}
     <input id="new-pin" type="password" inputMode="numeric" pattern="[0-9]{6}"
      autoComplete="new-password" maxLength={6} value={pin}
      onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>
    <label htmlFor="repeat-pin">Repeat PIN
     <input id="repeat-pin" type="password" inputMode="numeric" pattern="[0-9]{6}"
      autoComplete="new-password" maxLength={6} value={again}
      onChange={e=>setAgain(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>
   </div>
   <button className="btn primary" type="button" disabled={busy||pin.length!==6||again.length!==6}
    onClick={start}>{busy?<Loader2 size={17} className="vn-wizard-spinner"/>:<KeyRound size={17}/>}
    {busy?'Working with Google…':protectedMode?'Change PIN with Google':'Protect group with Google'}</button>
   {status&&<p className="vn-install-feedback" role="status">{status}</p>}
   {error&&<p className="fb-error" role="alert">{error} Your group and project are saved; reopen this page to retry the same group.</p>}
   {done&&<p><a href={modeHref('organizer')}>Open Organizer</a> · <a href={modeHref('scorekeeper')}>Open Scorekeeper</a></p>}
  </section>
 </main></div>;
}
