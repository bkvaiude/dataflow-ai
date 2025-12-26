'use client';

import { Pipeline, PipelineStatus } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  Square,
  Database,
  Server,
  Clock,
  AlertCircle,
  Activity,
  Layers,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PipelineCardProps {
  pipeline: Pipeline;
  onSelect?: (pipeline: Pipeline) => void;
  onStart?: (id: string) => void;
  onStop?: (id: string) => void;
  onPause?: (id: string) => void;
  isSelected?: boolean;
}

const statusConfig: Record<PipelineStatus, { color: string; bgColor: string; label: string; glow: string }> = {
  running: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    label: 'Running',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.4)]',
  },
  paused: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
    label: 'Paused',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]',
  },
  stopped: {
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10 border-zinc-500/30',
    label: 'Stopped',
    glow: '',
  },
  failed: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
    label: 'Failed',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.4)]',
  },
  pending: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    label: 'Pending',
    glow: '',
  },
};

const sinkIcons: Record<string, React.ReactNode> = {
  clickhouse: <Server className="w-4 h-4" />,
  kafka: <Activity className="w-4 h-4" />,
  s3: <Database className="w-4 h-4" />,
};

export function PipelineCard({
  pipeline,
  onSelect,
  onStart,
  onStop,
  onPause,
  isSelected,
}: PipelineCardProps) {
  const status = statusConfig[pipeline.status];

  const handleQuickAction = (
    e: React.MouseEvent,
    action: ((id: string) => void) | undefined
  ) => {
    e.stopPropagation();
    if (action) action(pipeline.id);
  };

  return (
    <div
      onClick={() => onSelect?.(pipeline)}
      className={`
        group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer
        ${isSelected
          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
        }
      `}
    >
      {/* Status glow effect */}
      {pipeline.status === 'running' && (
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center border
              ${pipeline.status === 'running'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-white/5 border-white/10'}
            `}>
              <Layers className={`w-5 h-5 ${pipeline.status === 'running' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">
                {pipeline.name}
              </h3>
              {pipeline.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                  {pipeline.description}
                </p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className={`
            px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5
            ${status.bgColor} ${status.color} ${status.glow}
          `}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              pipeline.status === 'running' ? 'bg-emerald-400 animate-pulse' :
              pipeline.status === 'failed' ? 'bg-red-400' :
              pipeline.status === 'paused' ? 'bg-amber-400' :
              'bg-current'
            }`} />
            {status.label}
          </div>
        </div>

        {/* Pipeline Flow Visualization */}
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-black/20 border border-white/5">
          <div className="flex items-center gap-1.5 text-xs">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-muted-foreground font-mono">
              {pipeline.sourceTables.length} table{pipeline.sourceTables.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-blue-500/50 via-white/20 to-primary/50" />
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`${pipeline.sinkType === 'clickhouse' ? 'text-amber-400' : 'text-primary'}`}>
              {sinkIcons[pipeline.sinkType]}
            </span>
            <span className="text-muted-foreground capitalize">{pipeline.sinkType}</span>
          </div>
        </div>

        {/* Metrics Row */}
        {pipeline.metricsCache && (
          <div className="flex items-center gap-4 mb-4 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span>{pipeline.metricsCache.eventsPerSecond?.toFixed(1) || 0}/s</span>
            </div>
            {pipeline.metricsCache.lagMs !== undefined && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{pipeline.metricsCache.lagMs}ms lag</span>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {pipeline.errorMessage && pipeline.status === 'failed' && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 line-clamp-2">{pipeline.errorMessage}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {pipeline.startedAt ? (
              <span>Started {formatDistanceToNow(new Date(pipeline.startedAt), { addSuffix: true })}</span>
            ) : (
              <span>Created {formatDistanceToNow(new Date(pipeline.createdAt), { addSuffix: true })}</span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {(pipeline.status === 'stopped' || pipeline.status === 'pending' || pipeline.status === 'failed') && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-emerald-500/20 hover:text-emerald-400"
                onClick={(e) => handleQuickAction(e, onStart)}
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
            {pipeline.status === 'running' && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-amber-500/20 hover:text-amber-400"
                  onClick={(e) => handleQuickAction(e, onPause)}
                >
                  <Pause className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-red-500/20 hover:text-red-400"
                  onClick={(e) => handleQuickAction(e, onStop)}
                >
                  <Square className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {pipeline.status === 'paused' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-emerald-500/20 hover:text-emerald-400"
                onClick={(e) => handleQuickAction(e, onStart)}
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
