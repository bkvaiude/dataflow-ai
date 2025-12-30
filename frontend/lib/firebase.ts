'use client';

import type { User } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Token refresh interval: refresh 5 minutes before expiration
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
const ACCESS_TOKEN_EXPIRE_MS = 60 * 60 * 1000; // 1 hour

let refreshTimer: NodeJS.Timeout | null = null;
let refreshPromise: Promise<boolean> | null = null;

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
    // Stop token refresh timer
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    const session = getSession();
    await fetch(`${API_URL}/api/auth/logout?session=${session}`, {
      method: 'POST',
      credentials: 'include',
    });

    // Clear all tokens from localStorage
    localStorage.removeItem('session');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');

    // Clear legacy session cookie
    document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Store JWT tokens in localStorage
function storeTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;

  const expiresAt = Date.now() + ACCESS_TOKEN_EXPIRE_MS;

  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('token_expires_at', expiresAt.toString());

  // Schedule token refresh
  scheduleTokenRefresh();
}

// Get access token from localStorage
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

// Get refresh token from localStorage
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

// Check if access token is expired or expiring soon
function isTokenExpiringSoon(): boolean {
  if (typeof window === 'undefined') return true;

  const expiresAt = localStorage.getItem('token_expires_at');
  if (!expiresAt) return true;

  const expiryTime = parseInt(expiresAt, 10);
  const now = Date.now();

  // Return true if expiring within 5 minutes
  return (expiryTime - now) < TOKEN_REFRESH_BUFFER_MS;
}

// Refresh the access token using refresh token (with mutex to prevent concurrent refreshes)
async function refreshAccessToken(): Promise<boolean> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = doRefreshAccessToken();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function doRefreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status);
      // Clear invalid tokens
      await signOut();
      return false;
    }

    const data = await response.json();
    storeTokens(data.access_token, data.refresh_token);

    console.log('Access token refreshed successfully');
    return true;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return false;
  }
}

// Schedule automatic token refresh
function scheduleTokenRefresh(): void {
  // Clear existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  const expiresAt = localStorage.getItem('token_expires_at');
  if (!expiresAt) return;

  const expiryTime = parseInt(expiresAt, 10);
  const now = Date.now();
  const refreshIn = expiryTime - now - TOKEN_REFRESH_BUFFER_MS;

  if (refreshIn > 0) {
    refreshTimer = setTimeout(async () => {
      await refreshAccessToken();
    }, refreshIn);
  }
}

// Get session from localStorage or cookie (legacy)
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
    // Try JWT authentication first
    let accessToken = getAccessToken();

    // If token is expiring soon, try to refresh it
    if (accessToken && isTokenExpiringSoon()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        accessToken = getAccessToken();
      } else {
        // Refresh failed - clear access token and try session auth
        accessToken = null;
      }
    }

    if (accessToken) {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        return {
          id: userData.id,
          email: userData.email,
          displayName: userData.name,
          photoURL: userData.picture,
        };
      }

      // Token invalid, try refresh
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return checkAuthStatus(); // Retry with new token
      }
      // Refresh failed - fall through to session auth
    }

    // Fallback to legacy session authentication
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

// Get ID token for API calls (returns JWT access token)
export const getIdToken = async (): Promise<string | null> => {
  // Check if access token is expiring soon and refresh if needed
  if (isTokenExpiringSoon()) {
    await refreshAccessToken();
  }

  // Return JWT access token (preferred)
  const accessToken = getAccessToken();
  if (accessToken) {
    return accessToken;
  }

  // Fallback to legacy session
  return getSession();
};

// Export token storage function for auth callback page
export { storeTokens };

// Export auth helper functions for components that need fine-grained control
export { getAccessToken, getSession };

// For backward compatibility
export const auth = null;
export const isFirebaseConfigured = false;
