import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// These web client identifiers are safe to bundle; database permissions
// are enforced separately by Firebase Authentication + Firestore Rules.
export const firebaseConfig = {
  apiKey: "AIzaSyBUE_-UrIY_RZeJagrUCXOWt6cXxcv4nQI",
  authDomain: "volleyball-night.firebaseapp.com",
  projectId: "volleyball-night",
  storageBucket: "volleyball-night.firebasestorage.app",
  messagingSenderId: "992829373528",
  appId: "1:992829373528:web:b5da259109ed2d5c6a5e2d"
};
export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
