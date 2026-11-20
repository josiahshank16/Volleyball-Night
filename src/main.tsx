import React, {useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Users,UserPlus,ClipboardCheck,Shuffle,CalendarDays,Monitor,Settings,Search,Check,Plus,ChevronRight,ArrowRight,RotateCcw,Download,Trash2, X, Info, Cloud, Play, Minus, Undo2, Trophy, RefreshCw, Pencil, CircleCheck, KeyRound, Volleyball, ArrowUpRight} from 'lucide-react';
import {pointStatus,formatPlayerName,AppState,Player,SKILLS,uid,ft,skill,newSession,samplePlayers,configs,generate,buildGames,exportState,Gender,SCORE_TARGETS,winnerOf} from './model';
import {ModeHome,ModeSwitch,goMode,modeHref} from './ModeHome';
import {GroupSetup} from './GroupSetup';
import {GoogleSetupPilot} from './GoogleSetupPilot';
import {MyGroups} from './MyGroups';
import {connectedGroupName,firebaseConfig} from './firebase';
import {activeGroup,groupLinkError,isIndependentGroupSite,useOriginalGroup} from './groupConnection';
import {useCloudState} from './cloudState';
import {useProtectedCloudState} from './protectedCloudState';
import {useProtectionStatus,usePublicKiosk,usePublicTV} from './protectedPublic';
import {enterLeaderMode} from './leaderAccess';
import {firebaseAuth} from './firebase';
import {onAuthStateChanged} from 'firebase/auth';
import {leaderEmail} from './accessAdmin';
import {OwnerAccess} from './OwnerAccess';
import {ChangePin} from './ChangePin';
import {UiPinSettings} from './UiPinSettings';
import {askForUiPin} from './uiPin';
import {MainLaunchpad,AdminSettings,GroupSiteHandoff} from './MainLaunchpad';
import {HowItWorks} from './HowItWorks';
import {toPublicTV,type PublicTVData} from './publicViews';
import {DndContext,PointerSensor,KeyboardSensor,pointerWithin,rectIntersection,useSensor,useSensors,type DragEndEvent} from '@dnd-kit/core';
import {DragPlayer,DropTeam} from './DragTeams';
import './style.css';
type Page='checkin'|'players'|'teams'|'schedule'|'settings';
const copy=<T,>(x:T):T=>structuredClone(x);
const byName=(a:Player,b:Player)=>a.name.localeCompare(b.name);
function App({stateHook=useCloudState,protectedMode=false}:{stateHook?:typeof useCloudState;protectedMode?:boolean}){
 const {state,apply,mode:cloudMode,status:cloudStatus,error:cloudError,retryCloud,createCloud,missing}=stateHook();
 const [page,setPage]=useState<Page>('checkin');const [organizer]=useState(new URLSearchParams(location.search).get('mode')==='organizer');
 const [search,setSearch]=useState('');const [editing,setEditing]=useState<Player|null>(null);const [creating,setCreating]=useState(false);
 const [selectedConfig,setSelectedConfig]=useState('');const [swap,setSwap]=useState<{team:number;id:string}|null>(null);
 const [newTeamPlayers,setNewTeamPlayers]=useState<string[]>([]);
 const [newGameA,setNewGameA]=useState(0),[newGameB,setNewGameB]=useState(1);
 const [cycles,setCycles]=useState(1);const [fullFour,setFullFour]=useState(false);const [message,setMessage]=useState('');
 const [showAllPlayers,setShowAllPlayers]=useState(false);
 const teamSensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor));

 const update=(fn:(draft:AppState)=>void)=>apply(fn);
 const players=useMemo(()=>[...state.players].sort(byName),[state.players]);
 const here=players.filter(p=>state.session.checkedIn.includes(p.id));
 const searchMatches=players.filter(p=>p.name.toLowerCase().includes(search.trim().toLowerCase()));
 const patterns=useMemo(()=>configs(here.length),[here.length]);
 const configKey=(v:number[])=>v.join('-');
 const validChoice=patterns.find(v=>configKey(v)===selectedConfig)??patterns[0];
 const roster=state.session.draft.length?state.session.draft:state.session.confirmed;
 const assigned=new Set(state.session.confirmed.flatMap(t=>t.playerIds));
 const available=here.filter(p=>!assigned.has(p.id));
 function flash(msg:string){setMessage(msg);window.setTimeout(()=>setMessage(''),3200)}
 function confirmReplaceGames(){
  return !state.session.games.length||window.confirm('This will replace the current game schedule and scores. Completed team lineups remain in history. Continue?');
 }
 function toggleAttendance(id:string){const saved=update(s=>{
  const a=s.session.checkedIn;
  s.session.checkedIn=a.includes(id)?a.filter(v=>v!==id):[...a,id];
  // A draft is based on the old attendance. Confirmed teams and live scores
  // must remain intact when someone checks in late or leaves early.
  s.session.draft=[];
 });if(saved&&state.session.confirmed.length)flash('Attendance updated. Existing teams and scores stay in place.');}
 function makeTeams(){if(!validChoice||!confirmReplaceGames())return;try{update(s=>{const attending=s.players.filter(p=>s.session.checkedIn.includes(p.id));s.session.draft=generate(attending,validChoice,s.history,s.session.draft);s.session.confirmed=[];s.session.games=[];s.session.currentGame=0;s.session.confirmedAt=null});flash('Teams generated. Review before confirming.')}catch(e){flash(String(e))}}
 function regenerate(){const sizes=state.session.draft.map(t=>t.playerIds.length);if(!sizes.length)return;update(s=>{const attending=s.players.filter(p=>s.session.checkedIn.includes(p.id));s.session.draft=generate(attending,sizes,s.history,s.session.draft)});flash('New team arrangement generated.')}
 function confirm(){if(!state.session.draft.length)return;update(s=>{const confirmed=copy(s.session.draft);s.session.confirmed=confirmed;s.session.confirmedAt=Date.now();const round={id:uid(),at:Date.now(),rosters:copy(confirmed)};s.session.rounds.push(round);s.history.push({sessionId:s.session.id,roundId:round.id,at:round.at,teams:confirmed.map(r=>[...r.playerIds])});s.session.games=[];s.session.currentGame=0});flash('Confirmed. This lineup is saved in team history.')}
 function adjustTeam(team:number,subChange:number){update(s=>{const list=s.session.draft.length?s.session.draft:s.session.confirmed;const t=list[team];if(t)t.subs=Math.max(0,t.subs+subChange)});}
 function pickPlayer(team:number,id:string){if(!swap){setSwap({team,id});return}if(swap.id===id){setSwap(null);return}update(s=>{const list=s.session.draft.length?s.session.draft:s.session.confirmed;const a=list[swap.team],b=list[team];if(!a||!b)return;const ai=a.playerIds.indexOf(swap.id),bi=b.playerIds.indexOf(id);if(ai!==-1&&bi!==-1)[a.playerIds[ai],b.playerIds[bi]]=[b.playerIds[bi],a.playerIds[ai]]});setSwap(null);flash('Players swapped. Live games and scores are preserved.');}
 function movePlayer(id:string,from:number,to:number){if(from===to)return false;const saved=update(s=>{const list=s.session.draft.length?s.session.draft:s.session.confirmed;const src=list[from],dst=list[to];if(!src||!dst||dst.playerIds.length>=8||!src.playerIds.includes(id))return;src.playerIds=src.playerIds.filter(p=>p!==id);dst.playerIds.push(id);if(src.subs<Math.max(0,6-src.playerIds.length))src.subs=Math.max(0,6-src.playerIds.length);dst.subs=Math.max(0,dst.subs-1)});if(saved)setSwap(null);return saved}
 function assignLivePlayer(id:string,team:number){if(!available.some(p=>p.id===id)||state.session.confirmed[team]?.playerIds.length>=8)return;
  update(s=>{const t=s.session.confirmed[team];if(!t||t.playerIds.length>=8||s.session.confirmed.some(r=>r.playerIds.includes(id))||!s.session.checkedIn.includes(id))return;t.playerIds.push(id);t.subs=Math.max(0,t.subs-1);s.session.draft=[]});
  setNewTeamPlayers(v=>v.filter(item=>item!==id));flash('Player added to the live team. Games and scores are unchanged.');
 }
 function removeLivePlayer(id:string){const p=state.players.find(p=>p.id===id);if(!window.confirm(`Remove ${p?.name??'this player'} from tonight’s team and check-in? Their saved profile and game scores will remain.`))return;
  update(s=>{s.session.checkedIn=s.session.checkedIn.filter(item=>item!==id);for(const t of s.session.confirmed){if(t.playerIds.includes(id)){t.playerIds=t.playerIds.filter(item=>item!==id);t.subs=Math.max(t.subs,Math.max(0,6-t.playerIds.length))}}s.session.draft=[]});
  setSwap(null);flash('Player removed from tonight. Schedule and scores are unchanged.');
 }
 function createLiveTeam(){const ids=newTeamPlayers.filter(id=>available.some(p=>p.id===id));if(!ids.length||ids.length>8)return;
  const teamId=uid();
  update(s=>{const unused=ids.filter(id=>s.session.checkedIn.includes(id)&&!s.session.confirmed.some(t=>t.playerIds.includes(id)));if(!unused.length)return;
   s.session.confirmed.push({id:teamId,name:`Team ${s.session.confirmed.length+1}`,playerIds:unused.slice(0,8),subs:Math.max(0,6-unused.length)});s.session.draft=[]});
  setNewTeamPlayers([]);flash('New team added. Add its matchups in Game schedule.');
 }
 function dropPlayer(e:DragEndEvent){
  const active=String(e.active.id),target=String(e.over?.id??'');
  if(!active.startsWith('player:')||!target.startsWith('team:'))return;
  const id=active.slice(7),to=Number(target.slice(5));
  const from=roster.findIndex(t=>t.playerIds.includes(id));
  if(from<0||!Number.isInteger(to)||to<0||to>=roster.length||from===to)return;
  if(roster[to].playerIds.length>=8){flash('That team already has eight players.');return;}
  if(movePlayer(id,from,to))flash(state.session.draft.length?'Player moved. Confirm the adjusted teams when ready.':'Player moved. Live games and scores are unchanged.');
 }
 function createSchedule(){if(state.session.confirmed.length<2||!confirmReplaceGames())return;update(s=>{s.session.games=buildGames(s.session.confirmed.length,cycles,fullFour);s.session.currentGame=0});flash('Game schedule created.')}
 function reorderGame(id:string,direction:number){update(s=>{
  const games=s.session.games,index=games.findIndex(g=>g.id===id),to=index+direction;
  if(index<=s.session.currentGame||to<=s.session.currentGame||to>=games.length)return;
  const currentId=games[s.session.currentGame]?.id;
  [games[index],games[to]]=[games[to],games[index]];
  if(currentId)s.session.currentGame=games.findIndex(g=>g.id===currentId);
 });}
 function addGame(){update(s=>{
  if(newGameA===newGameB||!s.session.confirmed[newGameA]||!s.session.confirmed[newGameB])return;
  s.session.games.push({id:uid(),a:newGameA,b:newGameB,cycle:Math.max(1,...s.session.games.map(g=>g.cycle))});
 });}
 function newNight(){if(!window.confirm('Start a new volleyball night? Attendance, teams, and tonight’s schedule will reset. Player profiles and saved team history will remain.'))return;update(s=>{s.session=newSession()});setPage('checkin');flash('New session started.')}
 function upsertPlayer(p:Player){
  const saved=update(s=>{
   const idx=s.players.findIndex(q=>q.id===p.id);
   if(idx===-1){
    s.players.push(p);
    // A player registered at the check-in kiosk is here to play tonight.
    s.session.checkedIn.push(p.id);s.session.draft=[];
   }else s.players[idx]=p;
  });
  if(!saved)return;
  setEditing(null);setCreating(false);setSearch('');
  flash(organizer?'Player saved.':state.session.confirmed.length?'You’re checked in! Existing teams and scores stay in place.':'You’re checked in!');
 }
 function removePlayer(id:string){if(!window.confirm('Delete this saved player profile? The player will leave tonight’s teams, but the schedule and scores will remain.'))return;update(s=>{s.players=s.players.filter(p=>p.id!==id);s.session.checkedIn=s.session.checkedIn.filter(v=>v!==id);s.session.draft=[];for(const t of s.session.confirmed){if(t.playerIds.includes(id)){t.playerIds=t.playerIds.filter(v=>v!==id);t.subs=Math.max(t.subs,Math.max(0,6-t.playerIds.length))}}})}
 const openDisplay=()=>goMode('tv');
 const openWithPin=(mode:'home'|'organizer'|'scorekeeper',label:string)=>{
  if(protectedMode||!activeGroup){goMode(mode);return}
  void askForUiPin(label).then(ok=>{if(ok)goMode(mode)})
   .catch(err=>window.alert((err as Error)?.message||String(err)));
 };
 const openScorekeeper=()=>openWithPin('scorekeeper','open Scorekeeper');
 const viewDisplay=new URLSearchParams(location.search).get('mode')==='tv'||new URLSearchParams(location.search).has('display')||new URLSearchParams(location.search).has('publicTv');
 if(viewDisplay)return <><Display data={toPublicTV({...state,publicTVEnabled:true})} uiPin={!protectedMode&&!!activeGroup}/><CloudHealth mode={cloudMode} status={cloudStatus} error={cloudError}/></>;
 if(new URLSearchParams(location.search).get('mode')==='scorekeeper'||new URLSearchParams(location.search).has('scorekeeper'))return <><ModeSwitch floating uiPin={!protectedMode&&!!activeGroup}/><Scorekeeper state={state} update={update}/><CloudHealth mode={cloudMode} status={cloudStatus} error={cloudError}/></>;
 if(!organizer)return <>
  <KioskCheckin players={players} here={here} search={search} setSearch={setSearch} matches={searchMatches} showAllPlayers={showAllPlayers} setShowAllPlayers={setShowAllPlayers} message={message}
    teamsReady={state.session.confirmed.length} onToggleAttendance={toggleAttendance} onCreatePlayer={()=>{setEditing(null);setCreating(true)}} onOpenDisplay={openDisplay} onOpenScorekeeper={openScorekeeper} onEnterOrganizer={()=>openWithPin('organizer','open Organizer')} onSwitchMode={()=>openWithPin('home','switch modes')}/>
  {(creating||editing)&&<PlayerModal player={editing} initialName={search.trim()} onClose={()=>{setCreating(false);setEditing(null)}} onSave={upsertPlayer}/>}
  <CloudHealth mode={cloudMode} status={cloudStatus} error={cloudError}/>
 </>;
 return <div className="app">
  <aside className="sidebar">
   <div className="brand"><div className="brandmark"><Volleyball size={24}/></div><div><b>VOLLEYBALL</b><span>NIGHT</span></div></div>
   <div className="sidebar-label">PLAYERS</div>
   <Nav icon={<ClipboardCheck size={19}/>} name="Check-in" active={page==='checkin'} click={()=>setPage('checkin')}/>
   {organizer&&<><div className="sidebar-label top-gap">ORGANIZER</div><Nav icon={<Users size={19}/>} name="Player profiles" active={page==='players'} click={()=>setPage('players')}/><Nav icon={<Shuffle size={19}/>} name="Team builder" active={page==='teams'} click={()=>setPage('teams')}/><Nav icon={<CalendarDays size={19}/>} name="Game schedule" active={page==='schedule'} click={()=>setPage('schedule')}/><Nav icon={<Settings size={19}/>} name="Settings" active={page==='settings'} click={()=>setPage('settings')}/></>}
   <div className="sidebar-bottom"><button className="nav display-link" onClick={openScorekeeper}><Trophy size={19}/> Open scorekeeper <ArrowUpRight size={15}/></button><button className="nav display-link" onClick={openDisplay}><Monitor size={19}/> Open TV display <ArrowUpRight size={15}/></button><p>{protectedMode?'Leader access active':activeGroup?'Group PIN on mode buttons':'Open live design preview'}</p></div>
  </aside>
  <div className="main">
   <header className="header"><div className="crumb"><span>Volleyball Night</span><ChevronRight size={15}/><b>{({checkin:'Check-in',players:'Player profiles',teams:'Team builder',schedule:'Game schedule',settings:'Settings'})[page]}</b></div><div className="headright"><span className="date">{new Date(state.session.date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span><span className="tiny-dot"/><span className="organizer-header-detail">{connectedGroupName}</span><span className="tiny-dot"/><span className="organizer-header-detail">{organizer?'Organizer':'Player kiosk'}</span><ModeSwitch uiPin={!protectedMode&&!!activeGroup}/></div></header>
   <main className="content">{cloudMode==='cloud'&&<div className={'cloud-topline '+(cloudStatus==='error'?'cloud-error':'')} role="status"><Cloud size={17}/><div><strong>Live group session: {cloudStatus==='connected'?'connected':cloudStatus==='saving'?'saving…':cloudStatus==='error'?'connection issue':'connecting…'}</strong>{cloudStatus==='error'&&<p className="cloud-inline-error">{cloudError||'Cloud write failed. Open Settings and retry the connection.'}</p>}</div>{cloudStatus==='error'&&<button className="btn secondary" type="button" onClick={retryCloud}>Retry connection</button>}</div>}
    {message&&<div className="toast"><CircleCheck size={17}/>{message}</div>}

    {page==='checkin'&&<><div className="page-heading"><div><div className="eyebrow">WELCOME TO THE COURT</div><h1>Who’s playing tonight?</h1><p>Tap your name to check in. Tap again to undo.</p></div><button className="btn primary" onClick={()=>{setCreating(true);setEditing(null)}}><UserPlus size={18}/> New player</button></div><div className="stats"><Stat label="Checked in" value={here.length} icon={<Check size={21}/>} accent/><Stat label="Saved players" value={players.length} icon={<Users size={21}/>}/><Stat label="Teams ready" value={state.session.confirmed.length} icon={<Volleyball size={21}/>}/></div><div className="panel"><div className="panel-top"><div><h2>Player check-in</h2><span>{here.length} checked in · {players.length-here.length} not checked in</span></div><div className="input-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search for your name…"/></div></div><div className="player-grid">{players.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=>{const selected=state.session.checkedIn.includes(p.id);return <button key={p.id} className={'check-tile '+(selected?'selected':'')} onClick={()=>toggleAttendance(p.id)}><span className="avatar">{p.name.trim().slice(0,1).toUpperCase()}</span><span className="tile-name">{p.name}</span><span className="tile-check">{selected?<Check size={18}/>:<Plus size={17}/>}</span></button>})}</div>{players.length===0&&<div className="empty"><Users size={36}/><b>No players yet</b><p>Add your first player to get started.</p><button className="btn primary" onClick={()=>setCreating(true)}>Add player</button></div>}{players.length>0&&players.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).length===0&&<div className="empty">No names match your search.</div>}</div>{organizer&&<div className="actions-row"><button className="btn secondary" onClick={newNight}><RotateCcw size={17}/> New volleyball night</button><button className="btn primary" onClick={()=>setPage('teams')}>Build teams <ArrowRight size={17}/></button></div>}</>}
    {page==='players'&&organizer&&<><div className="page-heading"><div><div className="eyebrow">ROSTER MANAGEMENT</div><h1>Player profiles</h1><p>Skill levels and organizer overrides stay saved between sessions.</p></div><button className="btn primary" onClick={()=>setCreating(true)}><UserPlus size={18}/> Add player</button></div><div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>PLAYER</th><th>SKILL</th><th>GENDER</th><th>HEIGHT</th><th>CHECKED IN</th><th></th></tr></thead><tbody>{players.map(p=><tr key={p.id}><td><span className="table-avatar">{p.name[0]?.toUpperCase()}</span><b>{p.name}</b></td><td><span className="pill">{SKILLS[skill(p)-1][0]}</span>{p.overrideSkill!==null&&<small> overridden</small>}{state.showNumbers&&<small> · {skill(p)}/10</small>}</td><td>{p.gender==='unspecified'?'Not set':p.gender}</td><td>{ft(p.height)}</td><td>{state.session.checkedIn.includes(p.id)?<span className="text-green">● Yes</span>:'No'}</td><td><button className="icon-btn" title={'Edit '+p.name} onClick={()=>setEditing(p)}><Pencil size={17}/></button><button className="icon-btn red" title={'Delete '+p.name} onClick={()=>removePlayer(p.id)}><Trash2 size={17}/></button></td></tr>)}</tbody></table></div>{players.length===0&&<div className="empty">No players yet.</div>}</div></>}
    {page==='teams'&&organizer&&<>
     <div className="page-heading"><div><div className="eyebrow">FAIR TEAMS, FAST</div><h1>Team builder</h1><p>{here.length} checked in · Indoor 6v6 · Up to 8 actual players per team</p></div>{state.session.confirmed.length>0&&<span className="status"><Check size={16}/> Teams live</span>}</div>
     {state.session.confirmed.length>0&&<section className="panel live-roster">
      <div className="panel-top"><div><h2>Live roster</h2><span>Changes appear on TV immediately. The game order and scores stay in place.</span></div><button className="btn secondary" onClick={()=>setPage('checkin')}><UserPlus size={17}/> Check in players</button></div>
      {available.length>0?<><p className="live-roster-hint">Checked in and waiting for a team</p>
       <div className="live-roster-available">{available.map(p=><div className="live-roster-person" key={p.id}><strong>{p.name}</strong><label>Assign to <select aria-label={`Assign ${p.name} to team`} value="" onChange={e=>{if(e.target.value!=='')assignLivePlayer(p.id,+e.target.value)}}><option value="">Choose team</option>{state.session.confirmed.map((t,i)=><option key={t.id} value={i} disabled={t.playerIds.length>=8}>{t.name}{t.playerIds.length>=8?' (full)':''}</option>)}</select></label></div>)}</div>
       <div className="live-new-team"><h3>Add another team</h3><p>Select the checked-in players for it. You can add games for the new team on the schedule page.</p>
        <div className="live-roster-choices">{available.map(p=><label key={p.id}><input type="checkbox" checked={newTeamPlayers.includes(p.id)} onChange={e=>setNewTeamPlayers(v=>e.target.checked?[...v,p.id]:v.filter(id=>id!==p.id))}/>{p.name}</label>)}</div>
        <button className="btn primary" disabled={!newTeamPlayers.some(id=>available.some(p=>p.id===id))||newTeamPlayers.filter(id=>available.some(p=>p.id===id)).length>8} onClick={createLiveTeam}><Plus size={17}/> Add team</button>
       </div></>:<p className="live-roster-hint">Everyone checked in is assigned. Check in another player to add them to a team.</p>}
     </section>}
     {here.length>=8?<div className="panel"><div className="panel-top"><div><h2>Generate a new lineup</h2><span>Rebuilding teams during a live night replaces the schedule and scores after confirmation.</span></div></div><div className="config-grid">{patterns.map(p=><button key={configKey(p)} onClick={()=>setSelectedConfig(configKey(p))} className={'config '+(configKey(p)===configKey(validChoice)?'chosen':'')}><div><b>{p.length} teams</b>{configKey(p)===configKey(validChoice)&&<Check size={18}/>}</div><strong>{p.join(' / ')}</strong><small>{p.reduce((n,x)=>n+Math.max(0,6-x),0)} Sub slot(s){p.some(x=>x>6)?' · rotating extras':''}</small></button>)}</div><div className="panel-actions"><button className="btn secondary" disabled={!validChoice} onClick={makeTeams}><Shuffle size={17}/> Generate teams</button></div></div>:!state.session.confirmed.length&&<div className="empty panel"><Users size={38}/><h2>Check in more players</h2><p>At least eight checked-in players are needed to create two automatic rosters.</p><button className="btn primary" onClick={()=>setPage('checkin')}>Go to check-in</button></div>}
     {roster.length>0&&<><div className="section-heading"><div><h2>{state.session.draft.length?'Review & confirm teams':'Tonight’s teams'}</h2><p>Drag a player to another team, tap two players to swap, or use the team dropdown. Live changes keep the schedule and scores.</p></div><div className="button-group">{state.session.draft.length>0&&<><button className="btn secondary" onClick={regenerate}><RefreshCw size={16}/> Regenerate</button><button className="btn primary" onClick={confirm}><Check size={17}/> Confirm teams</button></>}</div></div>
      <DndContext sensors={teamSensors} collisionDetection={args=>{const hits=pointerWithin(args);return hits.length?hits:rectIntersection(args)}} onDragEnd={dropPlayer}><div className="team-grid">{roster.map((t,i)=><DropTeam index={i} full={t.playerIds.length>=8} key={t.id}><div className="team-head"><div className={'team-stripe c'+i%6}/><div><h3>{t.name}</h3><small>{t.playerIds.length} players{t.subs?` + ${t.subs} Sub${t.subs>1?'s':''}`:''}</small></div></div><div className="team-people">{t.playerIds.map(id=>{const p=state.players.find(p=>p.id===id);if(!p)return null;return <DragPlayer id={id} selected={swap?.id===id} key={id}><button onClick={()=>pickPlayer(i,id)} title="Select for swap"><span className="mini-avatar">{p.name[0]}</span><span>{p.name}</span></button>{state.showNumbers&&<small>{skill(p)}</small>}<select aria-label={`Move ${p.name} to team`} value={i} onChange={e=>movePlayer(id,i,Number(e.target.value))}>{roster.map((other,j)=><option key={other.id} value={j} disabled={j!==i&&other.playerIds.length>=8}>Team {j+1}</option>)}</select>{!state.session.draft.length&&<button className="live-remove-player" title={`Remove ${p.name} from tonight`} aria-label={`Remove ${p.name} from tonight`} onClick={()=>removeLivePlayer(id)}><X size={16}/></button>}</DragPlayer>})}{Array.from({length:t.subs},(_,j)=><div className="sub-row" key={j}><span>SUB</span><button aria-label="Remove sub" onClick={()=>adjustTeam(i,-1)}><X size={16}/></button></div>)}</div><div className="team-footer"><button className="sub-add" onClick={()=>adjustTeam(i,1)}><Plus size={15}/> Add a Sub</button></div></DropTeam>)}</div></DndContext>
      <div className="alert"><Info size={18}/><div><b>Sub placeholders are not assigned people.</b><span>Borrow players from resting teams when a game needs them.</span></div></div>{state.session.confirmed.length>0&&<div className="actions-row"><span className="note">New teams can be scheduled without rebuilding games already played.</span><button className="btn primary" onClick={()=>setPage('schedule')}>Game schedule <ArrowRight size={17}/></button></div>}</>}
    </>}
    {page==='schedule'&&organizer&&<><div className="page-heading"><div><div className="eyebrow">ONE COURT · FAIR ROTATION</div><h1>Game schedule</h1><p>Sequential matchups with balanced game counts and short breaks.</p></div></div>{state.session.confirmed.length<2?<div className="empty panel"><CalendarDays size={38}/><h2>Confirm teams first</h2><p>Generate and confirm teams before making a schedule.</p><button className="btn primary" onClick={()=>setPage('teams')}>Go to team builder</button></div>:<><div className="panel scheduler-options"><div><h2>Schedule settings</h2><p>{state.session.confirmed.length} confirmed teams · 1 court</p></div><div className="option-controls"><label>Cycles <select value={cycles} onChange={e=>setCycles(+e.target.value)}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label>{state.session.confirmed.length===4&&<label className="checkbox-label"><input type="checkbox" checked={fullFour} onChange={e=>setFullFour(e.target.checked)}/> Full 6-game round robin (instead of 4 games)</label>}<label>Points <select value={state.session.scoreTarget??25} onChange={e=>update(s=>{s.session.scoreTarget=+e.target.value})}>{SCORE_TARGETS.map(n=><option key={n} value={n}>{n} · win by 2</option>)}</select></label><button className="btn primary" onClick={createSchedule}><CalendarDays size={17}/> {state.session.games.length?'Rebuild schedule':'Generate schedule'}</button></div></div><div className="panel"><h2>Add a game</h2><div className="option-controls"><label>First team <select aria-label="First team" value={newGameA} onChange={e=>setNewGameA(+e.target.value)}>{state.session.confirmed.map((t,i)=><option value={i} key={t.id}>{t.name}</option>)}</select></label><label>Second team <select aria-label="Second team" value={newGameB} onChange={e=>setNewGameB(+e.target.value)}>{state.session.confirmed.map((t,i)=><option value={i} key={t.id}>{t.name}</option>)}</select></label><button className="btn secondary" disabled={newGameA===newGameB||!state.session.confirmed[newGameA]||!state.session.confirmed[newGameB]} onClick={addGame}><Plus size={17}/> Add game</button></div><p>New games are added to the end. Use the arrows below to change the order.</p></div>{state.session.games.length>0&&<><div className="current-game"><div className="eyebrow">{state.session.currentGame>=state.session.games.length?'SCHEDULE COMPLETE':'ON THE COURT'}</div>{state.session.currentGame<state.session.games.length?<><h2>{state.session.confirmed[state.session.games[state.session.currentGame].a]?.name} <span>vs</span> {state.session.confirmed[state.session.games[state.session.currentGame].b]?.name}</h2><p>Game {state.session.currentGame+1} of {state.session.games.length}</p></>:<h2>All games complete!</h2>}<div className="button-group"><button className="btn secondary darkbtn" onClick={()=>update(s=>{s.session.currentGame=Math.max(0,s.session.currentGame-1)})} disabled={state.session.currentGame===0}>Previous</button><button className="btn primary" onClick={()=>update(s=>{s.session.currentGame=Math.min(s.session.games.length,s.session.currentGame+1)})} disabled={state.session.currentGame>=state.session.games.length}><Play size={16}/> Next game</button></div></div><div className="panel"><div className="panel-top"><h2>Game order</h2><span>Reorder upcoming games · current game and scores stay in place</span></div><div className="game-list">{state.session.currentGame>0&&<div className="previous-games"><h3>Previous games</h3>{state.session.games.slice(0,state.session.currentGame).map((g,i)=><p key={g.id}>Game {i+1}: <span className={pointStatus(g,'a',state.session.scoreTarget)==='winner'?'result-winner':''}>{state.session.confirmed[g.a]?.name} {g.scoreA??0}</span> – <span className={pointStatus(g,'b',state.session.scoreTarget)==='winner'?'result-winner':''}>{state.session.confirmed[g.b]?.name} {g.scoreB??0}</span></p>)}</div>}{state.session.games.map((g,i)=>i<state.session.currentGame?null:<div className={'game-row '+(i===state.session.currentGame?'now':'')+(i<state.session.currentGame?' finished':'')} key={g.id}><div className="game-number">{i+1}</div><div><b>{state.session.confirmed[g.a]?.name} <span>vs</span> {state.session.confirmed[g.b]?.name}</b><small>Cycle {g.cycle} · Rest: {state.session.confirmed.map((_,j)=>j).filter(j=>j!==g.a&&j!==g.b).map(j=>`Team ${j+1}`).join(', ')||'No resting teams'}</small></div><div className="button-group"><button className="btn secondary" aria-label={`Move game ${i+1} up`} disabled={i<=state.session.currentGame+1} onClick={()=>reorderGame(g.id,-1)}>↑</button><button className="btn secondary" aria-label={`Move game ${i+1} down`} disabled={i<=state.session.currentGame||i===state.session.games.length-1} onClick={()=>reorderGame(g.id,1)}>↓</button></div><span className="game-tag">{i<state.session.currentGame?'Played':i===state.session.currentGame?'Current':'Upcoming'}</span></div>)}</div></div></>}</>}</>}
    {page==='settings'&&organizer&&<><div className="page-heading"><div><div className="eyebrow">PREFERENCES & DATA</div><h1>Settings</h1><p>Manage group preferences and back up your data.</p></div>{activeGroup&&<div className="button-group">{protectedMode&&<a className="btn primary" href={modeHref('change-pin')}><KeyRound size={17}/> Change leader PIN</a>}<a className="btn secondary" href={modeHref(protectedMode?'owner-settings':'pin-settings')}><KeyRound size={17}/>{protectedMode?'Google owner recovery':'Set or change group PIN'}</a></div>}</div><div className="settings-grid"><div className="panel setting-card"><h2>Connected group</h2>
      <p><strong>{connectedGroupName}</strong></p><p>Firebase project: <code>{firebaseConfig.projectId}</code></p>
      <p>This group's players, teams, games and history are stored in its own Firestore project.</p>
      <a className="btn secondary" href={modeHref('groups')}>Find another group</a>
      </div><div className="panel setting-card firebase-card"><h2>Live cloud session</h2><p>{protectedMode?'Organizer and Scorekeeper require the leader PIN. Check-in and TV remain open.':'All modes use the same live session. The group PIN prompts on mode buttons, while direct URLs remain open.'}</p><p><strong>Status: {cloudStatus}</strong></p>{cloudError&&<p className="fb-error">{cloudError}</p>}<div className="stack-buttons"><button className="btn secondary" type="button" onClick={retryCloud}><RefreshCw size={17}/> Retry connection</button>{missing&&<button className="btn primary" type="button" onClick={()=>createCloud().catch(e=>flash(String(e)))}>Create first cloud session</button>}<button className="btn secondary" type="button" onClick={()=>exportState(state)}><Download size={17}/> Download JSON backup</button></div>{!protectedMode&&<p className="public-tv-help">This prototype is open to anyone with the link, including editing player data and scores.</p>}</div><div className="panel setting-card"><h2>Organizer preferences</h2><label className="checkbox-label"><input type="checkbox" checked={state.showNumbers} onChange={e=>update(s=>{s.showNumbers=e.target.checked})}/> Show numerical skill ratings in organizer views</label><p>Players always see names such as “Intermediate,” never underlying numbers.</p></div><div className="panel setting-card"><h2>Data & sample players</h2><p>{cloudMode==='cloud'?'Live organizer cloud synchronization enabled. JSON backups are still recommended.':'Local data is stored in this browser until you explicitly activate cloud synchronization.'}</p><div className="stack-buttons"><button className="btn secondary" onClick={()=>exportState(state)}><Download size={16}/> Download JSON backup</button><button className="btn secondary" onClick={()=>{if(state.players.length&& !window.confirm('Add 18 sample players to existing profiles?'))return;update(s=>{const newPeople=samplePlayers();s.players.push(...newPeople);s.session.checkedIn.push(...newPeople.map(p=>p.id))});flash('18 sample players added and checked in.')}}><Plus size={16}/> Add 18 sample players</button><button className="btn danger" onClick={newNight}><RotateCcw size={16}/> Start new volleyball night</button></div></div><div className="panel setting-card"><h2>Recent confirmed team history</h2><p>{state.history.length} confirmed lineup{state.history.length===1?'':'s'} saved in this group.</p>{state.history.slice(-5).reverse().map(h=><div className="history-row" key={h.roundId}><span>{new Date(h.at).toLocaleString()}</span><b>{h.teams.length} teams</b></div>)}</div>{!protectedMode&&<div className="panel setting-card"><h2>How the group PIN works</h2><p>The PIN prompts on mode buttons. A direct URL or a database write can bypass it. Anyone with this group link may change player profiles, teams, and scores.</p></div>}</div></>}
   </main>
  </div>
  {(creating||editing)&&<PlayerModal player={editing} onClose={()=>{setCreating(false);setEditing(null)}} onSave={upsertPlayer}/>} 
 </div>
}
function Nav({icon,name,active,click}:{icon:React.ReactNode;name:string;active:boolean;click:()=>void}){return <button className={'nav '+(active?'active':'')} onClick={click}>{icon}<span>{name}</span>{active&&<ChevronRight size={16}/>}</button>}
function Stat({label,value,icon,accent}:{label:string;value:number;icon:React.ReactNode;accent?:boolean}){return <div className={'stat '+(accent?'accent':'')}><div><span>{label}</span><strong>{value}</strong></div><div className="stat-icon">{icon}</div></div>}

function KioskCheckin({players,here,search,setSearch,matches,showAllPlayers,setShowAllPlayers,teamsReady,message,onToggleAttendance,onCreatePlayer,onOpenDisplay,onOpenScorekeeper,onEnterOrganizer,onSwitchMode}:{players:Player[];here:Player[];search:string;setSearch:(v:string)=>void;matches:Player[];showAllPlayers:boolean;setShowAllPlayers:(v:boolean)=>void;teamsReady:number;message:string;onToggleAttendance:(id:string)=>void;onCreatePlayer:()=>void;onOpenDisplay:()=>void;onOpenScorekeeper:()=>void;onEnterOrganizer:()=>void;onSwitchMode:()=>void}){
 const [menuOpen,setMenuOpen]=useState(false);
 const keyboardRows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
 const checked=new Set(here.map(p=>p.id));
 const list=search.trim()?matches:(showAllPlayers?players:here);
 const key=(letter:string)=>setSearch(search+letter);
 function selectPlayer(id:string){onToggleAttendance(id);setSearch('')}
 return <div className="kiosk-shell">
  <button type="button" className="kiosk-menu-btn" aria-label="More options" onClick={()=>setMenuOpen(v=>!v)}><Settings size={19}/></button>
  {menuOpen&&<div className="kiosk-menu">
   <button className="kiosk-menu-link" onClick={()=>{setMenuOpen(false);onEnterOrganizer()}}><Settings size={16}/> Organizer</button><button className="kiosk-menu-link" onClick={()=>{setMenuOpen(false);onSwitchMode()}}><ArrowRight size={16}/> All modes</button>
   <button className="kiosk-menu-link" onClick={()=>{setMenuOpen(false);onOpenDisplay()}}><Monitor size={16}/> Open TV display</button><button className="kiosk-menu-link" onClick={()=>{setMenuOpen(false);onOpenScorekeeper()}}><Trophy size={16}/> Scorekeeper</button>
   <label className="kiosk-menu-check"><input type="checkbox" checked={showAllPlayers} onChange={e=>setShowAllPlayers(e.target.checked)}/> Show all saved players</label>
   <p>Group mode controls</p>
  </div>}
  <div className="kiosk-inner">
   {message&&<div className="kiosk-flash" role="status"><CircleCheck size={18}/>{message}</div>}
   <div className="kiosk-hero">
    <div className="eyebrow">WELCOME TO THE COURT</div><h1>Who's playing tonight?</h1>
    <p>Search for your name and tap it to check in.</p>
    <div className="kiosk-meta"><span><b>{here.length}</b> checked in</span><span><b>{players.length}</b> saved players</span><span><b>{teamsReady}</b> teams ready</span></div>
   </div>
   <div className="kiosk-search-wrap"><div className="kiosk-search"><Search size={29}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search for your name…" aria-label="Search for your name" autoFocus />{search&&<button className="kiosk-search-clear" aria-label="Clear search" onClick={()=>setSearch('')}><X size={21}/></button>}</div><button className="kiosk-add-inline" onClick={onCreatePlayer}><UserPlus size={15}/> New player</button></div>
   <div className="kiosk-keyboard" aria-label="On-screen keyboard">
    {keyboardRows.map((row,i)=><div className="kiosk-key-row" key={i}>{row.split('').map(letter=><button type="button" className="kiosk-key" key={letter} onClick={()=>key(letter)}>{letter}</button>)}{i===2&&<button type="button" className="kiosk-key wide" onClick={()=>setSearch(search.slice(0,-1))} aria-label="Backspace">⌫</button>}</div>)}
    <div className="kiosk-key-row"><button className="kiosk-key xl" onClick={()=>key(' ')}>Space</button><button className="kiosk-key wide" onClick={()=>setSearch('')}>Clear</button></div>
   </div>
   <section className="kiosk-results">
    <div className="kiosk-results-title"><div><h2>{search.trim()?'Search results':showAllPlayers?'All saved players':'Checked in tonight'}</h2><p>{search.trim()?list.length+' matching players':here.length+' checked in'}</p></div></div>
    {list.length>0?<div className="player-grid kiosk-grid">{list.map(p=>{const selected=checked.has(p.id);return <button key={p.id} className={'check-tile kiosk-tile '+(selected?'selected':'')} onClick={()=>selectPlayer(p.id)}><span className="avatar">{p.name.trim().slice(0,1).toUpperCase()}</span><span className="tile-name">{p.name}</span><span className="tile-check">{selected?<Check size={18}/>:<Plus size={18}/>}</span></button>})}</div>:search.trim()?<div className="empty"><Users size={34}/><b>Player not found</b><p>No player matches “{search}”. New here?</p><button className="btn primary" onClick={onCreatePlayer}><UserPlus size={17}/> Add new player</button></div>:<div className="empty"><ClipboardCheck size={34}/><b>No one checked in yet</b><p>Search above to find your name and check in.</p></div>}
   </section>
  </div>
 </div>
}

function PlayerModal({player,initialName='',onClose,onSave,error}:{player:Player|null;initialName?:string;onClose:()=>void;onSave:(p:Player)=>void;error?:string}){
 const originalName=(player?.name??initialName).trim().split(/\s+/);const [firstName,setFirstName]=useState(player?.firstName??originalName[0]??'');const [lastName,setLastName]=useState(player?.lastName??originalName.slice(1).join(' '));const [selfSkill,setSelfSkill]=useState(player?.selfSkill??5);const [overrideSkill,setOverrideSkill]=useState<number|null>(player?.overrideSkill??null);const [gender,setGender]=useState<Gender>(player?.gender??'unspecified');const [height,setHeight]=useState<number|null>(player?.height??68);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal large-modal"><div className="modal-head"><div><div className="eyebrow">PLAYER PROFILE</div><h2>{player?'Edit player':'Add new player'}</h2></div><button className="icon-btn" onClick={onClose}><X size={22}/></button></div><form onSubmit={e=>{e.preventDefault();if(!firstName.trim()||!lastName.trim())return;const name=formatPlayerName(firstName+' '+lastName);if(name.length>50)return;onSave({id:player?.id??uid(),name,firstName:formatPlayerName(firstName),lastName:formatPlayerName(lastName),selfSkill,overrideSkill,gender,height,createdAt:player?.createdAt??Date.now()})}}><div className="field"><label htmlFor="first-name">First Name</label><input id="first-name" autoFocus maxLength={25} required autoComplete="given-name" value={firstName} onChange={e=>setFirstName(e.target.value)} onBlur={()=>setFirstName(formatPlayerName(firstName))}/></div><div className="field"><label htmlFor="last-name">Last Name (or Last Initial)</label><input id="last-name" maxLength={24} required autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)} onBlur={()=>setLastName(formatPlayerName(lastName))}/></div><div className="field"><label>Choose your indoor 6v6 volleyball skill level</label><div className="skill-list">{SKILLS.map(([level,description],i)=><button key={level} type="button" className={'skill-card '+(selfSkill===i+1?'chosen':'')} onClick={()=>setSelfSkill(i+1)} aria-pressed={selfSkill===i+1}><span className="skill-title"><strong>{level}</strong><span className="skill-indicator">{selfSkill===i+1?<Check size={17}/>:null}</span></span><span className="skill-description">{description}</span></button>)}</div></div>{player&&<div className="field"><label htmlFor="override">Organizer rating override</label><select id="override" value={overrideSkill??''} onChange={e=>setOverrideSkill(e.target.value===''?null:+e.target.value)}><option value="">Use player's original selection</option>{SKILLS.map(([name],i)=><option value={i+1} key={name}>{name}</option>)}</select></div>}<div className="field"><label htmlFor="gender">Gender (optional)</label><select id="gender" value={gender} onChange={e=>setGender(e.target.value as Gender)}><option value="unspecified">Prefer not to say / Not set</option><option value="woman">Woman</option><option value="man">Man</option><option value="other">Another gender</option></select></div><div className="field"><div className="field-title"><label htmlFor="height">Height (optional)</label><strong>{ft(height)}</strong></div><input id="height" type="range" min="36" max="84" step="1" value={height??68} disabled={height===null} onChange={e=>setHeight(+e.target.value)}/><div className="range-ends"><small>3′0″</small><small>7′0″</small></div><label className="checkbox-label small"><input type="checkbox" checked={height===null} onChange={e=>setHeight(e.target.checked?null:68)}/> Prefer not to say</label></div>{error&&<p className="fb-error" role="alert">{error}</p>}<div className="modal-actions"><button className="btn secondary" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="submit"><Check size={17}/> Save player</button></div></form></div></div>
}

function CloudHealth({mode,status,error}:{mode:'local'|'cloud';status:'local'|'connecting'|'connected'|'saving'|'error';error:string}){
 if(mode==='local')return null;
 if(status==='connected'||status==='saving')return null;
 return <div className={'cloud-health '+(status==='error'?'cloud-health-error':'')} role="status">
  <Cloud size={16}/>
  <div><b>{status==='error'?'Cloud connection issue':'Connecting to cloud…'}</b>
   {status==='error'&&<p>{error||'Open Organizer → Settings and reconnect.'}</p>}
  </div>
 </div>;
}

function Scorekeeper({state,update}:{state:AppState;update:(fn:(draft:AppState)=>void)=>void}){
 const [notice,setNotice]=useState('');
 const session=state.session,game=session.games[session.currentGame],teams=session.confirmed;
 const target=game?.target??session.scoreTarget??25,win=game?winnerOf(game,session.scoreTarget??25):null;
 const a=game?.scoreA??0,b=game?.scoreB??0;
 const teamNames=game?[teams[game.a]?.name??'Team A',teams[game.b]?.name??'Team B']:['Team A','Team B'];
 const changeScore=(side:'a'|'b',delta:number)=>{
  if(!game||game.finishedAt)return;
  update(s=>{const g=s.session.games[s.session.currentGame];if(!g||g.finishedAt)return;
   const oldA=g.scoreA??0,oldB=g.scoreB??0;
   if(delta>0&&winnerOf(g,s.session.scoreTarget??25))return;
   g.scoreHistory=[...(g.scoreHistory??[]),{a:oldA,b:oldB,serving:g.serving??null}].slice(-250);
   g.scoreA=Math.max(0,oldA+(side==='a'?delta:0));g.scoreB=Math.max(0,oldB+(side==='b'?delta:0));
   if(delta>0)g.serving=side;
  });setNotice('');
 };
 const undo=()=>{update(s=>{const g=s.session.games[s.session.currentGame];if(!g||g.finishedAt||!g.scoreHistory?.length)return;const prior=g.scoreHistory.pop()!;g.scoreA=prior.a;g.scoreB=prior.b;g.serving=prior.serving});setNotice('Last score change undone.')};
 const reset=()=>{if(!game||!window.confirm('Reset the score for this game?'))return;update(s=>{const g=s.session.games[s.session.currentGame];g.scoreA=0;g.scoreB=0;g.serving=null;g.scoreHistory=[];g.finishedAt=undefined});setNotice('Score reset.')};
 const finish=()=>{if(!game||!win)return;if(!window.confirm(`Finish game at ${a}–${b} and advance to the next matchup?`))return;update(s=>{const g=s.session.games[s.session.currentGame];if(!winnerOf(g,s.session.scoreTarget??25))return;g.finishedAt=Date.now();s.session.currentGame=Math.min(s.session.games.length,s.session.currentGame+1)});setNotice('Game saved. Next matchup is ready.')};
 return <div className="scorekeeper-screen">
  <div className="scorekeeper-head"><div><span className="eyebrow">VOLLEYBALL NIGHT</span><h1>Scorekeeper</h1><p>Single court · one tap per point</p></div><div className="scorekeeper-target"><label htmlFor="score-target">Play to</label><select id="score-target" value={session.scoreTarget??25} onChange={e=>update(s=>{s.session.scoreTarget=+e.target.value})}>{SCORE_TARGETS.map(n=><option key={n} value={n}>{n} points</option>)}</select><small>Win by 2</small></div></div>
  {!game?<div className="scorekeeper-placeholder"><Trophy size={44}/><h2>{session.games.length?'All games complete':'No scheduled game'}</h2><p>Use the organizer dashboard to confirm teams and create a game schedule.</p></div>:<>
   <div className="scorekeeper-match">Game {session.currentGame+1} of {session.games.length}<span>Target {target} · Win by 2</span></div>
   <div className="scorekeeper-columns">{(game.sidesSwapped?['b','a'] as const:['a','b'] as const).map(side=><section className={'scorekeeper-team '+pointStatus(game,side,session.scoreTarget)} key={side}><h2>{teamNames[side==='a'?0:1]}</h2><span className="point-status">{pointStatus(game,side,session.scoreTarget)==='winner'?'Winner':pointStatus(game,side,session.scoreTarget)==='set-point'?'Set Point':'\u00a0'}</span><strong className="scorekeeper-number">{side==='a'?a:b}</strong><div className="scorekeeper-serving">{game.serving===side?'● SERVING':' '}</div><button className="scorekeeper-add" onClick={()=>changeScore(side,1)} disabled={!!win||!!game.finishedAt}><Plus size={32}/> POINT</button><button className="scorekeeper-minus" onClick={()=>changeScore(side,-1)} disabled={(side==='a'?a:b)===0||!!game.finishedAt}><Minus size={20}/> Remove point</button></section>)}</div>
   {win?<div className="scorekeeper-winner"><Trophy size={23}/>{teamNames[win==='a'?0:1]} wins, {a}–{b}! Confirm to finish this game.</div>:<p className="scorekeeper-hint">The winning team must reach {target} and lead by at least two points.</p>}
   <div className="scorekeeper-actions"><button className="btn secondary" onClick={()=>update(s=>{const g=s.session.games[s.session.currentGame];if(g)g.sidesSwapped=!g.sidesSwapped})}><Shuffle size={18}/> Switch sides</button><button className="btn secondary" onClick={undo} disabled={!game.scoreHistory?.length}><Undo2 size={18}/> Undo</button><button className="btn secondary" onClick={reset}>Reset score</button><button className="btn primary" disabled={!win} onClick={finish}><Check size={19}/> Finish game & next matchup</button></div>
  </>}
  {notice&&<p className="scorekeeper-notice">{notice}</p>}
  <p className="scorekeeper-foot">Live scores sync through Firebase across devices. Use Switch mode to return to the home screen.</p>
 </div>
}

function Display({data,uiPin=false}:{data:PublicTVData;uiPin?:boolean}){
 const teams=data.teams,games=data.games,current=games[data.currentGame];
 const waiting=teams.length===0;
 const played=games.filter((g,i)=>g.finished||i<data.currentGame);
 const upcoming=games.map((g,i)=>({g,i})).filter(({g,i})=>!g.finished&&i>=data.currentGame).slice(0,4);
 const scoreSide=(side:'a'|'b')=><div className={'tv-score-side '+pointStatus(current,side,data.scoreTarget)}><span>{teams[current[side]]?.name}</span><strong>{side==='a'?current.scoreA:current.scoreB}</strong><span className="point-status">{pointStatus(current,side,data.scoreTarget)==='winner'?'Winner':pointStatus(current,side,data.scoreTarget)==='set-point'?'Set Point':'\u00a0'}</span></div>;
 return <div className={'tv '+(waiting?'tv-waiting':'')}>
  <header className="tv-top">
   <div><div className="eyebrow">VOLLEYBALL NIGHT</div><h1>Tonight’s games</h1></div>
   <div className="tv-top-meta"><span>{new Date(data.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span><ModeSwitch uiPin={uiPin}/></div>
  </header>
  {waiting?<section className="tv-checkin"><div className="tv-checkin-heading"><div><div className="eyebrow">WELCOME TO THE COURT</div><h2>Who’s playing tonight?</h2></div><strong>{data.checkedInNames?.length??0} checked in</strong></div><div className="tv-checkin-names" style={{'--checkin-rows':Math.max(1,Math.ceil((data.checkedInNames?.length??0)/4))} as React.CSSProperties}>{(data.checkedInNames??[]).map((name,i)=><div key={i}>{formatPlayerName(name)}</div>)}</div>{!data.checkedInNames?.length&&<p>Check in to see your name here. Teams are coming soon!</p>}</section>:<><main className="tv-live-grid">
   <section className="tv-status-card tv-current-card">
    <small>CURRENT GAME</small>
    <h2>{current?`${teams[current.a]?.name} vs ${teams[current.b]?.name}`:games.length?'Schedule complete':'Waiting for schedule'}</h2>
    <p>{games.length?`Game ${Math.min(data.currentGame+1,games.length)} of ${games.length}`:'Generate a schedule from the organizer view.'}</p>
   </section>
   <section className="tv-scoreboard" aria-label="Live score">
    <div className="tv-card-label">SCORE</div>
    {current?<div className="tv-score-content">
     {scoreSide(current.sidesSwapped?'b':'a')}
     <div className="tv-score-mid"><small>GAME {data.currentGame+1}</small><b>:</b><small>TO {current.target??data.scoreTarget??25} · WIN BY 2</small></div>
     {scoreSide(current.sidesSwapped?'a':'b')}
    </div>:<div className="tv-score-wait">{games.length?'Schedule complete':'Scoreboard ready when the game starts'}</div>}
   </section>
   <section className="tv-status-card tv-order-card">
    <small>GAME ORDER · {games.length} TOTAL</small>
    {played.length>0&&<div className="tv-previous"><small>PREVIOUS GAMES</small><div className="tv-previous-results">{played.map(g=><div key={g.id}><span className={pointStatus(g,'a',data.scoreTarget)==='winner'?'result-winner':''}>{teams[g.a]?.name} {g.scoreA}</span><span> – </span><span className={pointStatus(g,'b',data.scoreTarget)==='winner'?'result-winner':''}>{teams[g.b]?.name} {g.scoreB}</span></div>)}</div></div>}
    <div className="tv-schedule">{upcoming.length?upcoming.map(({g,i})=><div key={g.id} className={'tv-schedule-row '+(i===data.currentGame?'current':'')}><span>{i+1}</span><div>{teams[g.a]?.name} <b>vs</b> {teams[g.b]?.name}</div><strong>{i===data.currentGame?'Current':'Upcoming'}</strong></div>):<div className="tv-schedule-empty">{games.length?'Schedule complete':'No schedule yet'}</div>}</div>
   </section>
   {current&&current.scoreA===0&&current.scoreB===0&&!current.finished&&<div className="tv-up-next"><small>UP NEXT · GAME {data.currentGame+1}</small><strong>{teams[current.sidesSwapped?current.b:current.a]?.name} <span>vs</span> {teams[current.sidesSwapped?current.a:current.b]?.name}</strong></div>}
  </main>
  <section className="tv-teams" aria-label="Tonight’s teams">
   {teams.map((team,i)=><div className="tv-team" key={team.id}>
    <div className={'tv-bar c'+i%6}/><h2>{team.name}</h2>
    <div className="tv-people">{team.players.map((name,j)=><div key={j}>{formatPlayerName(name)}</div>)}{Array.from({length:team.subs},(_,j)=><div className="tv-sub" key={j}>SUB</div>)}</div>
   </div>)}
   {teams.length===0&&<div className="tv-empty">Teams will appear here once the organizer confirms them.</div>}
  </section></>}
  <div className="tv-foot">Read-only display · To go fullscreen, use your browser’s fullscreen command</div>
 </div>;
}

function ProtectedKiosk(){
 const {players,here,ready,error,toggle,register}=usePublicKiosk();
 const {data}=usePublicTV();
 const [search,setSearch]=useState(''),[showAllPlayers,setShowAllPlayers]=useState(false);
 const [creating,setCreating]=useState(false),[message,setMessage]=useState(''),[modalError,setModalError]=useState('');
 const matches=players.filter(p=>p.name.toLowerCase().includes(search.trim().toLowerCase()));
 const notice=(value:string)=>{setMessage(value);window.setTimeout(()=>setMessage(''),4000)};
 return <>
  <KioskCheckin players={players} here={here} search={search} setSearch={setSearch}
   matches={matches} showAllPlayers={showAllPlayers} setShowAllPlayers={setShowAllPlayers}
   teamsReady={data?.teams.length??0} message={message}
   onToggleAttendance={id=>{if(!ready)return;void toggle(id).then(()=>{setSearch('');notice('Check-in updated.')}).catch(e=>notice((e as Error).message))}}
   onCreatePlayer={()=>{setModalError('');setCreating(true)}} onOpenDisplay={()=>goMode('tv')}
   onOpenScorekeeper={()=>goMode('scorekeeper')} onEnterOrganizer={()=>goMode('organizer')} onSwitchMode={()=>goMode('home')}/>
  {creating&&<PlayerModal player={null} initialName={search.trim()} error={modalError} onClose={()=>setCreating(false)}
   onSave={p=>{void register(p).then(()=>{setCreating(false);setSearch('');notice('You’re checked in!')})
    .catch(e=>setModalError((e as Error).message))}}/>}
  {error&&<div className="cloud-health cloud-health-error" role="alert">{error}</div>}
 </>;
}

function ProtectedTV(){
 const {data,error}=usePublicTV();
 const {here}=usePublicKiosk();
 return <>{data?<Display data={{...data,checkedInNames:here.map(p=>p.name)}}/>:<><ModeSwitch floating/><div className="scorekeeper-placeholder"><Monitor size={44}/><h2>TV display waiting</h2><p>{error||'Connecting to your group…'}</p></div></>}</>;
}

function LeaderGate({mode}:{mode:'organizer'|'scorekeeper'}){
 const [ready,setReady]=useState(false),[signedIn,setSignedIn]=useState(false);
 const [pin,setPin]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>onAuthStateChanged(firebaseAuth,user=>{
  setSignedIn(user?.email===leaderEmail(firebaseConfig.projectId));setReady(true);
 }),[]);
 const unlock=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');
  try{await enterLeaderMode(pin);setPin('')}
  catch(err){setError('Incorrect PIN or sign-in unavailable. '+((err as Error)?.message||''))}
  finally{setBusy(false)}
 };
 if(!ready)return <div className="scorekeeper-placeholder">Checking leader access…</div>;
 if(signedIn)return <App stateHook={useProtectedCloudState} protectedMode/>;
 return <div className="device-pairing-screen"><div className="device-pairing-card">
  <div className="eyebrow">VOLLEYBALL NIGHT</div><h1>{mode==='organizer'?'Organizer':'Scorekeeper'} access</h1>
  <p>Enter this group’s six-digit leader PIN. The group owner sets it with their Google account.</p>
  <form onSubmit={unlock} className="device-form"><label htmlFor="leader-pin">Leader PIN</label>
   <input id="leader-pin" autoFocus type="password" inputMode="numeric" pattern="[0-9]{6}"
    autoComplete="off" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/>
   <button className="btn primary" disabled={busy||pin.length!==6} type="submit">{busy?'Checking PIN…':'Enter leader mode'}</button>
  </form>
  {error&&<p className="fb-error" role="alert">{error}</p>}
  <ModeSwitch/>
 </div></div>;
}

function GroupAppRoutes(){
 const {status,error}=useProtectionStatus();
 const mode=new URLSearchParams(location.search).get('mode');
 if(!activeGroup)return mode||new URLSearchParams(location.search).has('scorekeeper')||new URLSearchParams(location.search).has('display')||new URLSearchParams(location.search).has('publicTv')?<App/>:<ModeHome/>;
 if(status==='loading')return <div className="scorekeeper-placeholder">Connecting to your group…</div>;
 if(status==='error')return <div className="scorekeeper-placeholder"><h2>Group connection issue</h2><p>{error}</p></div>;
 if(mode==='owner-settings')return status==='protected'?<OwnerAccess protectedMode/>:<UiPinSettings/>;
 if(mode==='pin-settings')return status==='protected'?<ChangePin/>:<UiPinSettings/>;
 if(mode==='change-pin')return status==='protected'?<ChangePin/>:<UiPinSettings/>;
 if(status==='legacy')return mode||new URLSearchParams(location.search).has('scorekeeper')||new URLSearchParams(location.search).has('display')||new URLSearchParams(location.search).has('publicTv')?<App/>:<ModeHome/>;
 if(mode==='organizer'||mode==='scorekeeper')return <LeaderGate mode={mode}/>;
 if(mode==='tv'||new URLSearchParams(location.search).has('display')||new URLSearchParams(location.search).has('publicTv'))return <ProtectedTV/>;
 if(mode==='kiosk')return <ProtectedKiosk/>;
 return <ModeHome protectedMode/>;
}

function HubLegacyData(){
 const {state,status,error}=useCloudState();
 return <div className="hub-legacy-data"><h3>Original project archive</h3>
  <p>The central project no longer runs game night. This read-only summary lets you keep a backup of its earlier data.</p>
  {status==='connected'?<><div className="hub-legacy-stats"><span><strong>{state.players.length}</strong> player profiles</span><span><strong>{state.history.length}</strong> confirmed lineups</span></div>
   <button className="hub-owner-button" type="button" onClick={()=>exportState(state)}><Download size={17}/> Download original data</button></>
  :<p role="status">{status==='error'?error:'Connecting to the original project…'}</p>}
 </div>;
}



function InvalidGroupLink(){
 return <div className="group-setup-shell"><main className="group-setup-main"><div className="group-setup-card">
 <h1>That group link could not be opened</h1>
 <p>{groupLinkError}</p>
 <p>The app hasn't switched databases. You can paste the group config again or return to the original Volleyball Night.</p>
 <a className="btn primary" href={modeHref('setup')}>Set up a group</a>
 <button className="btn secondary" type="button" onClick={useOriginalGroup}>Use original Volleyball Night</button>
 </div></main></div>;
}
const params=new URLSearchParams(location.search);
const setupMode=params.get('mode');
if(isIndependentGroupSite&&['setup','groups','manual-setup','owner-settings','guide','admin'].includes(setupMode??''))
 location.replace(modeHref(setupMode as 'setup'|'groups'|'manual-setup'|'owner-settings'|'guide'|'admin'));
else
createRoot(document.getElementById('root')!).render(<React.StrictMode>{
 groupLinkError&&!['setup','manual-setup'].includes(params.get('mode')??'')?<InvalidGroupLink/>:
 params.get('mode')==='setup'?<GoogleSetupPilot/>:
 params.get('mode')==='groups'?<MyGroups/>:
 params.get('mode')==='manual-setup'?<GroupSetup/>:
 params.get('mode')==='guide'?<HowItWorks/>:
 params.get('mode')==='admin'?<AdminSettings ownerTools={<HubLegacyData/>}/>:
 isIndependentGroupSite?<GroupAppRoutes/>:
 params.has('g')&&activeGroup&&params.get('mode')==='owner-settings'?<GroupAppRoutes/>:
 params.has('g')&&activeGroup?<GroupSiteHandoff projectId={activeGroup.config.projectId} mode={params.get('mode')}/>:
 <MainLaunchpad/>
}</React.StrictMode>);
