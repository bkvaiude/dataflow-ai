'use client';

import { io, Socket } from 'socket.io-client';
import type { ChatAction } from '@/types';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000';

let socket: Socket | null = null;

export interface SocketCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onChatResponse?: (data: { message: string; actions?: ChatAction[] }) => void;
  onError?: (error: string) => void;
}

export const initializeSocket = (callbacks: SocketCallbacks): Socket => {
  if (socket?.connected) {
    return socket;
  }

  // Get JWT token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  if (!token) {
    console.error('No access token found - cannot connect to WebSocket');
    throw new Error('Authentication required');
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    auth: {
      token: token,
    },
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
    callbacks.onConnect?.();
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    callbacks.onDisconnect?.();
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);

    // Handle authentication errors
    if (error.message.includes('auth') || error.message.includes('token') || error.message.includes('unauthorized')) {
      console.error('WebSocket authentication failed - token may be expired');
      callbacks.onError?.('Authentication failed. Please log in again.');

      // Disconnect the socket
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    } else {
      callbacks.onError?.(error.message);
    }
  });

  socket.on('chat_response', (data: { message: string; actions?: ChatAction[] }) => {
    console.log('Chat response received:', data);
    callbacks.onChatResponse?.(data);
  });

  socket.on('error', (error: string) => {
    console.error('Socket error:', error);
    callbacks.onError?.(error);
  });

  return socket;
};

export const sendChatMessage = (message: string): void => {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  // user_id is now retrieved from the Socket.IO session on the backend
  // No need to send it from the client anymore
  socket.emit('chat_message', { message });
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

export const isSocketConnected = (): boolean => socket?.connected ?? false;
