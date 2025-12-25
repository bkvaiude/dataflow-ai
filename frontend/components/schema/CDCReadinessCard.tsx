'use client';

import { useState } from 'react';
import type { CDCReadinessResult } from '@/types';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Server,
  Cloud,
  Database,
  Zap,
  Settings,
  Table2,
  Key,
  RefreshCw,
  Loader2,
  Shield,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CDCReadinessCardProps {
  readiness: CDCReadinessResult | null;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
}

function getProviderIcon(provider: string) {
  switch (provider.toLowerCase()) {
    case 'aws_rds':
      return <Cloud className="w-4 h-4 text-orange-400" />;
    case 'supabase':
      return <Zap className="w-4 h-4 text-green-400" />;
    case 'cloud_sql':
      return <Cloud className="w-4 h-4 text-blue-400" />;
    case 'azure':
      return <Cloud className="w-4 h-4 text-cyan-400" />;
    default:
      return <Server className="w-4 h-4 text-purple-400" />;
  }
}

function getProviderName(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'aws_rds':
      return 'AWS RDS';
    case 'supabase':
      return 'Supabase';
    case 'cloud_sql':
      return 'Google Cloud SQL';
    case 'azure':
      return 'Azure Database';
    case 'self_hosted':
      return 'Self-Hosted';
    default:
      return provider;
  }
}

function getStatusIcon(status: 'pass' | 'warning' | 'fail') {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'fail':
      return <XCircle className="w-4 h-4 text-red-500" />;
  }
}

function getStatusColor(status: 'pass' | 'warning' | 'fail') {
  switch (status) {
    case 'pass':
      return 'bg-green-500/10 border-green-500/20';
    case 'warning':
      return 'bg-yellow-500/10 border-yellow-500/20';
    case 'fail':
      return 'bg-red-500/10 border-red-500/20';
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

interface CheckItemProps {
  name: string;
  check: {
    status: 'pass' | 'warning' | 'fail';
    currentValue?: string | number;
    requiredValue?: string;
    message: string;
    fixInstructions?: string;
    fix?: string;
    used?: number;
    available?: number;
  };
}

function CheckItem({ name, check }: CheckItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = check.fixInstructions || check.fix;

  const formatName = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className={`rounded-xl border ${getStatusColor(check.status)} overflow-hidden`}>
      <button
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center gap-3 text-left ${hasDetails ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-default'} transition-colors`}
      >
        {getStatusIcon(check.status)}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground">
              {formatName(name)}
            </span>
            {check.currentValue !== undefined && (
              <code className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground font-mono">
                {check.currentValue}
              </code>
            )}
            {check.requiredValue && check.status !== 'pass' && (
              <>
                <span className="text-white/30 text-xs">→</span>
                <code className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono">
                  {check.requiredValue}
                </code>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>

          {check.used !== undefined && check.available !== undefined && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Usage</span>
                <span>{check.used} / {check.available}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    check.status === 'pass' ? 'bg-green-500' :
                    check.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((check.used / check.available) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {hasDetails && (
          <span className="text-muted-foreground shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        )}
      </button>

      {isExpanded && hasDetails && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3 animate-fade-in">
          {check.fixInstructions && (
            <div className="text-sm text-muted-foreground">
              {check.fixInstructions}
            </div>
          )}

          {check.fix && (
            <div className="relative">
              <pre className="p-3 rounded-lg bg-black/30 border border-white/10 text-xs font-mono text-green-400 overflow-x-auto">
                {check.fix}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={check.fix} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CDCReadinessCard({ readiness, isLoading = false, onRefresh }: CDCReadinessCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
          </div>
          <h3 className="text-base font-display font-semibold text-foreground mb-1">
            Checking CDC Readiness
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Analyzing database configuration...
          </p>
        </div>
      </div>
    );
  }

  if (!readiness) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
              <Settings className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h3 className="text-base font-display font-semibold text-foreground mb-1">
            CDC Readiness Check
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Run a readiness check to see if your database is configured for Change Data Capture.
          </p>
        </div>
      </div>
    );
  }

  const checkEntries = Object.entries(readiness.checks);
  const passCount = checkEntries.filter(([, c]) => c.status === 'pass').length;
  const failCount = checkEntries.filter(([, c]) => c.status === 'fail').length;
  const warnCount = checkEntries.filter(([, c]) => c.status === 'warning').length;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className={`
        rounded-2xl border p-6 relative overflow-hidden
        ${readiness.overallReady
          ? 'bg-green-500/5 border-green-500/20'
          : 'bg-red-500/5 border-red-500/20'}
      `}>
        {/* Background glow */}
        <div className={`
          absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20
          ${readiness.overallReady ? 'bg-green-500' : 'bg-red-500'}
        `} />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`
              w-14 h-14 rounded-xl flex items-center justify-center
              ${readiness.overallReady
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-red-500/20 border border-red-500/30'}
            `}>
              {readiness.overallReady ? (
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              ) : (
                <XCircle className="w-7 h-7 text-red-500" />
              )}
            </div>

            <div>
              <h3 className={`text-xl font-display font-bold ${readiness.overallReady ? 'text-green-400' : 'text-red-400'}`}>
                {readiness.overallReady ? 'CDC Ready' : 'Not Ready for CDC'}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {passCount} passed • {failCount > 0 ? `${failCount} failed` : ''} {warnCount > 0 ? `• ${warnCount} warnings` : ''}
              </p>
            </div>
          </div>

          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>

        {/* Server Info */}
        <div className="relative mt-4 pt-4 border-t border-white/10 flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            {getProviderIcon(readiness.server.provider)}
            <span className="text-sm font-medium">{getProviderName(readiness.server.provider)}</span>
            {readiness.server.providerDetected && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase tracking-wider">
                Detected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono">{readiness.server.version}</span>
          </div>
        </div>
      </div>

      {/* Configuration Checks */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 px-1">
          <Settings className="w-4 h-4" />
          Configuration Checks
        </h4>
        {checkEntries.map(([name, check]) => (
          <CheckItem key={name} name={name} check={check} />
        ))}
      </div>

      {/* Table Readiness */}
      {readiness.tableReadiness && readiness.tableReadiness.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 px-1">
            <Table2 className="w-4 h-4" />
            Table Readiness ({readiness.tableReadiness.filter(t => t.ready).length}/{readiness.tableReadiness.length} ready)
          </h4>
          <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
            {readiness.tableReadiness.map((table) => (
              <div key={table.table} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                {table.ready ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}

                <span className="font-mono text-sm text-foreground flex-1">{table.table}</span>

                <div className="flex items-center gap-2">
                  {table.hasPrimaryKey ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-xs">
                      <Key className="w-3 h-3" /> PK
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs">
                      <Key className="w-3 h-3" /> No PK
                    </span>
                  )}

                  {table.hasReplicaIdentity ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-xs">
                      <Shield className="w-3 h-3" /> {table.replicaIdentity || 'FULL'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-xs">
                      <Shield className="w-3 h-3" /> DEFAULT
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions */}
      {readiness.recommendedActions && readiness.recommendedActions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 px-1">
            <Info className="w-4 h-4" />
            Recommended Actions
          </h4>
          <div className="space-y-2">
            {readiness.recommendedActions.map((action, i) => (
              <div
                key={i}
                className={`
                  px-4 py-3 rounded-xl border flex items-start gap-3
                  ${action.priority === 'high'
                    ? 'bg-red-500/5 border-red-500/20'
                    : action.priority === 'medium'
                      ? 'bg-yellow-500/5 border-yellow-500/20'
                      : 'bg-blue-500/5 border-blue-500/20'}
                `}
              >
                <span className={`
                  text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium shrink-0 mt-0.5
                  ${action.priority === 'high'
                    ? 'bg-red-500/20 text-red-400'
                    : action.priority === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-blue-500/20 text-blue-400'}
                `}>
                  {action.priority}
                </span>
                <span className="text-sm text-foreground">{action.action}</span>
                {action.providerSpecific && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground uppercase tracking-wider shrink-0 ml-auto">
                    {getProviderName(readiness.server.provider)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
