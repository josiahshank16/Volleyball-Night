import {doc} from 'firebase/firestore';
import {firestore} from './firebase';
import type {AppState} from './model';

/**
 * A deliberately restricted projection for the public TV.
 * Do not include profile skill ratings, height, gender, check-in IDs,
 * history, organizer preferences, or Firebase credentials.
 * Published player names and match scores are visible to anyone with
 * access to the TV document when the organizer turns publishing on.
 */
export type PublicTVData={
 schemaVersion:1;
 enabled:boolean;
 date:string;
 teams:{id:string;name:string;players:string[];subs:number}[];
 games:{id:string;a:number;b:number;scoreA:number;scoreB:number;target:number;finished:boolean}[];
 currentGame:number;
 scoreTarget:number;
};
export const PUBLIC_TV_REF=doc(firestore,'publicDisplays','current');

export function toPublicTV(state:AppState):PublicTVData{
 const names=new Map(state.players.map(p=>[p.id,p.name]));
 const session=state.session;
 return {
  schemaVersion:1,
  enabled:state.publicTVEnabled===true,
  date:session.date,
  teams:session.confirmed.map(t=>({
    id:t.id,name:t.name,players:t.playerIds.map(id=>names.get(id)??'Former player'),
    subs:t.subs
  })),
  games:session.games.map(g=>({
    id:g.id,a:g.a,b:g.b,scoreA:g.scoreA??0,scoreB:g.scoreB??0,
    target:g.target??session.scoreTarget??25,finished:!!g.finishedAt
  })),
  currentGame:session.currentGame,
  scoreTarget:session.scoreTarget??25
 };
}

export function isPublicTVData(v:unknown):v is PublicTVData{
 if(!v||typeof v!=='object')return false;
 const p=v as Partial<PublicTVData>;
 return p.schemaVersion===1&&p.enabled===true&&typeof p.date==='string'&&
 Array.isArray(p.teams)&&Array.isArray(p.games)&&typeof p.currentGame==='number';
}
