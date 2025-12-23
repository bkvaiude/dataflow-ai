'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ActionButton } from './ActionButton';
import type { ChatMessage } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useMemo } from 'react';

interface MessageBubbleProps {
  message: ChatMessage;
}

// Safe text formatting component
function FormattedText({ content }: { content: string }) {
  const parts = useMemo(() => {
    const result: React.ReactNode[] = [];
    let key = 0;

    // Split by line breaks first
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        result.push(<br key={`br-${key++}`} />);
      }

      // Process each line for bold, italic, and code
      let remaining = line;
      let match;

      while (remaining.length > 0) {
        // Check for bold **text**
        match = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/);
        if (match) {
          if (match[1]) result.push(<span key={key++}>{match[1]}</span>);
          result.push(
            <strong key={key++} className="text-primary font-semibold">
              {match[2]}
            </strong>
          );
          remaining = match[3];
          continue;
        }

        // Check for code `text`
        match = remaining.match(/^(.*?)`(.+?)`(.*)/);
        if (match) {
          if (match[1]) result.push(<span key={key++}>{match[1]}</span>);
          result.push(
            <code key={key++} className="bg-secondary px-1.5 py-0.5 rounded font-mono text-sm">
              {match[2]}
            </code>
          );
          remaining = match[3];
          continue;
        }

        // Check for italic *text*
        match = remaining.match(/^(.*?)\*(.+?)\*(.*)/);
        if (match) {
          if (match[1]) result.push(<span key={key++}>{match[1]}</span>);
          result.push(<em key={key++}>{match[2]}</em>);
          remaining = match[3];
          continue;
        }

        // No more matches, add remaining text
        if (remaining) {
          result.push(<span key={key++}>{remaining}</span>);
        }
        break;
      }
    });

    return result;
  }, [content]);

  return <>{parts}</>;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { user } = useAuthStore();
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex items-start gap-3 animate-fade-in-up ${
        isUser ? 'flex-row-reverse' : ''
      }`}
    >
      {/* Avatar */}
      {isUser ? (
        <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-primary/30">
          <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {user?.displayName?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 h-8 rounded-full gradient-ai flex items-center justify-center flex-shrink-0 glow-ai">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
      )}

      {/* Message content */}
      <div
        className={`max-w-[80%] ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
            : 'glass rounded-2xl rounded-tl-sm'
        } px-4 py-3`}
      >
        <div className="text-sm leading-relaxed">
          <FormattedText content={message.content} />
        </div>

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
            {message.actions.map((action, index) => (
              <ActionButton key={index} action={action} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-primary-foreground/60' : 'text-muted-foreground'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
