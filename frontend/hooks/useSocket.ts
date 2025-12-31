'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { initializeSocket, sendChatMessage, disconnectSocket, isSocketConnected } from '@/lib/socket';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import type { ChatAction } from '@/types';

// Connection message from backend
const CONNECTION_MESSAGE = 'Connected to DataFlow AI!';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const hasShownConnectionMessage = useRef(false);
  const reconnectAttempts = useRef(0);
  const { addMessage, setTyping } = useChatStore();
  const { user, refreshAccessToken, logout } = useAuthStore();

  // Function to handle reconnection with fresh token
  const reconnectWithFreshToken = useCallback(async () => {
    if (reconnectAttempts.current >= 3) {
      console.error('Max reconnection attempts reached, logging out');
      addMessage({
        role: 'assistant',
        content: 'Session expired. Please log in again.',
      });
      logout();
      return;
    }

    reconnectAttempts.current++;
    console.log(`Attempting to refresh token and reconnect (attempt ${reconnectAttempts.current})`);

    try {
      // Try to refresh the access token
      await refreshAccessToken();

      // Disconnect old socket
      disconnectSocket();

      // Small delay before reconnecting
      setTimeout(() => {
        // Reconnect will be handled by the useEffect
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      logout();
    }
  }, [refreshAccessToken, logout, addMessage]);

  useEffect(() => {
    if (!user) return;

    try {
      const socket = initializeSocket({
        onConnect: () => {
          setIsConnected(true);
          reconnectAttempts.current = 0; // Reset on successful connection
        },
        onDisconnect: () => {
          setIsConnected(false);
        },
        onChatResponse: (data: { message: string; actions?: ChatAction[] }) => {
          setTyping(false);

          // Skip duplicate connection messages on reconnection
          if (data.message.startsWith(CONNECTION_MESSAGE)) {
            if (hasShownConnectionMessage.current) {
              console.log('Skipping duplicate connection message');
              return;
            }
            hasShownConnectionMessage.current = true;
          }

          addMessage({
            role: 'assistant',
            content: data.message,
            actions: data.actions,
          });
        },
        onError: (error: string) => {
          setTyping(false);

          // Handle authentication errors specifically
          if (error.includes('Authentication failed') || error.includes('Please log in again')) {
            reconnectWithFreshToken();
          } else {
            addMessage({
              role: 'assistant',
              content: `Sorry, something went wrong: ${error}`,
            });
          }
        },
      });

      // Initial connection status
      setIsConnected(socket.connected);

      return () => {
        disconnectSocket();
      };
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      if (error instanceof Error && error.message === 'Authentication required') {
        reconnectWithFreshToken();
      }
    }
  }, [user, addMessage, setTyping, reconnectWithFreshToken]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !isSocketConnected()) {
        console.error('Cannot send message: not connected or no user');
        return;
      }

      setTyping(true);
      // No longer need to pass user.id - it's retrieved from session
      sendChatMessage(content);
    },
    [user, setTyping]
  );

  return {
    isConnected,
    sendMessage,
  };
}
