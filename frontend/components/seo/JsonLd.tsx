import Script from 'next/script';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dataflow-ai.com';

// Organization Schema
export function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DataFlow AI',
    url: siteUrl,
    logo: `${siteUrl}/favicon.svg`,
    description: 'Real-time marketing analytics platform powered by Kafka, Flink, and AI.',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      url: `${siteUrl}/pricing`,
    },
  };

  return (
    <Script
      id="organization-jsonld"
      type="application/ld+json"
      strategy="afterInteractive"
    >
      {JSON.stringify(schema)}
    </Script>
  );
}

// SoftwareApplication Schema
export function SoftwareApplicationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'DataFlow AI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'AI-powered real-time marketing analytics platform with CDC streaming, ETL pipelines, and live dashboards.',
    url: siteUrl,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Contact sales for pricing',
    },
    featureList: [
      'Real-time CDC Streaming',
      'Apache Kafka Integration',
      'Apache Flink Processing',
      'AI-Powered Insights',
      'Google Ads Integration',
      'Facebook Ads Integration',
      'Live Dashboards',
      'ETL Pipeline Automation',
      'Data Transformation',
    ],
    screenshot: `${siteUrl}/og-image.png`,
  };

  return (
    <Script
      id="software-jsonld"
      type="application/ld+json"
      strategy="afterInteractive"
    >
      {JSON.stringify(schema)}
    </Script>
  );
}

// WebSite Schema with SearchAction
export function WebSiteJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DataFlow AI',
    url: siteUrl,
    description: 'Real-time marketing analytics platform',
    publisher: {
      '@type': 'Organization',
      name: 'DataFlow AI',
    },
  };

  return (
    <Script
      id="website-jsonld"
      type="application/ld+json"
      strategy="afterInteractive"
    >
      {JSON.stringify(schema)}
    </Script>
  );
}

// FAQ Schema for AEO
interface FAQItem {
  question: string;
  answer: string;
}

export function FAQJsonLd({ faqs }: { faqs: FAQItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <Script
      id="faq-jsonld"
      type="application/ld+json"
      strategy="afterInteractive"
    >
      {JSON.stringify(schema)}
    </Script>
  );
}

// Breadcrumb Schema
interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <Script
      id="breadcrumb-jsonld"
      type="application/ld+json"
      strategy="afterInteractive"
    >
      {JSON.stringify(schema)}
    </Script>
  );
}
