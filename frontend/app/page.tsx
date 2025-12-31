'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Database,
  Workflow,
  Sparkles,
  Server,
  Bell,
  MessageSquare,
  Zap,
  ArrowRight,
  CheckCircle2,
  Shield,
  CircleDollarSign,
  Trash2,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useAuthStore } from '@/stores/authStore';
import { OrganizationJsonLd, SoftwareApplicationJsonLd, WebSiteJsonLd } from '@/components/seo/JsonLd';

// Dynamic imports for Firebase-dependent components
const LoginButton = dynamic(
  () => import('@/components/auth/LoginButton').then((mod) => mod.LoginButton),
  { ssr: false, loading: () => <div className="h-12 sm:h-14 w-full sm:w-64 rounded-xl sm:rounded-2xl bg-secondary animate-pulse" /> }
);

const buildingBlocks = [
  {
    icon: Database,
    title: 'Source',
    description: 'PostgreSQL, MySQL & more',
    color: 'primary',
  },
  {
    icon: Workflow,
    title: 'Pipeline',
    description: 'Confluent Kafka',
    color: 'accent',
  },
  {
    icon: Sparkles,
    title: 'Transform',
    description: 'ksqlDB & Flink',
    color: 'purple',
  },
  {
    icon: Server,
    title: 'Destination',
    description: 'ClickHouse, S3',
    color: 'green',
  },
  {
    icon: Bell,
    title: 'Alerts',
    description: 'Real-time monitoring',
    color: 'red',
  },
];

const features = [
  {
    icon: MessageSquare,
    title: 'Conversational AI',
    description: 'Describe your pipeline in plain English. Gemini AI builds it for you.',
  },
  {
    icon: Zap,
    title: 'Minutes, Not Months',
    description: 'What used to take weeks of DevOps work now takes a single conversation.',
  },
  {
    icon: Shield,
    title: 'No DevOps Required',
    description: 'Self-service pipeline management. No infrastructure expertise needed.',
  },
  {
    icon: CircleDollarSign,
    title: 'Cost Transparency',
    description: 'See estimated costs before creating. No surprise bills.',
  },
  {
    icon: Trash2,
    title: 'Easy Cleanup',
    description: 'Achieve your goal, cleanup with one click. Save costs.',
  },
  {
    icon: CheckCircle2,
    title: 'Smart Validation',
    description: 'AI validates schemas and catches issues before deployment.',
  },
];

const workflowSteps = [
  'Describe your data needs',
  'AI selects sources & tables',
  'Validate schemas',
  'Create pipeline',
  'Stream to destination',
  'Monitor & alert',
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
    <>
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <WebSiteJsonLd />

      <div className="min-h-screen bg-background bg-grid">
        {/* Gradient mesh overlay */}
        <div className="fixed inset-0 bg-mesh pointer-events-none" />

        <PublicHeader currentPage="home" />

        {/* Hero Section */}
        <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6 overflow-hidden">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass mb-6 sm:mb-8 animate-fade-in-up">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs sm:text-sm font-medium">AI-Powered Data Pipelines</span>
            </div>

            {/* Logo */}
            <div className="flex items-center justify-center mb-6 sm:mb-8">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl gradient-ai flex items-center justify-center glow-ai">
                <Logo className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
              Build Data Pipelines
              <br />
              <span className="text-gradient">With a Conversation</span>
            </h1>

            <p className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-4 sm:mb-6 px-4">
              Tell the AI what you need. It builds the pipeline.
              <span className="text-foreground font-medium"> No DevOps. No complexity.</span>
            </p>

            {/* Tech stack */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 px-4">
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-primary/10 text-primary border border-primary/20 font-mono text-xs sm:text-sm">
                Confluent Kafka
              </span>
              <span className="text-muted-foreground text-sm">+</span>
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-accent/10 text-accent border border-accent/20 font-mono text-xs sm:text-sm">
                ksqlDB / Flink
              </span>
              <span className="text-muted-foreground text-sm">+</span>
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-xs sm:text-sm">
                Gemini AI
              </span>
            </div>

            {/* CTA - Login Button */}
            <div className="flex justify-center mb-6 sm:mb-8 px-4">
              <div className="w-full sm:w-auto">
                <LoginButton />
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground">
              Free to start. No credit card required.
            </p>
          </div>
        </section>

        {/* Building Blocks */}
        <section className="relative py-12 sm:py-16 px-4 sm:px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">The Building Blocks</h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto px-4">
                Five core components that power your real-time data pipelines
              </p>
            </div>

            {/* Mobile: Vertical stack, Desktop: Horizontal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {buildingBlocks.map((block, index) => (
                <div
                  key={index}
                  className="glass rounded-xl p-4 flex items-center sm:flex-col sm:items-start lg:items-center lg:flex-row gap-3 transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    block.color === 'primary' ? 'bg-primary/10 text-primary' :
                    block.color === 'accent' ? 'bg-accent/10 text-accent' :
                    block.color === 'purple' ? 'bg-purple-500/10 text-purple-400' :
                    block.color === 'green' ? 'bg-green-500/10 text-green-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    <block.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base">{block.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{block.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="relative py-12 sm:py-16 px-4 sm:px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            {/* Section Header - Mobile centered */}
            <div className="text-center lg:text-left mb-8 sm:mb-10 lg:hidden">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <span className="text-xs sm:text-sm font-medium text-purple-400">Conversational Interface</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Just Tell the AI
                <br />
                <span className="text-gradient">What You Need</span>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                No more wrestling with configs. Describe your pipeline in plain English.
              </p>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 lg:gap-12 items-stretch lg:items-center">
              {/* Left: Content - Hidden header on mobile (shown above) */}
              <div className="order-2 lg:order-1">
                {/* Desktop header */}
                <div className="hidden lg:block">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-400">Conversational Interface</span>
                  </div>

                  <h2 className="text-3xl md:text-4xl font-bold mb-6">
                    Just Tell the AI
                    <br />
                    <span className="text-gradient">What You Need</span>
                  </h2>

                  <p className="text-lg text-muted-foreground mb-6">
                    No more wrestling with configs. Describe your pipeline in plain English:
                  </p>
                </div>

                {/* Example prompt */}
                <div className="glass rounded-xl p-4 mb-6">
                  <p className="text-xs text-muted-foreground mb-2">Example:</p>
                  <p className="text-foreground font-mono text-xs sm:text-sm leading-relaxed">
                    &ldquo;Create a pipeline from my audit database. Track login events and sync to ClickHouse. Alert me when there&apos;s gaps in the data.&rdquo;
                  </p>
                </div>


              </div>

              {/* Right: Workflow */}
              <div className="order-1 lg:order-2 glass rounded-xl p-4 sm:p-5">
                <h3 className="text-sm sm:text-base font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  AI-Guided Workflow
                </h3>

                <div className="space-y-2.5 sm:space-y-3">
                  {workflowSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3 group">
                      <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center font-mono text-[10px] sm:text-xs text-primary">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">{step}</p>
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="relative py-12 sm:py-16 px-4 sm:px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Why DataFlow AI?</h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto px-4">
                Everything you need to build production-grade pipelines without the complexity
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="glass rounded-xl p-4 sm:p-6 transition-all duration-300 hover:scale-[1.02] hover:glow-primary"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Marketing Analytics Outcome */}
        <section className="relative py-12 sm:py-16 px-4 sm:px-6 border-t border-border">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-4 sm:mb-6">
              <span className="text-xs sm:text-sm font-medium text-accent">The End Goal</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
              Real-Time Marketing Analytics
            </h2>

            <p className="text-base sm:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto px-4">
              Build pipelines that power instant insights into your campaign performance
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
              {['ROAS', 'CPC', 'CTR', 'Conversions'].map((metric, index) => (
                <div key={index} className="glass rounded-xl p-4 sm:p-6 text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gradient mb-1">{metric}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Real-time</div>
                </div>
              ))}
            </div>

            <div className="flex justify-center px-4">
              <div className="w-full sm:w-auto">
                <LoginButton />
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative py-12 sm:py-20 px-4 sm:px-6 border-t border-border">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Ready to Build Your First Pipeline?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto px-4">
              Start with a conversation. Let AI handle the complexity.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
              <div className="w-full sm:w-auto">
                <LoginButton />
              </div>
              <Link
                href="/features"
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-border hover:bg-secondary transition-colors font-medium inline-flex items-center justify-center gap-2"
              >
                Learn More
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        <PublicFooter currentPage="home" />
      </div>
    </>
  );
}
