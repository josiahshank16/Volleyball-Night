import {useEffect,useState,type FormEvent} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,type User} from 'firebase/auth';
import {doc,getDoc,setDoc,serverTimestamp} from 'firebase/firestore';
import {firebaseAuth,firebaseConfig,firestore} from './firebase';
import {type AppState,exportState} from './model';
import {CheckCircle2,LogIn,LogOut,ShieldCheck,CloudOff,CloudUpload,CloudDownload,Database,Zap} from 'lucide-react';

const ORGANIZER_UID='lzA887v8R7d4yWoxVlHMG9ISrAK2';
const CHECK_COLLECTION='organizerChecks';
const BACKUP_REF=doc(firestore,'organizerBackups','latest');

function readableError(err:unknown) {
 const code=(err as {code?:string}).code??'';
 if(code==='permission-denied')return 'Firestore permission denied. Publish the new firestore.rules from GitHub in Firebase Console → Firestore Database → Rules, then retry. The account must match the authorized organizer UID.';
 if(code==='unavailable')return 'Could not reach Firestore. Check the network and whether the database was created.';
 if(code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found')return 'Sign-in failed. Check the email and password for your Firebase Authentication user.';
 if(code==='auth/operation-not-allowed')return 'Enable Email/Password in Firebase Console → Authentication → Sign-in method.';
 if(code==='auth/too-many-requests')return 'Too many sign-in attempts. Try again later.';
 return code||String(err);
}
function validAppState(v:unknown):v is AppState {
 if(!v||typeof v!=='object')return false;
 const s=v as Partial<AppState>;
 return Array.isArray(s.players)
   &&Array.isArray(s.history)
   &&!!s.session&&typeof s.session==='object'
   &&Array.isArray(s.session.checkedIn)
   &&Array.isArray(s.session.games)
   &&Array.isArray(s.session.confirmed);
}
export function FirebaseConnect({state,onRestore}:{state:AppState;onRestore:(next:AppState)=>void}){
 const [user,setUser]=useState<User|null>(firebaseAuth.currentUser);
 const [loaded,setLoaded]=useState(false);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [feedback,setFeedback]=useState('');
 useEffect(()=>onAuthStateChanged(firebaseAuth,u=>{setUser(u);setLoaded(true);setError('');setFeedback('')}),[]);
 const authorized=!!user&&user.uid===ORGANIZER_UID;
 const doTask=async(task:()=>Promise<void>)=>{
   setBusy(true);setError('');setFeedback('');
   try{await task()}catch(err){setError(readableError(err))}finally{setBusy(false)}
 };
 const login=async(e:FormEvent)=>{
   e.preventDefault();
   await doTask(async()=>{await signInWithEmailAndPassword(firebaseAuth,email.trim(),password);setPassword('')});
 };
 const verify=()=>doTask(async()=>{
   if(!user)throw Error('Sign in first.');
   const ref=doc(firestore,CHECK_COLLECTION,user.uid);
   await setDoc(ref,{lastCheckedAt:serverTimestamp(),uid:user.uid});
   const snapshot=await getDoc(ref);
   if(!snapshot.exists())throw Error('Test document was not found after write.');
   setFeedback('Firestore read and write succeeded. This account is authorized by the deployed security rules.');
 });
 const backup=()=>doTask(async()=>{
   if(!user||!authorized)throw Error('Organizer sign-in required.');
   const existing=await getDoc(BACKUP_REF);
   const existingText=existing.exists()?'This will REPLACE the previously uploaded cloud backup.':'This will create the first cloud backup.';
   if(!window.confirm(existingText+'\n\nYour browser data will not change. Continue?'))return;
   // Keep a separate JSON copy before replacing an earlier cloud backup.
   exportState(state);
   await setDoc(BACKUP_REF,{payload:state,updatedAt:serverTimestamp(),updatedBy:user.uid,schemaVersion:1});
   setFeedback('Cloud backup uploaded successfully. A JSON copy of this browser data was also downloaded.');
 });
 const restore=()=>doTask(async()=>{
   if(!user||!authorized)throw Error('Organizer sign-in required.');
   const snap=await getDoc(BACKUP_REF);
   if(!snap.exists()){setFeedback('No cloud backup exists yet. Use “Upload local data” first.');return;}
   const restored=(snap.data() as {payload?:unknown}).payload;
   if(!validAppState(restored))throw Error('Cloud backup is not a supported Volleyball Night data file.');
   if(!window.confirm('This will REPLACE the current browser data with the cloud backup. A JSON backup of your current browser data will download first. Continue?'))return;
   exportState(state);
   onRestore(restored);
   setFeedback('Cloud backup restored into this browser. Realtime cloud sync is not yet enabled.');
 });
 return <div className="firebase-connect">
   <div className="fb-head"><div><h2>Firebase connection</h2><p>Project: <strong>{firebaseConfig.projectId}</strong></p></div><span className="fb-status"><CheckCircle2 size={16}/> Configured</span></div>
   {!loaded?<p>Checking Firebase sign-in…</p>:user?<div className="fb-signedin">
     <p><ShieldCheck size={18}/> Signed in as <strong>{user.email??'Firebase user'}</strong></p>
     <div className="fb-uid"><span>User ID (UID)</span><code>{user.uid}</code><button type="button" onClick={()=>navigator.clipboard.writeText(user.uid)}>Copy UID</button></div>
     <p className={authorized?'fb-role-ok':'fb-role-warn'}>{authorized?'Authorized organizer UID matches this account.':'This user is not on the organizer allowlist. Firestore access will be denied.'}</p>
     {authorized&&<section className="fb-data-test">
       <div className="fb-data-intro"><Database size={22}/><div><h3>Test protected cloud storage</h3><p>These actions require the new security rules to be published in Firestore. Nothing is automatically uploaded.</p></div></div>
       <div className="stack-buttons">
         <button type="button" className="btn secondary" disabled={busy} onClick={verify}><Zap size={17}/> Test Firestore read/write</button>
         <button type="button" className="btn secondary" disabled={busy} onClick={backup}><CloudUpload size={17}/> Upload local data backup</button>
         <button type="button" className="btn secondary" disabled={busy} onClick={restore}><CloudDownload size={17}/> Restore cloud backup here</button>
       </div>
     </section>}
     <button className="btn secondary" disabled={busy} onClick={()=>doTask(()=>signOut(firebaseAuth))}><LogOut size={17}/> Sign out</button>
   </div>:<form className="fb-login" onSubmit={login}>
     <p>Sign in using the organizer account you created in Firebase Authentication. The organizer dashboard is still a prototype preview and isn't yet locked behind sign-in.</p>
     <label>Email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="organizer@example.com"/></label>
     <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
     <button className="btn primary" type="submit" disabled={busy}><LogIn size={17}/>{busy?'Signing in…':'Sign in with Firebase'}</button>
   </form>}
   {error&&<p className="fb-error" role="alert">{error}</p>}
   {feedback&&<p className="fb-feedback" role="status">{feedback}</p>}
   <div className="fb-warning"><CloudOff size={19}/><p><strong>This is a protected backup test, not realtime synchronization.</strong> Normal check-ins and scores still use this browser's local storage. Separate-device access will follow a granular database and kiosk-permission implementation.</p></div>
 </div>;
}
