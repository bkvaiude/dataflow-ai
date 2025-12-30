'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Mail, Building2, User, MessageSquare } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { trackCTAClick } from '@/lib/analytics';

const plans = [
  {
    name: 'Starter',
    description: 'For small marketing teams getting started',
    features: [
      'Up to 3 data sources',
      '1 million events/month',
      'Real-time dashboards',
      'Basic AI insights',
      'Email support',
    ],
    highlight: false,
  },
  {
    name: 'Professional',
    description: 'For growing teams with advanced needs',
    features: [
      'Unlimited data sources',
      '10 million events/month',
      'Advanced Flink processing',
      'Custom metrics & alerts',
      'AI-powered recommendations',
      'Priority support',
      'Google Sheets export',
    ],
    highlight: true,
  },
  {
    name: 'Enterprise',
    description: 'For large organizations with custom requirements',
    features: [
      'Unlimited everything',
      'Custom event limits',
      'Dedicated infrastructure',
      'SSO & SAML',
      'Custom integrations',
      'SLA guarantee',
      '24/7 support',
      'On-premise option',
    ],
    highlight: false,
  },
];

export default function PricingPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    trackCTAClick('contact_sales_submit', 'pricing_page');

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  return (
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
            <Link href="/pricing" className="text-primary font-medium">Pricing</Link>
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
            Simple, <span className="text-gradient">Transparent Pricing</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your team. Contact our sales team for custom enterprise solutions.
          </p>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-2xl p-8 ${
                  plan.highlight
                    ? 'glass border-2 border-primary glow-primary'
                    : 'glass'
                }`}
              >
                {plan.highlight && (
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                    Most Popular
                  </span>
                )}
                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <p className="text-muted-foreground mb-6">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold">Contact Sales</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#contact-sales"
                  className={`block w-full text-center py-3 rounded-lg font-medium transition-colors ${
                    plan.highlight
                      ? 'bg-primary text-primary-foreground hover:opacity-90'
                      : 'border border-border hover:bg-secondary'
                  }`}
                  onClick={() => trackCTAClick(`select_${plan.name.toLowerCase()}_plan`, 'pricing_page')}
                >
                  Contact Sales
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Sales Form */}
      <section id="contact-sales" className="py-20 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Contact Our Sales Team</h2>
            <p className="text-muted-foreground">
              Get a personalized demo and custom pricing for your organization.
            </p>
          </div>

          {isSubmitted ? (
            <div className="glass rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
              <p className="text-muted-foreground">
                Our sales team will get back to you within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none transition-colors"
                    placeholder="john@company.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Building2 className="w-4 h-4 inline mr-2" />
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none transition-colors"
                  placeholder="Acme Inc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  How can we help?
                </label>
                <textarea
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none transition-colors resize-none"
                  placeholder="Tell us about your marketing analytics needs..."
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Request Demo'}
              </button>
            </form>
          )}
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
  );
}
