'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Zap, Database, BarChart3, Activity } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

// Dynamic imports for Firebase-dependent components
const LoginButton = dynamic(
  () => import('@/components/auth/LoginButton').then((mod) => mod.LoginButton),
  { ssr: false, loading: () => <div className="h-14 w-64 rounded-2xl bg-secondary animate-pulse" /> }
);

const features = [
  {
    icon: Database,
    title: 'Real-time CDC Streaming',
    description: 'Kafka-powered data pipelines that stream your marketing data continuously',
  },
  {
    icon: Activity,
    title: 'Flink Processing',
    description: 'Apache Flink calculates ROAS, CPC, and CTR in real-time windows',
  },
  {
    icon: BarChart3,
    title: 'Live Dashboards',
    description: 'Auto-updating dashboards that reflect your latest campaign performance',
  },
];

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router, mounted]);

  // Show loading state during hydration
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background bg-grid bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid bg-mesh">
      {/* Hero Section */}
      <div className="relative">
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-32">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <div className="w-14 h-14 rounded-2xl gradient-ai flex items-center justify-center glow-ai">
              <Zap className="w-7 h-7 text-white" />
            </div>
          </div>

          {/* Headline */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-gradient">DataFlow AI</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4">
              Real-time Marketing Analytics Powered by
            </p>
            <div className="flex items-center justify-center gap-4 text-lg font-mono">
              <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                Kafka
              </span>
              <span className="text-muted-foreground">+</span>
              <span className="px-3 py-1 rounded-lg bg-accent/10 text-accent border border-accent/20">
                Flink
              </span>
              <span className="text-muted-foreground">+</span>
              <span className="px-3 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Gemini AI
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-center text-muted-foreground text-lg max-w-2xl mx-auto mb-12">
            Connect your Google Ads, Facebook Ads, and more. Get real-time streaming dashboards
            with AI-powered insights. No data engineers required.
          </p>

          {/* CTA */}
          <div className="flex justify-center mb-20">
            <LoginButton />
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className="glass rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:glow-primary"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>Built for the CDC Hackathon with Kafka, Flink, and Gemini AI</p>
        </div>
      </footer>
    </div>
  );
}
