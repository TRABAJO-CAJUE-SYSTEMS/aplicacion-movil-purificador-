import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase, ref, get, onValue, off,
  query, limitToLast, orderByKey, set,
  type Database, type DatabaseReference,
} from 'firebase/database';

// Auth via REST — no necesita módulos nativos, funciona en Expo Go
export { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         sendPasswordResetEmail, signOut, onAuthStateChanged,
         restoreSession, signInWithGoogleToken,
         resendVerificationEmail } from './customAuth';

const firebaseConfig = {
  apiKey:            "AIzaSyB_lHSk7tsVKKp4h4bRK8-OJJMC63ZOoak",
  authDomain:        "purificador-53617.firebaseapp.com",
  databaseURL:       "https://purificador-53617-default-rtdb.firebaseio.com",
  projectId:         "purificador-53617",
  storageBucket:     "purificador-53617.appspot.com",
  messagingSenderId: "192689604959",
  appId:             "1:192689604959:android:215bbcd9d33732602b4eea",
};

// Solo inicializar la app para Firebase RTDB (no Auth)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const database: Database = getDatabase(app);

export { database, ref, get, onValue, off, query, limitToLast, orderByKey, set };
export type { Database, DatabaseReference };
