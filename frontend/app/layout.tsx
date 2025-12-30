import type { Metadata } from "next";
import "./globals.css";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dataflow-ai.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DataFlow AI - Real-time Marketing Analytics Platform",
    template: "%s | DataFlow AI",
  },
  description: "Transform your marketing data with real-time CDC streaming. Connect Google Ads, Facebook Ads & more. Get AI-powered insights, live dashboards, and automated ETL pipelines. No data engineers required.",
  keywords: [
    "real-time analytics for marketers",
    "marketing analytics platform",
    "ETL pipeline",
    "data transformation",
    "data labeling",
    "CDC streaming",
    "Kafka analytics",
    "marketing data pipeline",
    "real-time dashboards",
    "AI marketing insights",
    "Google Ads analytics",
    "Facebook Ads analytics",
  ],
  authors: [{ name: "DataFlow AI" }],
  creator: "DataFlow AI",
  publisher: "DataFlow AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "DataFlow AI",
    title: "DataFlow AI - Real-time Marketing Analytics Platform",
    description: "Transform your marketing data with real-time CDC streaming. AI-powered insights, live dashboards, and automated ETL pipelines.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DataFlow AI - Real-time Marketing Analytics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DataFlow AI - Real-time Marketing Analytics",
    description: "Transform your marketing data with real-time CDC streaming. AI-powered insights and live dashboards.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
