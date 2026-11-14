export type Gender = 'woman' | 'man' | 'other' | 'unspecified';
export type Player = {id:string; name:string; selfSkill:number; overrideSkill:number|null; gender:Gender; height:number|null; createdAt:number};
export type Roster = {id:string; name:string; playerIds:string[]; subs:number};
export type Session = {id:string; date:string; checkedIn:string[]; draft:Roster[]; confirmed:Roster[]; rounds:Round[]; games:Game[]; currentGame:number; scoreTarget?:number; confirmedAt:number|null};
export type Round = {id:string; at:number; rosters:Roster[]};
export type Game = {id:string; a:number; b:number; cycle:number; scoreA?:number; scoreB?:number; serving?:'a'|'b'|null; scoreHistory?:{a:number;b:number;serving:'a'|'b'|null}[]; finishedAt?:number; target?:number};
export type AppState = {players:Player[]; session:Session; history:{sessionId:string; roundId:string; at:number; teams:string[][]}[]; showNumbers:boolean; publicTVEnabled?:boolean};
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
export const uid=()=>crypto.randomUUID();
export const skill=(p:Player)=>p.overrideSkill??p.selfSkill;
export const ft=(inches:number|null)=>inches===null?'Not set':`${Math.floor(inches/12)}′${inches%12}″`;
export const newSession=():Session=>({id:uid(),date:new Date().toISOString().slice(0,10),checkedIn:[],draft:[],confirmed:[],rounds:[],games:[],currentGame:0,scoreTarget:25,confirmedAt:null});
export const initial=():AppState=>({players:[],session:newSession(),history:[],showNumbers:false});
const STORE='volleyball-night-v01';
export function load():AppState {try{const raw=localStorage.getItem(STORE);if(raw){const v=JSON.parse(raw) as AppState;if(v?.players&&v?.session&&v?.history)return v;}}catch{/* ignore corrupted local data */}return initial();}
export function save(s:AppState){
 const next=JSON.stringify(s);
 // Avoid an endless storage-event ping-pong between open tabs.
 if(localStorage.getItem(STORE)===next)return;
 localStorage.setItem(STORE,next);
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
export function generate(players:Player[], sizes:number[], history:AppState['history'], prev:Roster[]=[]):Roster[]{
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
