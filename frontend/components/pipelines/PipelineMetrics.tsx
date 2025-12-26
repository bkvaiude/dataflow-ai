'use client';

import { PipelineMetrics as PipelineMetricsType } from '@/types';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Activity,
  Clock,
  Zap,
  TrendingUp,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PipelineMetricsProps {
  metrics: PipelineMetricsType | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
  return `${(num / 1000000000).toFixed(1)}B`;
}

export function PipelineMetrics({ metrics, isLoading, onRefresh }: PipelineMetricsProps) {
  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No metrics data available</p>
          <p className="text-sm mt-1">Start the pipeline to collect metrics</p>
        </div>
      </div>
    );
  }

  const lagStatus = metrics.lag.currentMs < 1000
    ? { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Healthy' }
    : metrics.lag.currentMs < 5000
      ? { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Moderate' }
      : { color: 'text-red-400', bg: 'bg-red-500/10', label: 'High' };

  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Pipeline Metrics</h3>
            <p className="text-xs text-muted-foreground">
              Last {metrics.windowSeconds}s window • Updated {formatDistanceToNow(new Date(metrics.updatedAt), { addSuffix: true })}
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

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Throughput */}
        <div className="p-4 rounded-xl bg-black/20 border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Throughput</span>
          </div>
          <div className="text-2xl font-display font-bold text-foreground">
            {metrics.throughput.eventsPerSecond.toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground ml-1">/s</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatBytes(metrics.throughput.bytesPerSecond)}/s
          </div>
        </div>

        {/* Lag */}
        <div className={`p-4 rounded-xl border ${lagStatus.bg} border-white/5`}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className={`w-4 h-4 ${lagStatus.color}`} />
            <span className="text-xs text-muted-foreground">Current Lag</span>
          </div>
          <div className={`text-2xl font-display font-bold ${lagStatus.color}`}>
            {metrics.lag.currentMs < 1000
              ? `${metrics.lag.currentMs}ms`
              : `${(metrics.lag.currentMs / 1000).toFixed(1)}s`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {lagStatus.label} latency
          </div>
        </div>

        {/* Total Events */}
        <div className="p-4 rounded-xl bg-black/20 border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Total Events</span>
          </div>
          <div className="text-2xl font-display font-bold text-foreground">
            {formatNumber(metrics.throughput.totalEvents)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Processed events
          </div>
        </div>
      </div>

      {/* Lag Details */}
      <div className="p-4 rounded-xl bg-black/20 border border-white/5">
        <h4 className="text-sm font-medium text-foreground mb-3">Lag Statistics</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Current</div>
            <div className="text-sm font-mono text-foreground">
              {metrics.lag.currentMs}ms
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Average</div>
            <div className="text-sm font-mono text-foreground">
              {metrics.lag.avgMs.toFixed(0)}ms
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Max</div>
            <div className="text-sm font-mono text-foreground">
              {metrics.lag.maxMs}ms
            </div>
          </div>
        </div>

        {/* Lag Bar Visualization */}
        <div className="mt-4">
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                metrics.lag.currentMs < 1000
                  ? 'bg-emerald-500'
                  : metrics.lag.currentMs < 5000
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{
                width: `${Math.min((metrics.lag.currentMs / metrics.lag.maxMs) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0ms</span>
            <span>{metrics.lag.maxMs}ms</span>
          </div>
        </div>
      </div>

      {/* Throughput Chart Placeholder */}
      <div className="p-4 rounded-xl bg-black/20 border border-white/5">
        <h4 className="text-sm font-medium text-foreground mb-3">Throughput Over Time</h4>
        <div className="h-24 flex items-end justify-around gap-1">
          {/* Simple bar chart visualization */}
          {[...Array(20)].map((_, i) => {
            const height = Math.random() * 80 + 20;
            return (
              <div
                key={i}
                className="flex-1 bg-primary/30 hover:bg-primary/50 transition-colors rounded-t"
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>-{metrics.windowSeconds}s</span>
          <span>Now</span>
        </div>
      </div>
    </div>
  );
}
