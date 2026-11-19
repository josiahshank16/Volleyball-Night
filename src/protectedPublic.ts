import {useEffect,useMemo,useState} from 'react';
import {arrayRemove,arrayUnion,collection,doc,onSnapshot,query,serverTimestamp,updateDoc,writeBatch} from 'firebase/firestore';
import {firestore} from './firebase';
import {formatPlayerName,type Player} from './model';
import {PUBLIC_TV_REF,isPublicTVData,type PublicTVData} from './publicViews';

export const ACCESS_STATUS_REF=doc(firestore,'access','status');
const ATTENDANCE_REF=doc(firestore,'attendance','current');
const PUBLIC_PLAYERS=collection(firestore,'publicPlayers');
const REGISTRATIONS=collection(firestore,'registrations');
const errorText=(e:unknown)=>(e as Error)?.message||String(e);

export function useProtectionStatus(){
 const [status,setStatus]=useState<'loading'|'legacy'|'protected'|'error'>('loading');
 const [error,setError]=useState('');
 useEffect(()=>onSnapshot(ACCESS_STATUS_REF,snap=>{
  setStatus(snap.exists()&&snap.data().protected===true?'protected':'legacy');setError('');
 },e=>{
  // Older groups' prototype rules deny every unknown document. They do not
  // have an access/status document and must keep their legacy path.
  if((e as {code?:string}).code==='permission-denied'){setStatus('legacy');setError('');return}
  setStatus('error');setError(errorText(e));
 }),[]);
 return {status,error};
}

/** Open kiosk sees names and attendance only, never the protected session. */
export function usePublicKiosk(){
 const [players,setPlayers]=useState<Player[]>([]);
 const [checkedIn,setCheckedIn]=useState<string[]>([]);
 const [error,setError]=useState('');
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  const offPlayers=onSnapshot(query(PUBLIC_PLAYERS),snapshot=>{
   setPlayers(snapshot.docs.map(item=>({
    id:item.id,name:formatPlayerName(String(item.data().name??'')),selfSkill:5,overrideSkill:null,
    gender:'unspecified' as const,height:null,createdAt:0
   })).sort((a,b)=>a.name.localeCompare(b.name)));
  },e=>setError(errorText(e)));
  const offAttendance=onSnapshot(ATTENDANCE_REF,snapshot=>{
   if(!snapshot.exists()){setError('This group has no public check-in session. Ask the owner to finish access setup.');return;}
   const ids=snapshot.data().checkedIn;
   if(!Array.isArray(ids)){setError('This group has an invalid check-in session.');return;}
   setCheckedIn(ids.filter((id):id is string=>typeof id==='string'));
   setReady(true);setError('');
  },e=>setError(errorText(e)));
  return()=>{offPlayers();offAttendance()};
 },[]);
 const here=useMemo(()=>players.filter(p=>checkedIn.includes(p.id)),[players,checkedIn]);
 async function toggle(id:string){
  if(!ready)throw Error('Check-in is still connecting.');
  if(!players.some(p=>p.id===id))throw Error('This player is not in the group roster.');
  await updateDoc(ATTENDANCE_REF,{checkedIn:checkedIn.includes(id)?arrayRemove(id):arrayUnion(id)});
 }
 async function register(player:Player){
  if(!ready)throw Error('Check-in is still connecting.');
  const name=formatPlayerName(player.name);
  if(!name||name.length>50)throw Error('Enter a player name up to 50 characters.');
  const batch=writeBatch(firestore);
  batch.set(doc(PUBLIC_PLAYERS,player.id),{name});
  batch.set(doc(REGISTRATIONS,player.id),{
   name,selfSkill:player.selfSkill,gender:player.gender,height:player.height,
   createdAt:serverTimestamp()
  });
  batch.update(ATTENDANCE_REF,{checkedIn:arrayUnion(player.id)});
  await batch.commit();
 }
 return {players,here,ready,error,toggle,register};
}

export function usePublicTV(){
 const [data,setData]=useState<PublicTVData|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>onSnapshot(PUBLIC_TV_REF,snapshot=>{
  if(snapshot.exists()&&isPublicTVData(snapshot.data())){setData(snapshot.data() as PublicTVData);setError('')}
  else{setData(null);setError('Waiting for the organizer to publish the TV display.')}
 },e=>setError(errorText(e))),[]);
 return {data,error};
}
