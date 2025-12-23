'use client';

import type { User } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Sign in with Google via backend OAuth
export const signInWithGoogle = async (): Promise<User> => {
  try {
    // Get the OAuth URL from backend
    const response = await fetch(`${API_URL}/api/auth/google/login`);
    const data = await response.json();

    if (!data.auth_url) {
      throw new Error('Failed to get auth URL');
    }

    // Redirect to Google OAuth
    window.location.href = data.auth_url;

    // This won't be reached as we're redirecting
    return {} as User;
  } catch (error) {
    console.error('Error initiating sign in:', error);
    throw error;
  }
};

// Sign out
export const signOut = async (): Promise<void> => {
  try {
    const session = getSession();
    await fetch(`${API_URL}/api/auth/logout?session=${session}`, {
      method: 'POST',
      credentials: 'include',
    });
    // Clear session from localStorage and cookie
    localStorage.removeItem('session');
    document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Get session from localStorage or cookie
function getSession(): string | null {
  if (typeof window === 'undefined') return null;

  // Try localStorage first
  const localSession = localStorage.getItem('session');
  if (localSession) return localSession;

  // Fallback to cookie
  const match = document.cookie.match(/(?:^|; )session=([^;]*)/);
  return match ? match[1] : null;
}

// Check auth status with backend
export const checkAuthStatus = async (): Promise<User | null> => {
  try {
    const session = getSession();
    if (!session) {
      return null;
    }

    const response = await fetch(`${API_URL}/api/auth/me?session=${session}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const userData = await response.json();
    return {
      id: userData.id,
      email: userData.email,
      displayName: userData.name,
      photoURL: userData.picture,
    };
  } catch (error) {
    console.error('Error checking auth status:', error);
    return null;
  }
};

// Subscribe to auth state changes (check on mount)
export const subscribeToAuthState = (
  callback: (user: User | null) => void
): (() => void) => {
  // Check auth status immediately
  checkAuthStatus().then(callback);

  // Return empty unsubscribe function
  return () => {};
};

// Get current user (synchronous - returns cached value)
export const getCurrentUser = (): User | null => {
  // This is now async, so we return null synchronously
  // The actual user is fetched via subscribeToAuthState
  return null;
};

// Get ID token for API calls
export const getIdToken = async (): Promise<string | null> => {
  return getSession();
};

// For backward compatibility
export const auth = null;
export const isFirebaseConfigured = false;
