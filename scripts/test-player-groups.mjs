import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=ts.transpile(fs.readFileSync(new URL('../src/model.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {generate,initial,reconcileAttendance}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const players=Array.from({length:24},(_,i)=>({id:String(i),name:`Player ${i}`,selfSkill:i%10+1,overrideSkill:null,gender:'unspecified',height:68,createdAt:0}));
const rule=(kind,ids)=>({id:crypto.randomUUID(),kind,playerIds:ids.map(String),name:''});
const teamFor=(teams,id)=>teams.findIndex(t=>t.playerIds.includes(String(id)));
function complete(teams,sizes,n){assert.deepEqual(teams.map(t=>t.playerIds.length),sizes);assert.equal(new Set(teams.flatMap(t=>t.playerIds)).size,n);assert.equal(teams.flatMap(t=>t.playerIds).length,n)}
for(let trial=0;trial<4;trial++){
 const teams=generate(players,[6,6,6,6],[],[],[rule('buddy',[0,1]),rule('buddy',[1,2]),rule('rival',[3,4,5,6])]);complete(teams,[6,6,6,6],24);
 assert.equal(teamFor(teams,0),teamFor(teams,2));assert.equal(new Set([3,4,5,6].map(id=>teamFor(teams,id))).size,4);
 const three=generate(players.slice(0,18),[6,6,6],[],[],[rule('rival',[0,1,2,3])]);complete(three,[6,6,6],18);
 assert.deepEqual(three.map(t=>t.playerIds.filter(id=>['0','1','2','3'].includes(id)).length).sort(),[1,1,2]);
}
const absent=generate(players.slice(0,12),[6,6],[],[],[rule('buddy',[0,1,99]),rule('rival',[2,3,98])]);assert.equal(teamFor(absent,0),teamFor(absent,1));assert.notEqual(teamFor(absent,2),teamFor(absent,3));
assert.throws(()=>generate(players.slice(0,12),[6,6],[],[],[rule('buddy',[0,1]),rule('rival',[0,1])]),/conflict/);
assert.throws(()=>generate(players.slice(0,12),[6,6],[],[],[rule('buddy',[0,1,2,3,4,5,6])]),/larger/);
const packed=players.slice(0,8);assert.throws(()=>generate(packed,[4,4],[],[],[rule('buddy',[0,1,2]),rule('buddy',[3,4,5]),rule('buddy',[6,7])]),/Could not fit/);
const state=initial();state.players=players;state.session.checkedIn=['0','1'];state.session.confirmed=[{id:'t',name:'Team 1',playerIds:['0','1'],subs:0}];state.session.draft=structuredClone(state.session.confirmed);state.session.games=[{id:'g',a:0,b:1,cycle:1,scoreA:12,scoreB:10}];state.history=[{sessionId:'old',roundId:'r',at:1,teams:[['0','1']]}];
const games=JSON.stringify(state.session.games),history=JSON.stringify(state.history);state.session.checkedIn.push('2');reconcileAttendance(state);assert.deepEqual(state.session.confirmed[0].playerIds,['0','1']);assert.equal(state.session.draft.length,1);
state.session.checkedIn=state.session.checkedIn.filter(id=>id!=='0');reconcileAttendance(state);assert.deepEqual(state.session.confirmed[0].playerIds,['1']);assert.deepEqual(state.session.draft[0].playerIds,['1']);assert.equal(JSON.stringify(state.session.games),games);assert.equal(JSON.stringify(state.history),history);
console.log('Passed: overlapping buddies, rival separation, 4 rivals / 3 teams, absent members, conflicts, impossible packing, arrivals, checkout, drafts, scores and history.');
