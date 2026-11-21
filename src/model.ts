export type Gender = 'woman' | 'man' | 'other' | 'unspecified';
export type Player = {id:string; name:string; firstName?:string; lastName?:string; selfSkill:number; overrideSkill:number|null; gender:Gender; height:number|null; createdAt:number};
export type Roster = {id:string; name:string; playerIds:string[]; subs:number};
export type Session = {id:string; date:string; checkedIn:string[]; draft:Roster[]; confirmed:Roster[]; rounds:Round[]; games:Game[]; currentGame:number; scoreTarget?:number; confirmedAt:number|null};
export type Round = {id:string; at:number; rosters:Roster[]};
export type Game = {id:string; a:number; b:number; cycle:number; sidesSwapped?:boolean; scoreA?:number; scoreB?:number; serving?:'a'|'b'|null; scoreHistory?:{a:number;b:number;serving:'a'|'b'|null}[]; finishedAt?:number; target?:number};
export type PlayerGroup = {id:string;kind:'buddy'|'rival';playerIds:string[];name:string;sessionId?:string};
export type AppState = {playerGroups?:PlayerGroup[];players:Player[]; session:Session; history:{sessionId:string; roundId:string; at:number; teams:string[][]}[]; showNumbers:boolean; publicTVEnabled?:boolean; uiPinHash?:string};
export const SKILLS = [
  ['First Timer','I’m brand new to indoor volleyball and learning the rules, serving, and basic contact.'],
  ['Beginner','I know the basics, but serving, passing, and positioning are not yet consistent.'],
  ['Recreational','I can serve and return easier balls, but my control and rotations still need work.'],
  ['Developing','I serve fairly consistently, pass manageable balls, and understand basic court coverage.'],
  ['Intermediate','I contribute to three-touch rallies, communicate, and handle standard indoor rotations.'],
  ['Proficient','I can direct passes and sets, defend reliably, and make purposeful attacks.'],
  ['Skilled','I consistently control difficult balls and participate in coordinated offense and defense.'],
  ['Advanced','I read plays, attack and block effectively, and execute structured 6v6 strategies.'],
  ['Competitive','I regularly compete at a high level with strong serve receive, rotations, and fast offense.'],
  ['Elite','I play at an exceptional level with precise technique and advanced decisions under pressure.']
] as const;
export const formatPlayerName=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase().replace(/(^|[\s'-])\p{L}/gu,letter=>letter.toLocaleUpperCase());
export function normalizePlayerNames(state:AppState):AppState {
 const normalized={...state,players:state.players.map(p=>({...p,name:formatPlayerName(p.name),...(p.firstName?{firstName:formatPlayerName(p.firstName)}:{}),...(p.lastName?{lastName:formatPlayerName(p.lastName)}:{})}))};
 // Older confirmations left an identical draft behind. Clear only that exact
 // duplicate so existing groups recover without discarding later edits.
 if(state.session.confirmedAt!==null&&state.session.confirmed.length>0&&JSON.stringify(state.session.draft)===JSON.stringify(state.session.confirmed))normalized.session={...state.session,draft:[]};
 return normalized;
}

export const uid=()=>crypto.randomUUID();
export const skill=(p:Player)=>p.overrideSkill??p.selfSkill;
export const ft=(inches:number|null)=>inches===null?'Not set':`${Math.floor(inches/12)}′${inches%12}″`;
export const newSession=():Session=>({id:uid(),date:new Date().toISOString().slice(0,10),checkedIn:[],draft:[],confirmed:[],rounds:[],games:[],currentGame:0,scoreTarget:25,confirmedAt:null});
export const initial=():AppState=>({players:[],session:newSession(),history:[],showNumbers:false});
const STORE='volleyball-night-v01';
export function load(storageKey=STORE):AppState {try{const raw=localStorage.getItem(storageKey);if(raw){const v=JSON.parse(raw) as AppState;if(v?.players&&v?.session&&v?.history)return normalizePlayerNames(v);}}catch{/* ignore corrupted local data */}return initial();}
export function save(s:AppState,storageKey=STORE){
 const next=JSON.stringify(s);
 // Avoid an endless storage-event ping-pong between open tabs.
 if(localStorage.getItem(storageKey)===next)return;
 localStorage.setItem(storageKey,next);
 window.dispatchEvent(new CustomEvent('volleyball-saved'));
}
export function samplePlayers():Player[]{const names=['Alex','Jordan','Taylor','Morgan','Casey','Avery','Riley','Sam','Cameron','Jamie','Parker','Quinn','Blake','Reese','Drew','Harper','Charlie','Skyler'];return names.map((name,i)=>({id:uid(),name,selfSkill:[5,7,4,6,3,8,5,6,4,7,3,5,6,8,4,6,7,5][i],overrideSkill:null,gender:(i%3===0?'woman':i%3===1?'man':'unspecified') as Gender,height:i%5===0?74:i%5===1?69:i%5===2?64:i%5===3?72:67,createdAt:Date.now()}));}
export function configs(count:number):number[][] {
  const list:number[][]=[];
  function recurse(remaining:number, current:number[], max:number){
    if(remaining===0){if(current.length>=2&&current.length<=6)list.push([...current]);return;}
    if(current.length>=6)return;
    for(let n=Math.min(8,max,remaining);n>=4;n--)recurse(remaining-n,[...current,n],n);
  }
  recurse(count,[],8);
  // Prefer 6-person teams, few placeholders, and modest disparities; retain valid alternatives.
  const score=(sizes:number[])=>sizes.reduce((v,x)=>v+Math.abs(x-6)*1.2+Math.max(0,6-x)*2,0)+Math.max(...sizes)-Math.min(...sizes)+sizes.length*.15;
  return list.sort((a,b)=>score(a)-score(b)||a.length-b.length).slice(0,18);
}
function scoreRosters(rosters:string[][], players:Map<string,Player>, history:AppState['history'], previous:string[][]):number {
  const all=[...players.values()]; const globalSkill=all.reduce((s,p)=>s+skill(p),0)/(all.length||1);
  const globalHeight=all.filter(p=>p.height!==null).reduce((s,p)=>s+p.height!,0)/(all.filter(p=>p.height!==null).length||1);
  const genderTypes:Gender[]=['woman','man','other'];
  const globalGender=genderTypes.map(g=>all.filter(p=>p.gender===g).length/(all.length||1));
  let sum=0;
  for(const group of rosters){
    const people=group.map(id=>players.get(id)!).filter(Boolean); const n=people.length||1;
    const avg=people.reduce((s,p)=>s+skill(p),0)/n;
    sum+=Math.pow(avg-globalSkill,2)*7;
    const heights=people.filter(p=>p.height!==null).map(p=>p.height!);
    if(heights.length)sum+=Math.pow(heights.reduce((a,b)=>a+b,0)/heights.length-globalHeight,2)*.18;
    // Count very tall individuals, not just roster averages.
    const tallGlobal=all.filter(p=>p.height!==null&&p.height>=72).length/(all.length||1);
    sum+=Math.pow(people.filter(p=>p.height!==null&&p.height>=72).length/n-tallGlobal,2)*9;
    for(let j=0;j<genderTypes.length;j++)sum+=Math.pow(people.filter(p=>p.gender===genderTypes[j]).length/n-globalGender[j],2)*9;
    for(let a=0;a<group.length;a++)for(let b=a+1;b<group.length;b++){
      const pa=group[a],pb=group[b];
      let repeats=0;
      for(const h of history.slice(-40)){if(h.teams.some(t=>t.includes(pa)&&t.includes(pb)))repeats++;}
      sum+=Math.min(6,repeats)*.65;
      if(previous.some(t=>t.includes(pa)&&t.includes(pb)))sum+=.65;
    }
  }
  return sum;
}
function generateUnrestricted(players:Player[], sizes:number[], history:AppState['history'], prev:Roster[]=[]):Roster[]{
  if(sizes.reduce((a,b)=>a+b,0)!==players.length)throw Error('Team sizes must match attendance');
  const lookup=new Map(players.map(p=>[p.id,p]));const ids=players.map(p=>p.id);
  const previous=prev.map(r=>r.playerIds);
  let best:string[][]=[];let bestScore=Infinity;
  for(let restart=0;restart<15;restart++){
    const shuffled=[...ids].sort(()=>Math.random()-.5);let offset=0;
    const groups=sizes.map(n=>{const grp=shuffled.slice(offset,offset+n);offset+=n;return grp;});
    let curr=scoreRosters(groups,lookup,history,previous);
    for(let step=0;step<450;step++){
      const a=Math.floor(Math.random()*groups.length),b=Math.floor(Math.random()*groups.length);
      if(a===b)continue;
      const x=Math.floor(Math.random()*groups[a].length),y=Math.floor(Math.random()*groups[b].length);
      [groups[a][x],groups[b][y]]=[groups[b][y],groups[a][x]];
      const next=scoreRosters(groups,lookup,history,previous);
      const temp=Math.max(.08,2.0*(1-step/450));
      if(next<=curr||Math.random()<Math.exp((curr-next)/temp)){curr=next;}else{[groups[a][x],groups[b][y]]=[groups[b][y],groups[a][x]];}
    }
    // Small random perturbation gives Regenerate multiple good choices.
    const noisy=curr+Math.random()*.6;
    if(noisy<bestScore){bestScore=noisy;best=groups.map(g=>[...g]);}
  }
  return best.map((playerIds,i)=>({id:uid(),name:`Team ${i+1}`,playerIds,subs:Math.max(0,6-playerIds.length)}));
}
/** Checkout edits today's rosters only; arrivals remain available for assignment. */
export function reconcileAttendance(state:AppState){
 const checked=new Set(state.session.checkedIn);
 for(const team of [...state.session.draft,...state.session.confirmed]){
  const before=team.playerIds.length;team.playerIds=team.playerIds.filter(id=>checked.has(id));
  if(team.playerIds.length<before)team.subs=Math.max(team.subs,6-team.playerIds.length);
 }
 return state;
}

export function generate(players:Player[],sizes:number[],history:AppState['history'],prev:Roster[]=[],rules:PlayerGroup[]=[]):Roster[]{
 if(!sizes.length||sizes.some(n=>!Number.isInteger(n)||n<1||n>8))throw Error('Assign players to empty teams before regenerating, or generate a new lineup.');
 if(!rules.length)return generateUnrestricted(players,sizes,history,prev);
 if(sizes.reduce((a,b)=>a+b,0)!==players.length)throw Error('Team sizes must match attendance.');
 const ids=new Set(players.map(p=>p.id)),parent=new Map(players.map(p=>[p.id,p.id]));
 const find=(id:string):string=>{const p=parent.get(id)!;if(p===id)return id;const root=find(p);parent.set(id,root);return root};
 const active=rules.map(r=>({...r,playerIds:[...new Set(r.playerIds.filter(id=>ids.has(id)))]})).filter(r=>r.playerIds.length>1);
 for(const r of active.filter(r=>r.kind==='buddy'))for(const id of r.playerIds.slice(1))parent.set(find(id),find(r.playerIds[0]));
 const unitsMap=new Map<string,string[]>();for(const id of ids){const key=find(id);unitsMap.set(key,[...(unitsMap.get(key)??[]),id])}
 const units=[...unitsMap.values()];
 if(units.some(u=>u.length>Math.max(...sizes)))throw Error('A Buddies group is larger than every selected team. Choose larger teams or edit the group.');
 const rivals=active.filter(r=>r.kind==='rival');
 for(const r of rivals)if(new Set(r.playerIds.map(find)).size!==r.playerIds.length)throw Error('Buddies and Rivals conflict: linked buddies also belong to the same Rivals group. Edit those groups first.');
 const rivalSets=rivals.map(r=>new Set(r.playerIds));
 // The smallest possible number of same-team rival pairs for each group.
 const ideal=rivals.map(r=>{const n=r.playerIds.length,k=sizes.length,q=Math.floor(n/k),extra=n%k;return extra*q*(q+1)/2+(k-extra)*q*(q-1)/2});
 const collisions=(groups:string[][])=>rivalSets.map(set=>groups.reduce((total,g)=>{const n=g.filter(id=>set.has(id)).length;return total+n*(n-1)/2},0));
 const valid=(groups:string[][])=>collisions(groups).every((n,i)=>n<=ideal[i]);
 const lookup=new Map(players.map(p=>[p.id,p]));let best:string[][]|null=null,bestScore=Infinity;
 for(let restart=0;restart<32;restart++){
  const order=units.map(u=>({u,random:Math.random(),weight:rivalSets.filter(set=>u.some(id=>set.has(id))).length})).sort((a,b)=>b.u.length-a.u.length||b.weight-a.weight||a.random-b.random).map(x=>x.u);
  const groups=sizes.map(()=>[] as string[]);let budget=25000;
  const place=(index:number):boolean=>{
   if(--budget<0)return false;if(index===order.length)return true;
   const unit=order[index];
   const choices=groups.map((g,i)=>({i,random:Math.random(),used:g.length})).sort((a,b)=>a.used-b.used||a.random-b.random);
   for(const {i} of choices){
    if(groups[i].length+unit.length>sizes[i])continue;
    groups[i].push(...unit);
    if(valid(groups)&&place(index+1))return true;
    groups[i].splice(groups[i].length-unit.length);
   }
   return false;
  };
  if(!place(0))continue;
  // Improve skill, height, gender and teammate history without breaking groups.
  for(let step=0;step<250;step++){
   const u=units[Math.floor(Math.random()*units.length)],v=units[Math.floor(Math.random()*units.length)];
   if(u===v||u.length!==v.length)continue;
   const a=groups.findIndex(g=>g.includes(u[0])),b=groups.findIndex(g=>g.includes(v[0]));if(a===b)continue;
   const before=scoreRosters(groups,lookup,history,prev.map(t=>t.playerIds));
   const oldA=groups[a],oldB=groups[b];groups[a]=oldA.filter(id=>!u.includes(id)).concat(v);groups[b]=oldB.filter(id=>!v.includes(id)).concat(u);
   if(!valid(groups)||scoreRosters(groups,lookup,history,prev.map(t=>t.playerIds))>before){groups[a]=oldA;groups[b]=oldB}
  }
  const score=scoreRosters(groups,lookup,history,prev.map(t=>t.playerIds))+Math.random()*.6;
  if(score<bestScore){bestScore=score;best=groups.map(g=>[...g])}
 }
 if(!best)throw Error('Could not fit these Buddies and Rivals groups into the selected team sizes. Try a different layout or edit the groups. No rules were ignored.');
 return best.map((playerIds,i)=>({id:uid(),name:`Team ${i+1}`,playerIds,subs:Math.max(0,6-playerIds.length)}));
}

export const SCORE_TARGETS = [11,15,21,25] as const;
export function winnerOf(game:Game, fallbackTarget=25):'a'|'b'|null {
 const a=game.scoreA??0,b=game.scoreB??0,target=game.target??fallbackTarget;
 return Math.max(a,b)>=target && Math.abs(a-b)>=2 ? (a>b?'a':'b') : null;
}
export function buildGames(count:number,cycles:number,fullFour:boolean):Game[]{
  if(count<2)return[];
  let pattern:[number,number][]=[];
  if(count===2)pattern=[[0,1]];
  else if(count===3)pattern=[[0,1],[1,2],[0,2]];
  else if(count===4)pattern=[[0,1],[2,3],[0,2],[1,3],...(fullFour?[[0,3],[1,2]] as [number,number][]:[])];
  else {
    // Greedy approximate fair ordering for 5+ teams, with a slight rest preference.
    const pairings:[number,number][]=[];for(let a=0;a<count;a++)for(let b=a+1;b<count;b++)pairings.push([a,b]);
    const used=Array(count).fill(0),last=Array(count).fill(-2);
    while(pairings.length){const idxs=pairings.map((p,i)=>({i,p,v:used[p[0]]+used[p[1]]+(p.some(t=>last[t]===pattern.length-1)?1.5:0)+(p.some(t=>last[t]===pattern.length-2)?0.25:0)})).sort((a,b)=>a.v-b.v);const chosen=idxs[0];pattern.push(chosen.p);chosen.p.forEach(t=>{used[t]++;last[t]=pattern.length-1});pairings.splice(chosen.i,1);}
  }
  return Array.from({length:cycles},(_,cycle)=>pattern.map(([a,b])=>({id:uid(),a,b,cycle:cycle+1}))).flat();
}
export function exportState(state:AppState){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download=`volleyball-night-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

/** Status follows the team, independent of its physical side of the court. */
export function pointStatus(game:{scoreA?:number;scoreB?:number;target?:number},side:'a'|'b',fallbackTarget=25):'winner'|'set-point'|'' {
 const a=game.scoreA??0,b=game.scoreB??0,target=game.target??fallbackTarget;
 const own=side==='a'?a:b,other=side==='a'?b:a;
 if(Math.max(a,b)>=target&&Math.abs(a-b)>=2)return own>other?'winner':'';
 return own+1>=target&&own+1-other>=2?'set-point':'';
}
