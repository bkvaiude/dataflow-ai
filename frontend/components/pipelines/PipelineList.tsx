'use client';

import { Pipeline } from '@/types';
import { PipelineCard } from './PipelineCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, GitBranch, Zap } from 'lucide-react';

interface PipelineListProps {
  pipelines: Pipeline[];
  isLoading?: boolean;
  selectedPipelineId?: string;
  onSelect?: (pipeline: Pipeline) => void;
  onStart?: (id: string) => void;
  onStop?: (id: string) => void;
  onPause?: (id: string) => void;
  onCreateNew?: () => void;
}

export function PipelineList({
  pipelines,
  isLoading,
  selectedPipelineId,
  onSelect,
  onStart,
  onStop,
  onPause,
  onCreateNew,
}: PipelineListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-[220px] rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse"
          >
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-white/5 rounded" />
                  <div className="h-3 w-24 bg-white/5 rounded" />
                </div>
                <div className="h-6 w-16 bg-white/5 rounded-full" />
              </div>
              <div className="h-12 bg-white/5 rounded-xl" />
              <div className="flex gap-4">
                <div className="h-4 w-16 bg-white/5 rounded" />
                <div className="h-4 w-20 bg-white/5 rounded" />
              </div>
              <div className="h-4 w-40 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative mb-8">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />

          {/* Icon container */}
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/50 to-transparent" />
            <GitBranch className="w-12 h-12 text-primary relative z-10" />
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center animate-pulse">
            <Zap className="w-3 h-3 text-emerald-400" />
          </div>
        </div>

        <h3 className="text-xl font-display font-bold text-foreground mb-2">
          No Pipelines Yet
        </h3>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Create your first CDC pipeline to start streaming data changes from PostgreSQL to your destination in real-time.
        </p>

        <Button
          onClick={onCreateNew}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-6"
        >
          <Plus className="w-4 h-4" />
          Create Pipeline
        </Button>

        {/* Feature hints */}
        <div className="mt-12 grid grid-cols-3 gap-8 max-w-2xl">
          {[
            { label: 'Real-time CDC', desc: 'Stream changes instantly' },
            { label: 'Multiple Sinks', desc: 'ClickHouse, Kafka, S3' },
            { label: 'Monitoring', desc: 'Track lag & throughput' },
          ].map((feature, i) => (
            <div key={i} className="text-center">
              <div className="text-sm font-medium text-foreground mb-1">{feature.label}</div>
              <div className="text-xs text-muted-foreground">{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Create New Card */}
      <button
        onClick={onCreateNew}
        className="h-[220px] rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/30 bg-white/[0.01] hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center gap-3 group"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6 text-primary" />
        </div>
        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
          Create New Pipeline
        </span>
      </button>

      {/* Pipeline Cards */}
      {pipelines.map((pipeline) => (
        <PipelineCard
          key={pipeline.id}
          pipeline={pipeline}
          onSelect={onSelect}
          onStart={onStart}
          onStop={onStop}
          onPause={onPause}
          isSelected={pipeline.id === selectedPipelineId}
        />
      ))}
    </div>
  );
}
