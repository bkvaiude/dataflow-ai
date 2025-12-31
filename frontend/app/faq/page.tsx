import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, MessageSquare, Zap, ArrowRight } from 'lucide-react';
import { FAQJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description: 'Find answers to common questions about DataFlow AI: AI-powered pipeline building, Confluent Kafka streaming, real-time transformations, and marketing analytics.',
  keywords: [
    'data pipeline FAQ',
    'AI pipeline builder questions',
    'Confluent Kafka FAQ',
    'real-time analytics help',
    'marketing data questions',
  ],
  openGraph: {
    title: 'DataFlow AI FAQ - Frequently Asked Questions',
    description: 'Find answers to common questions about AI-powered data pipeline building and real-time marketing analytics.',
  },
};

const faqs = [
  {
    category: 'Getting Started',
    questions: [
      {
        question: 'What is DataFlow AI?',
        answer: 'DataFlow AI is an AI-powered data pipeline builder that helps tech teams create streaming pipelines in minutes. Using conversational AI (Gemini), you describe what you need in plain English, and the system handles everything: connecting sources, configuring Kafka topics, setting up transformations with ksqlDB/Flink, and streaming to destinations like ClickHouse or S3. The end goal is real-time marketing analytics with metrics like ROAS, CPC, and CTR.',
      },
      {
        question: 'Who is DataFlow AI designed for?',
        answer: 'DataFlow AI is built for tech teams who need to build data pipelines quickly without DevOps overhead. Whether you\'re a developer, data engineer, or analytics team member, you can create production-grade streaming pipelines through conversation. No need to configure Kafka manually or write complex transformation logic - the AI handles the heavy lifting.',
      },
      {
        question: 'Do I need technical skills to use DataFlow AI?',
        answer: 'Basic technical understanding helps, but you don\'t need deep expertise in Kafka, Flink, or data engineering. The AI guides you through the entire process conversationally. You describe your goal (e.g., "sync login events from PostgreSQL to ClickHouse with alerts for gaps"), and the AI handles source connection, schema validation, topic creation, and destination setup.',
      },
      {
        question: 'How quickly can I build a pipeline?',
        answer: 'Most pipelines can be created in minutes through conversation. The AI walks you through: selecting your data source, choosing tables, validating schemas, configuring Kafka topics, setting up destinations, establishing alerts, and reviewing costs. What traditionally takes days or weeks of DevOps work becomes a guided conversation.',
      },
    ],
  },
  {
    category: 'Pipeline Building',
    questions: [
      {
        question: 'What are the core building blocks of a pipeline?',
        answer: 'Every DataFlow AI pipeline consists of five components: (1) Source - where data is extracted from (PostgreSQL, MySQL, etc.), (2) Pipeline - Confluent Kafka as the streaming backbone, (3) Transform - ksqlDB or Flink for real-time data transformations, (4) Destination - where transformed data lands (ClickHouse, S3, BigQuery), and (5) Alerts - monitoring and notifications on your data streams.',
      },
      {
        question: 'What data sources are supported?',
        answer: 'DataFlow AI supports multiple sources through Confluent Kafka connectors. Currently available: PostgreSQL and MySQL with CDC (Change Data Capture) for real-time streaming. The platform is designed to be extensible - any source with a Confluent connector can be integrated. Pre-configured connections make setup straightforward.',
      },
      {
        question: 'What destinations can I stream data to?',
        answer: 'Supported destinations include ClickHouse for analytics queries, S3 for data lake storage, and more destinations based on Confluent connector availability. The AI automatically creates required resources - tables in ClickHouse, buckets in S3 - so you don\'t need to set up infrastructure manually.',
      },
      {
        question: 'How does the AI understand what I need?',
        answer: 'The Gemini AI parses your natural language request to identify: which datasource connection to use, which tables are relevant to your goal, what schema structure is needed, what transformations to apply, where to send the results, and what alerts to configure. Through iterative conversation, it clarifies ambiguities and confirms each step before proceeding.',
      },
      {
        question: 'Can I modify a pipeline after creation?',
        answer: 'Yes. Pipelines can be updated through the same conversational interface. Need to add a new table, change transformation logic, or modify alert thresholds? Just tell the AI what you want to change. The system tracks all resources and handles updates cleanly.',
      },
    ],
  },
  {
    category: 'Technology & Architecture',
    questions: [
      {
        question: 'What technologies power DataFlow AI?',
        answer: 'DataFlow AI is built on enterprise-grade open-source technologies: Confluent Kafka for message streaming and CDC, Apache Flink and ksqlDB for real-time transformations, ClickHouse for analytics storage, and Google Gemini AI for the conversational pipeline builder. This stack handles millions of events with sub-second latency.',
      },
      {
        question: 'What is CDC and why does it matter?',
        answer: 'CDC (Change Data Capture) captures every insert, update, and delete in your source database in real-time. Instead of batch processing that runs hourly or daily, CDC streams changes continuously to Kafka. This means your analytics dashboards always show current data, enabling faster decision-making for marketing campaigns.',
      },
      {
        question: 'How do transformations work?',
        answer: 'Transformations run on ksqlDB or Flink, processing data in real-time as it flows through Kafka. You can calculate metrics (ROAS, CPC, CTR), filter events, aggregate data, join streams, and apply custom logic. The AI suggests appropriate transformations based on your stated goals and validates the logic before deployment.',
      },
      {
        question: 'What is the data latency?',
        answer: 'DataFlow AI delivers sub-second latency for most operations. From the moment data changes in your source database to when transformed results appear in your destination, typical latency is under 5 seconds. This is achieved through CDC streaming and Flink\'s real-time processing capabilities.',
      },
    ],
  },
  {
    category: 'Cost & Resources',
    questions: [
      {
        question: 'How does cost estimation work?',
        answer: 'Before creating any pipeline, the AI shows projected costs based on estimated data volume, transformation complexity, and destination storage. You see per-day cost estimates and can adjust pipeline configuration to optimize spending. No surprises - you know the costs before committing.',
      },
      {
        question: 'What happens to resources when I delete a pipeline?',
        answer: 'DataFlow AI tracks all resources created for each pipeline: Kafka topics, Flink jobs, ClickHouse tables, S3 buckets, etc. When you delete a pipeline, all associated resources are cleaned up automatically. No orphaned infrastructure wasting budget - achieve your goal, then cleanup with one click.',
      },
      {
        question: 'Can I control costs for proof-of-concept projects?',
        answer: 'Absolutely. For POCs and testing, you can create lightweight pipelines with limited data retention, simpler transformations, and shorter alert windows. The easy cleanup feature means you can experiment freely, then tear down test pipelines instantly when done.',
      },
    ],
  },
  {
    category: 'Marketing Analytics',
    questions: [
      {
        question: 'What marketing metrics can I track?',
        answer: 'DataFlow AI enables real-time tracking of key marketing metrics: ROAS (Return on Ad Spend), CPC (Cost per Click), CTR (Click-Through Rate), conversion rates, and custom metrics you define. Data flows from your sources through transformations that calculate these metrics in real-time.',
      },
      {
        question: 'Can I connect Google Ads and Facebook Ads?',
        answer: 'Marketing platform integrations are on the roadmap. The current focus is on database sources (PostgreSQL, MySQL) with CDC streaming. Once your marketing data lands in these databases, DataFlow AI can stream and transform it in real-time. Direct ad platform connectors are planned for future releases.',
      },
      {
        question: 'How do alerts work for marketing data?',
        answer: 'You can configure alerts on any metric or condition. Examples: notify when ROAS drops below threshold, alert when there\'s a gap in event data, trigger when conversion rate changes significantly. Alerts use pre-designed templates for common scenarios, making setup quick while remaining customizable.',
      },
    ],
  },
  {
    category: 'Security & Support',
    questions: [
      {
        question: 'Is my data secure?',
        answer: 'Yes. DataFlow AI uses encryption at rest and in transit. Database connections use secure credentials management. Role-based access control determines who can create, modify, or delete pipelines. Audit logging tracks all actions for compliance and debugging.',
      },
      {
        question: 'Do I need DevOps support to use DataFlow AI?',
        answer: 'No. That\'s the core value proposition. DataFlow AI is designed for self-service pipeline management. Tech teams can build, test, deploy, and cleanup pipelines without waiting on infrastructure teams. The AI handles resource provisioning, configuration, and teardown.',
      },
      {
        question: 'What support options are available?',
        answer: 'Support varies by plan: documentation and community resources for all users, email support for Starter plans, priority support for Professional plans, and dedicated support with SLA guarantees for Enterprise customers. The AI chat itself serves as first-line support, answering questions about your pipelines.',
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

      <div className="min-h-screen bg-background bg-grid">
        {/* Gradient mesh overlay */}
        <div className="fixed inset-0 bg-mesh pointer-events-none" />

        <PublicHeader currentPage="faq" />

        {/* Hero */}
        <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass mb-6 sm:mb-8 animate-fade-in-up">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm font-medium">Got Questions?</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
              Everything you need to know about building AI-powered data pipelines
              for real-time marketing analytics.
            </p>
          </div>
        </section>

        {/* Quick Links */}
        <section className="relative py-6 sm:py-8 px-4 sm:px-6 border-b border-border">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {faqs.map((category, index) => (
                <a
                  key={index}
                  href={`#${category.category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg glass text-xs sm:text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {category.category}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Sections */}
        <section className="relative py-10 sm:py-12 lg:py-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto space-y-10 sm:space-y-12 lg:space-y-16">
            {faqs.map((category, categoryIndex) => (
              <div
                key={categoryIndex}
                id={category.category.toLowerCase().replace(/\s+/g, '-')}
                className="scroll-mt-20 sm:scroll-mt-24"
              >
                {/* Category header */}
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">{category.category}</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">{category.questions.length} questions</p>
                  </div>
                </div>

                {/* Questions */}
                <div className="space-y-3 sm:space-y-4">
                  {category.questions.map((faq, faqIndex) => (
                    <details
                      key={faqIndex}
                      className="group glass rounded-xl overflow-hidden transition-all duration-300 hover:glow-primary"
                    >
                      <summary className="flex items-center justify-between p-4 sm:p-6 cursor-pointer list-none select-none">
                        <h3 className="font-semibold pr-3 sm:pr-4 text-foreground group-open:text-primary transition-colors text-sm sm:text-base">
                          {faq.question}
                        </h3>
                        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground transition-transform duration-300 group-open:rotate-180 group-open:text-primary" />
                        </div>
                      </summary>
                      <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pt-3 sm:pt-4">{faq.answer}</p>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <div className="glass rounded-2xl p-6 sm:p-8 md:p-12 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Still Have Questions?</h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto px-2">
                Can&apos;t find what you&apos;re looking for? Our team is here to help.
                Or better yet, try the AI chat - it knows everything about building pipelines.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link
                  href="/"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 group"
                >
                  Try the AI Chat
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/pricing#contact-sales"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl border border-border hover:bg-secondary transition-colors font-medium text-center"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </section>

        <PublicFooter currentPage="faq" />
      </div>
    </>
  );
}
