'use client';

import { useEffect, useState, useCallback } from 'react';
import { initializeSocket, sendChatMessage, disconnectSocket, isSocketConnected } from '@/lib/socket';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import type { ChatAction } from '@/types';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const { addMessage, setTyping } = useChatStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const socket = initializeSocket({
      onConnect: () => {
        setIsConnected(true);
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onChatResponse: (data: { message: string; actions?: ChatAction[] }) => {
        setTyping(false);
        addMessage({
          role: 'assistant',
          content: data.message,
          actions: data.actions,
        });
      },
      onError: (error: string) => {
        setTyping(false);
        addMessage({
          role: 'assistant',
          content: `Sorry, something went wrong: ${error}`,
        });
      },
    });

    // Initial connection status
    setIsConnected(socket.connected);

    return () => {
      disconnectSocket();
    };
  }, [user, addMessage, setTyping]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !isSocketConnected()) {
        console.error('Cannot send message: not connected or no user');
        return;
      }

      setTyping(true);
      sendChatMessage(content, user.id);
    },
    [user, setTyping]
  );

  return {
    isConnected,
    sendMessage,
  };
}
