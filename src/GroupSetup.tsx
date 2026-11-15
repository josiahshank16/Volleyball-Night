import {useState} from 'react';
import {initializeApp,deleteApp} from 'firebase/app';
import {doc,getDoc,getFirestore,runTransaction,serverTimestamp} from 'firebase/firestore';
import {CheckCircle2,Copy,Database,ExternalLink,Link2,RefreshCw,RotateCcw,Volleyball} from 'lucide-react';
import {initial} from './model';
import {activeGroup,activateGroup,encodeGroup,parseFirebaseConfig,useOriginalGroup,validateGroup,type GroupConnection} from './groupConnection';
import {connectedGroupName,firebaseConfig} from './firebase';
import {ModeSwitch} from './ModeHome';

export const GROUP_FIRESTORE_RULES=`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /liveSessions/{sessionId} {
      allow get: if sessionId == 'current';
      allow list, delete: if false;
      allow create, update: if sessionId == 'current'
        && request.resource.data.keys().hasOnly([
          'payload', 'schemaVersion', 'updatedAt', 'updatedBy'
        ])
        && request.resource.data.schemaVersion == 1
        && request.resource.data.payload is map
        && request.resource.data.payload.keys().hasOnly(['json'])
        && request.resource.data.payload.json is string
        && request.resource.data.updatedBy is string;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;

const urls={
 firebase:'https://console.firebase.google.com/',
 firestore:'https://firebase.google.com/docs/firestore/quickstart',
 config:'https://support.google.com/firebase/answer/7015592'
};
function shareUrl(g:GroupConnection){
 const u=new URL(location.href);
 u.search='';u.hash='';
 u.searchParams.set('g',encodeGroup(g));
 return u.toString();
}
export function GroupSetup(){
 const [name,setName]=useState('');
 const [text,setText]=useState('');
 const [verified,setVerified]=useState<GroupConnection|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [copied,setCopied]=useState('');
 async function copy(label:string,value:string){
  try{await navigator.clipboard.writeText(value);setCopied(label);}
  catch{setError('Clipboard permission was denied. Select and copy the text manually.');}
 }
 const test=async()=>{
  setError('');setMessage('');setVerified(null);setBusy(true);
  let app:ReturnType<typeof initializeApp>|undefined;
  try{
   const config=parseFirebaseConfig(text);
   const group=validateGroup({version:1,name:name.trim()||config.projectId,config});
   // A separate temporary Firebase app tests the prospective project,
   // without changing the active group or its saved browser data.
   app=initializeApp(group.config,'check-'+crypto.randomUUID());
   const db=getFirestore(app);
   const ref=doc(db,'liveSessions','current');
   const existing=await getDoc(ref);
   if(!existing.exists()){
    await runTransaction(db,async tx=>{
     const check=await tx.get(ref);
     if(check.exists())return;
     tx.set(ref,{schemaVersion:1,payload:{json:JSON.stringify(initial())},updatedAt:serverTimestamp(),updatedBy:'open-prototype'});
    });
    setMessage('Connected! A new empty Volleyball Night session was created in this Firebase project.');
   }else{
    const existingData=existing.data();
    const payload=existingData?.payload;
    if(!payload||typeof payload!=='object'||(!('json' in payload)&&!Array.isArray((payload as {players?:unknown}).players))){
     throw Error('Firestore connected, but liveSessions/current does not contain a compatible Volleyball Night session.');
    }
    setMessage('Connected! This project already has a Volleyball Night session. Its existing players and games will be preserved.');
   }
   setVerified(group);
  }catch(err){
   const e=err as {code?:string;message?:string};
   setError(e.code==='permission-denied'?'Firestore denied access. Create the Firestore database and publish the setup rules in THAT group’s Firebase project. Then test again.':e.message??String(err));
  }finally{
   setBusy(false);
   if(app)void deleteApp(app).catch(()=>{});
  }
 };
 return <div className="group-setup-shell">
  <header className="group-setup-bar">
    <div className="vn-home-logo"><Volleyball size={25}/><span>VOLLEYBALL <b>NIGHT</b></span></div>
    <ModeSwitch/>
  </header>
  <main className="group-setup-main">
    <div className="group-setup-heading"><span className="eyebrow">BRING YOUR OWN FIREBASE</span><h1>Connect your volleyball group</h1><p>One Volleyball Night website, with a separate database for each group. Your group doesn't need a GitHub account or its own website.</p></div>
    <section className="group-setup-card">
      <div className="group-setup-step"><span>1</span><div>
       <h2>Create a Firebase project</h2>
       <p>In Firebase Console, create a project for your group. Under <strong>Firestore Database</strong>, create the default Standard-edition database. You can choose the free Spark plan.</p>
       <a href={urls.firebase} target="_blank" rel="noreferrer">Open Firebase Console <ExternalLink size={15}/></a>
      </div></div>
      <div className="group-setup-step"><span>2</span><div>
       <h2>Publish the Volleyball Night Firestore rules</h2>
       <p>Open your new project's <strong>Firestore Database → Rules</strong>, replace the editor contents with these prototype rules, and click <strong>Publish</strong>. These allow anyone with the group link to edit that group's data.</p>
       <button type="button" className="btn secondary" onClick={()=>copy('rules',GROUP_FIRESTORE_RULES)}><Copy size={16}/>{copied==='rules'?'Copied rules':'Copy Firestore rules'}</button>
       <details><summary>Show the rules</summary><pre className="group-setup-code">{GROUP_FIRESTORE_RULES}</pre></details>
      </div></div>
      <div className="group-setup-step"><span>3</span><div>
       <h2>Paste your Firebase web app configuration</h2>
       <p>In <strong>Project settings → Your apps</strong>, register a Web app (the <strong>&lt;/&gt;</strong> icon). You do not need to enable Firebase Hosting for that project. Select <strong>Config</strong> and copy the <code>firebaseConfig</code> object.</p>
       <a href={urls.config} target="_blank" rel="noreferrer">Where to find the config <ExternalLink size={15}/></a>
       <div className="group-setup-fields">
        <label htmlFor="group-name">Group name<input id="group-name" value={name} onChange={e=>{setName(e.target.value);setVerified(null)}} maxLength={80} placeholder="e.g. Community Volleyball"/></label>
        <label htmlFor="group-config">Firebase web config<textarea id="group-config" rows={8} spellCheck={false} value={text} onChange={e=>{setText(e.target.value);setVerified(null)}} placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  appId: "..."\n};'}/></label>
       </div>
       <button type="button" className="btn primary" disabled={busy||!text.trim()} onClick={test}><Database size={17}/>{busy?'Checking Firestore…':'Test connection and initialize if needed'}</button>
       {error&&<p className="fb-error" role="alert">{error}</p>}
       {message&&<p className="group-setup-success"><CheckCircle2 size={19}/>{message}</p>}
       {verified&&<div className="group-setup-ready">
         <h3>{verified.name} is ready</h3>
         <p>Firebase project: <code>{verified.config.projectId}</code></p>
         <button type="button" className="btn primary" onClick={()=>activateGroup(verified)}><CheckCircle2 size={18}/> Open this group's Volleyball Night</button>
         <div className="group-setup-share">
          <label htmlFor="group-url">Link for other devices</label>
          <input id="group-url" readOnly value={shareUrl(verified)} onFocus={e=>e.target.select()}/>
          <button type="button" className="btn secondary" onClick={()=>copy('link',shareUrl(verified))}><Link2 size={16}/>{copied==='link'?'Copied':'Copy group link'}</button>
         </div>
         <p className="group-setup-muted">Share this link with your volunteers. It's longer than a normal website link because it includes the group's public Firebase configuration; no centralized directory or GitHub setup is needed.</p>
       </div>}
      </div></div>
    </section>
    <section className="group-setup-current">
     <h2>Currently selected group</h2>
     <p><strong>{connectedGroupName}</strong> · <code>{firebaseConfig.projectId}</code></p>
     {activeGroup?<button type="button" className="btn secondary" onClick={useOriginalGroup}><RotateCcw size={17}/> Switch back to original Volleyball Night</button>:<p>The original project remains available here. Connecting a new group won't copy or delete its data.</p>}
     <p className="group-setup-muted"><RefreshCw size={14}/> Connecting a different Firebase project changes only this browser's selected group. Other devices keep using their existing links.</p>
    </section>
  </main>
 </div>;
}
