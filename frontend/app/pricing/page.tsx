'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Check,
  Mail,
  Building2,
  User,
  MessageSquare,
  ArrowRight,
  Calendar,
  Sparkles,
  Zap,
  Shield,
  Users,
} from 'lucide-react';
import { trackCTAClick } from '@/lib/analytics';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

const benefits = [
  {
    icon: Sparkles,
    title: 'AI-Powered Pipelines',
    description: 'Build data pipelines through natural conversation',
  },
  {
    icon: Zap,
    title: 'Real-Time Streaming',
    description: 'Confluent Kafka with sub-second latency',
  },
  {
    icon: Shield,
    title: 'Enterprise Ready',
    description: 'Secure, scalable, and compliant infrastructure',
  },
  {
    icon: Users,
    title: 'Dedicated Support',
    description: 'White-glove onboarding and ongoing assistance',
  },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function PricingPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    role: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    trackCTAClick('contact_sales_submit', 'pricing_page');

    try {
      const response = await fetch(`${API_URL}/api/contact/demo-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Error submitting demo request:', err);
      setError('Failed to submit request. Please try again or email us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Gradient mesh overlay */}
      <div className="fixed inset-0 bg-mesh pointer-events-none" />

      <PublicHeader currentPage="pricing" />

      {/* Hero */}
      <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass mb-6 sm:mb-8 animate-fade-in-up">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium">Schedule a Demo</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
            Let&apos;s Build Your
            <br />
            <span className="text-gradient">Data Pipeline Together</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
            DataFlow AI is an enterprise solution tailored to your needs.
            Talk to our team to see how we can accelerate your marketing analytics.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="relative py-10 sm:py-12 lg:py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-start">
            {/* Left: Benefits */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8">What You&apos;ll Get</h2>

              <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-12">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-0.5 sm:mb-1 text-sm sm:text-base">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* What to expect */}
              <div className="glass rounded-2xl p-4 sm:p-6">
                <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">What to Expect</h3>
                <ul className="space-y-2.5 sm:space-y-3">
                  <li className="flex items-start gap-2.5 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-mono text-primary">1</span>
                    </div>
                    <div>
                      <span className="font-medium text-sm sm:text-base">Discovery Call</span>
                      <p className="text-xs sm:text-sm text-muted-foreground">Understand your data pipeline needs</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-mono text-primary">2</span>
                    </div>
                    <div>
                      <span className="font-medium text-sm sm:text-base">Live Demo</span>
                      <p className="text-xs sm:text-sm text-muted-foreground">See DataFlow AI in action with your use case</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-mono text-primary">3</span>
                    </div>
                    <div>
                      <span className="font-medium text-sm sm:text-base">Custom Proposal</span>
                      <p className="text-xs sm:text-sm text-muted-foreground">Tailored pricing based on your requirements</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right: Contact Form */}
            <div id="contact-sales">
              {isSubmitted ? (
                <div className="glass rounded-2xl p-6 sm:p-8 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                    <Check className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">Thank You!</h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                    We&apos;ve received your request. Our team will reach out within 24 hours
                    to schedule your personalized demo.
                  </p>
                  <Link
                    href="/features"
                    className="inline-flex items-center gap-2 text-primary hover:underline text-sm sm:text-base"
                  >
                    Explore Features
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="glass rounded-2xl p-5 sm:p-6 md:p-8">
                  <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Request a Demo</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-5 sm:mb-8">
                    Fill out the form and we&apos;ll get back to you within 24 hours.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2 text-muted-foreground" />
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm sm:text-base"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                          <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2 text-muted-foreground" />
                          Work Email
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm sm:text-base"
                          placeholder="john@company.com"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                          <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2 text-muted-foreground" />
                          Company
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm sm:text-base"
                          placeholder="Acme Inc."
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2 text-muted-foreground" />
                          Your Role
                        </label>
                        <input
                          type="text"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm sm:text-base"
                          placeholder="Data Engineer, VP Marketing..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2 text-muted-foreground" />
                        Tell us about your needs
                      </label>
                      <textarea
                        rows={4}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-sm sm:text-base"
                        placeholder="What data sources do you use? What analytics challenges are you facing?"
                      />
                    </div>

                    {error && (
                      <div className="p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 sm:py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group text-sm sm:text-base"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Request Demo
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>

                    <p className="text-xs text-muted-foreground text-center">
                      By submitting, you agree to our{' '}
                      <Link href="/privacy" className="underline hover:text-foreground">
                        Privacy Policy
                      </Link>
                    </p>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Alternative CTA */}
      <section className="relative py-10 sm:py-12 lg:py-16 px-4 sm:px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass rounded-2xl p-6 sm:p-8 md:p-12">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Prefer to Email Us Directly?</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
              Reach out to our sales team at any time
            </p>
            <a
              href="mailto:support@highguts.com"
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl border border-border hover:bg-secondary transition-colors font-medium text-sm sm:text-base"
            >
              <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
              support@highguts.com
            </a>
          </div>
        </div>
      </section>

      <PublicFooter currentPage="pricing" />
    </div>
  );
}
