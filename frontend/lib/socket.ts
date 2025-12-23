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

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
    callbacks.onConnect?.();
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    callbacks.onDisconnect?.();
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

export const sendChatMessage = (message: string, userId: string): void => {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  socket.emit('chat_message', { message, user_id: userId });
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

export const isSocketConnected = (): boolean => socket?.connected ?? false;
