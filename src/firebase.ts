import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';
import {activeGroup} from './groupConnection';

// Existing volleyball project stays the default for current users.
// A group link or saved connection selects a different project at runtime.
export const originalFirebaseConfig={
 apiKey:'AIzaSyBUE_-UrIY_RZeJagrUCXOWt6cXxcv4nQI',
 authDomain:'volleyball-night.firebaseapp.com',
 projectId:'volleyball-night',
 storageBucket:'volleyball-night.firebasestorage.app',
 messagingSenderId:'992829373528',
 appId:'1:992829373528:web:b5da259109ed2d5c6a5e2d'
};
export const firebaseConfig=activeGroup?.config??originalFirebaseConfig;
export const firebaseApp=initializeApp(firebaseConfig);
export const firebaseAuth=getAuth(firebaseApp);
export const firestore=getFirestore(firebaseApp);
export const connectedGroupName=activeGroup?.name??'Original Volleyball Night';
