'use client';

import { useState } from 'react';
import { Enrichment, EnrichmentStatus } from '@/types';
import { EnrichmentCard } from './EnrichmentCard';
import { Button } from '@/components/ui/button';
import {
  Plus,
  GitMerge,
  Filter,
  Loader2,
} from 'lucide-react';

interface EnrichmentListProps {
  enrichments: Enrichment[];
  isLoading?: boolean;
  onSelectEnrichment?: (enrichment: Enrichment) => void;
  onActivate?: (id: string) => void;
  onDeactivate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCreateNew?: () => void;
  selectedEnrichmentId?: string;
}

const statusFilters: { key: EnrichmentStatus | 'all'; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: 'text-foreground' },
  { key: 'active', label: 'Active', color: 'text-emerald-400' },
  { key: 'pending', label: 'Pending', color: 'text-amber-400' },
  { key: 'failed', label: 'Failed', color: 'text-red-400' },
  { key: 'stopped', label: 'Stopped', color: 'text-zinc-400' },
];

export function EnrichmentList({
  enrichments,
  isLoading = false,
  onSelectEnrichment,
  onActivate,
  onDeactivate,
  onDelete,
  onCreateNew,
  selectedEnrichmentId,
}: EnrichmentListProps) {
  const [statusFilter, setStatusFilter] = useState<EnrichmentStatus | 'all'>('all');

  const filteredEnrichments = enrichments.filter((e) =>
    statusFilter === 'all' ? true : e.status === statusFilter
  );

  const statusCounts = {
    all: enrichments.length,
    active: enrichments.filter((e) => e.status === 'active').length,
    pending: enrichments.filter((e) => e.status === 'pending').length,
    failed: enrichments.filter((e) => e.status === 'failed').length,
    stopped: enrichments.filter((e) => e.status === 'stopped').length,
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-white/5 rounded-lg animate-pulse" />
        </div>

        {/* Filter skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-20 bg-white/5 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-2xl bg-white/[0.02] border border-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (enrichments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
            <GitMerge className="w-10 h-10 text-cyan-400" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Plus className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <h3 className="text-lg font-display font-semibold text-foreground mb-2">
          No Enrichments Yet
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Enrich your streaming data by joining it with lookup tables. Add user details to events,
          product info to orders, and more.
        </p>

        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Enrichment
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">
            Stream Enrichments
          </h2>
          <p className="text-sm text-muted-foreground">
            {enrichments.length} enrichment{enrichments.length !== 1 ? 's' : ''} configured
          </p>
        </div>

        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            New Enrichment
          </Button>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {statusFilters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key)}
            className={`
              px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${statusFilter === filter.key
                ? 'bg-white/10 text-foreground border border-white/20'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'}
            `}
          >
            <span className={filter.key !== 'all' ? filter.color : ''}>
              {filter.label}
            </span>
            <span className="ml-1.5 text-muted-foreground">
              ({statusCounts[filter.key]})
            </span>
          </button>
        ))}
      </div>

      {/* Enrichment Grid */}
      {filteredEnrichments.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No {statusFilter} enrichments found
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEnrichments.map((enrichment) => (
            <EnrichmentCard
              key={enrichment.id}
              enrichment={enrichment}
              isSelected={enrichment.id === selectedEnrichmentId}
              onSelect={onSelectEnrichment}
              onActivate={onActivate}
              onDeactivate={onDeactivate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
