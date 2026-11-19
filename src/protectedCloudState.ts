import {useCallback,useEffect,useRef,useState} from 'react';
import {collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'firebase/firestore';
import {firestore} from './firebase';
import {groupLocalCacheKey} from './groupConnection';
import {normalizePlayerNames,type AppState,type Player,load,save} from './model';
import {PUBLIC_TV_REF,toPublicTV} from './publicViews';

const LIVE_REF=doc(firestore,'liveSessions','current');
const ATTENDANCE_REF=doc(firestore,'attendance','current');
const PUBLIC_PLAYERS=collection(firestore,'publicPlayers');
const REGISTRATIONS=collection(firestore,'registrations');
type Status='connecting'|'connected'|'saving'|'error';
const message=(e:unknown)=>(e as Error)?.message||String(e);
function decode(raw:unknown):AppState{
 const value=(raw as {payload?:{json?:unknown}}|undefined)?.payload?.json;
 if(typeof value!=='string')throw Error('The protected group session is invalid.');
 const state=JSON.parse(value) as AppState;
 if(!Array.isArray(state.players)||!state.session||!Array.isArray(state.history))
  throw Error('The protected group session is incompatible with this app.');
 return normalizePlayerNames(state);
}
const payload=(state:AppState)=>({json:JSON.stringify(state)});

/** Organizer and scorekeeper sync after a successful server-checked PIN. */
export function useProtectedCloudState(){
 const [state,setState]=useState<AppState>(()=>load(groupLocalCacheKey));
 const [status,setStatus]=useState<Status>('connecting');
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const latest=useRef(state),attendance=useRef<string[]|null>(null);
 const connected=useRef(false),pending=useRef(0);
 const queue=useRef<Promise<void>>(Promise.resolve());
 const importing=useRef(new Set<string>());
 latest.current=state;
 useEffect(()=>{save(state,groupLocalCacheKey)},[state]);
 useEffect(()=>{
  connected.current=false;setStatus('connecting');setError('');
  const offLive=onSnapshot(LIVE_REF,snapshot=>{
   try{
    if(!snapshot.exists())throw Error('This protected group has no session. Ask the owner to finish migration.');
    const received=decode(snapshot.data());
    if(attendance.current)received.session.checkedIn=attendance.current;
    connected.current=true;
    if(!pending.current){latest.current=received;setState(received);setStatus('connected');setError('')}
   }catch(e){connected.current=false;setStatus('error');setError(message(e))}
  },e=>{connected.current=false;setStatus('error');setError(message(e))});
  const offAttendance=onSnapshot(ATTENDANCE_REF,snapshot=>{
   const ids=snapshot.data()?.checkedIn;
   if(!Array.isArray(ids)){setStatus('error');setError('The public attendance document is missing.');return}
   attendance.current=ids.filter((id):id is string=>typeof id==='string');
   if(!pending.current){
    latest.current={...latest.current,session:{...latest.current.session,checkedIn:attendance.current}};
    setState(latest.current);
   }
  },e=>{setStatus('error');setError(message(e))});
  const offRegistrations=onSnapshot(REGISTRATIONS,snapshot=>{
   for(const item of snapshot.docs){
    if(importing.current.has(item.id))continue;
    importing.current.add(item.id);
    void runTransaction(firestore,async tx=>{
     const session=await tx.get(LIVE_REF);
     if(!session.exists())throw Error('Protected session is missing.');
     const next=decode(session.data());
     if(!next.players.some(p=>p.id===item.id)){
      const entry=item.data();
      const player:Player={id:item.id,name:String(entry.name),selfSkill:Number(entry.selfSkill),
       overrideSkill:null,gender:entry.gender,height:entry.height,
       createdAt:entry.createdAt?.toMillis?.()??Date.now()};
      next.players.push(player);
      tx.update(LIVE_REF,{payload:payload(next),updatedAt:serverTimestamp(),updatedBy:'registration-import'});
     }
     tx.delete(item.ref);
    }).catch(e=>{setStatus('error');setError('New player registration could not be imported: '+message(e))})
     .finally(()=>importing.current.delete(item.id));
   }
  },e=>{setStatus('error');setError(message(e))});
  return()=>{connected.current=false;offLive();offAttendance();offRegistrations()};
 },[retry]);

 const apply=useCallback((fn:(draft:AppState)=>void)=>{
  if(!connected.current||!attendance.current){
   setStatus('error');setError('Protected group is not connected. No changes were made.');return false;
  }
  const optimistic=structuredClone(latest.current);fn(optimistic);
  latest.current=optimistic;setState(optimistic);pending.current++;setStatus('saving');
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   try{
    const result=await runTransaction(firestore,async tx=>{
     const live=await tx.get(LIVE_REF);
     const publicAttendance=await tx.get(ATTENDANCE_REF);
     if(!live.exists()||!publicAttendance.exists())throw Error('Protected group data is incomplete.');
     const before=decode(live.data()),next=structuredClone(before);
     const ids=publicAttendance.data().checkedIn;
     if(!Array.isArray(ids))throw Error('Attendance is invalid.');
     next.session.checkedIn=ids;
     fn(next);
     if(JSON.stringify(ids)!==JSON.stringify(next.session.checkedIn))
      tx.update(ATTENDANCE_REF,{checkedIn:next.session.checkedIn});
     const oldNames=new Map(before.players.map(p=>[p.id,p.name]));
     const newNames=new Map(next.players.map(p=>[p.id,p.name]));
     for(const [id,name] of newNames){
      if(oldNames.get(id)!==name)tx.set(doc(PUBLIC_PLAYERS,id),{name});
     }
     for(const id of oldNames.keys())if(!newNames.has(id))tx.delete(doc(PUBLIC_PLAYERS,id));
     tx.update(LIVE_REF,{payload:payload(next),updatedAt:serverTimestamp(),updatedBy:'leader'});
     tx.set(PUBLIC_TV_REF,{...toPublicTV({...next,publicTVEnabled:true}),updatedAt:serverTimestamp()});
     return next;
    });
    if(pending.current===1){latest.current=result;setState(result);setError('')}
   }catch(e){connected.current=false;setStatus('error');setError(message(e))}
   finally{pending.current=Math.max(0,pending.current-1);if(!pending.current&&connected.current)setStatus('connected')}
  });
  return true;
 },[]);
 const retryCloud=()=>setRetry(n=>n+1);
 const createCloud=async()=>{throw Error('This protected group is initialized by its owner.');};
 return {state,setState,apply,mode:'cloud' as const,status,error,retryCloud,createCloud,missing:false};
}
