import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ExternalLink } from 'lucide-react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

export const metadata: Metadata = {
  title: 'Privacy Policy - DataFlow AI',
  description: 'Privacy Policy for DataFlow AI. Learn how we collect, use, and protect your data.',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'December 31, 2025';

  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="fixed inset-0 bg-mesh pointer-events-none" />

      <PublicHeader currentPage="privacy" />

      {/* Content */}
      <main className="relative py-10 sm:py-12 lg:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass mb-4 sm:mb-6">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm font-medium">Your Privacy Matters</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">Privacy Policy</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>

          {/* Policy Content */}
          <div className="glass rounded-2xl p-5 sm:p-8 md:p-12 space-y-6 sm:space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">1. Introduction</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                Welcome to DataFlow AI, a product developed and operated by <strong>Highguts Solutions LLP</strong> (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). We are committed to protecting your privacy and ensuring the security of your personal information.
              </p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our DataFlow AI platform, including our website, applications, and related services (collectively, the &quot;Service&quot;). By using our Service, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            {/* Company Information */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">2. Company Information</h2>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 sm:p-6">
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-2">
                  <strong>Highguts Solutions LLP</strong>
                </p>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-2">
                  Website: <a href="https://highguts.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    highguts.com <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Contact: <a href="mailto:support@highguts.com" className="text-primary hover:underline">support@highguts.com</a>
                </p>
              </div>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">3. Information We Collect</h2>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">3.1 Information You Provide</h3>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                <li><strong>Account Information:</strong> Name, email address, company name, and role when you register or request a demo.</li>
                <li><strong>Authentication Data:</strong> OAuth tokens when you connect third-party services (Google, etc.).</li>
                <li><strong>Database Credentials:</strong> Connection details for your data sources (PostgreSQL, MySQL, etc.), which are encrypted at rest.</li>
                <li><strong>Communication Data:</strong> Messages, feedback, and support inquiries you send us.</li>
              </ul>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">3.2 Data Processed Through Our Service</h3>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                <li><strong>Pipeline Data:</strong> Data that flows through pipelines you create, including source data, transformed data, and destination data.</li>
                <li><strong>Schema Information:</strong> Database schemas, table structures, and column definitions.</li>
                <li><strong>Analytics Data:</strong> Marketing metrics such as ROAS, CPC, CTR, and custom metrics you configure.</li>
              </ul>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">3.3 Automatically Collected Information</h3>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li><strong>Usage Data:</strong> How you interact with our Service, features used, and actions taken.</li>
                <li><strong>Device Information:</strong> Browser type, IP address, device identifiers, and operating system.</li>
                <li><strong>Log Data:</strong> Server logs, error reports, and performance metrics.</li>
              </ul>
            </section>

            {/* How We Use Your Information */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">4. How We Use Your Information</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">We use the collected information for the following purposes:</p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li><strong>Service Delivery:</strong> To provide, maintain, and improve the DataFlow AI platform.</li>
                <li><strong>Pipeline Execution:</strong> To execute data pipelines, transformations, and analytics as configured by you.</li>
                <li><strong>AI Processing:</strong> To power our conversational AI features using Google Gemini for pipeline building assistance.</li>
                <li><strong>Communication:</strong> To respond to inquiries, send service updates, and provide support.</li>
                <li><strong>Security:</strong> To detect, prevent, and address technical issues and security threats.</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations.</li>
              </ul>
            </section>

            {/* Data Processing Role */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">5. Data Processing Role</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                <strong>As a B2B Service Provider:</strong> When you use DataFlow AI to process your business data, we act as a <strong>Data Processor</strong> on your behalf. You remain the <strong>Data Controller</strong> for any personal data contained within your pipelines.
              </p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                You are responsible for ensuring that you have the necessary rights and consents to process any personal data through our Service. We process such data only according to your instructions and configurations.
              </p>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">6. Data Security</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">We implement robust security measures to protect your data:</p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li><strong>Encryption:</strong> All data is encrypted in transit (TLS/SSL) and at rest (AES-256).</li>
                <li><strong>Credential Security:</strong> Database credentials are encrypted using industry-standard encryption with unique keys.</li>
                <li><strong>Access Controls:</strong> Role-based access control and authentication mechanisms.</li>
                <li><strong>Infrastructure:</strong> Secure cloud infrastructure with regular security audits.</li>
                <li><strong>Monitoring:</strong> Continuous monitoring for security threats and anomalies.</li>
              </ul>
            </section>

            {/* Third-Party Services */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">7. Third-Party Services</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">Our Service integrates with third-party services:</p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li><strong>Confluent Kafka:</strong> For message streaming and data pipeline infrastructure.</li>
                <li><strong>Google Gemini AI:</strong> For powering our conversational AI pipeline builder.</li>
                <li><strong>Google OAuth:</strong> For authentication services.</li>
                <li><strong>ClickHouse:</strong> For analytics data storage.</li>
              </ul>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mt-3 sm:mt-4">
                Each third-party service has its own privacy policy governing their use of data. We recommend reviewing their policies.
              </p>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">8. Data Retention</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                We retain your data for as long as your account is active or as needed to provide our services. Upon account deletion or request:
              </p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li>Account data is deleted within 30 days.</li>
                <li>Pipeline configurations and related data are permanently removed.</li>
                <li>Encrypted credentials are securely destroyed.</li>
                <li>Some data may be retained for legal compliance purposes.</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">9. Your Rights</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">Depending on your jurisdiction, you may have the following rights:</p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li><strong>Access:</strong> Request access to your personal data.</li>
                <li><strong>Rectification:</strong> Request correction of inaccurate data.</li>
                <li><strong>Erasure:</strong> Request deletion of your data.</li>
                <li><strong>Portability:</strong> Request a copy of your data in a portable format.</li>
                <li><strong>Objection:</strong> Object to certain processing activities.</li>
                <li><strong>Restriction:</strong> Request restriction of processing.</li>
              </ul>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mt-3 sm:mt-4">
                To exercise these rights, contact us at <a href="mailto:support@highguts.com" className="text-primary hover:underline">support@highguts.com</a>.
              </p>
            </section>

            {/* International Transfers */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">10. International Data Transfers</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers, including standard contractual clauses and other legally recognized transfer mechanisms.
              </p>
            </section>

            {/* Children's Privacy */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">11. Children&apos;s Privacy</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected data from a child, please contact us immediately.
              </p>
            </section>

            {/* Changes to Policy */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">12. Changes to This Policy</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">13. Contact Us</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 sm:p-6">
                <p className="text-sm sm:text-base text-muted-foreground mb-2"><strong>Highguts Solutions LLP</strong></p>
                <p className="text-sm sm:text-base text-muted-foreground mb-2">
                  Email: <a href="mailto:support@highguts.com" className="text-primary hover:underline">support@highguts.com</a>
                </p>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Website: <a href="https://highguts.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    https://highguts.com <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </section>
          </div>

          {/* Highguts Promotion */}
          <div className="mt-8 sm:mt-12 glass rounded-2xl p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
              DataFlow AI is proudly developed by
            </p>
            <a
              href="https://highguts.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xl sm:text-2xl font-bold text-primary hover:underline"
            >
              Highguts Solutions LLP
              <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
            </a>
            <p className="text-sm sm:text-base text-muted-foreground mt-3 sm:mt-4">
              Building innovative solutions for modern businesses.
            </p>
          </div>
        </div>
      </main>

      <PublicFooter currentPage="privacy" />
    </div>
  );
}
