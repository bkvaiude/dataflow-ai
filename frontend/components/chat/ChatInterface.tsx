'use client';

import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { useChat } from '@/hooks/useChat';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

export function ChatInterface() {
  const { messages, isTyping, isConnected, sendMessage } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-full">
      {/* Connection status */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Chat</h2>
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className={`text-xs ${
              isConnected
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            }`}
          >
            {isConnected ? (
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                Connecting
              </span>
            )}
          </Badge>
        </div>
        {isConnected && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse-glow" />
            <span className="text-xs text-muted-foreground">Real-time streaming active</span>
          </div>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <MessageList messages={messages} />
          {isTyping && (
            <div className="mt-4">
              <TypingIndicator />
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="px-4 py-4 border-t border-border bg-background/50 backdrop-blur">
        <div className="max-w-3xl mx-auto">
          <MessageInput onSend={sendMessage} disabled={!isConnected} />
        </div>
      </div>
    </div>
  );
}
