import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, serverTimestamp, getDoc, doc, initializeFirestore, CACHE_SIZE_UNLIMITED, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Load config from environment variables (prefixed with REACT_APP_)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);
let db;

const CWS_DOMAIN_SUFFIX = "firebase-sign-up-1746849346726.cluster-76blnmxvvzdpat4inoxk5tmzik.cloudworkstations.dev";

// Disable all emulators and use production services
console.log("Using production Firebase services...");
db = getFirestore(app);

// Set up auth state change listener
onAuthStateChanged(auth, (user) => {
  if (user) console.log("Firebase.js Auth Test: User is SIGNED IN:", user.uid);
  else console.log("Firebase.js Auth Test: User is SIGNED OUT.");
}, (error) => console.error("Firebase.js Auth Test (onAuthStateChanged Error):", error));

if (!db) {
    console.error("CRITICAL: Firestore DB instance (db) is undefined. Falling back to default init.");
    db = getFirestore(app);
}

export { auth, db, functions, app, serverTimestamp };
