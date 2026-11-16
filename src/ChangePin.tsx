import {useState,type FormEvent} from 'react';
import {KeyRound,Loader2} from 'lucide-react';
import {ModeSwitch,modeHref} from './ModeHome';
import {changeLeaderPin} from './leaderAccess';

export function ChangePin(){
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 const rotate=async(e:FormEvent)=>{
  e.preventDefault();setError('');
  if(next!==confirm){setError('The new PIN entries do not match.');return}
  setBusy(true);
  try{
   await changeLeaderPin(current,next);
   setCurrent('');setNext('');setConfirm('');setDone(true);
  }catch(err){
   setError((err as Error)?.message||String(err));
  }finally{setBusy(false)}
 };
 const pin=(value:string)=>value.replace(/\D/g,'').slice(0,6);
 return <div className="group-setup-shell"><header className="group-setup-bar">
  <strong>VOLLEYBALL NIGHT</strong><ModeSwitch/>
 </header><main className="group-setup-main vn-wizard-main">
  <section className="group-setup-heading"><div className="eyebrow">LEADER SETTINGS</div>
   <h1>Change leader PIN</h1>
   <p>Enter the current six-digit PIN to choose a new one for Organizer and Scorekeeper.</p>
  </section>
  <section className="group-setup-card vn-owner-access">
   {done?<><p role="status">Your group PIN was changed. Open Organizer or Scorekeeper with the new PIN.</p>
    <a className="btn primary" href={modeHref('organizer')}>Open Organizer</a></>:
    <form onSubmit={rotate} className="group-setup-fields">
     <label htmlFor="current-pin">Current PIN<input id="current-pin" type="password" inputMode="numeric"
      autoComplete="off" maxLength={6} required value={current} onChange={e=>setCurrent(pin(e.target.value))}/></label>
     <label htmlFor="next-pin">New PIN<input id="next-pin" type="password" inputMode="numeric"
      autoComplete="new-password" maxLength={6} required value={next} onChange={e=>setNext(pin(e.target.value))}/></label>
     <label htmlFor="confirm-pin">Repeat new PIN<input id="confirm-pin" type="password" inputMode="numeric"
      autoComplete="new-password" maxLength={6} required value={confirm} onChange={e=>setConfirm(pin(e.target.value))}/></label>
     <button className="btn primary" type="submit" disabled={busy||current.length!==6||next.length!==6||confirm.length!==6}>
      {busy?<Loader2 size={17} className="vn-wizard-spinner"/>:<KeyRound size={17}/>}
      {busy?'Changing PIN…':'Change PIN'}</button>
    </form>}
   {error&&<p className="fb-error" role="alert">{error} If the change was interrupted, try the new PIN first, then the old PIN. The group owner can recover access with Google.</p>}
   <p><a href={modeHref('owner-settings')}>Forgot the current PIN? Use Google owner recovery</a></p>
  </section>
 </main></div>;
}
