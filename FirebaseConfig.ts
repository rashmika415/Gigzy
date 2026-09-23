// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdkoBt86OJ90zKNOGQu_9FTfVXpc8XFz4",
  authDomain: "gig-app-6661d.firebaseapp.com",
  projectId: "gig-app-6661d",
  storageBucket: "gig-app-6661d.firebasestorage.app",
  messagingSenderId: "203461135740",
  appId: "1:203461135740:web:38cf5749d50af10bac28f9",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
