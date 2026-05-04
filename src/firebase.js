// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
// Replace the values below with your own Firebase project config.
// Steps:
//  1. Go to https://console.firebase.google.com
//  2. Create a new project (or use an existing one)
//  3. Go to Project Settings > General > Your apps > Add app (Web)
//  4. Copy the firebaseConfig object and paste it here
//  5. In Firebase Console → Authentication → Sign-in method → Enable Google
//  6. In Firebase Console → Firestore Database → Create database (start in production mode)
//  7. Add your deployed domain to Authentication → Settings → Authorized domains
// ============================================================

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCstuwnxh8VH8-kbzno151N4ZQcCSr4tRQ",
  authDomain: "fintracker-6751d.firebaseapp.com",
  projectId: "fintracker-6751d",
  storageBucket: "fintracker-6751d.firebasestorage.app",
  messagingSenderId: "222170459132",
  appId: "1:222170459132:web:61d603b3ff65be0b756079"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
