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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
