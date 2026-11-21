import {useEffect,useState,type FormEvent} from 'react';
import {KeyRound,Loader2} from 'lucide-react';
import {doc,getDocFromServer} from 'firebase/firestore';
import {firestore} from './firebase';
import {ModeSwitch,modeHref} from './ModeHome';
import {changeUiPin} from './uiPin';

export function UiPinSettings(){
 const [configured,setConfigured]=useState<boolean|null>(null);
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[again,setAgain]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{
  let live=true;
  void getDocFromServer(doc(firestore,'liveSessions','current')).then(snapshot=>{
   const json=snapshot.data()?.payload?.json;
   if(typeof json!=='string')throw Error('The group session is unavailable.');
   if(live)setConfigured(!!JSON.parse(json).uiPinHash);
  }).catch(e=>{if(live)setError((e as Error).message)});
  return()=>{live=false};
 },[]);
 const digits=(value:string)=>value.replace(/\D/g,'').slice(0,6);
 const save=async(e:FormEvent)=>{
  e.preventDefault();setError('');
  if(next!==again){setError('The new PIN entries do not match.');return}
  setBusy(true);
  try{await changeUiPin(configured?current:null,next);
   setCurrent('');setNext('');setAgain('');setConfigured(true);setDone(true);
  }catch(err){setError((err as Error)?.message||String(err))}
  finally{setBusy(false)}
 };
 return <div className="group-setup-shell"><header className="group-setup-bar">
  <strong>VOLLEYBALL NIGHT</strong><ModeSwitch/>
 </header><main className="group-setup-main vn-wizard-main">
  <section className="group-setup-heading"><div className="eyebrow">GROUP SETTINGS</div>
   <h1>{configured?'Change group PIN':'Set group PIN'}</h1>
   <p>This PIN adds a pop-up to mode buttons. Direct links and the group database remain open.</p>
  </section>
  <section className="group-setup-card vn-owner-access">
   {configured===null&&!error?<p>Loading group settings…</p>:<form onSubmit={save} className="group-setup-fields">
    {configured&&<label htmlFor="ui-pin-current">Current PIN<input id="ui-pin-current" type="password" inputMode="numeric"
     autoComplete="off" maxLength={6} value={current} onChange={e=>setCurrent(digits(e.target.value))}/></label>}
    <label htmlFor="ui-pin-next">{configured?'New PIN':'Choose a six-digit PIN'}<input id="ui-pin-next" type="password" inputMode="numeric"
     autoComplete="new-password" maxLength={6} value={next} onChange={e=>setNext(digits(e.target.value))}/></label>
    <label htmlFor="ui-pin-again">Repeat PIN<input id="ui-pin-again" type="password" inputMode="numeric"
     autoComplete="new-password" maxLength={6} value={again} onChange={e=>setAgain(digits(e.target.value))}/></label>
    <button className="btn primary" type="submit" disabled={busy||configured===null||next.length!==6||again.length!==6||(configured&&current.length!==6)}>
     {busy?<Loader2 size={17} className="vn-wizard-spinner"/>:<KeyRound size={17}/>}{busy?'Saving PIN…':configured?'Change PIN':'Set PIN'}</button>
   </form>}
   {done&&<p role="status">PIN saved for this group. <a href={modeHref('home')}>Open the mode switcher</a>.</p>}
   {error&&<p className="fb-error" role="alert">{error}</p>}
  </section>
 </main></div>;
}
