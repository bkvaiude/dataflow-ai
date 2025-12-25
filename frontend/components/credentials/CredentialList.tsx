'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Credential } from '@/types';
import {
  Database,
  Server,
  Trash2,
  Zap,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';

interface CredentialListProps {
  credentials: Credential[];
  selectedId?: string;
  onSelect: (credential: Credential) => void;
  onDelete: (id: string) => Promise<void>;
  onTest: (id: string) => Promise<{ success: boolean; latencyMs?: number }>;
  isLoading?: boolean;
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function DatabaseIcon({ type }: { type: string }) {
  return (
    <span className="text-xl">
      {type === 'postgresql' ? '🐘' : type === 'mysql' ? '🐬' : '🗄️'}
    </span>
  );
}

export function CredentialList({
  credentials,
  selectedId,
  onSelect,
  onDelete,
  onTest,
  isLoading = false,
}: CredentialListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latencyMs?: number }>>({});

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this connection?')) {
      setDeletingId(id);
      try {
        await onDelete(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleTest = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingId(id);
    try {
      const result = await onTest(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } finally {
      setTestingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-white/10 rounded" />
                <div className="h-3 w-48 bg-white/5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (credentials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        {/* Decorative background */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
            <Database className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h3 className="text-lg font-display font-semibold text-foreground mb-2">
          No Databases Connected
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
          Connect your first database to start discovering schemas and setting up CDC pipelines.
        </p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="w-3.5 h-3.5" />
          <span>Supports PostgreSQL</span>
          <span className="text-white/20">•</span>
          <span className="text-primary/60">MySQL coming soon</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {credentials.map((credential, index) => {
        const isSelected = credential.id === selectedId;
        const testResult = testResults[credential.id];

        return (
          <div
            key={credential.id}
            onClick={() => onSelect(credential)}
            className={`
              group relative p-4 rounded-xl border cursor-pointer transition-all duration-200
              ${isSelected
                ? 'bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(0,240,255,0.1)]'
                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'}
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Selected indicator line */}
            {isSelected && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
            )}

            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className={`
                w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors
                ${isSelected ? 'bg-primary/20' : 'bg-white/5 group-hover:bg-white/10'}
              `}>
                <DatabaseIcon type={credential.sourceType} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground truncate">
                    {credential.name}
                  </h4>
                  {/* Status dot */}
                  <div className={`
                    w-2 h-2 rounded-full shrink-0
                    ${credential.isValid
                      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                      : credential.lastValidatedAt
                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                        : 'bg-muted-foreground'}
                  `} />
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-muted-foreground font-mono truncate">
                    {credential.host}:{credential.port}/{credential.database}
                  </code>
                </div>

                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(credential.lastValidatedAt)}
                  </span>

                  {testResult && (
                    <span className={`flex items-center gap-1 ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {testResult.success ? (
                        <>
                          <Zap className="w-3 h-3" />
                          {testResult.latencyMs}ms
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          Failed
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => handleTest(credential.id, e)}
                  disabled={testingId === credential.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Test connection"
                >
                  {testingId === credential.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => handleDelete(credential.id, e)}
                  disabled={deletingId === credential.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
                  title="Delete connection"
                >
                  {deletingId === credential.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>

                <ChevronRight className={`
                  w-4 h-4 text-muted-foreground transition-transform
                  ${isSelected ? 'rotate-90' : ''}
                `} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
