'use client';

import { Enrichment, EnrichmentStatus } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Play,
  Square,
  Trash2,
  GitMerge,
  Database,
  Zap,
  ArrowRight,
  MoreVertical,
  Eye,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface EnrichmentCardProps {
  enrichment: Enrichment;
  onSelect?: (enrichment: Enrichment) => void;
  onActivate?: (id: string) => void;
  onDeactivate?: (id: string) => void;
  onDelete?: (id: string) => void;
  isSelected?: boolean;
}

const statusConfig: Record<EnrichmentStatus, {
  color: string;
  bgColor: string;
  label: string;
  glow: string;
  dotColor: string;
}> = {
  active: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    label: 'Active',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.4)]',
    dotColor: 'bg-emerald-400',
  },
  pending: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
    label: 'Pending',
    glow: '',
    dotColor: 'bg-amber-400',
  },
  failed: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
    label: 'Failed',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.4)]',
    dotColor: 'bg-red-400',
  },
  stopped: {
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10 border-zinc-500/30',
    label: 'Stopped',
    glow: '',
    dotColor: 'bg-zinc-400',
  },
};

export function EnrichmentCard({
  enrichment,
  onSelect,
  onActivate,
  onDeactivate,
  onDelete,
  isSelected,
}: EnrichmentCardProps) {
  const status = statusConfig[enrichment.status];

  const handleQuickAction = (
    e: React.MouseEvent,
    action: ((id: string) => void) | undefined
  ) => {
    e.stopPropagation();
    if (action) action(enrichment.id);
  };

  return (
    <div
      onClick={() => onSelect?.(enrichment)}
      className={`
        group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden
        ${isSelected
          ? 'border-cyan-500/50 bg-cyan-500/5 ring-1 ring-cyan-500/20'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
        }
      `}
    >
      {/* Active glow effect */}
      {enrichment.status === 'active' && (
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      {/* Data flow animation for active enrichments */}
      {enrichment.status === 'active' && (
        <div className="absolute top-0 left-0 w-full h-0.5 overflow-hidden">
          <div className="h-full w-1/4 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-[flow_2s_ease-in-out_infinite]" />
        </div>
      )}

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center border relative
              ${enrichment.status === 'active'
                ? 'bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border-cyan-500/30'
                : 'bg-white/5 border-white/10'}
            `}>
              <GitMerge className={`w-5 h-5 ${enrichment.status === 'active' ? 'text-cyan-400' : 'text-muted-foreground'}`} />
              {enrichment.status === 'active' && (
                <div className="absolute -top-1 -right-1 w-3 h-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground group-hover:text-cyan-400 transition-colors">
                {enrichment.name}
              </h3>
              {enrichment.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                  {enrichment.description}
                </p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className={`
            px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5
            ${status.bgColor} ${status.color} ${status.glow}
          `}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor} ${
              enrichment.status === 'active' ? 'animate-pulse' : ''
            }`} />
            {status.label}
          </div>
        </div>

        {/* Stream Flow Visualization */}
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-black/30 border border-white/5">
          {/* Source Stream */}
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-6 h-6 rounded-md bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Zap className="w-3 h-3 text-blue-400" />
            </div>
            <span className="text-muted-foreground font-mono truncate max-w-[80px]">
              {enrichment.sourceTopic.split('.').pop()}
            </span>
          </div>

          {/* Join indicator */}
          <div className="flex-1 flex items-center justify-center gap-1">
            <div className="h-px flex-1 bg-gradient-to-r from-blue-500/50 to-transparent" />
            <div className="flex items-center gap-0.5">
              {enrichment.lookupTables.slice(0, 2).map((table, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-md bg-green-500/20 border border-green-500/30 flex items-center justify-center"
                  title={table.topic}
                >
                  <Database className="w-2.5 h-2.5 text-green-400" />
                </div>
              ))}
              {enrichment.lookupTables.length > 2 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  +{enrichment.lookupTables.length - 2}
                </span>
              )}
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-500/50" />
          </div>

          {/* Output Stream */}
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Zap className="w-3 h-3 text-cyan-400" />
            </div>
            <span className="text-muted-foreground font-mono truncate max-w-[80px]">
              {enrichment.outputTopic.split('.').pop() || 'enriched'}
            </span>
          </div>
        </div>

        {/* Join Info */}
        <div className="flex items-center gap-3 mb-4 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5">
            <span className="text-muted-foreground">JOIN:</span>
            <span className={`font-mono font-medium ${enrichment.joinType === 'LEFT' ? 'text-amber-400' : 'text-blue-400'}`}>
              {enrichment.joinType}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5">
            <span className="text-muted-foreground">Columns:</span>
            <span className="text-foreground font-medium">{enrichment.outputColumns.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5">
            <span className="text-muted-foreground">Tables:</span>
            <span className="text-foreground font-medium">{enrichment.lookupTables.length}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {enrichment.activatedAt ? (
              <span>Active {formatDistanceToNow(new Date(enrichment.activatedAt), { addSuffix: true })}</span>
            ) : (
              <span>Created {formatDistanceToNow(new Date(enrichment.createdAt), { addSuffix: true })}</span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-white/10"
              onClick={(e) => { e.stopPropagation(); onSelect?.(enrichment); }}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>

            {(enrichment.status === 'stopped' || enrichment.status === 'pending' || enrichment.status === 'failed') && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-emerald-500/20 hover:text-emerald-400"
                onClick={(e) => handleQuickAction(e, onActivate)}
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}

            {enrichment.status === 'active' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-amber-500/20 hover:text-amber-400"
                onClick={(e) => handleQuickAction(e, onDeactivate)}
              >
                <Square className="w-3.5 h-3.5" />
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-red-500/20 hover:text-red-400"
              onClick={(e) => handleQuickAction(e, onDelete)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes flow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
