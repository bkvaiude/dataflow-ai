'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertRuleList, AlertRuleForm } from '@/components/alerts';
import { Button } from '@/components/ui/button';
import type { AlertRule, Pipeline, CreateAlertRuleRequest } from '@/types';
import {
  ArrowLeft,
  Bell,
  Plus,
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

export default function AlertRulesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get access token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    setAccessToken(storedToken);
  }, []);
  const editRuleId = searchParams.get('edit');

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };

      const [rulesRes, pipelinesRes] = await Promise.all([
        fetch(`${API_URL}/api/alerts/rules`, { headers }),
        fetch(`${API_URL}/api/pipelines`, { headers }),
      ]);

      const rulesData = rulesRes.ok ? await rulesRes.json() : [];
      const pipelinesData = pipelinesRes.ok ? await pipelinesRes.json() : [];

      const transformedRules = Array.isArray(rulesData) ? rulesData.map(transformAlertRule) : [];
      setRules(transformedRules);
      setPipelines(Array.isArray(pipelinesData) ? pipelinesData : []);

      // Check if we need to edit a rule
      if (editRuleId && transformedRules.length > 0) {
        const ruleToEdit = transformedRules.find((r: AlertRule) => r.id === editRuleId);
        if (ruleToEdit) {
          setEditingRule(ruleToEdit);
          setShowForm(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, editRuleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleCreateOrUpdate = async (data: CreateAlertRuleRequest) => {
    if (!accessToken) return;

    setIsSubmitting(true);
    try {
      const payload = {
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
      };

      const url = editingRule
        ? `${API_URL}/api/alerts/rules/${editingRule.id}`
        : `${API_URL}/api/alerts/rules`;

      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowForm(false);
        setEditingRule(undefined);
        // Clear edit param from URL
        if (editRuleId) {
          router.replace('/dashboard/alerts/rules');
        }
        fetchData();
      } else {
        const error = await response.json();
        console.error('Failed to save rule:', error);
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setIsSubmitting(false);
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
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRule(undefined);
    // Clear edit param from URL
    if (editRuleId) {
      router.replace('/dashboard/alerts/rules');
    }
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
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold text-foreground">
                    Alert Rules
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Configure when and how you get notified
                  </p>
                </div>
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
                onClick={() => {
                  setEditingRule(undefined);
                  setShowForm(true);
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
              >
                <Plus className="w-4 h-4" />
                New Rule
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
          <AlertRuleList
            rules={rules}
            onEdit={handleEdit}
            onTest={handleTestRule}
            onDelete={handleDeleteRule}
            onToggleActive={handleToggleActive}
            onCreateNew={() => {
              setEditingRule(undefined);
              setShowForm(true);
            }}
          />
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <AlertRuleForm
          rule={editingRule}
          pipelines={pipelines}
          onSubmit={handleCreateOrUpdate}
          onCancel={handleCloseForm}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}
