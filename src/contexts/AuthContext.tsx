import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserCredential, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { registerFCMToken } from '../lib/notifications';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isVerified: boolean;
  hasProfile: boolean;
  isPremium: boolean;
  blockedUsers: string[];
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<UserCredential>;
  signInWithEmail: (email: string, password: string) => Promise<UserCredential>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  checkProfileStatus: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  const checkProfileStatus = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setIsVerified(data.isVerified || false);
        setIsPremium(data.isPremium || false);
      } else {
        // Create base user doc if it doesn't exist
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: auth.currentUser?.email || '',
          role: 'user',
          isVerified: false,
          isPremium: false
        });
        setIsVerified(false);
        setIsPremium(false);
      }

      const profileDoc = await getDoc(doc(db, 'public_profiles', uid));
      setHasProfile(profileDoc.exists());
    } catch (error) {
      console.error("Error checking profile status:", error);
    }
  };

  useEffect(() => {
    let blockedUnsub: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkProfileStatus(currentUser.uid);
        registerFCMToken(currentUser.uid);
        
        // Listen to blocked users
        blockedUnsub = onSnapshot(collection(db, `blocks/${currentUser.uid}/blocked`), (snapshot) => {
          setBlockedUsers(snapshot.docs.map(doc => doc.id));
        });
      } else {
        setIsVerified(false);
        setHasProfile(false);
        setIsPremium(false);
        setBlockedUsers([]);
        if (blockedUnsub) blockedUnsub();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (blockedUnsub) blockedUnsub();
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      return await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing up with email", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing in with email", error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Error resetting password", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isVerified, hasProfile, isPremium, blockedUsers, signInWithGoogle, signUpWithEmail, signInWithEmail, resetPassword, logout, checkProfileStatus }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
