'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PipelineList, PipelineCreator } from '@/components/pipelines';
import type {
  Pipeline,
  Credential,
  DiscoveredTable,
  CreatePipelineRequest,
} from '@/types';
import {
  GitBranch,
  Plus,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function PipelinesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [session, setSession] = useState<string | null>(null);

  // Get session from localStorage on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('session');
    setSession(storedSession);
  }, []);

  // State
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreator, setShowCreator] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch pipelines
  const fetchPipelines = useCallback(async (showRefreshLoader = false) => {
    if (!session) return;

    if (showRefreshLoader) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch(`${API_URL}/api/pipelines/?session=${session}`);
      if (response.ok) {
        const data = await response.json();
        // Transform snake_case to camelCase
        const transformed = (data || []).map((p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          sourceCredentialId: p.source_credential_id,
          sourceTables: p.source_tables,
          sourceConnectorName: p.source_connector_name,
          sinkType: p.sink_type,
          sinkConfig: p.sink_config,
          sinkConnectorName: p.sink_connector_name,
          templateId: p.template_id,
          status: p.status,
          lastHealthCheck: p.last_health_check,
          errorMessage: p.error_message,
          metricsCache: p.metrics_cache,
          metricsUpdatedAt: p.metrics_updated_at,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          startedAt: p.started_at,
          stoppedAt: p.stopped_at,
        }));
        setPipelines(transformed);
      }
    } catch (error) {
      console.error('Failed to fetch pipelines:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session, API_URL]);

  // Fetch credentials for the creator
  const fetchCredentials = useCallback(async () => {
    if (!session) return;

    try {
      const response = await fetch(`${API_URL}/api/credentials/?session=${session}`);
      if (response.ok) {
        const data = await response.json();
        const transformed = (data || []).map((cred: Record<string, unknown>) => ({
          id: cred.id,
          name: cred.name,
          sourceType: cred.source_type,
          host: cred.host,
          database: cred.database,
          port: cred.port,
          isValid: cred.is_valid,
          lastValidatedAt: cred.last_validated_at,
          createdAt: cred.created_at,
        }));
        setCredentials(transformed);
      }
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
    }
  }, [session, API_URL]);

  // Fetch tables for a credential
  const fetchTables = useCallback(async (credentialId: string): Promise<DiscoveredTable[]> => {
    if (!session) return [];

    try {
      const response = await fetch(`${API_URL}/api/sources/discover?session=${session}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential_id: credentialId,
          schema_filter: 'public',
          include_row_counts: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return (data.tables || []).map((t: Record<string, unknown>) => ({
          tableName: t.table_name,
          schemaName: t.schema_name || data.schema_name,
          columns: ((t.columns as Array<Record<string, unknown>>) || []).map((c) => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable !== false,
            default: c.column_default,
            isPk: ((t.primary_keys as string[]) || []).includes(c.column_name as string),
          })),
          primaryKeys: t.primary_keys || [],
          foreignKeys: [],
          rowCountEstimate: t.row_count_estimate as number | undefined,
          hasPrimaryKey: t.has_primary_key as boolean,
          cdcEligible: t.cdc_eligible as boolean,
          cdcIssues: (t.cdc_issues as string[]) || [],
        }));
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
    return [];
  }, [session, API_URL]);

  // Create pipeline
  const handleCreatePipeline = async (data: CreatePipelineRequest): Promise<{ success: boolean; message?: string }> => {
    if (!session) return { success: false, message: 'Not authenticated' };

    try {
      const response = await fetch(`${API_URL}/api/pipelines/?session=${session}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          source_credential_id: data.sourceCredentialId,
          source_tables: data.sourceTables,
          sink_type: data.sinkType,
          sink_config: data.sinkConfig,
          template_id: data.templateId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        await fetchPipelines();
        return { success: true };
      } else {
        return { success: false, message: result.detail || 'Failed to create pipeline' };
      }
    } catch (error) {
      console.error('Failed to create pipeline:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  // Pipeline actions
  const handleStartPipeline = async (id: string) => {
    if (!session) return;

    try {
      await fetch(`${API_URL}/api/pipelines/${id}/start?session=${session}`, {
        method: 'POST',
      });
      await fetchPipelines();
    } catch (error) {
      console.error('Failed to start pipeline:', error);
    }
  };

  const handleStopPipeline = async (id: string) => {
    if (!session) return;

    try {
      await fetch(`${API_URL}/api/pipelines/${id}/stop?session=${session}`, {
        method: 'POST',
      });
      await fetchPipelines();
    } catch (error) {
      console.error('Failed to stop pipeline:', error);
    }
  };

  const handlePausePipeline = async (id: string) => {
    if (!session) return;

    try {
      await fetch(`${API_URL}/api/pipelines/${id}/pause?session=${session}`, {
        method: 'POST',
      });
      await fetchPipelines();
    } catch (error) {
      console.error('Failed to pause pipeline:', error);
    }
  };

  const handleSelectPipeline = (pipeline: Pipeline) => {
    router.push(`/dashboard/pipelines/${pipeline.id}`);
  };

  // Initial fetch
  useEffect(() => {
    if (user && session) {
      fetchPipelines();
      fetchCredentials();
    }
  }, [user, session, fetchPipelines, fetchCredentials]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="shrink-0 px-6 py-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <GitBranch className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                CDC Pipelines
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your real-time data streaming pipelines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => fetchPipelines(true)}
              disabled={isRefreshing}
              className="gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </Button>
            <Button
              onClick={() => setShowCreator(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Pipeline
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {pipelines.length > 0 && (
        <div className="shrink-0 px-6 py-3 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-muted-foreground">
                {pipelines.filter(p => p.status === 'running').length} Running
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm text-muted-foreground">
                {pipelines.filter(p => p.status === 'paused').length} Paused
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-muted-foreground">
                {pipelines.filter(p => p.status === 'failed').length} Failed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
              <span className="text-sm text-muted-foreground">
                {pipelines.filter(p => p.status === 'stopped' || p.status === 'pending').length} Stopped
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <PipelineList
          pipelines={pipelines}
          isLoading={isLoading}
          onSelect={handleSelectPipeline}
          onStart={handleStartPipeline}
          onStop={handleStopPipeline}
          onPause={handlePausePipeline}
          onCreateNew={() => setShowCreator(true)}
        />
      </main>

      {/* Pipeline Creator Modal */}
      <PipelineCreator
        isOpen={showCreator}
        onClose={() => setShowCreator(false)}
        onSubmit={handleCreatePipeline}
        credentials={credentials}
        onFetchTables={fetchTables}
      />
    </div>
  );
}
