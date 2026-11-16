import {inMemoryPersistence,setPersistence,signInWithEmailAndPassword,signOut,updatePassword} from 'firebase/auth';
import {doc,serverTimestamp,updateDoc} from 'firebase/firestore';
import {firebaseAuth,firebaseConfig,firestore} from './firebase';
import {leaderEmail} from './accessAdmin';

/** The PIN is sent to Firebase Authentication, never stored in the app. */
export async function enterLeaderMode(pin:string){
 if(!/^\d{6}$/.test(pin))throw Error('Enter the six-digit group PIN.');
 await setPersistence(firebaseAuth,inMemoryPersistence);
 return signInWithEmailAndPassword(firebaseAuth,leaderEmail(firebaseConfig.projectId),pin);
}

export async function leaveLeaderMode(){await signOut(firebaseAuth)}

/** A recent sign-in with the existing PIN authorizes a server-checked rotation. */
export async function changeLeaderPin(currentPin:string,newPin:string){
 if(!/^\d{6}$/.test(currentPin)||!/^\d{6}$/.test(newPin))
  throw Error('Both PINs must be six digits.');
 if(currentPin===newPin)throw Error('Choose a different new PIN.');
 const credential=await enterLeaderMode(currentPin);
 try{
  // Firestore rules allow this account to change only the cutoff timestamp.
  // This invalidates every earlier leader session before changing the password.
  await updateDoc(doc(firestore,'access','config'),{pinChangedAt:serverTimestamp()});
  await updatePassword(credential.user,newPin);
 }finally{await leaveLeaderMode()}
 // Auth timestamps have whole-second precision. Wait past the Firestore
 // server cutoff so the next PIN sign-in is accepted immediately.
 await new Promise(resolve=>setTimeout(resolve,1200));
}
