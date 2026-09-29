// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// @ts-expect-error getReactNativePersistence ships in the RN build of firebase/auth
// (resolved by Metro's "react-native" export condition) but isn't in the package's public types.
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Firebase config is injected via EXPO_PUBLIC_* env vars (see .env.example) so
// each teammate/environment can point at their own Firebase project without
// editing source. Expo inlines EXPO_PUBLIC_ vars from .env at build time.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill in your Firebase project's config.`
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: requireEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: requireEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: requireEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requireEnv("EXPO_PUBLIC_FIREBASE_APP_ID"),
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});
// Firestore's streaming transport can be buffered indefinitely by some mobile
// networks/proxies. Native builds use long polling so writes either complete or
// surface an error instead of leaving the UI stuck on "Persisting...".
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: Platform.OS !== "web",
});
export const storage = getStorage(app);

export default app;
