import {inMemoryPersistence,setPersistence,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {firebaseAuth,firebaseConfig} from './firebase';
import {leaderEmail} from './accessAdmin';

/** The PIN is sent to Firebase Authentication, never stored in the app. */
export async function enterLeaderMode(pin:string){
 if(!/^\d{6}$/.test(pin))throw Error('Enter the six-digit group PIN.');
 await setPersistence(firebaseAuth,inMemoryPersistence);
 return signInWithEmailAndPassword(firebaseAuth,leaderEmail(firebaseConfig.projectId),pin);
}

export async function leaveLeaderMode(){await signOut(firebaseAuth)}
