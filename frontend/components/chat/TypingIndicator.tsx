'use client';

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in-up">
      {/* AI Avatar */}
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

      {/* Typing dots */}
      <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 bg-primary rounded-full animate-typing-dot"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 bg-primary rounded-full animate-typing-dot"
            style={{ animationDelay: '200ms' }}
          />
          <div
            className="w-2 h-2 bg-primary rounded-full animate-typing-dot"
            style={{ animationDelay: '400ms' }}
          />
        </div>
      </div>
    </div>
  );
}
