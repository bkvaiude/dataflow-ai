'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AlertHistoryTable } from '@/components/alerts';
import { Button } from '@/components/ui/button';
import type { AlertHistory, AlertRule, AlertSeverity } from '@/types';
import {
  ArrowLeft,
  History,
  Loader2,
  RefreshCw,
  Filter,
  Calendar,
  Zap,
  AlertTriangle,
  Info,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Transform snake_case API response to camelCase for frontend types
function transformAlertRule(rule: Record<string, unknown>): AlertRule {
  return {
    id: rule.id as string,
    userId: (rule.user_id || rule.userId) as string,
    pipelineId: (rule.pipeline_id || rule.pipelineId) as string,
    name: rule.name as string,
    description: rule.description as string | undefined,
    ruleType: (rule.rule_type || rule.ruleType) as AlertRule['ruleType'],
    thresholdConfig: (rule.threshold_config || rule.thresholdConfig) as AlertRule['thresholdConfig'],
    severity: rule.severity as AlertRule['severity'],
    recipients: (rule.recipients || []) as string[],
    enabledDays: (rule.enabled_days || rule.enabledDays || []) as number[],
    enabledHours: (rule.enabled_hours || rule.enabledHours || { start: 0, end: 23 }) as AlertRule['enabledHours'],
    cooldownMinutes: (rule.cooldown_minutes || rule.cooldownMinutes || 30) as number,
    isActive: (rule.is_active ?? rule.isActive ?? true) as boolean,
    lastTriggeredAt: (rule.last_triggered_at || rule.lastTriggeredAt) as string | undefined,
    triggerCount: (rule.trigger_count ?? rule.triggerCount ?? 0) as number,
    createdAt: (rule.created_at || rule.createdAt) as string,
    updatedAt: (rule.updated_at || rule.updatedAt) as string,
  };
}

function transformAlertHistory(history: Record<string, unknown>): AlertHistory {
  return {
    id: history.id as string,
    ruleId: (history.rule_id || history.ruleId) as string,
    pipelineId: (history.pipeline_id || history.pipelineId || '') as string,
    anomalyType: (history.alert_type || history.anomaly_type || history.anomalyType || 'unknown') as string,
    anomalyDetails: (history.details || history.anomaly_details || history.anomalyDetails || {}) as Record<string, unknown>,
    severity: history.severity as AlertHistory['severity'],
    triggeredAt: (history.triggered_at || history.triggeredAt) as string,
    emailSent: (history.email_sent ?? history.emailSent ?? false) as boolean,
    emailError: (history.email_error || history.emailError) as string | undefined,
  };
}

type SeverityFilter = 'all' | AlertSeverity;
type DateFilter = 'all' | 'today' | 'week' | 'month';

const severityFilters: { key: SeverityFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'all', label: 'All', icon: null, color: '' },
  { key: 'critical', label: 'Critical', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-rose-400' },
  { key: 'warning', label: 'Warning', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-amber-400' },
  { key: 'info', label: 'Info', icon: <Info className="w-3.5 h-3.5" />, color: 'text-sky-400' },
];

const dateFilters: { key: DateFilter; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

export default function AlertHistoryPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get access token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    setAccessToken(storedToken);
  }, []);

  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [ruleFilter, setRuleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  const fetchData = useCallback(async (reset = false) => {
    if (!accessToken) return;

    try {
      const currentPage = reset ? 1 : page;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };

      const [historyRes, rulesRes] = await Promise.all([
        fetch(`${API_URL}/api/alerts/history?limit=${pageSize}&offset=${(currentPage - 1) * pageSize}`, { headers }),
        rules.length === 0 ? fetch(`${API_URL}/api/alerts/rules`, { headers }) : Promise.resolve(null),
      ]);

      const historyData = historyRes.ok ? await historyRes.json() : [];

      if (rulesRes) {
        const rulesData = await rulesRes.json();
        setRules(Array.isArray(rulesData) ? rulesData.map(transformAlertRule) : []);
      }

      const validHistory = Array.isArray(historyData) ? historyData.map(transformAlertHistory) : [];

      if (reset) {
        setHistory(validHistory);
        setPage(1);
      } else if (currentPage === 1) {
        setHistory(validHistory);
      } else {
        setHistory((prev) => [...prev, ...validHistory]);
      }

      setHasMore(validHistory.length === pageSize);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, page, rules.length]);

  useEffect(() => {
    if (accessToken) {
      fetchData(true);
    }
  }, [accessToken]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData(true);
  };

  const loadMore = () => {
    setPage((prev) => prev + 1);
    fetchData();
  };

  // Filter history
  const filteredHistory = history.filter((alert) => {
    // Severity filter
    if (severityFilter !== 'all' && alert.severity !== severityFilter) {
      return false;
    }

    // Rule filter
    if (ruleFilter !== 'all' && alert.ruleId !== ruleFilter) {
      return false;
    }

    // Date filter
    if (dateFilter !== 'all') {
      const alertDate = new Date(alert.triggeredAt);
      const now = new Date();

      if (dateFilter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (alertDate < today) return false;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (alertDate < weekAgo) return false;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (alertDate < monthAgo) return false;
      }
    }

    return true;
  });

  // Stats for filtered history
  const filteredStats = {
    total: filteredHistory.length,
    critical: filteredHistory.filter((h) => h.severity === 'critical').length,
    warning: filteredHistory.filter((h) => h.severity === 'warning').length,
    info: filteredHistory.filter((h) => h.severity === 'info').length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/alerts"
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                  <History className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold text-foreground">
                    Alert History
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    View past alerts and their details
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-white/10 bg-white/[0.01]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span className="text-sm">Filters:</span>
            </div>

            {/* Severity filter */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
              {severityFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setSeverityFilter(filter.key)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    ${severityFilter === filter.key
                      ? `bg-white/10 ${filter.color || 'text-foreground'}`
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }
                  `}
                >
                  {filter.icon}
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Date filter */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground focus:outline-none cursor-pointer"
              >
                {dateFilters.map((filter) => (
                  <option key={filter.key} value={filter.key} className="bg-zinc-900">
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rule filter */}
            {rules.length > 0 && (
              <select
                value={ruleFilter}
                onChange={(e) => setRuleFilter(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900">All Rules</option>
                {rules.map((rule) => (
                  <option key={rule.id} value={rule.id} className="bg-zinc-900">
                    {rule.name}
                  </option>
                ))}
              </select>
            )}

            {/* Clear filters */}
            {(severityFilter !== 'all' || dateFilter !== 'all' || ruleFilter !== 'all') && (
              <button
                onClick={() => {
                  setSeverityFilter('all');
                  setDateFilter('all');
                  setRuleFilter('all');
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b border-white/10 bg-white/[0.01]">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-muted-foreground">
              Showing <strong className="text-foreground">{filteredStats.total}</strong> alerts
            </span>
            {filteredStats.critical > 0 && (
              <span className="flex items-center gap-1.5 text-rose-400">
                <Zap className="w-3.5 h-3.5" />
                {filteredStats.critical} critical
              </span>
            )}
            {filteredStats.warning > 0 && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                {filteredStats.warning} warning
              </span>
            )}
            {filteredStats.info > 0 && (
              <span className="flex items-center gap-1.5 text-sky-400">
                <Info className="w-3.5 h-3.5" />
                {filteredStats.info} info
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <AlertHistoryTable history={filteredHistory} />

            {hasMore && filteredHistory.length >= pageSize && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  className="gap-2"
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
