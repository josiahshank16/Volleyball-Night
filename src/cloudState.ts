import {useEffect,useState,useRef,useCallback} from 'react';
import {doc,onSnapshot,runTransaction,serverTimestamp} from 'firebase/firestore';
import {firestore} from './firebase';
import {type AppState,load,save,exportState} from './model';

// Open-access design prototype. The single document is readable and editable
// by anyone using the app. The eventual production model can add a leader PIN.
const LIVE_REF=doc(firestore,'liveSessions','current');
type Status='connecting'|'connected'|'saving'|'error';
function valid(s:unknown):s is AppState {
 if(!s||typeof s!=='object')return false;
 const v=s as Partial<AppState>;
 return Array.isArray(v.players)&&Array.isArray(v.history)&&!!v.session&&
 Array.isArray(v.session.checkedIn)&&Array.isArray(v.session.draft)&&
 Array.isArray(v.session.confirmed)&&Array.isArray(v.session.games);
}
function decode(source:unknown):AppState{
 const p=(source as {payload?:unknown}|undefined)?.payload;
 let v:unknown=p;
 if(p&&typeof p==='object'&&'json' in p){
  const json=(p as {json?:unknown}).json;
  if(typeof json!=='string')throw Error('Invalid cloud session format.');
  v=JSON.parse(json);
 }
 if(!valid(v))throw Error('The cloud session has an unsupported data format.');
 return v;
}
const encode=(state:AppState)=>({json:JSON.stringify(state)});
const describe=(e:unknown)=>{
 const err=e as {code?:string;message?:string};
 if(err.code==='permission-denied')return 'Firestore rules still require login. Publish the updated open-prototype firestore.rules from GitHub in Firebase Console.';
 if(err.code==='unavailable')return 'Firestore unavailable. Check the network and retry.';
 return err.code?err.code+': '+(err.message??'Unknown error'):err.message??String(e);
};
export function useCloudState(){
 const [state,setState]=useState<AppState>(load);
 const [status,setStatus]=useState<Status>('connecting');
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const [missing,setMissing]=useState(false);
 const latest=useRef(state);
 const pending=useRef(0);
 const connected=useRef(false);
 const queue=useRef<Promise<void>>(Promise.resolve());
 latest.current=state;
 useEffect(()=>{save(state)},[state]);
 useEffect(()=>{
  connected.current=false;setStatus('connecting');setError('');
  const off=onSnapshot(LIVE_REF,snap=>{
   try{
    if(!snap.exists()){setMissing(true);setStatus('error');setError('No cloud session exists yet. An organizer can initialize one from Settings.');return;}
    setMissing(false);
    const received=decode(snap.data());connected.current=true;
    if(pending.current===0){latest.current=received;setState(received);setStatus('connected');setError('');}
   }catch(err){connected.current=false;setStatus('error');setError(describe(err));}
  },err=>{connected.current=false;setStatus('error');setError(describe(err))});
  return()=>{connected.current=false;off()};
 },[retry]);
 const apply=useCallback((fn:(draft:AppState)=>void)=>{
  if(!connected.current){setStatus('error');setError('Not connected to Firestore. No changes were made. Use Retry connection in Organizer Settings.');return;}
  const optimistic=structuredClone(latest.current);fn(optimistic);
  latest.current=optimistic;setState(optimistic);pending.current++;setStatus('saving');
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   try{
    const result=await runTransaction(firestore,async tx=>{
     const snap=await tx.get(LIVE_REF);
     if(!snap.exists())throw Error('Cloud session is missing.');
     const next=structuredClone(decode(snap.data()));fn(next);
     tx.update(LIVE_REF,{payload:encode(next),updatedAt:serverTimestamp(),updatedBy:'open-prototype'});
     return next;
    });
    if(pending.current===1){latest.current=result;setState(result);setError('');}
   }catch(e){connected.current=false;setStatus('error');setError(describe(e));}
   finally{pending.current=Math.max(0,pending.current-1);if(pending.current===0&&connected.current)setStatus(v=>v==='error'?'error':'connected');}
  });
 },[]);
 const createCloud=async()=>{
  if(!missing)throw Error('A cloud session already exists. You do not need to initialize it again.');
  if(!window.confirm('Create the first shared cloud session from the player data saved in this browser?'))return;
  exportState(latest.current);
  await runTransaction(firestore,async tx=>{
   const check=await tx.get(LIVE_REF);
   if(check.exists())throw Error('A cloud session was already created. Use Retry connection.');
   tx.set(LIVE_REF,{schemaVersion:1,payload:encode(latest.current),updatedAt:serverTimestamp(),updatedBy:'open-prototype'});
  });
  setRetry(v=>v+1);
 };
 const retryCloud=()=>setRetry(v=>v+1);
 return {state,setState,apply,mode:'cloud' as const,status,error,retryCloud,createCloud,missing};
}
