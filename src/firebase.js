import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, serverTimestamp, getDoc, doc, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore'; // Removed connectFirestoreEmulator as we use initializeFirestore for proxy
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCl7tGYcTpAQnX0v85D1cHyCsvsrmXJP_I",
  authDomain: "sign-up-203c0.firebaseapp.com",
  projectId: "sign-up-203c0",
  storageBucket: "sign-up-203c0.firebasestorage.app",
  messagingSenderId: "329918791992",
  appId: "1:329918791992:web:8514ffd0f2b172ba80c1cd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);
let db;

const CWS_DOMAIN_SUFFIX = "firebase-sign-up-1746849346726.cluster-76blnmxvvzdpat4inoxk5tmzik.cloudworkstations.dev";

if (process.env.NODE_ENV === 'development') {
  console.log("Development mode: Configuring Firebase Emulators...");

  // --- Auth Emulator Connection --- 
  const authEmulatorUrl = `https://${9099}-${CWS_DOMAIN_SUFFIX}`;
  try {
    console.log(`Attempting to connect Auth emulator to: ${authEmulatorUrl}`);
    connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
    console.log("Auth Emulator connection configured.");
    onAuthStateChanged(auth, (user) => {
      if (user) console.log("Firebase.js Auth Test: User is SIGNED IN:", user.uid);
      else console.log("Firebase.js Auth Test: User is SIGNED OUT.");
    }, (error) => console.error("Firebase.js Auth Test (onAuthStateChanged Error):", error));
  } catch (e) { console.error("Error configuring Auth Emulator:", e); }

  // --- Firestore Emulator Connection (Attempting with Dev Server Proxy) ---
  console.log("Configuring Firestore to use a path on app's origin, to be proxied to emulator.");
  console.log("Firebase.js: window.location.host is:", window.location.host, "protocol is:", window.location.protocol); // Test T3
  try {
    db = initializeFirestore(app, {
      host: window.location.host, 
      ssl: window.location.protocol === "https:",
      // Removed experimentalForceLongPolling and cacheSizeBytes for this test (Test T2 simplification)
    });
    console.log(`Firestore initialized to target app host: ${window.location.host}, SSL: ${window.location.protocol === "https:"}`);
    
    getDoc(doc(db, "_emulatorTest", "doc1")).then(() => {
        console.log("Firestore Emulator connection test successful (via Dev Server Proxy to emulator).");
    }).catch(err => {
        console.error("Firestore Emulator connection test FAILED (via Dev Server Proxy to emulator):", err);
    });
  } catch (e) { console.error("Error initializing Firestore for Dev Server Proxy:", e); }

  // --- Functions Emulator Connection (Commented - will need proxy and fetch update in component) ---
  console.log("Functions emulator connection is currently commented out. Will need proxy and fetch updates in components.");
  // connectFunctionsEmulator(functions, "127.0.0.1", 5001);

} else {
  console.log("Production mode. Initializing production Firestore.");
  db = getFirestore(app); 
}

if (!db) {
    console.error("CRITICAL: Firestore DB instance (db) is undefined. Falling back to default init.");
    db = getFirestore(app);
}

export { auth, db, functions, app, serverTimestamp };
