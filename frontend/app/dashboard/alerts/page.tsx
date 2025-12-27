'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertStats, AlertHistoryTable, AlertRuleList, AlertRuleForm } from '@/components/alerts';
import { Button } from '@/components/ui/button';
import type { AlertRule, AlertHistory, AlertStats as AlertStatsType, Pipeline, CreateAlertRuleRequest } from '@/types';
import {
  Bell,
  Plus,
  ArrowRight,
  History,
  Settings,
  Loader2,
  RefreshCw,
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

export default function AlertsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get access token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    setAccessToken(storedToken);
  }, []);

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [stats, setStats] = useState<AlertStatsType | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };

      // Fetch all data in parallel
      const [rulesRes, historyRes, pipelinesRes] = await Promise.all([
        fetch(`${API_URL}/api/alerts/rules`, { headers }),
        fetch(`${API_URL}/api/alerts/history?limit=10`, { headers }),
        fetch(`${API_URL}/api/pipelines`, { headers }),
      ]);

      // Handle potential error responses
      const rulesData = rulesRes.ok ? await rulesRes.json() : [];
      const historyData = historyRes.ok ? await historyRes.json() : [];
      const pipelinesData = pipelinesRes.ok ? await pipelinesRes.json() : [];

      setRules(Array.isArray(rulesData) ? rulesData.map(transformAlertRule) : []);
      setHistory(Array.isArray(historyData) ? historyData.map(transformAlertHistory) : []);
      setPipelines(Array.isArray(pipelinesData) ? pipelinesData : []);

      // Calculate stats from transformed data
      const validHistory = Array.isArray(historyData) ? historyData.map(transformAlertHistory) : [];
      const validRules = Array.isArray(rulesData) ? rulesData.map(transformAlertRule) : [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const alertsToday = validHistory.filter((h: AlertHistory) =>
        new Date(h.triggeredAt) >= today
      ).length;
      const alertsThisWeek = validHistory.filter((h: AlertHistory) =>
        new Date(h.triggeredAt) >= weekAgo
      ).length;

      const bySeverity = validHistory.reduce(
        (acc: { info: number; warning: number; critical: number }, h: AlertHistory) => {
          acc[h.severity] = (acc[h.severity] || 0) + 1;
          return acc;
        },
        { info: 0, warning: 0, critical: 0 }
      );

      setStats({
        totalRules: validRules.length,
        activeRules: validRules.filter((r: AlertRule) => r.isActive).length,
        alertsToday,
        alertsThisWeek,
        bySeverity,
      });
    } catch (error) {
      console.error('Failed to fetch alerts data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleCreateRule = async (data: CreateAlertRuleRequest) => {
    if (!accessToken) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/alerts/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          pipeline_id: data.pipelineId,
          rule_type: data.ruleType,
          threshold_config: data.thresholdConfig,
          severity: data.severity,
          recipients: data.recipients,
          enabled_days: data.enabledDays,
          enabled_hours: data.enabledHours,
          cooldown_minutes: data.cooldownMinutes,
          is_active: data.isActive,
        }),
      });

      if (response.ok) {
        setShowCreateForm(false);
        fetchData();
      } else {
        const error = await response.json();
        console.error('Failed to create rule:', error);
      }
    } catch (error) {
      console.error('Failed to create rule:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (ruleId: string, active: boolean) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/alerts/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ is_active: active }),
      });

      if (response.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, isActive: active } : r))
        );
        // Update stats
        if (stats) {
          setStats({
            ...stats,
            activeRules: active ? stats.activeRules + 1 : stats.activeRules - 1,
          });
        }
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleTestRule = async (ruleId: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/alerts/rules/${ruleId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to test rule:', error);
      return false;
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!accessToken) return;
    if (!confirm('Are you sure you want to delete this alert rule?')) return;

    try {
      const response = await fetch(`${API_URL}/api/alerts/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
        fetchData(); // Refresh stats
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
                <Bell className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground">
                  Alerts
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Monitor your pipelines and get notified of anomalies
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
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
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
              >
                <Plus className="w-4 h-4" />
                New Alert Rule
              </Button>
            </div>
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
          <div className="space-y-8">
            {/* Stats */}
            <AlertStats stats={stats} />

            {/* Quick links */}
            <div className="grid gap-4 md:grid-cols-3">
              <Link
                href="/dashboard/alerts/rules"
                className="group p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Manage Rules</h3>
                      <p className="text-sm text-muted-foreground">
                        {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </div>
              </Link>

              <Link
                href="/dashboard/alerts/history"
                className="group p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <History className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Alert History</h3>
                      <p className="text-sm text-muted-foreground">
                        View past alerts and details
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </div>
              </Link>

              <button
                onClick={() => setShowCreateForm(true)}
                className="group p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/30 hover:from-amber-500/15 hover:to-orange-500/15 transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Create Rule</h3>
                      <p className="text-sm text-muted-foreground">
                        Set up a new alert
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-amber-400/50 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            </div>

            {/* Active Rules Preview */}
            {rules.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Active Rules</h2>
                  <Link
                    href="/dashboard/alerts/rules"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View all →
                  </Link>
                </div>
                <AlertRuleList
                  rules={rules.filter((r) => r.isActive).slice(0, 6)}
                  onToggleActive={handleToggleActive}
                  onTest={handleTestRule}
                  onDelete={handleDeleteRule}
                  onEdit={(rule) => router.push(`/dashboard/alerts/rules?edit=${rule.id}`)}
                  onCreateNew={() => setShowCreateForm(true)}
                />
              </div>
            )}

            {/* Recent Alerts */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Recent Alerts</h2>
                <Link
                  href="/dashboard/alerts/history"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all →
                </Link>
              </div>
              <AlertHistoryTable history={history.slice(0, 5)} />
            </div>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <AlertRuleForm
          pipelines={pipelines}
          onSubmit={handleCreateRule}
          onCancel={() => setShowCreateForm(false)}
          isLoading={isCreating}
        />
      )}
    </div>
  );
}
