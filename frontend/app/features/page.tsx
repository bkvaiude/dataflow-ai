import { Metadata } from 'next';
import Link from 'next/link';
import {
  Database,
  Activity,
  BarChart3,
  Zap,
  Shield,
  RefreshCw,
  MessageSquare,
  GitBranch,
  Layers
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { SoftwareApplicationJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Features - Real-time Marketing Analytics',
  description: 'Explore DataFlow AI features: Real-time CDC streaming, Apache Kafka & Flink processing, AI-powered insights, live dashboards, and automated ETL pipelines for marketers.',
  keywords: [
    'real-time analytics features',
    'marketing analytics tools',
    'ETL pipeline features',
    'Kafka streaming',
    'Flink processing',
    'AI marketing analytics',
  ],
  openGraph: {
    title: 'DataFlow AI Features - Real-time Marketing Analytics',
    description: 'Explore powerful features for real-time marketing analytics with CDC streaming and AI insights.',
  },
};

const features = [
  {
    icon: Database,
    title: 'Real-time CDC Streaming',
    description: 'Capture every change in your marketing data with Change Data Capture. Stream updates continuously from Google Ads, Facebook Ads, and more.',
    benefits: ['Zero data lag', 'Continuous sync', 'No batch delays'],
  },
  {
    icon: Activity,
    title: 'Apache Flink Processing',
    description: 'Calculate ROAS, CPC, CTR, and custom metrics in real-time using Apache Flink windowed aggregations.',
    benefits: ['Sub-second processing', 'Custom metrics', 'Windowed analytics'],
  },
  {
    icon: BarChart3,
    title: 'Live Dashboards',
    description: 'Auto-updating dashboards that reflect your latest campaign performance. Export to Google Sheets with real-time sync.',
    benefits: ['Live updates', 'Google Sheets export', 'Customizable views'],
  },
  {
    icon: Zap,
    title: 'Apache Kafka Integration',
    description: 'Enterprise-grade message streaming with Kafka. Handle millions of events per second with guaranteed delivery.',
    benefits: ['High throughput', 'Fault tolerant', 'Scalable'],
  },
  {
    icon: MessageSquare,
    title: 'AI-Powered Insights',
    description: 'Chat with your data using Gemini AI. Get instant answers, recommendations, and automated analysis.',
    benefits: ['Natural language', 'Smart recommendations', 'Automated reports'],
  },
  {
    icon: GitBranch,
    title: 'Data Transformation',
    description: 'Transform and enrich your marketing data with custom rules. Create calculated fields, filters, and aggregations.',
    benefits: ['Custom transforms', 'Data enrichment', 'Field mapping'],
  },
  {
    icon: Layers,
    title: 'Multi-Source Integration',
    description: 'Connect all your marketing platforms in one place. Google Ads, Facebook Ads, and more with OAuth integration.',
    benefits: ['One-click connect', 'OAuth secure', 'Unified view'],
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'SOC2-compliant infrastructure with encrypted data at rest and in transit. Role-based access control.',
    benefits: ['Data encryption', 'Access control', 'Audit logs'],
  },
  {
    icon: RefreshCw,
    title: 'Automated ETL Pipelines',
    description: 'Build data pipelines without code. Configure extraction, transformation, and loading with a visual interface.',
    benefits: ['No-code setup', 'Visual builder', 'Scheduled runs'],
  },
];

export default function FeaturesPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dataflow-ai.com';

  return (
    <>
      <SoftwareApplicationJsonLd />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: siteUrl },
          { name: 'Features', url: `${siteUrl}/features` },
        ]}
      />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-ai flex items-center justify-center">
                <Logo className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-lg">DataFlow AI</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/features" className="text-primary font-medium">Features</Link>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
              <Link
                href="/"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Get Started
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Powerful Features for <span className="text-gradient">Real-time Analytics</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to transform your marketing data into actionable insights.
              Built with enterprise-grade technology.
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <article
                  key={index}
                  className="glass rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-3">{feature.title}</h2>
                  <p className="text-muted-foreground mb-4">{feature.description}</p>
                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6 border-t border-border">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-muted-foreground mb-8">
              Transform your marketing analytics today with real-time data streaming.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/"
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Start Free Trial
              </Link>
              <Link
                href="/pricing"
                className="px-6 py-3 rounded-lg border border-border hover:bg-secondary transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link href="/">Home</Link>
                <Link href="/features">Features</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/faq">FAQ</Link>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <a href="https://highguts.com/blogs/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                <a href="https://highguts.com/blogs/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
              </div>
            </div>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} DataFlow AI. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
