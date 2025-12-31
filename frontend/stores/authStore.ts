'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: () => {
        // Clear tokens from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      refreshAccessToken: async () => {
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          const response = await fetch(`${apiUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (!response.ok) {
            throw new Error('Failed to refresh token');
          }

          const data = await response.json();

          // Update access token in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', data.access_token);
            if (data.refresh_token) {
              localStorage.setItem('refresh_token', data.refresh_token);
            }
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          throw error;
        }
      },
    }),
    {
      name: 'dataflow-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
