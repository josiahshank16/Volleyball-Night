import {useEffect,useState,type FormEvent} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut, type User} from 'firebase/auth';
import {firebaseAuth, firebaseConfig} from './firebase';
import {CheckCircle2, LogIn, LogOut, ShieldCheck, CloudOff} from 'lucide-react';

function authMessage(code:string) {
  if (code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found') return 'Sign-in failed. Check the email and password for your Firebase Authentication user.';
  if (code==='auth/operation-not-allowed') return 'Enable Email/Password in Firebase Console → Authentication → Sign-in method.';
  if (code==='auth/too-many-requests') return 'Too many attempts. Try again later.';
  return code;
}
export function FirebaseConnect(){
  const [user,setUser]=useState<User|null>(firebaseAuth.currentUser);
  const [loaded,setLoaded]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>onAuthStateChanged(firebaseAuth,u=>{setUser(u);setLoaded(true)}),[]);
  const login=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');
    try {await signInWithEmailAndPassword(firebaseAuth,email.trim(),password);setPassword('');}
    catch(err){setError(authMessage((err as {code?:string}).code??'Sign-in failed'));}
    finally{setBusy(false)}
  };
  const logout=async()=>{setBusy(true);try{await signOut(firebaseAuth)}finally{setBusy(false)}};
  return <div className="firebase-connect">
    <div className="fb-head"><div><h2>Firebase connection</h2><p>Project: <strong>{firebaseConfig.projectId}</strong></p></div><span className="fb-status"><CheckCircle2 size={16}/> Configured</span></div>
    {!loaded?<p>Checking Firebase sign-in…</p>:user?<div className="fb-signedin">
      <p><ShieldCheck size={18}/> Signed in as <strong>{user.email??'Firebase user'}</strong></p>
      <div className="fb-uid"><span>User ID (UID)</span><code>{user.uid}</code><button type="button" onClick={()=>navigator.clipboard.writeText(user.uid)}>Copy UID</button></div>
      <button className="btn secondary" disabled={busy} onClick={logout}><LogOut size={17}/> Sign out</button>
    </div>:<form className="fb-login" onSubmit={login}>
      <p>Sign in with an account you created in Firebase Authentication. This does not yet unlock cloud data or organizer privileges.</p>
      <label>Email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="organizer@example.com"/></label>
      <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      {error&&<p className="fb-error" role="alert">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}><LogIn size={17}/>{busy?'Signing in…':'Test Firebase sign-in'}</button>
    </form>}
    <div className="fb-warning"><CloudOff size={19}/><p><strong>Cloud data is not enabled yet.</strong> Existing check-ins, scores, teams, and history still use this browser's local storage. Firestore remains locked until we implement and test role-based security rules and a safe migration.</p></div>
  </div>;
}
