'use client';

import type { User } from '@/types';

// Check if Firebase is configured
const isFirebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

// Mock user for development
const MOCK_USER: User = {
  id: 'demo-user-123',
  email: 'demo@dataflow.ai',
  displayName: 'Demo User',
  photoURL: null,
};

// Dynamic imports for Firebase (only when configured)
let auth: ReturnType<typeof import('firebase/auth').getAuth> | null = null;
let googleProvider: import('firebase/auth').GoogleAuthProvider | null = null;

// Initialize Firebase only if configured
if (typeof window !== 'undefined' && isFirebaseConfigured) {
  import('firebase/app').then(({ initializeApp, getApps }) => {
    import('firebase/auth').then(({ getAuth, GoogleAuthProvider }) => {
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      };

      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
    });
  });
}

// Sign in with Google (or mock in development)
export const signInWithGoogle = async (): Promise<User> => {
  if (!isFirebaseConfigured) {
    console.log('[DEV MODE] Mock sign in');
    return MOCK_USER;
  }

  try {
    const { signInWithPopup } = await import('firebase/auth');
    if (!auth || !googleProvider) {
      throw new Error('Firebase not initialized');
    }
    const result = await signInWithPopup(auth, googleProvider);
    return {
      id: result.user.uid,
      email: result.user.email || '',
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    };
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// Sign out
export const signOut = async (): Promise<void> => {
  if (!isFirebaseConfigured) {
    console.log('[DEV MODE] Mock sign out');
    return;
  }

  try {
    const { signOut: firebaseSignOut } = await import('firebase/auth');
    if (auth) {
      await firebaseSignOut(auth);
    }
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Subscribe to auth state changes
export const subscribeToAuthState = (
  callback: (user: User | null) => void
): (() => void) => {
  if (!isFirebaseConfigured) {
    // In dev mode, don't auto-login - wait for explicit sign in
    return () => {};
  }

  if (!auth) {
    return () => {};
  }

  import('firebase/auth').then(({ onAuthStateChanged }) => {
    if (auth) {
      onAuthStateChanged(auth, (firebaseUser) => {
        callback(firebaseUser ? {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        } : null);
      });
    }
  });

  return () => {};
};

// Get current user
export const getCurrentUser = (): User | null => {
  if (!isFirebaseConfigured) {
    return null;
  }

  if (!auth) {
    return null;
  }

  const firebaseUser = auth.currentUser;
  return firebaseUser ? {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
  } : null;
};

// Get ID token for API calls
export const getIdToken = async (): Promise<string | null> => {
  if (!isFirebaseConfigured) {
    return 'mock-token-for-development';
  }

  if (!auth) {
    return null;
  }

  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

export { auth, isFirebaseConfigured };
