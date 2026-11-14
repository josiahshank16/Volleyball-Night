import {useCallback,useEffect,useRef,useState} from 'react';
import {onAuthStateChanged,type User} from 'firebase/auth';
import {doc,getDoc,onSnapshot,runTransaction,serverTimestamp} from 'firebase/firestore';
import {firebaseAuth,firestore} from './firebase';
import {type AppState,load,save,exportState} from './model';

const ORGANIZER_UID='lzA887v8R7d4yWoxVlHMG9ISrAK2';
const LIVE_REF=doc(firestore,'liveSessions','current');
const MODE_KEY='volleyball-cloud-mode-v1';
type Mode='local'|'cloud';
type Status='local'|'connecting'|'connected'|'saving'|'error';

function isAppState(value:unknown):value is AppState {
 if(!value||typeof value!=='object')return false;
 const v=value as Partial<AppState>;
 return Array.isArray(v.players)&&Array.isArray(v.history)&&
   !!v.session&&typeof v.session==='object'&&
   Array.isArray(v.session.checkedIn)&&Array.isArray(v.session.confirmed)&&
   Array.isArray(v.session.games)&&Array.isArray(v.session.draft);
}
function cloudPayload(data:unknown):AppState {
 const payload=(data as {payload?:unknown}|undefined)?.payload;
 if(!isAppState(payload))throw Error('Cloud data is not in a supported format. The existing browser data was preserved.');
 return payload;
}
function message(err:unknown):string {
 const code=(err as {code?:string}).code??'';
 if(code==='permission-denied')return 'Permission denied. Sign in as the organizer and verify the latest Firestore rules are published.';
 if(code==='unavailable')return 'Firestore is unavailable. Check your connection and use Retry connection.';
 if(code==='resource-exhausted')return 'Firestore limits were reached. Try again later.';
 return (err as Error)?.message??String(err);
}
export function useCloudState(){
 const [state,setState]=useState<AppState>(load);
 const [mode,setMode]=useState<Mode>(()=>localStorage.getItem(MODE_KEY)==='cloud'?'cloud':'local');
 const [status,setStatus]=useState<Status>('local');
 const [error,setError]=useState('');
 const [user,setUser]=useState<User|null>(firebaseAuth.currentUser);
 const [authReady,setAuthReady]=useState(false);
 const [retryKey,setRetryKey]=useState(0);
 const pending=useRef(0);
 const queue=useRef<Promise<void>>(Promise.resolve());
 const modeRef=useRef(mode);
 const connectedRef=useRef(false);
 const latest=useRef(state);
 modeRef.current=mode;
 latest.current=state;
 const authorized=authReady&&user?.uid===ORGANIZER_UID;
 const online=mode==='cloud'&&authorized;

 // Local browser copy is a fallback, never an automatic cloud upload.
 useEffect(()=>{save(state)},[state]);
 // Authentication is asynchronous. A null value *before* initialization
 // must never discard the user's saved cloud-mode preference.
 useEffect(()=>onAuthStateChanged(firebaseAuth,next=>{
   setUser(next);
   setAuthReady(true);
 }),[]);

 useEffect(()=>{
   connectedRef.current=false;
   if(mode!=='cloud'){setStatus('local');setError('');return;}
   if(!authReady){setStatus('connecting');return;}
   if(!authorized){
     setStatus('error');
     setError('Cloud session is paused. Sign in as the authorized organizer under Organizer → Settings → Firebase connection.');
     return;
   }
   setStatus('connecting');setError('');
   const unsubscribe=onSnapshot(LIVE_REF,snap=>{
     try{
       if(!snap.exists())throw Error('Cloud session was not found. Your local browser data is still available.');
       const remote=cloudPayload(snap.data());
       connectedRef.current=true;
       // Never overwrite optimistic edits while they are being committed.
       if(pending.current===0){setState(remote);setStatus('connected');setError('');}
     }catch(err){connectedRef.current=false;setStatus('error');setError(message(err));}
   },err=>{connectedRef.current=false;setStatus('error');setError(message(err))});
   return()=>{connectedRef.current=false;unsubscribe()};
 },[mode,authReady,authorized,retryKey]);

 const apply=useCallback((fn:(draft:AppState)=>void)=>{
   const inCloud=modeRef.current==='cloud';
   if(inCloud&&(!connectedRef.current||firebaseAuth.currentUser?.uid!==ORGANIZER_UID)){
     setStatus('error');
     setError('Cloud connection is not ready. No change was saved. Reconnect in Settings before continuing.');
     return;
   }
   // Keep the existing UI responsive. Firestore transaction is authoritative.
   const optimistic=structuredClone(latest.current);
   fn(optimistic);
   latest.current=optimistic;
   setState(optimistic);
   if(!inCloud)return;
   pending.current++;
   setStatus('saving');
   queue.current=queue.current.catch(()=>{}).then(async()=>{
     try{
       const result=await runTransaction(firestore,async tx=>{
         const snap=await tx.get(LIVE_REF);
         if(!snap.exists())throw Error('Cloud session was removed. Your browser data is preserved.');
         const next=structuredClone(cloudPayload(snap.data()));
         fn(next);
         tx.update(LIVE_REF,{payload:next,updatedAt:serverTimestamp(),updatedBy:ORGANIZER_UID});
         return next;
       });
       // Other queued optimistic changes should remain visible until saved.
       if(modeRef.current==='cloud'&&pending.current===1){
         latest.current=result;
         setState(result);
         setError('');
       }
     }catch(err){
       setError(message(err));
       setStatus('error');
       // Don't silently replace the local copy after a rejected write.
       connectedRef.current=false;
     }finally{
       pending.current=Math.max(0,pending.current-1);
       if(pending.current===0&&modeRef.current==='cloud'&&connectedRef.current){
         setStatus(current=>current==='error'?'error':'connected');
       }
     }
   });
 },[]);

 const startCloud=async()=>{
   if(firebaseAuth.currentUser?.uid!==ORGANIZER_UID)throw Error('Sign in as the authorized organizer first.');
   if(modeRef.current==='cloud')return 'already';
   const snap=await getDoc(LIVE_REF);
   if(snap.exists())return 'existing';
   if(!window.confirm('Create a new protected live cloud session using the data in THIS browser? This will not overwrite an existing cloud session.'))return 'cancelled';
   exportState(latest.current);
   await runTransaction(firestore,async tx=>{
     const check=await tx.get(LIVE_REF);
     if(check.exists())throw Error('A cloud session was created elsewhere. Join it instead.');
     tx.set(LIVE_REF,{payload:latest.current,schemaVersion:1,updatedBy:ORGANIZER_UID,updatedAt:serverTimestamp()});
   });
   localStorage.setItem(MODE_KEY,'cloud');
   setMode('cloud');setStatus('connecting');setError('');
   return 'created';
 };
 const joinCloud=async()=>{
   if(firebaseAuth.currentUser?.uid!==ORGANIZER_UID)throw Error('Sign in as the authorized organizer first.');
   const snap=await getDoc(LIVE_REF);
   if(!snap.exists())return 'missing';
   const remote=cloudPayload(snap.data());
   if(!window.confirm('Open the existing cloud session? The current browser state will be replaced by the cloud version. A JSON backup will be downloaded first.'))return 'cancelled';
   exportState(latest.current);
   latest.current=remote;
   setState(remote);
   localStorage.setItem(MODE_KEY,'cloud');setMode('cloud');setStatus('connecting');setError('');
   return 'joined';
 };
 const leaveCloud=()=>{
   if(pending.current>0)throw Error('A cloud save is still running. Finish the save before disconnecting.');
   localStorage.removeItem(MODE_KEY);setMode('local');setStatus('local');setError('');
 };
 const retryCloud=()=>{if(modeRef.current==='cloud'){setStatus('connecting');setRetryKey(n=>n+1)}};
 return {state,setState,apply,mode,status,error,user,online,startCloud,joinCloud,leaveCloud,retryCloud};
}
