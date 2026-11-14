import {useState} from 'react';
import {Cloud,CloudOff,CloudUpload,CloudDownload,AlertTriangle} from 'lucide-react';

export function CloudControl({mode,status,error,authorized,playerCount,startCloud,joinCloud,leaveCloud,retryCloud}:{
 mode:'local'|'cloud';
 status:'local'|'connecting'|'connected'|'saving'|'error';
 error:string;
 authorized:boolean;
 playerCount:number;
 startCloud:()=>Promise<string>;
 joinCloud:()=>Promise<string>;
 leaveCloud:()=>void;
 retryCloud:()=>void;
}){
 const [busy,setBusy]=useState(false),[note,setNote]=useState(''),[failure,setFailure]=useState('');
 async function act(action:()=>Promise<string>){
   setBusy(true);setNote('');setFailure('');
   try{
     const result=await action();
     const messages:Record<string,string>={
       already:'Already connected to the live cloud session.',
       existing:'A live cloud session already exists. Use “Join existing cloud session” instead. Your browser data was not changed.',
       missing:'No live cloud session exists yet. Choose “Create cloud session from this browser”.',
       cancelled:'No changes were made.',
       created:'Live session created. This organizer account is now connected to Firestore.',
       joined:'Joined existing cloud session. Your browser has been updated from Firestore.'
     };
     setNote(messages[result]??result);
   }catch(e){setFailure((e as Error).message||String(e))}
   finally{setBusy(false)}
 }
 return <section className="cloud-control">
   <div className="cloud-control-head"><div><h2>Live cloud session (organizer-only preview)</h2><p>Synchronize check-ins, teams, games, and scores between devices signed in as the authorized organizer.</p></div>
   <span className={'cloud-pill '+(mode==='cloud'?'cloud-on':'')}><Cloud size={15}/>{mode==='cloud'?status==='connected'?'Connected':status==='saving'?'Saving…':status==='error'?'Connection issue':'Connecting…':'Local only'}</span></div>
   {mode==='local'?<div className="cloud-actions">
      <p><strong>{playerCount} saved profiles</strong> in this browser. Nothing is automatically uploaded or replaced.</p>
      <button type="button" className="btn primary" disabled={!authorized||busy} onClick={()=>act(startCloud)}><CloudUpload size={17}/> Create cloud session from this browser</button>
      <button type="button" className="btn secondary" disabled={!authorized||busy} onClick={()=>act(joinCloud)}><CloudDownload size={17}/> Join existing cloud session</button>
   </div>:<div className="cloud-actions">
      <p>Changes now save to a protected Firestore document. This is still a transitional single-document prototype.</p>
      {status==='error'&&<button type="button" className="btn primary" disabled={busy} onClick={retryCloud}>Retry connection</button>}
      <button type="button" className="btn secondary" disabled={busy||status==='saving'} onClick={()=>{setFailure('');try{leaveCloud();setNote('Disconnected. Your current browser copy remains available.')}catch(e){setFailure((e as Error).message)}}}><CloudOff size={17}/> Disconnect this browser</button>
   </div>}
   {!authorized&&<p className="cloud-warning"><AlertTriangle size={18}/> Sign in above as the authorized organizer to enable cloud access.</p>}
   {(error||failure)&&<p className="fb-error" role="alert">{failure||error}</p>}
   {note&&<p className="fb-feedback" role="status">{note}</p>}
   <p className="cloud-disclaimer">Not yet suitable for an unsupervised public kiosk. Only the authorized organizer account can access this session; separate kiosk, scorekeeper, and public-display permissions are next.</p>
 </section>;
}
