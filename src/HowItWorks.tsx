import {useEffect} from 'react';
import {ArrowRight,Check,FolderOpen} from 'lucide-react';
import {HubFooter,HubHeader} from './MainLaunchpad';

type Visual='setup'|'pin'|'checkin'|'teams'|'games';
const ink='#18384b',muted='#77909e',green='#13987e',pale='#e3f7f0';
const label=(x:number,y:number,value:string,size=16,color=ink,weight=700)=><text x={x} y={y} fill={color} fontSize={size} fontWeight={weight} fontFamily="Arial, sans-serif">{value}</text>;
const box=(x:number,y:number,w:number,h:number,fill='#fff',stroke='#d9e6eb',radius=11)=><rect x={x} y={y} width={w} height={h} rx={radius} fill={fill} stroke={stroke}/>;

function GuideImage({kind,title}:{kind:Visual;title:string}){
 return <svg className="guide-visual" viewBox="0 0 600 370" role="img" aria-label={title}>
  <rect width="600" height="370" rx="20" fill="#eff5f6"/>
  <rect x="29" y="25" width="542" height="320" rx="16" fill="white" stroke="#dce7ea"/>
  <path d="M29 41a16 16 0 0 1 16-16h510a16 16 0 0 1 16 16v28H29Z" fill="#102b3d"/>
  <circle cx="50" cy="48" r="5" fill="#6dd6c2"/><circle cx="67" cy="48" r="5" fill="#6dd6c2" opacity=".5"/>
  {label(89,54,'VOLLEYBALL NIGHT',13,'#fff',800)}
  {kind==='setup'&&<>
   {label(63,103,'Create your group',23)}{label(63,125,'A new site and saved space, set up with Google.',13,muted,400)}
   {label(64,159,'Group name',12,ink,700)}{box(63,169,465,38)}{label(77,193,'Thursday Volleyball',15,ink,400)}
   <rect x="63" y="227" width="465" height="7" rx="4" fill="#dfece9"/><rect x="63" y="227" width="315" height="7" rx="4" fill={green}/>
   {label(63,258,'Google account',12,green)}{label(243,258,'Group project',12,green)}{label(411,258,'Website',12,muted)}
   {box(63,279,241,42,green,green,10)}{label(88,306,'Continue with Google  →',15,'#fff',700)}
  </>}
  {kind==='pin'&&<>
   {label(63,103,'Set your group PIN',23)}{label(63,126,'Choose six digits for the mode buttons.',13,muted,400)}
   {label(64,158,'Create group PIN',12)}{box(63,168,225,43)}{label(81,195,'••••••',24,ink,700)}
   {label(310,158,'Repeat PIN',12)}{box(309,168,219,43)}{label(327,195,'••••••',24,ink,700)}
   {box(63,232,158,42,green,green,10)}{label(84,258,'Save group PIN',15,'#fff')}
   {box(63,295,465,34,'#eef7f5','#d5eee8',8)}{label(76,317,'thursday-volleyball.web.app  ↗',13,'#28766c',600)}
  </>}
  {kind==='checkin'&&<>
   {label(63,105,'Who’s playing tonight?',24)}{label(63,132,'Search for your name and tap it to check in.',13,muted,400)}
   {box(63,156,464,52,'#f9fbfc','#cfdfe4',11)}<circle cx="87" cy="181" r="10" fill="none" stroke={muted} strokeWidth="2"/><path d="m94 188 7 7" stroke={muted} strokeWidth="2"/>{label(115,190,'Search players…',17,muted,400)}
   {box(63,229,219,62,pale,'#c6eddd',10)}<circle cx="91" cy="260" r="17" fill="#55bda4"/>{label(86,266,'A',17,'#fff')}{label(120,258,'Alex',16)}{label(120,277,'Checked in',11,green)}{label(256,267,'✓',19,green)}
   {box(308,229,219,62)}<circle cx="336" cy="260" r="17" fill="#d9e8ec"/>{label(330,266,'J',17,ink)}{label(365,267,'Jordan',16)}
   {label(64,320,'+ New player',14,green)}
  </>}
  {kind==='teams'&&<>
   {label(63,104,'Build balanced teams',23)}{label(63,128,'Choose a layout, generate, then confirm.',13,muted,400)}
   {box(63,148,153,60,pale,'#6dc9ad',9)}{label(79,173,'2 teams',15)}{label(79,194,'6 / 6',13,green)}
   {box(227,148,143,60)}{label(243,173,'3 teams',15)}{label(243,194,'4 / 4 / 4',13,muted)}
   {box(63,224,222,75,'#f9fbfc','#dfe9eb',8)}{label(77,247,'TEAM 1',12,green)}{label(77,274,'Alex  ·  Jordan  ·  Sam',14,ink,500)}
   {box(306,224,222,75,'#f9fbfc','#dfe9eb',8)}{label(320,247,'TEAM 2',12,green)}{label(320,274,'Casey  ·  Riley  ·  Drew',14,ink,500)}
   {label(64,328,'↻  Regenerate',13,muted)}{box(371,308,157,27,green,green,7)}{label(392,327,'✓  Confirm teams',13,'#fff')}
  </>}
  {kind==='games'&&<>
   {label(63,105,'One court. One live score.',23)}{label(63,129,'Scorekeeper and TV stay in sync.',13,muted,400)}
   {box(63,151,247,155,'#f9fbfc','#dfe9eb',11)}{label(78,177,'SCOREKEEPER',11,green)}{label(94,207,'Team 1',13,ink)}{label(224,207,'Team 2',13,ink)}
   {label(100,263,'18',48,ink)}{label(228,263,'16',48,ink)}{box(80,273,98,23,green,green,5)}{label(101,290,'+ POINT',11,'#fff')}
   {box(326,151,202,155,'#102b3d','#102b3d',11)}{label(342,177,'TV DISPLAY',11,'#76dac5')}{label(342,211,'Tonight’s Teams',18,'#fff')}
   {label(342,238,'Team 1',13,'#c4e8e3')}{label(471,238,'18',18,'#fff')}{label(342,266,'Team 2',13,'#c4e8e3')}{label(471,266,'16',18,'#fff')}
   {label(64,331,'Generate a schedule, score each game, and advance.',13,muted,400)}
  </>}
 </svg>;
}

const steps:{number:string;title:string;description:string;points:string[];visual:Visual;visualTitle:string}[]=[
 {number:'01',title:'Create a group',description:'Give your group a name and continue with Google. Setup creates a separate website and saved player space for that group.',points:['The website is ready when setup finishes.','Your group’s data stays with its own project.'],visual:'setup',visualTitle:'Example of the group creation form and setup progress'},
 {number:'02',title:'Set the PIN and share the link',description:'Choose the six-digit PIN for Organizer, Scorekeeper, and Switch mode buttons. Then send your group website link to the people running game night.',points:['Check-in and the TV display stay open.','The PIN is a button prompt; direct links can bypass it.'],visual:'pin',visualTitle:'Example of the group PIN form and independent website link'},
 {number:'03',title:'Let players check in',description:'At the kiosk, people search for their names and tap to check in. A new player can create a profile with a skill category and optional details.',points:['Profiles stay saved for future nights.','You can also check in from another device.'],visual:'checkin',visualTitle:'Example of the player check-in kiosk with search and player tiles'},
 {number:'04',title:'Build and confirm teams',description:'Choose a team layout. The organizer can generate balanced teams, regenerate another arrangement, and move or swap players before confirming.',points:['Balance considers skill, height, and optional gender.','Only confirmed lineups count toward teammate history.'],visual:'teams',visualTitle:'Example of team layout choices, rosters, and confirm control'},
 {number:'05',title:'Run the games live',description:'Create a one-court schedule, keep score with the Scorekeeper, and put the TV display on another screen. Scores and teams update across devices.',points:['Choose 11, 15, 21, or 25 points, win by two.','Start a new night without losing player profiles.'],visual:'games',visualTitle:'Example of the Scorekeeper controls beside the live TV display'}
];

export function HowItWorks(){
 useEffect(()=>{document.title='How it works | Volleyball Night'},[]);
 return <div className="hub-page"><HubHeader/><main className="guide-main">
  <div className="guide-intro"><a className="hub-back" href="/">← Back to launch page</a><span className="hub-kicker">HOW IT WORKS</span><h1>From first click<br/>to first serve.</h1>
   <p>Set up your own group website, check in players, make fair teams, and run the whole night from connected screens.</p>
   <nav className="guide-jump" aria-label="Guide sections">{steps.map(step=><a key={step.number} href={'#step-'+step.number}>{step.number} {step.title}</a>)}</nav>
  </div>
  <div className="guide-steps">{steps.map(step=><section className="guide-step" id={'step-'+step.number} key={step.number}>
   <div className="guide-step-copy"><span className="guide-number">STEP {step.number}</span><h2>{step.title}</h2><p>{step.description}</p>
    <ul>{step.points.map(point=><li key={point}><Check size={17}/><span>{point}</span></li>)}</ul></div>
   <GuideImage kind={step.visual} title={step.visualTitle}/>
  </section>)}</div>
  <aside className="guide-after"><div><span className="hub-kicker">WHEN YOU COME BACK</span><h2>Your group is still there.</h2><p>Use Find my groups to reopen your website or publish an app update. Updating the website does not erase saved players or games.</p></div><a className="hub-button-outline" href="/?mode=groups">Find my groups <FolderOpen size={18}/></a></aside>
  <div className="guide-end"><h2>Ready to set up your group?</h2><a className="hub-button-primary" href="/?mode=setup">Create a group <ArrowRight size={18}/></a></div>
 </main><HubFooter/></div>;
}
