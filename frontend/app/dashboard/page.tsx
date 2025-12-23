'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues
const ChatInterface = dynamic(
  () => import('@/components/chat/ChatInterface').then((mod) => mod.ChatInterface),
  { ssr: false }
);

// Force dynamic rendering
export const dynamic_mode = 'force-dynamic';

export default function DashboardPage() {
  return <ChatInterface />;
}
