'use client';

import { create } from 'zustand';
import type { ChatMessage, ChatAction } from '@/types';

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  connectedProviders: string[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setTyping: (typing: boolean) => void;
  addConnectedProvider: (provider: string) => void;
  clearMessages: () => void;
}

let messageId = 0;

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: `Welcome to DataFlow AI! I'm your marketing analytics assistant that creates **real-time streaming pipelines**.

Unlike traditional tools that pull data on request, I set up enterprise-grade infrastructure:
- **Kafka** for continuous data streaming
- **Flink** for real-time metric calculations
- **Live dashboards** that update automatically

What would you like to do? You can say things like:
- "Connect my Google Ads"
- "Show me my campaign performance"
- "What data sources are available?"`,
      timestamp: new Date(),
    },
  ],
  isTyping: false,
  connectedProviders: [],

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg-${++messageId}`,
          timestamp: new Date(),
        },
      ],
    })),

  setTyping: (isTyping) => set({ isTyping }),

  addConnectedProvider: (provider) =>
    set((state) => ({
      connectedProviders: state.connectedProviders.includes(provider)
        ? state.connectedProviders
        : [...state.connectedProviders, provider],
    })),

  clearMessages: () =>
    set({
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Chat cleared. How can I help you today?',
          timestamp: new Date(),
        },
      ],
    }),
}));
