import {useCallback,useEffect,useRef,useState} from 'react';
import {onAuthStateChanged,type User} from 'firebase/auth';
import {doc,getDoc,onSnapshot,runTransaction,serverTimestamp} from 'firebase/firestore';
import {firebaseAuth,firestore} from './firebase';
import {type AppState,load,save,exportState} from './model';

// Transitional organizer-only cloud sync. The entire app state is stored in
// one protected document. Split it into granular documents before public use.
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
 if(!isAppState(payload))throw Error('The cloud session has an unsupported data format. Local data was not replaced.');
 return payload;
}
function message(err:unknown):string {
 const code=(err as {code?:string}).code??'';
 if(code==='permission-denied')return 'Firestore denied access. Publish the updated organizer-only rules in Firebase Console, then try again.';
 if(code==='unavailable')return 'Could not reach Firestore. Check the connection and retry.';
 return (err as Error)?.message??String(err);
}
export function useCloudState(){
 const [state,setState]=useState<AppState>(load);
 const [mode,setMode]=useState<Mode>(()=>localStorage.getItem(MODE_KEY)==='cloud'?'cloud':'local');
 const [status,setStatus]=useState<Status>('local');
 const [error,setError]=useState('');
 const [user,setUser]=useState<User|null>(firebaseAuth.currentUser);
 const pending=useRef(0);
 const queue=useRef<Promise<void>>(Promise.resolve());
 const modeRef=useRef(mode);
 const online=mode==='cloud'&&user?.uid===ORGANIZER_UID;
 modeRef.current=mode;
 useEffect(()=>{save(state)},[state]);
 useEffect(()=>onAuthStateChanged(firebaseAuth,next=>{
   setUser(next);
   if(!next||next.uid!==ORGANIZER_UID){
     setMode(current=>{
       if(current==='cloud'){localStorage.removeItem(MODE_KEY);return 'local'}
       return current;
     });
   }
 }),[]);
 useEffect(()=>{
   if(!online){
     setStatus('local');
     return;
   }
   setStatus('connecting');
   const unsubscribe=onSnapshot(LIVE_REF,snap=>{
     try{
       if(!snap.exists())throw Error('The cloud session no longer exists. Local data is preserved.');
       const remote=cloudPayload(snap.data());
       if(pending.current===0){setState(remote);setStatus('connected');setError('')}
     }catch(err){
       setError(message(err));setStatus('error');
     }
   },err=>{setError(message(err));setStatus('error')});
   return ()=>unsubscribe();
 },[online]);

 const apply=useCallback((fn:(draft:AppState)=>void)=>{
   // Existing app actions remain unchanged, with an optimistic local update.
   setState(previous=>{const next=structuredClone(previous);fn(next);return next});
   if(modeRef.current!=='cloud'||firebaseAuth.currentUser?.uid!==ORGANIZER_UID)return;
   pending.current++;
   setStatus('saving');
   queue.current=queue.current.catch(()=>{}).then(async()=>{
     try{
       const result=await runTransaction(firestore,async transaction=>{
         const snapshot=await transaction.get(LIVE_REF);
         if(!snapshot.exists())throw Error('Cloud session was removed. Your local data remains in this browser.');
         const next=structuredClone(cloudPayload(snapshot.data()));
         fn(next);
         transaction.update(LIVE_REF,{payload:next,updatedAt:serverTimestamp(),updatedBy:ORGANIZER_UID});
         return next;
       });
       if(modeRef.current==='cloud'){setState(result);setError('')}
     }catch(err){
       setError(message(err));setStatus('error');
       // Keep local changes visible rather than silently discarding them.
     }finally{
       pending.current=Math.max(0,pending.current-1);
       if(pending.current===0&&modeRef.current==='cloud'){
         // Only show connected when no error occurred.
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
   exportState(state);
   await runTransaction(firestore,async tx=>{
     const check=await tx.get(LIVE_REF);
     if(check.exists())throw Error('A cloud session was created elsewhere. Join it instead.');
     tx.set(LIVE_REF,{payload:state,schemaVersion:1,updatedBy:ORGANIZER_UID,updatedAt:serverTimestamp()});
   });
   localStorage.setItem(MODE_KEY,'cloud');setMode('cloud');setError('');
   return 'created';
 };
 const joinCloud=async()=>{
   if(firebaseAuth.currentUser?.uid!==ORGANIZER_UID)throw Error('Sign in as the authorized organizer first.');
   const snap=await getDoc(LIVE_REF);
   if(!snap.exists())return 'missing';
   const remote=cloudPayload(snap.data());
   if(!window.confirm('Open the existing cloud session? The current browser state will be replaced by the cloud version. A JSON backup will be downloaded first.'))return 'cancelled';
   exportState(state);
   setState(remote);
   localStorage.setItem(MODE_KEY,'cloud');setMode('cloud');setError('');
   return 'joined';
 };
 const leaveCloud=()=>{
   if(pending.current>0)throw Error('A cloud save is still running. Finish the save before disconnecting.');
   localStorage.removeItem(MODE_KEY);setMode('local');setStatus('local');setError('');
 };
 return {state,setState,apply,mode,status,error,user,online,startCloud,joinCloud,leaveCloud};
}
