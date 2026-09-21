// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// @ts-expect-error getReactNativePersistence ships in the RN build of firebase/auth
// (resolved by Metro's "react-native" export condition) but isn't in the package's public types.
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDdkoBt86OJ90zKNOGQu_9FTfVXpc8XFz4",
    authDomain: "gig-app-6661d.firebaseapp.com",
    projectId: "gig-app-6661d",
    storageBucket: "gig-app-6661d.firebasestorage.app",
    messagingSenderId: "203461135740",
    appId: "1:203461135740:web:38cf5749d50af10bac28f9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;