'use client';

import { useState } from 'react';
import { AlertRule, AlertRuleType, AlertSeverity } from '@/types';
import { AlertRuleCard } from './AlertRuleCard';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Bell,
  Filter,
  Search,
  Loader2,
} from 'lucide-react';

interface AlertRuleListProps {
  rules: AlertRule[];
  isLoading?: boolean;
  onEdit?: (rule: AlertRule) => void;
  onTest?: (ruleId: string) => void;
  onDelete?: (ruleId: string) => void;
  onToggleActive?: (ruleId: string, active: boolean) => void;
  onCreateNew?: () => void;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type SeverityFilter = 'all' | AlertSeverity;
type TypeFilter = 'all' | AlertRuleType;

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

const severityFilters: { key: SeverityFilter; label: string; color: string }[] = [
  { key: 'all', label: 'All Severities', color: 'text-foreground' },
  { key: 'critical', label: 'Critical', color: 'text-rose-400' },
  { key: 'warning', label: 'Warning', color: 'text-amber-400' },
  { key: 'info', label: 'Info', color: 'text-sky-400' },
];

const typeFilters: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'volume_spike', label: 'Spike' },
  { key: 'volume_drop', label: 'Drop' },
  { key: 'gap_detection', label: 'Gap' },
  { key: 'null_ratio', label: 'Null Ratio' },
];

export function AlertRuleList({
  rules,
  isLoading = false,
  onEdit,
  onTest,
  onDelete,
  onToggleActive,
  onCreateNew,
}: AlertRuleListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRules = rules.filter((rule) => {
    // Status filter
    if (statusFilter === 'active' && !rule.isActive) return false;
    if (statusFilter === 'inactive' && rule.isActive) return false;

    // Severity filter
    if (severityFilter !== 'all' && rule.severity !== severityFilter) return false;

    // Type filter
    if (typeFilter !== 'all' && rule.ruleType !== typeFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        rule.name.toLowerCase().includes(query) ||
        rule.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const statusCounts = {
    all: rules.length,
    active: rules.filter((r) => r.isActive).length,
    inactive: rules.filter((r) => !r.isActive).length,
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-white/5 rounded-lg animate-pulse" />
        </div>

        {/* Filter skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-24 bg-white/5 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-white/[0.02] border border-white/10 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
            <Bell className="w-10 h-10 text-amber-400" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Plus className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <h3 className="text-xl font-display font-semibold text-foreground mb-2">
          No Alert Rules Yet
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Set up alert rules to monitor your pipelines and get notified when anomalies occur.
          Detect volume spikes, drops, gaps, and data quality issues.
        </p>

        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Alert Rule
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-semibold text-foreground">
            Alert Rules
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
            {statusCounts.active > 0 && (
              <span className="text-emerald-400 ml-2">
                ({statusCounts.active} active)
              </span>
            )}
          </p>
        </div>

        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            New Rule
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10"
          />
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="w-4 h-4" />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
          {statusFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={`
                px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${statusFilter === filter.key
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }
              `}
            >
              {filter.label}
              <span className="ml-1.5 text-muted-foreground">
                ({statusCounts[filter.key]})
              </span>
            </button>
          ))}
        </div>

        {/* Severity filter dropdown */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground focus:outline-none focus:border-white/20 cursor-pointer"
        >
          {severityFilters.map((filter) => (
            <option key={filter.key} value={filter.key} className="bg-zinc-900">
              {filter.label}
            </option>
          ))}
        </select>

        {/* Type filter dropdown */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground focus:outline-none focus:border-white/20 cursor-pointer"
        >
          {typeFilters.map((filter) => (
            <option key={filter.key} value={filter.key} className="bg-zinc-900">
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      {/* Rules Grid */}
      {filteredRules.length === 0 ? (
        <div className="py-16 text-center">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">
            No rules match your filters
          </p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setSeverityFilter('all');
              setTypeFilter('all');
              setSearchQuery('');
            }}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRules.map((rule) => (
            <AlertRuleCard
              key={rule.id}
              rule={rule}
              onEdit={onEdit}
              onTest={onTest}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
