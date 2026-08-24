import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';

export type UserRole = 'youth' | 'business';

export interface UserProfile {
  fullName: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthResolved(true);
      if (!firebaseUser) {
        setProfile(null);
        setProfileResolved(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    setProfileResolved(false);
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const data = snapshot.data();
      setProfile(
        data
          ? { fullName: data.fullName, email: data.email, role: data.role === 'business' ? 'business' : 'youth' }
          : null
      );
      setProfileResolved(true);
    });
    return unsubscribe;
  }, [user]);

  const loading = !authResolved || (!!user && !profileResolved);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
