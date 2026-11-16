import {doc,getDocFromServer,getFirestore,runTransaction,serverTimestamp} from 'firebase/firestore';
import {firestore,firebaseConfig} from './firebase';
import type {AppState} from './model';

const validPin=(pin:string)=>/^\d{6}$/.test(pin);
const sessionRef=(db:ReturnType<typeof getFirestore>)=>doc(db,'liveSessions','current');
const decode=(data:unknown):AppState=>{
 const json=(data as {payload?:{json?:unknown}}|undefined)?.payload?.json;
 if(typeof json!=='string')throw Error('The group session is unavailable.');
 const state=JSON.parse(json) as AppState;
 if(!state.session||!Array.isArray(state.players))throw Error('The group session is invalid.');
 return state;
};
export async function pinHash(pin:string,projectId:string){
 if(!validPin(pin))throw Error('Enter exactly six digits.');
 const bytes=new TextEncoder().encode('Volleyball Night UI PIN:'+projectId+':'+pin);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

/** A convenience guard only. The live group document is still publicly writable. */
export async function askForUiPin(label:string){
 const snapshot=await getDocFromServer(sessionRef(firestore));
 if(!snapshot.exists())throw Error('The group session is unavailable.');
 const saved=decode(snapshot.data()).uiPinHash;
 if(!saved)return true;
 const entered=window.prompt('Enter the six-digit group PIN to '+label+':');
 if(entered===null)return false;
 if(!validPin(entered)||await pinHash(entered,firebaseConfig.projectId)!==saved){
  window.alert('That PIN did not match.');return false;
 }
 return true;
}

async function writePin(db:ReturnType<typeof getFirestore>,projectId:string,current:string|null,next:string){
 const nextHash=await pinHash(next,projectId);
 const currentHash=current===null?null:await pinHash(current,projectId);
 await runTransaction(db,async tx=>{
  const ref=sessionRef(db),snapshot=await tx.get(ref);
  if(!snapshot.exists())throw Error('The group session is unavailable.');
  const state=decode(snapshot.data());
  if(state.uiPinHash){
   if(currentHash!==state.uiPinHash)throw Error('The current PIN did not match.');
  }else if(current!==null){
   throw Error('This group does not have a PIN yet. Refresh and set its first PIN.');
  }
  state.uiPinHash=nextHash;
  tx.update(ref,{payload:{json:JSON.stringify(state)},schemaVersion:1,
   updatedAt:serverTimestamp(),updatedBy:'ui-pin-settings'});
 });
}
export async function changeUiPin(current:string|null,next:string){
 if(current===next)throw Error('Choose a different new PIN.');
 await writePin(firestore,firebaseConfig.projectId,current,next);
}
