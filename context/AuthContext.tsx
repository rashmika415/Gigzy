import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';

export interface UserData {
  uid: string;
  fullName: string;
  email: string;
  role: 'freelancer' | 'client' | 'admin';
  phone?: string;
  photoURL?: string;
  bio?: string;
  skills?: string;
  availability?: string;
  businessName?: string;
  businessCategory?: string;
  businessDetails?: string;
  location?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  setRoleForTesting: (role: 'freelancer' | 'client' | 'admin') => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  setRoleForTesting: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    // Safety timeout: Ensure loading is never stuck indefinitely on slow/offline networks
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 3500);

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimer);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Setup real-time listener for the Firestore user document
        const docRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeDoc = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserData(snapshot.data() as UserData);
          } else {
            // Fallback profile if Firestore doc hasn't been written yet
            setUserData({
              uid: firebaseUser.uid,
              fullName: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: 'freelancer', // default fallback
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user document:", error);
          setLoading(false);
        });
      } else {
        setUserData(null);
        if (unsubscribeDoc) unsubscribeDoc();
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const setRoleForTesting = (role: 'freelancer' | 'client' | 'admin') => {
    if (userData) {
      setUserData({
        ...userData,
        role,
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, setRoleForTesting }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

