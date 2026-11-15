import {useState} from 'react';
import {ClipboardCheck,Monitor,Trophy,Settings,ArrowRight,House,Volleyball,Database,Copy,FolderOpen} from 'lucide-react';
import {activeGroup,encodeGroup,isIndependentGroupSite} from './groupConnection';
import {connectedGroupName,firebaseConfig} from './firebase';
export type AppMode='home'|'kiosk'|'tv'|'scorekeeper'|'organizer'|'setup'|'manual-setup'|'groups';
export const modeHref=(mode:AppMode)=>{
 const u=new URL(window.location.href);u.search='';u.hash='';
 if(activeGroup&&!isIndependentGroupSite)u.searchParams.set('g',encodeGroup(activeGroup));
 if(mode!=='home')u.searchParams.set('mode',mode);
 return u.pathname+u.search;
};
export const goMode=(mode:AppMode)=>window.location.assign(modeHref(mode));
const cards=[
 {mode:'kiosk' as const,title:'Check-in kiosk',desc:'Find your name and check in',Icon:ClipboardCheck},
 {mode:'tv' as const,title:'TV display',desc:'Live teams, matches, and scores',Icon:Monitor},
 {mode:'scorekeeper' as const,title:'Scorekeeper',desc:'Track points and advance games',Icon:Trophy},
 {mode:'organizer' as const,title:'Organizer',desc:'Manage players, teams, and schedules',Icon:Settings}
];
export function ModeHome(){
 const [copied,setCopied]=useState(false);
 const groupUrl=()=>{
  const u=new URL(location.href);
  u.search='';u.hash='';
  if(activeGroup&&!isIndependentGroupSite)u.searchParams.set('g',encodeGroup(activeGroup));
  return u.toString();
 };
 return <div className="vn-home"><main className="vn-home-content">
  <div className="vn-home-logo"><Volleyball size={30}/><span>VOLLEYBALL <b>NIGHT</b></span></div>
  <div className="vn-home-heading"><span className="eyebrow">EVERYTHING IN ONE PLACE</span>
   <h1>What are you here to do?</h1><p>Select a mode for this device. You can switch modes whenever you need.</p>
   <div className="vn-current-group"><Database size={17}/> <strong>{connectedGroupName}</strong><span> · {firebaseConfig.projectId}</span></div>
  </div>
  <div className="vn-mode-grid">{cards.map(({mode,title,desc,Icon})=><a className="vn-mode-card" key={mode} href={modeHref(mode)}>
    <span className="vn-mode-card-icon"><Icon size={28}/></span><strong>{title}</strong><p>{desc}</p><span className="vn-mode-arrow"><ArrowRight size={20}/></span>
   </a>)}</div>
  <div className="vn-home-group-actions">
   <a href={isIndependentGroupSite?'https://volleyball-night.web.app/?mode=groups':modeHref('groups')}><FolderOpen size={17}/> Find my groups</a>
   <a href={isIndependentGroupSite?'https://volleyball-night.web.app/?mode=setup':modeHref('setup')}><Database size={17}/> Create a group with Google</a>
   {activeGroup&&<button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(groupUrl());setCopied(true)}catch{window.prompt('Copy the group link:',groupUrl())}}}><Copy size={17}/>{copied?'Link copied':'Copy group link'}</button>}
  </div>
  <p className="vn-home-note">Open design preview: no sign-in or PIN required yet. Each group connects to its own live Firebase database.</p>
 </main></div>;
}
export function ModeSwitch({floating=false}:{floating?:boolean}){
 return <a href={modeHref('home')} className={'vn-mode-switch '+(floating?'vn-mode-switch-floating':'')}><House size={17}/> Switch mode</a>;
}
