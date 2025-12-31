import { Metadata } from 'next';
import Link from 'next/link';
import {
  Database,
  Workflow,
  Sparkles,
  Zap,
  Shield,
  Bot,
  MessageSquare,
  Layers,
  ArrowRight,
  CircleDollarSign,
  Bell,
  Trash2,
  CheckCircle2,
  Server,
  TableProperties,
} from 'lucide-react';
import { SoftwareApplicationJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

export const metadata: Metadata = {
  title: 'Features - AI-Powered Data Pipeline Builder',
  description: 'Build data pipelines in minutes with AI assistance. Confluent Kafka streaming, ksqlDB transformations, and real-time marketing analytics. No DevOps required.',
  keywords: [
    'AI data pipeline',
    'Confluent Kafka',
    'ksqlDB',
    'real-time analytics',
    'marketing analytics',
    'data transformation',
    'pipeline builder',
  ],
  openGraph: {
    title: 'DataFlow AI Features - AI-Powered Pipeline Builder',
    description: 'Build data pipelines in minutes with conversational AI. Real-time marketing analytics powered by Kafka and Flink.',
  },
};

const buildingBlocks = [
  {
    icon: Database,
    title: 'Source',
    subtitle: 'Data Extraction',
    description: 'Connect to PostgreSQL, MySQL, and more. AI auto-detects schemas and suggests relevant tables.',
    color: 'primary',
  },
  {
    icon: Workflow,
    title: 'Pipeline',
    subtitle: 'Confluent Kafka',
    description: 'Enterprise-grade streaming backbone. Handle millions of events with guaranteed delivery.',
    color: 'accent',
  },
  {
    icon: Sparkles,
    title: 'Transform',
    subtitle: 'ksqlDB & Flink',
    description: 'Real-time transformations. Calculate ROAS, CPC, CTR and custom metrics on the fly.',
    color: 'purple',
  },
  {
    icon: Server,
    title: 'Destination',
    subtitle: 'Storage',
    description: 'Stream to ClickHouse, S3, BigQuery and more. AI creates tables and buckets automatically.',
    color: 'green',
  },
  {
    icon: Bell,
    title: 'Alerts',
    subtitle: 'Monitoring',
    description: 'Set up alerts on transformed data. Get notified when metrics cross thresholds.',
    color: 'red',
  },
];

const workflowSteps = [
  { step: '01', title: 'Select Source', desc: 'AI identifies your datasource connection' },
  { step: '02', title: 'Choose Tables', desc: 'Smart table selection based on your goal' },
  { step: '03', title: 'Validate Schema', desc: 'AI validates and verifies data structure' },
  { step: '04', title: 'Create Topic', desc: 'Kafka topic auto-configured' },
  { step: '05', title: 'Set Destination', desc: 'Choose where to store results' },
  { step: '06', title: 'Setup Alerts', desc: 'Configure monitoring rules' },
  { step: '07', title: 'Review Cost', desc: 'See estimates before creation' },
  { step: '08', title: 'Deploy', desc: 'One-click pipeline creation' },
];

const features = [
  {
    icon: Bot,
    title: 'AI-Powered Pipeline Builder',
    description: 'Conversational interface powered by Gemini. Describe what you need in plain English - the AI handles the complexity.',
    highlights: ['Natural language input', 'Context-aware suggestions', 'Iterative refinement'],
  },
  {
    icon: TableProperties,
    title: 'Smart Schema Validation',
    description: 'AI automatically validates source and destination schemas. Catches mismatches before they become problems.',
    highlights: ['Auto type mapping', 'Schema evolution', 'Conflict resolution'],
  },
  {
    icon: Layers,
    title: 'Automated Resource Creation',
    description: 'Tables, buckets, and topics created automatically. No manual infrastructure setup required.',
    highlights: ['ClickHouse tables', 'S3 buckets', 'Kafka topics'],
  },
  {
    icon: CircleDollarSign,
    title: 'Cost Estimation',
    description: 'See projected costs before creating pipelines. Make informed decisions with per-day estimates.',
    highlights: ['Pre-creation estimates', 'Usage projections', 'Budget alerts'],
  },
  {
    icon: Shield,
    title: 'No DevOps Dependency',
    description: 'Self-service pipeline management. Tech teams can build, test, and deploy without waiting on infrastructure.',
    highlights: ['Self-service', 'Role-based access', 'Audit logging'],
  },
  {
    icon: Trash2,
    title: 'Easy Cleanup',
    description: 'Achieve your goal, then cleanup with one click. No orphaned resources wasting budget.',
    highlights: ['One-click teardown', 'Resource tracking', 'Cost savings'],
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

      <div className="min-h-screen bg-background bg-grid">
        {/* Gradient mesh overlay */}
        <div className="fixed inset-0 bg-mesh pointer-events-none" />

        <PublicHeader currentPage="features" />

        {/* Hero Section */}
        <section className="relative py-12 sm:py-16 lg:py-24 px-4 sm:px-6 overflow-hidden">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass mb-6 sm:mb-8 animate-fade-in-up">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs sm:text-sm font-medium">AI-Powered Pipeline Builder</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
              Build Data Pipelines
              <br />
              <span className="text-gradient">In Minutes, Not Months</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto mb-6 sm:mb-8 px-2">
              Conversational AI guides you through pipeline creation.
              <span className="text-foreground font-medium"> No DevOps. No complexity. Just results.</span>
            </p>

            {/* Tech stack badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-12 px-2">
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 font-mono text-xs sm:text-sm">
                Confluent Kafka
              </span>
              <span className="text-muted-foreground hidden sm:inline">+</span>
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-accent/10 text-accent border border-accent/20 font-mono text-xs sm:text-sm">
                ksqlDB / Flink
              </span>
              <span className="text-muted-foreground hidden sm:inline">+</span>
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-xs sm:text-sm">
                Gemini AI
              </span>
            </div>
          </div>
        </section>

        {/* Building Blocks Section */}
        <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
                The Building Blocks
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
                Five core components that power your real-time marketing analytics pipeline
              </p>
            </div>

            {/* Pipeline visualization */}
            <div className="relative">
              {/* Connection line */}
              <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-primary via-accent to-purple-500 opacity-30" />

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                {buildingBlocks.map((block, index) => (
                  <div
                    key={index}
                    className="relative group"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="glass rounded-2xl p-4 sm:p-6 transition-all duration-500 hover:scale-105 hover:-translate-y-2 h-full">
                      {/* Step indicator */}
                      <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-background border border-border flex items-center justify-center text-xs font-mono text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-3 sm:mb-4 ${
                        block.color === 'primary' ? 'bg-primary/10 text-primary' :
                        block.color === 'accent' ? 'bg-accent/10 text-accent' :
                        block.color === 'purple' ? 'bg-purple-500/10 text-purple-400' :
                        block.color === 'green' ? 'bg-green-500/10 text-green-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        <block.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                      </div>

                      <h3 className="text-lg sm:text-xl font-bold mb-1">{block.title}</h3>
                      <p className="text-xs sm:text-sm font-mono text-muted-foreground mb-2 sm:mb-3">{block.subtitle}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{block.description}</p>
                    </div>

                    {/* Arrow connector (hidden on last item) */}
                    {index < buildingBlocks.length - 1 && (
                      <div className="hidden lg:flex absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                        <ArrowRight className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* AI Workflow Section */}
        <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
              {/* Left: Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4 sm:mb-6">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <span className="text-xs sm:text-sm font-medium text-purple-400">Conversational AI</span>
                </div>

                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
                  Just Tell the AI
                  <br />
                  <span className="text-gradient">What You Need</span>
                </h2>

                <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
                  No more wrestling with configs or reading docs. Describe your pipeline in plain English
                  and let Gemini AI handle the rest.
                </p>

                {/* Example prompt */}
                <div className="glass rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">Example prompt:</p>
                  <p className="text-foreground font-mono text-xs sm:text-sm leading-relaxed">
                    &ldquo;Create a pipeline from dataflow_test_audit_db to track login events.
                    Alert me when there&apos;s a gap in audit logs. Sync only login and logout events to ClickHouse.&rdquo;
                  </p>
                </div>

                <p className="text-sm sm:text-base text-muted-foreground">
                  The AI decodes your intent, validates schemas, estimates costs, and builds your pipeline -
                  all through natural conversation.
                </p>
              </div>

              {/* Right: Workflow steps */}
              <div className="glass rounded-2xl p-4 sm:p-6 lg:p-8">
                <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center gap-2">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  AI-Guided Workflow
                </h3>

                <div className="space-y-3 sm:space-y-4">
                  {workflowSteps.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 sm:gap-4 group">
                      <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-center font-mono text-xs text-primary group-hover:bg-primary/10 transition-colors">
                        {item.step}
                      </div>
                      <div className="flex-1 pt-0.5 sm:pt-1">
                        <h4 className="font-medium text-foreground text-sm sm:text-base">{item.title}</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0 mt-1 sm:mt-2" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
                Everything You Need
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
                From intelligent pipeline building to cost-efficient cleanup - all without DevOps overhead
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {features.map((feature, index) => (
                <article
                  key={index}
                  className="glass rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:scale-[1.02] hover:glow-primary group"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 sm:mb-5 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>

                  <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-5 leading-relaxed">{feature.description}</p>

                  <ul className="space-y-1.5 sm:space-y-2">
                    {feature.highlights.map((highlight, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs sm:text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        <span className="text-muted-foreground">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Marketing Analytics Outcome */}
        <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6 border-t border-border">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-4 sm:mb-6">
              <span className="text-xs sm:text-sm font-medium text-accent">The End Goal</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
              Real-Time Marketing Analytics
            </h2>

            <p className="text-base sm:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto px-2">
              All this pipeline magic serves one purpose: giving you instant visibility into
              campaign performance with metrics that matter.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {['ROAS', 'CPC', 'CTR', 'Conversions'].map((metric, index) => (
                <div key={index} className="glass rounded-xl p-4 sm:p-6 text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gradient mb-1 sm:mb-2">{metric}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Real-time</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-16 sm:py-20 lg:py-24 px-4 sm:px-6 border-t border-border">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Ready to Build Your First Pipeline?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto px-2">
              Start with a conversation. Let AI handle the complexity while you focus on results.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 group"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl border border-border hover:bg-secondary transition-colors font-medium text-center"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        <PublicFooter currentPage="features" />
      </div>
    </>
  );
}
