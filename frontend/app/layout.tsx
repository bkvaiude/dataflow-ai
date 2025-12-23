import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataFlow AI - Real-time Marketing Analytics",
  description: "AI-powered marketing analytics with real-time CDC streaming. Connect your data sources and get instant insights.",
  icons: {
    icon: "/favicon.svg",
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
        {children}
      </body>
    </html>
  );
}
