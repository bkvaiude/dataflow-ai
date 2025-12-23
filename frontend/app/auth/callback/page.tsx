'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { checkAuthStatus } from '@/lib/firebase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      const session = searchParams.get('session');
      const error = searchParams.get('error');

      if (error) {
        console.error('Auth error:', error);
        router.push(`/?error=${error}`);
        return;
      }

      if (session) {
        // Store session in localStorage
        localStorage.setItem('session', session);

        // Also set as cookie for API calls
        document.cookie = `session=${session}; path=/; max-age=${60 * 60 * 24 * 7}`;

        // Fetch user data from backend
        const user = await checkAuthStatus();
        if (user) {
          setUser(user);
          router.push('/dashboard');
        } else {
          router.push('/?error=session_invalid');
        }
      } else {
        router.push('/?error=no_session');
      }
    };

    handleCallback();
  }, [searchParams, router, setUser, setLoading]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
