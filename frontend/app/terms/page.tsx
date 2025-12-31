import { Metadata } from 'next';
import Link from 'next/link';
import { FileText, ExternalLink } from 'lucide-react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

export const metadata: Metadata = {
  title: 'Terms of Service - DataFlow AI',
  description: 'Terms of Service for DataFlow AI. Read our terms and conditions for using the platform.',
};

export default function TermsOfServicePage() {
  const lastUpdated = 'December 31, 2025';
  const effectiveDate = 'December 31, 2025';

  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="fixed inset-0 bg-mesh pointer-events-none" />

      <PublicHeader currentPage="terms" />

      {/* Content */}
      <main className="relative py-10 sm:py-12 lg:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass mb-4 sm:mb-6">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm font-medium">Legal Agreement</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">Terms of Service</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Effective Date: {effectiveDate} | Last Updated: {lastUpdated}</p>
          </div>

          {/* Terms Content */}
          <div className="glass rounded-2xl p-5 sm:p-8 md:p-12 space-y-6 sm:space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">1. Agreement to Terms</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) and <strong>Highguts Solutions LLP</strong> (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), governing your access to and use of the DataFlow AI platform and related services (collectively, the &quot;Service&quot;).
              </p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                By accessing or using our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use the Service.
              </p>
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

            {/* Description of Service */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">2. Description of Service</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                DataFlow AI is an AI-powered data pipeline building platform that enables users to:
              </p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li>Build data pipelines through conversational AI interfaces</li>
                <li>Connect to various data sources (PostgreSQL, MySQL, etc.)</li>
                <li>Stream data through Confluent Kafka infrastructure</li>
                <li>Transform data using ksqlDB and Apache Flink</li>
                <li>Store results in destinations like ClickHouse and S3</li>
                <li>Monitor pipelines and set up alerts</li>
                <li>Analyze real-time marketing metrics (ROAS, CPC, CTR, etc.)</li>
              </ul>
            </section>

            {/* Account Registration */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">3. Account Registration and Security</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                To use certain features of the Service, you must register for an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                <li>Provide accurate, current, and complete registration information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security and confidentiality of your login credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized access or security breach</li>
              </ul>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                We reserve the right to suspend or terminate accounts that violate these Terms or for any other reason at our sole discretion.
              </p>
            </section>

            {/* Acceptable Use */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">4. Acceptable Use Policy</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">You agree NOT to use the Service to:</p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                <li>Violate any applicable laws, regulations, or third-party rights</li>
                <li>Process personal data without proper legal basis or consent</li>
                <li>Transmit malware, viruses, or other harmful code</li>
                <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
                <li>Interfere with or disrupt the integrity or performance of the Service</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                <li>Use the Service for competitive analysis or to build a competing product</li>
                <li>Resell, sublicense, or redistribute the Service without authorization</li>
                <li>Use automated means to access the Service except through our APIs</li>
                <li>Process data that violates export control laws</li>
              </ul>
            </section>

            {/* Data and Privacy */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">5. Data Ownership and Processing</h2>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">5.1 Your Data</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                You retain all ownership rights to the data you submit to or process through the Service (&quot;Your Data&quot;). You grant us a limited license to use Your Data solely to provide and improve the Service.
              </p>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">5.2 Data Processing</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                When processing data on your behalf, we act as a Data Processor. You are the Data Controller and are responsible for:
              </p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                <li>Ensuring you have lawful basis to process personal data</li>
                <li>Obtaining necessary consents from data subjects</li>
                <li>Complying with applicable data protection laws (GDPR, CCPA, etc.)</li>
                <li>Accuracy and legality of Your Data</li>
              </ul>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">5.3 AI Processing</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Our AI features powered by Google Gemini process your instructions and pipeline configurations to provide assistance. We do not use Your Data to train AI models. See our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for details.
              </p>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">6. Intellectual Property Rights</h2>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">6.1 Our Intellectual Property</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                The Service, including all software, designs, text, graphics, logos, and other content, is owned by Highguts Solutions LLP and protected by intellectual property laws. Nothing in these Terms grants you ownership rights to our intellectual property.
              </p>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">6.2 License Grant</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business purposes.
              </p>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">6.3 Feedback</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                If you provide feedback, suggestions, or ideas about the Service, you grant us a perpetual, irrevocable, royalty-free license to use such feedback without any obligation to you.
              </p>
            </section>

            {/* Payment Terms */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">7. Payment Terms</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                If you subscribe to paid features of the Service:
              </p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li>Fees are as quoted at the time of purchase or as agreed in a separate agreement</li>
                <li>All fees are non-refundable unless otherwise specified</li>
                <li>We may change pricing with 30 days&apos; notice</li>
                <li>You are responsible for all applicable taxes</li>
                <li>Failure to pay may result in suspension or termination of access</li>
              </ul>
            </section>

            {/* Disclaimer of Warranties */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">8. Disclaimer of Warranties</h2>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 sm:p-6">
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                  <strong>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.</strong>
                </p>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                  TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO:
                </p>
                <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                  <li>IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE</li>
                  <li>WARRANTIES OF NON-INFRINGEMENT</li>
                  <li>WARRANTIES THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE</li>
                  <li>WARRANTIES REGARDING THE ACCURACY OR RELIABILITY OF RESULTS</li>
                </ul>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">9. Limitation of Liability</h2>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 sm:p-6">
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                  <strong>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:</strong>
                </p>
                <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                  <li>IN NO EVENT SHALL HIGHGUTS SOLUTIONS LLP BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES</li>
                  <li>THIS INCLUDES DAMAGES FOR LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, GOODWILL, OR OTHER INTANGIBLE LOSSES</li>
                  <li>OUR TOTAL LIABILITY SHALL NOT EXCEED THE GREATER OF: (A) THE AMOUNTS PAID BY YOU IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED US DOLLARS ($100)</li>
                </ul>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  SOME JURISDICTIONS DO NOT ALLOW LIMITATION OF LIABILITY FOR CERTAIN DAMAGES, SO SOME OF THESE LIMITATIONS MAY NOT APPLY TO YOU.
                </p>
              </div>
            </section>

            {/* Indemnification */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">10. Indemnification</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                You agree to indemnify, defend, and hold harmless Highguts Solutions LLP and its officers, directors, employees, agents, and affiliates from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising from or related to: (a) your use of the Service; (b) Your Data; (c) your violation of these Terms; or (d) your violation of any third-party rights.
              </p>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">11. Termination</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                Either party may terminate this agreement at any time:
              </p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                <li><strong>By You:</strong> You may stop using the Service and close your account at any time.</li>
                <li><strong>By Us:</strong> We may suspend or terminate your access for violation of these Terms, non-payment, or for any reason with reasonable notice.</li>
                <li><strong>Effect of Termination:</strong> Upon termination, your right to use the Service ceases. We may delete Your Data after a reasonable retention period.</li>
              </ul>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Sections that by their nature should survive termination will survive, including intellectual property, limitation of liability, indemnification, and dispute resolution.
              </p>
            </section>

            {/* Dispute Resolution */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">12. Dispute Resolution</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                Any disputes arising from these Terms or the Service shall be resolved as follows:
              </p>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li><strong>Informal Resolution:</strong> We encourage you to contact us first at <a href="mailto:support@highguts.com" className="text-primary hover:underline">support@highguts.com</a> to resolve disputes informally.</li>
                <li><strong>Governing Law:</strong> These Terms are governed by the laws of India, without regard to conflict of law principles.</li>
                <li><strong>Jurisdiction:</strong> Any legal action shall be brought exclusively in the courts located in India.</li>
                <li><strong>Arbitration:</strong> For enterprise customers, disputes may be subject to binding arbitration as agreed in separate agreements.</li>
              </ul>
            </section>

            {/* Modifications */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">13. Modifications to Terms</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will provide notice of material changes by posting the updated Terms on this page and updating the &quot;Last Updated&quot; date. Your continued use of the Service after such changes constitutes acceptance of the modified Terms. If you disagree with any changes, you must stop using the Service.
              </p>
            </section>

            {/* Miscellaneous */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">14. Miscellaneous</h2>
              <ul className="list-disc list-inside text-sm sm:text-base text-muted-foreground space-y-1.5 sm:space-y-2">
                <li><strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy and any other agreements, constitute the entire agreement between you and us.</li>
                <li><strong>Severability:</strong> If any provision is found unenforceable, the remaining provisions remain in effect.</li>
                <li><strong>Waiver:</strong> Our failure to enforce any right does not waive that right.</li>
                <li><strong>Assignment:</strong> You may not assign these Terms without our consent. We may assign our rights freely.</li>
                <li><strong>Force Majeure:</strong> We are not liable for delays or failures due to events beyond our reasonable control.</li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">15. Contact Information</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                For questions about these Terms, please contact us:
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

      <PublicFooter currentPage="terms" />
    </div>
  );
}
