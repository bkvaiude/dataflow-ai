'use client';

import { PipelineHealth as PipelineHealthType, PipelineStatus } from '@/types';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Database,
  Server,
  Loader2,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PipelineHealthProps {
  health: PipelineHealthType | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const statusConfig: Record<PipelineStatus | 'unknown', { icon: React.ReactNode; color: string; bgColor: string }> = {
  running: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
  },
  paused: {
    icon: <Clock className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
  },
  stopped: {
    icon: <XCircle className="w-5 h-5" />,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10 border-zinc-500/30',
  },
  failed: {
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
  },
  pending: {
    icon: <Clock className="w-5 h-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
  },
  unknown: {
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10 border-zinc-500/30',
  },
};

export function PipelineHealth({ health, isLoading, onRefresh }: PipelineHealthProps) {
  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="text-center py-8 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No health data available</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="mt-4 gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Check Health
          </Button>
        </div>
      </div>
    );
  }

  const overallStatus = statusConfig[health.status] || statusConfig.unknown;
  const sourceStatus = statusConfig[health.sourceConnector.status as PipelineStatus] || statusConfig.unknown;
  const sinkStatus = statusConfig[health.sinkConnector.status as PipelineStatus] || statusConfig.unknown;

  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${overallStatus.bgColor}`}>
            <span className={overallStatus.color}>{overallStatus.icon}</span>
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Pipeline Health</h3>
            <p className="text-xs text-muted-foreground">
              Last checked {health.lastCheck && !isNaN(new Date(health.lastCheck).getTime())
                ? formatDistanceToNow(new Date(health.lastCheck), { addSuffix: true })
                : 'Never'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Connector Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Source Connector */}
        <div className={`p-4 rounded-xl border ${sourceStatus.bgColor}`}>
          <div className="flex items-center gap-2 mb-3">
            <Database className={`w-4 h-4 ${sourceStatus.color}`} />
            <span className="text-sm font-medium text-foreground">Source Connector</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium capitalize ${sourceStatus.color}`}>
                {health.sourceConnector.status}
              </span>
            </div>
            {health.sourceConnector.name && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Name</span>
                <code className="text-foreground font-mono text-[10px] bg-black/20 px-1.5 py-0.5 rounded">
                  {health.sourceConnector.name}
                </code>
              </div>
            )}
            {health.sourceConnector.taskCount !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tasks</span>
                <span className="text-foreground">
                  {health.sourceConnector.taskCount - (health.sourceConnector.failedTasks || 0)}/{health.sourceConnector.taskCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sink Connector */}
        <div className={`p-4 rounded-xl border ${sinkStatus.bgColor}`}>
          <div className="flex items-center gap-2 mb-3">
            <Server className={`w-4 h-4 ${sinkStatus.color}`} />
            <span className="text-sm font-medium text-foreground">Sink Connector</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium capitalize ${sinkStatus.color}`}>
                {health.sinkConnector.status}
              </span>
            </div>
            {health.sinkConnector.name && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Name</span>
                <code className="text-foreground font-mono text-[10px] bg-black/20 px-1.5 py-0.5 rounded">
                  {health.sinkConnector.name}
                </code>
              </div>
            )}
            {health.sinkConnector.taskCount !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tasks</span>
                <span className="text-foreground">
                  {health.sinkConnector.taskCount - (health.sinkConnector.failedTasks || 0)}/{health.sinkConnector.taskCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Errors */}
      {health.errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            Recent Errors ({health.errors.length})
          </h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {health.errors.map((error, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-red-300">{error.component}</span>
                  <span className="text-xs text-muted-foreground">
                    {error.timestamp && !isNaN(new Date(error.timestamp).getTime())
                      ? formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })
                      : 'Unknown'}
                  </span>
                </div>
                <p className="text-xs text-red-200">{error.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
