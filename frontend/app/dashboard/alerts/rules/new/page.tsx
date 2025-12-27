'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertRuleForm } from '@/components/alerts';
import type { Pipeline, CreateAlertRuleRequest } from '@/types';
import {
  ArrowLeft,
  Bell,
  Loader2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function NewAlertRulePage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get access token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    setAccessToken(storedToken);
  }, []);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPipelines = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/pipelines`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPipelines(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch pipelines:', error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const handleCreate = async (data: CreateAlertRuleRequest) => {
    if (!accessToken) return;

    setIsSubmitting(true);
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
        router.push('/dashboard/alerts/rules');
      } else {
        const error = await response.json();
        console.error('Failed to create rule:', error);
      }
    } catch (error) {
      console.error('Failed to create rule:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/alerts/rules"
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
                <Bell className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground">
                  Create Alert Rule
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Set up a new alert to monitor your pipelines
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form in page content (not modal) */}
      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <div className="rounded-2xl bg-zinc-900/50 border border-white/10 overflow-hidden">
          <AlertRuleForm
            pipelines={pipelines}
            onSubmit={handleCreate}
            onCancel={() => router.push('/dashboard/alerts/rules')}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
