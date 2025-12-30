import { Metadata } from 'next';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dataflow-ai.com';

export const metadata: Metadata = {
  title: 'Pricing - Contact Sales',
  description: 'Get custom pricing for DataFlow AI. Contact our sales team for personalized plans for marketing teams, agencies, and enterprises.',
  openGraph: {
    title: 'DataFlow AI Pricing - Contact Sales',
    description: 'Get custom pricing for your real-time marketing analytics needs.',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: siteUrl },
          { name: 'Pricing', url: `${siteUrl}/pricing` },
        ]}
      />
      {children}
    </>
  );
}
