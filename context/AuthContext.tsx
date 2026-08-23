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
  bio?: string;
  skills?: string;
  createdAt?: any;
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

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
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

