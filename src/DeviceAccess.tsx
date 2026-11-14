import {useEffect,useState} from 'react';
import {onAuthStateChanged,signInAnonymously,type User} from 'firebase/auth';
import {collection,doc,getDoc,onSnapshot,serverTimestamp,setDoc,updateDoc} from 'firebase/firestore';
import {CheckCircle2,Clock,MonitorSmartphone,ShieldCheck,ShieldX,Tablet,RefreshCw} from 'lucide-react';
import {firebaseAuth,firestore} from './firebase';

type DeviceRole='kiosk'|'scorekeeper';
type DeviceStatus='pending'|'approved'|'revoked';
type DeviceRecord={
 role:DeviceRole;
 label:string;
 status:DeviceStatus;
 createdAt?:unknown;
 approvedAt?:unknown;
};
const devices=collection(firestore,'devices');
const deviceRef=(uid:string)=>doc(firestore,'devices',uid);
const isDeviceRecord=(d:unknown):d is DeviceRecord=>!!d&&typeof d==='object'&&
 ['kiosk','scorekeeper'].includes((d as DeviceRecord).role)&&
 ['pending','approved','revoked'].includes((d as DeviceRecord).status)&&
 typeof (d as DeviceRecord).label==='string';
const explain=(error:unknown)=> {
 const e=error as {code?:string;message?:string};
 if(e.code==='auth/operation-not-allowed')return 'Enable Anonymous authentication in Firebase Console → Authentication → Sign-in method, then try again.';
 if(e.code==='permission-denied')return 'Firestore permission denied. Publish the latest firestore.rules from GitHub in Firebase, then retry.';
 return e.code?e.code+': '+(e.message??'Unknown error'):e.message??String(error);
};
const roleLabel=(role:DeviceRole)=>role==='kiosk'?'Check-in kiosk':'Scorekeeper';
const link=(role:DeviceRole)=>location.origin+location.pathname+'?device='+role;

export function DeviceManager(){
 const [authorized,setAuthorized]=useState(false);
 const [items,setItems]=useState<{id:string;record:DeviceRecord}[]>([]);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState('');
 useEffect(()=>onAuthStateChanged(firebaseAuth,u=>setAuthorized(u?.uid==='lzA887v8R7d4yWoxVlHMG9ISrAK2')),[]);
 useEffect(()=>{
  if(!authorized)return;
  return onSnapshot(devices,snap=>{
   setItems(snap.docs.map(doc=>({id:doc.id,record:doc.data() as DeviceRecord})).filter(item=>isDeviceRecord(item.record)));
   setMessage('');
  },err=>setMessage(explain(err)));
 },[authorized]);
 const change=async(id:string,status:DeviceStatus)=>{
  setBusy(id);setMessage('');
  try{await updateDoc(deviceRef(id),{status,approvedAt:status==='approved'?serverTimestamp():null})}
  catch(e){setMessage(explain(e))}finally{setBusy('')}
 };
 return <section className="device-panel">
  <h2>Device pairing (setup preview)</h2>
  <p>Approve a separate kiosk or scorekeeper without sharing your organizer password. Pairing <strong>does not yet enable check-ins or scoring</strong>; restricted operational data access is the next step.</p>
  <div className="device-links">
   {(['kiosk','scorekeeper'] as const).map(role=><div className="device-link" key={role}>
    {role==='kiosk'?<Tablet size={22}/>:<MonitorSmartphone size={22}/>}
    <strong>{roleLabel(role)}</strong>
    <button type="button" className="btn secondary" onClick={()=>navigator.clipboard.writeText(link(role)).then(()=>setMessage(roleLabel(role)+' pairing link copied.'))}>Copy pairing link</button>
    <button type="button" className="btn secondary" onClick={()=>window.open(link(role),'_blank','noopener,noreferrer')}>Open</button>
   </div>)}
  </div>
  <h3>Requested devices</h3>
  {!authorized?<p>Sign into Firebase as the organizer above to review device requests.</p>:items.length===0?<p>No device pairing requests yet. Open one of the pairing links in a private browser or another device.</p>:
   <div className="device-list">{items.map(({id,record})=><div className="device-item" key={id}>
    <div><strong>{record.label}</strong> <span className="device-meta">{roleLabel(record.role)} · {record.status} · {id.slice(0,8)}</span></div>
    <div className="device-buttons">
     {record.status!=='approved'&&record.status!=='revoked'&&<button className="btn primary" disabled={!!busy} onClick={()=>change(id,'approved')}><CheckCircle2 size={16}/> Approve</button>}
     {record.status==='revoked'&&<button className="btn secondary" disabled={!!busy} onClick={()=>change(id,'approved')}><ShieldCheck size={16}/> Reapprove</button>}
     {record.status==='approved'&&<button className="btn secondary" disabled={!!busy} onClick={()=>change(id,'revoked')}><ShieldX size={16}/> Revoke</button>}
     {record.status==='pending'&&<button className="btn secondary" disabled={!!busy} onClick={()=>change(id,'revoked')}>Reject</button>}
    </div>
   </div>)}</div>}
  {message&&<p className="device-feedback" role="status">{message}</p>}
 </section>;
}

export function DevicePairing(){
 const params=new URLSearchParams(location.search);
 const role:DeviceRole=params.get('device')==='scorekeeper'?'scorekeeper':'kiosk';
 const [user,setUser]=useState<User|null>(firebaseAuth.currentUser);
 const [ready,setReady]=useState(false);
 const [record,setRecord]=useState<DeviceRecord|null>(null);
 const [label,setLabel]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>onAuthStateChanged(firebaseAuth,u=>{setUser(u);setReady(true)}),[]);
 useEffect(()=>{
  if(!user?.isAnonymous)return;
  return onSnapshot(deviceRef(user.uid),snap=>{
   const data=snap.data();setRecord(isDeviceRecord(data)?data:null);
  },err=>setError(explain(err)));
 },[user]);
 const register=async()=>{
  setBusy(true);setError('');
  try{
   let current=user;
   if(!current){const cred=await signInAnonymously(firebaseAuth);current=cred.user;}
   if(!current.isAnonymous)throw Error('This browser is signed into an existing Firebase account. Open the pairing link in a private/incognito window to register a separate device without signing out the organizer.');
   const ref=deviceRef(current.uid);
   if((await getDoc(ref)).exists())throw Error('This device already has a request. Its status will appear here.');
   await setDoc(ref,{role,label:label.trim()||roleLabel(role),status:'pending',createdAt:serverTimestamp()});
  }catch(e){setError(explain(e))}finally{setBusy(false)}
 };
 return <div className="device-pairing-screen">
  <div className="device-pairing-card">
   <span className="eyebrow">VOLLEYBALL NIGHT</span>
   <h1>{roleLabel(role)} pairing</h1>
   <p>Request approval for this browser without using the organizer's Firebase password.</p>
   {!ready?<p><RefreshCw size={18}/> Checking device sign-in…</p>:record?<div className="device-status">
    {record.status==='approved'?<ShieldCheck size={32}/>:record.status==='pending'?<Clock size={32}/>:<ShieldX size={32}/>}
    <h2>{record.status==='approved'?'Approved':record.status==='pending'?'Waiting for organizer approval':'Device access revoked'}</h2>
    <p>{record.label} · {roleLabel(record.role)}</p>
    {record.status==='approved'&&<p>Pairing succeeded. Check-in and scorekeeping features for approved devices will be connected in the next development step.</p>}
    {record.status==='pending'&&<p>Keep this page open. The organizer can approve this request in Settings → Device pairing.</p>}
   </div>:user&&!user.isAnonymous?<p className="device-feedback">This browser is signed into another Firebase account. Open this URL in a private/incognito window to pair a separate device.</p>:<div className="device-form">
    <label htmlFor="device-label">Device name (optional)</label>
    <input id="device-label" value={label} maxLength={40} onChange={e=>setLabel(e.target.value)} placeholder={role==='kiosk'?'Gym entrance tablet':'Score table iPad'}/>
    <button className="btn primary" type="button" disabled={busy} onClick={register}>Request {roleLabel(role)} access</button>
   </div>}
   {error&&<p className="fb-error" role="alert">{error}</p>}
   {user?.isAnonymous&&<small>Device ID: {user.uid.slice(0,12)}…</small>}
  </div>
 </div>;
}
