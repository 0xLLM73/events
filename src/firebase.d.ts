import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { Functions } from 'firebase/functions';

declare const app: FirebaseApp;
declare const auth: Auth;
declare const db: Firestore;
declare const functions: Functions;

export { app, auth, db, functions };
