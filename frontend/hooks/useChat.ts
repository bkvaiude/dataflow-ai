'use client';

import { useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSocket } from './useSocket';
import { trackChatMessageSent } from '@/lib/analytics';

export function useChat() {
  const { messages, isTyping, connectedProviders, addMessage, clearMessages } = useChatStore();
  const { isConnected, sendMessage: socketSendMessage } = useSocket();

  const sendMessage = useCallback(
    async (content: string) => {
      // Track chat message
      trackChatMessageSent(content.length);

      // Add user message to store
      addMessage({
        role: 'user',
        content,
      });

      // Send via socket
      await socketSendMessage(content);
    },
    [addMessage, socketSendMessage]
  );

  return {
    messages,
    isTyping,
    isConnected,
    connectedProviders,
    sendMessage,
    clearMessages,
  };
}
