import {ClipboardCheck,Monitor,Trophy,Settings,ArrowRight,House,Volleyball} from 'lucide-react';
export type AppMode='home'|'kiosk'|'tv'|'scorekeeper'|'organizer';
export const modeHref=(mode:AppMode)=>{
 const u=new URL(window.location.href);u.search='';
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
 return <div className="vn-home"><main className="vn-home-content">
  <div className="vn-home-logo"><Volleyball size={30}/><span>VOLLEYBALL <b>NIGHT</b></span></div>
  <div className="vn-home-heading"><span className="eyebrow">EVERYTHING IN ONE PLACE</span><h1>What are you here to do?</h1><p>Select a mode for this device. You can switch modes whenever you need.</p></div>
  <div className="vn-mode-grid">{cards.map(({mode,title,desc,Icon})=><a className="vn-mode-card" key={mode} href={modeHref(mode)}>
    <span className="vn-mode-card-icon"><Icon size={28}/></span><strong>{title}</strong><p>{desc}</p><span className="vn-mode-arrow"><ArrowRight size={20}/></span>
   </a>)}</div>
  <p className="vn-home-note">Open design preview: no sign-in or PIN required yet. All modes use the same live Firebase session.</p>
 </main></div>;
}
export function ModeSwitch({floating=false}:{floating?:boolean}){
 return <a href={modeHref('home')} className={'vn-mode-switch '+(floating?'vn-mode-switch-floating':'')}><House size={17}/> Switch mode</a>;
}
