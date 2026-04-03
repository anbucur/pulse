import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authProvider, type AuthUser, type AuthResult } from '../lib/providers';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isVerified: boolean;
  hasProfile: boolean;
  isPremium: boolean;
  blockedUsers: string[];
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  checkProfileStatus: (uid: string) => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  const checkProfileStatus = useCallback(async (uid: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profiles/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const profile = await response.json();
        setIsVerified(profile.is_verified || false);
        setIsPremium(profile.is_premium || false);
        setHasProfile(true);
      } else {
        setHasProfile(false);
      }
    } catch (error) {
      console.error('Error checking profile status:', error);
      setHasProfile(false);
    }
  }, []);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('token');
    if (token) {
      authProvider.verifyToken(token)
        .then((authenticatedUser) => {
          setUser(authenticatedUser);
          setIsVerified(authenticatedUser.isVerified);
          setIsPremium(authenticatedUser.isPremium);
          checkProfileStatus(authenticatedUser.id);
        })
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [checkProfileStatus]);

  const signInWithEmail = async (email: string, password: string) => {
    const result = await authProvider.login({ email, password });
    localStorage.setItem('token', result.token);
    localStorage.setItem('refreshToken', result.refreshToken || '');
    setUser(result.user);
    setIsVerified(result.user.isVerified);
    setIsPremium(result.user.isPremium);
    await checkProfileStatus(result.user.id);
    return result;
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    const result = await authProvider.register({ email, password, displayName });
    localStorage.setItem('token', result.token);
    localStorage.setItem('refreshToken', result.refreshToken || '');
    setUser(result.user);
    setIsVerified(result.user.isVerified);
    setIsPremium(result.user.isPremium);
    await checkProfileStatus(result.user.id);
    return result;
  };

  const resetPassword = async (email: string) => {
    await authProvider.resetPassword(email);
  };

  const logout = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      await authProvider.logout(token);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setIsVerified(false);
    setHasProfile(false);
    setIsPremium(false);
    setBlockedUsers([]);
  };

  const refreshToken = async () => {
    const refreshTokenValue = localStorage.getItem('refreshToken');
    if (!refreshTokenValue) {
      throw new Error('No refresh token available');
    }

    const result = await authProvider.refreshToken(refreshTokenValue);
    localStorage.setItem('token', result.token);
    localStorage.setItem('refreshToken', result.refreshToken || '');
    setUser(result.user);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isVerified,
      hasProfile,
      isPremium,
      blockedUsers,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      logout,
      checkProfileStatus,
      refreshToken,
    }}>
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
