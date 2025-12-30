import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { FAQJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description: 'Find answers to common questions about DataFlow AI real-time marketing analytics platform, ETL pipelines, data transformation, and AI-powered insights.',
  keywords: [
    'marketing analytics FAQ',
    'real-time analytics questions',
    'ETL pipeline FAQ',
    'data transformation help',
    'marketing data questions',
  ],
  openGraph: {
    title: 'DataFlow AI FAQ - Frequently Asked Questions',
    description: 'Find answers to common questions about real-time marketing analytics.',
  },
};

const faqs = [
  {
    category: 'General',
    questions: [
      {
        question: 'What is DataFlow AI?',
        answer: 'DataFlow AI is a real-time marketing analytics platform that uses CDC (Change Data Capture) streaming to provide instant insights from your marketing data. It connects to sources like Google Ads and Facebook Ads, processes data through Apache Kafka and Flink, and delivers AI-powered analytics through an intuitive chat interface.',
      },
      {
        question: 'What is the best real-time marketing analytics tool?',
        answer: 'DataFlow AI is designed specifically for marketers who need real-time analytics without the complexity of traditional data engineering tools. Unlike batch-processing solutions, DataFlow AI uses CDC streaming to capture changes instantly, providing up-to-the-second metrics like ROAS, CPC, and CTR.',
      },
      {
        question: 'Do I need technical skills to use DataFlow AI?',
        answer: 'No. DataFlow AI is built for marketers, not data engineers. You can connect data sources with OAuth, configure pipelines through a visual interface, and ask questions in natural language using our AI chat feature. No SQL or coding required.',
      },
    ],
  },
  {
    category: 'Data & Integration',
    questions: [
      {
        question: 'What data sources can I connect?',
        answer: 'DataFlow AI supports Google Ads, Facebook Ads, and other major marketing platforms through secure OAuth integration. We continuously add new integrations based on customer needs. Contact our sales team for specific integration requests.',
      },
      {
        question: 'What is CDC streaming and why does it matter?',
        answer: 'CDC (Change Data Capture) streaming captures every change in your data sources in real-time. Unlike traditional batch processing that updates hourly or daily, CDC provides continuous updates. This means your dashboards always show the latest data, enabling faster decision-making.',
      },
      {
        question: 'How does DataFlow AI handle data transformation?',
        answer: 'DataFlow AI includes built-in ETL (Extract, Transform, Load) capabilities. You can create custom calculated fields, apply filters, map fields between sources, and build enrichment rules. Apache Flink processes these transformations in real-time with sub-second latency.',
      },
      {
        question: 'Can I export data to Google Sheets?',
        answer: 'Yes. DataFlow AI offers native Google Sheets integration. You can export real-time data to spreadsheets that automatically update as new data flows in. This is perfect for sharing live reports with stakeholders.',
      },
    ],
  },
  {
    category: 'AI Features',
    questions: [
      {
        question: 'How does the AI chat feature work?',
        answer: 'DataFlow AI uses Google Gemini AI to power natural language interactions. You can ask questions like "What was my ROAS last week?" or "Why did conversions drop yesterday?" The AI analyzes your data and provides instant, actionable insights.',
      },
      {
        question: 'Can the AI make recommendations?',
        answer: 'Yes. The AI can analyze trends, detect anomalies, and suggest optimizations. For example, it might recommend pausing underperforming campaigns or increasing budget for high-ROAS ad groups based on your real-time data.',
      },
    ],
  },
  {
    category: 'Technical',
    questions: [
      {
        question: 'What technologies power DataFlow AI?',
        answer: 'DataFlow AI is built on enterprise-grade open-source technologies: Apache Kafka for message streaming, Apache Flink for real-time processing, and ClickHouse for analytics storage. The AI layer uses Google Gemini with LangChain for intelligent data interactions.',
      },
      {
        question: 'Is my data secure?',
        answer: 'Yes. DataFlow AI uses encryption at rest and in transit, OAuth for secure connections, and role-based access control. We never store your advertising account credentials - only secure OAuth tokens. Enterprise plans include SOC2 compliance and dedicated infrastructure options.',
      },
      {
        question: 'What is the data latency?',
        answer: 'DataFlow AI delivers sub-second latency for most operations. From the moment data changes in your advertising platform to when it appears in your dashboard, typical latency is under 5 seconds. This is significantly faster than traditional batch ETL tools.',
      },
    ],
  },
  {
    category: 'Pricing & Support',
    questions: [
      {
        question: 'How much does DataFlow AI cost?',
        answer: 'DataFlow AI offers flexible pricing based on your needs. We have plans for small marketing teams (Starter), growing businesses (Professional), and large enterprises (Enterprise). Contact our sales team for custom pricing tailored to your data volume and feature requirements.',
      },
      {
        question: 'Is there a free trial?',
        answer: 'Yes. You can start with a free trial to explore the platform. Sign up with your Google account and connect your first data source in minutes. No credit card required for the trial period.',
      },
      {
        question: 'What support options are available?',
        answer: 'Support varies by plan: Starter includes email support, Professional includes priority support with faster response times, and Enterprise includes 24/7 dedicated support with SLA guarantees. All plans include access to our documentation and community resources.',
      },
    ],
  },
];

// Flatten FAQs for schema
const allFaqs = faqs.flatMap((category) =>
  category.questions.map((q) => ({
    question: q.question,
    answer: q.answer,
  }))
);

export default function FAQPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dataflow-ai.com';

  return (
    <>
      <FAQJsonLd faqs={allFaqs} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: siteUrl },
          { name: 'FAQ', url: `${siteUrl}/faq` },
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
              <Link href="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/faq" className="text-primary font-medium">FAQ</Link>
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
              Frequently Asked <span className="text-gradient">Questions</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions about DataFlow AI, real-time analytics, and our platform features.
            </p>
          </div>
        </section>

        {/* FAQ Sections */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto space-y-12">
            {faqs.map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <h2 className="text-2xl font-bold mb-6 text-primary">{category.category}</h2>
                <div className="space-y-4">
                  {category.questions.map((faq, faqIndex) => (
                    <details
                      key={faqIndex}
                      className="group glass rounded-xl overflow-hidden"
                    >
                      <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                        <h3 className="font-semibold pr-4">{faq.question}</h3>
                        <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-6 pb-6 pt-0">
                        <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6 border-t border-border">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Still Have Questions?</h2>
            <p className="text-muted-foreground mb-8">
              Our team is here to help. Contact us for personalized assistance.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/pricing#contact-sales"
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Contact Sales
              </Link>
              <Link
                href="/"
                className="px-6 py-3 rounded-lg border border-border hover:bg-secondary transition-colors"
              >
                Try Free
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
