'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { signInWithGoogle, signOut, subscribeToAuthState } from '@/lib/firebase';

export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((authUser) => {
      setUser(authUser);
    });

    return () => unsubscribe();
  }, [setUser]);

  const handleSignIn = async () => {
    try {
      // Don't set loading here - the page will redirect to Google OAuth
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in failed:', error);
      setLoading(false);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      logout();
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };
}
