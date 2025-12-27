'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PipelineHealth, PipelineMetrics, PipelineControls } from '@/components/pipelines';
import { EnrichmentList } from '@/components/enrichments/EnrichmentList';
import type {
  Pipeline,
  PipelineHealth as PipelineHealthType,
  PipelineMetrics as PipelineMetricsType,
  PipelineEvent,
  PipelineStatus,
  Enrichment,
} from '@/types';
import {
  ArrowLeft,
  GitBranch,
  Database,
  Server,
  Clock,
  Activity,
  Loader2,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  History,
  Layers,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow } from 'date-fns';

type TabType = 'overview' | 'health' | 'metrics' | 'enrichments' | 'events' | 'settings';

const statusConfig: Record<PipelineStatus, { color: string; bgColor: string; label: string }> = {
  running: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    label: 'Running',
  },
  paused: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
    label: 'Paused',
  },
  stopped: {
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10 border-zinc-500/30',
    label: 'Stopped',
  },
  failed: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
    label: 'Failed',
  },
  pending: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    label: 'Pending',
  },
};

export default function PipelineDetailPage() {
  const router = useRouter();
  const params = useParams();
  const pipelineId = params.id as string;
  const { user } = useAuthStore();
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Use JWT access_token for authentication
    const storedToken = localStorage.getItem('access_token');
    setAccessToken(storedToken);
  }, []);

  // State
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [health, setHealth] = useState<PipelineHealthType | null>(null);
  const [metrics, setMetrics] = useState<PipelineMetricsType | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [enrichments, setEnrichments] = useState<Enrichment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingEnrichments, setIsLoadingEnrichments] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch pipeline
  const fetchPipeline = useCallback(async () => {
    if (!accessToken || !pipelineId) return;

    try {
      const response = await fetch(`${API_URL}/api/pipelines/${pipelineId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPipeline({
          id: data.id,
          name: data.name,
          description: data.description,
          sourceCredentialId: data.source_credential_id,
          sourceTables: data.source_tables,
          sourceConnectorName: data.source_connector_name,
          sinkType: data.sink_type,
          sinkConfig: data.sink_config,
          sinkConnectorName: data.sink_connector_name,
          templateId: data.template_id,
          status: data.status,
          lastHealthCheck: data.last_health_check,
          errorMessage: data.error_message,
          metricsCache: data.metrics_cache,
          metricsUpdatedAt: data.metrics_updated_at,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          startedAt: data.started_at,
          stoppedAt: data.stopped_at,
        });
      } else if (response.status === 404) {
        router.push('/dashboard/pipelines');
      }
    } catch (error) {
      console.error('Failed to fetch pipeline:', error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, pipelineId, API_URL, router]);

  // Fetch health
  const fetchHealth = useCallback(async () => {
    if (!accessToken || !pipelineId) return;

    setIsLoadingHealth(true);
    try {
      const response = await fetch(`${API_URL}/api/pipelines/${pipelineId}/health`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();

        // Extract connector status - handle both Confluent API response and mock objects
        type ConnectorStatus = 'running' | 'paused' | 'failed' | 'unknown';
        const extractConnectorStatus = (connector: Record<string, unknown> | null): ConnectorStatus => {
          if (!connector) return 'unknown';
          const status = connector.status;
          let statusStr = 'unknown';
          if (typeof status === 'string') statusStr = status.toLowerCase();
          else if (typeof status === 'object' && status !== null) {
            // Confluent API returns: { connector: { state: 'RUNNING' } }
            const connectorObj = (status as Record<string, unknown>).connector as Record<string, unknown> | undefined;
            if (connectorObj?.state) statusStr = String(connectorObj.state).toLowerCase();
            // Or simple mock: { status: 'running' }
            else if ((status as Record<string, unknown>).status) statusStr = String((status as Record<string, unknown>).status).toLowerCase();
          }
          // Map to allowed values
          if (['running', 'paused', 'failed'].includes(statusStr)) return statusStr as ConnectorStatus;
          return 'unknown';
        };

        const extractTaskCount = (connector: Record<string, unknown> | null): number | undefined => {
          if (!connector) return undefined;
          const status = connector.status;
          if (typeof status === 'object' && status !== null) {
            const statusObj = status as Record<string, unknown>;
            if (statusObj.tasks && Array.isArray(statusObj.tasks)) {
              return statusObj.tasks.length;
            }
          }
          return connector.task_count as number | undefined;
        };

        setHealth({
          pipelineId: data.pipeline_id,
          status: data.status?.toLowerCase() || data.pipeline_status?.toLowerCase() || 'unknown',
          sourceConnector: {
            name: data.source_connector?.name,
            status: extractConnectorStatus(data.source_connector),
            taskCount: extractTaskCount(data.source_connector),
            failedTasks: data.source_connector?.failed_tasks,
          },
          sinkConnector: {
            name: data.sink_connector?.name,
            status: extractConnectorStatus(data.sink_connector),
            taskCount: extractTaskCount(data.sink_connector),
            failedTasks: data.sink_connector?.failed_tasks,
          },
          lastCheck: data.last_health_check || data.last_check,
          errors: (data.errors || []).map((e: Record<string, unknown>) => ({
            timestamp: e.timestamp,
            component: e.component,
            message: e.message,
            details: e.details,
          })),
        });
      }
    } catch (error) {
      console.error('Failed to fetch health:', error);
    } finally {
      setIsLoadingHealth(false);
    }
  }, [accessToken, pipelineId, API_URL]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    if (!accessToken || !pipelineId) return;

    setIsLoadingMetrics(true);
    try {
      const response = await fetch(`${API_URL}/api/pipelines/${pipelineId}/metrics`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMetrics({
          pipelineId: data.pipeline_id,
          lag: data.lag || { currentMs: 0, avgMs: 0, maxMs: 0 },
          throughput: data.throughput || { eventsPerSecond: 0, bytesPerSecond: 0, totalEvents: 0 },
          windowSeconds: data.window_seconds || 60,
          updatedAt: data.updated_at,
        });
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [accessToken, pipelineId, API_URL]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    if (!accessToken || !pipelineId) return;

    setIsLoadingEvents(true);
    try {
      const response = await fetch(`${API_URL}/api/pipelines/${pipelineId}/events?limit=50`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEvents((data || []).map((e: Record<string, unknown>) => ({
          id: e.id,
          pipelineId: e.pipeline_id,
          eventType: e.event_type,
          message: e.message,
          details: e.details,
          createdAt: e.created_at,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [accessToken, pipelineId, API_URL]);

  // Fetch enrichments
  const fetchEnrichments = useCallback(async () => {
    if (!accessToken || !pipelineId) return;

    setIsLoadingEnrichments(true);
    try {
      const response = await fetch(`${API_URL}/api/enrichments?pipeline_id=${pipelineId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEnrichments((data || []).map((e: Record<string, unknown>) => ({
          id: e.id,
          pipelineId: e.pipeline_id,
          name: e.name,
          description: e.description,
          sourceStreamName: e.source_stream_name,
          sourceTopic: e.source_topic,
          lookupTables: e.lookup_tables || [],
          joinType: e.join_type || 'LEFT',
          joinKeys: e.join_keys || [],
          outputColumns: e.output_columns || [],
          outputStreamName: e.output_stream_name,
          outputTopic: e.output_topic,
          ksqldbQueryId: e.ksqldb_query_id,
          status: e.status,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
          activatedAt: e.activated_at,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch enrichments:', error);
    } finally {
      setIsLoadingEnrichments(false);
    }
  }, [accessToken, pipelineId, API_URL]);

  // Enrichment actions
  const handleActivateEnrichment = async (enrichmentId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/enrichments/${enrichmentId}/activate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        await fetchEnrichments();
      }
    } catch (error) {
      console.error('Failed to activate enrichment:', error);
    }
  };

  const handleDeactivateEnrichment = async (enrichmentId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/enrichments/${enrichmentId}/deactivate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        await fetchEnrichments();
      }
    } catch (error) {
      console.error('Failed to deactivate enrichment:', error);
    }
  };

  const handleDeleteEnrichment = async (enrichmentId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/enrichments/${enrichmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        await fetchEnrichments();
      }
    } catch (error) {
      console.error('Failed to delete enrichment:', error);
    }
  };

  // Pipeline actions
  const handleStart = async () => {
    if (!accessToken || !pipelineId) return;

    try {
      await fetch(`${API_URL}/api/pipelines/${pipelineId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      await fetchPipeline();
    } catch (error) {
      console.error('Failed to start pipeline:', error);
    }
  };

  const handleStop = async () => {
    if (!accessToken || !pipelineId) return;

    try {
      await fetch(`${API_URL}/api/pipelines/${pipelineId}/stop`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      await fetchPipeline();
    } catch (error) {
      console.error('Failed to stop pipeline:', error);
    }
  };

  const handlePause = async () => {
    if (!accessToken || !pipelineId) return;

    try {
      await fetch(`${API_URL}/api/pipelines/${pipelineId}/pause`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      await fetchPipeline();
    } catch (error) {
      console.error('Failed to pause pipeline:', error);
    }
  };

  const handleResume = async () => {
    if (!accessToken || !pipelineId) return;

    try {
      await fetch(`${API_URL}/api/pipelines/${pipelineId}/resume`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      await fetchPipeline();
    } catch (error) {
      console.error('Failed to resume pipeline:', error);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !pipelineId) return;

    try {
      const response = await fetch(`${API_URL}/api/pipelines/${pipelineId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        router.push('/dashboard/pipelines');
      }
    } catch (error) {
      console.error('Failed to delete pipeline:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (user && accessToken) {
      fetchPipeline();
    }
  }, [user, accessToken, fetchPipeline]);

  // Fetch tab-specific data
  useEffect(() => {
    if (!pipeline) return;

    if (activeTab === 'health') {
      fetchHealth();
    } else if (activeTab === 'metrics') {
      fetchMetrics();
    } else if (activeTab === 'events') {
      fetchEvents();
    } else if (activeTab === 'enrichments') {
      fetchEnrichments();
    }
  }, [activeTab, pipeline, fetchHealth, fetchMetrics, fetchEvents, fetchEnrichments]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-foreground mb-2">Pipeline Not Found</h2>
          <p className="text-muted-foreground mb-4">The pipeline you&apos;re looking for doesn&apos;t exist.</p>
          <Button onClick={() => router.push('/dashboard/pipelines')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pipelines
          </Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[pipeline.status];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/pipelines')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Pipelines
          </Button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{pipeline.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${status.bgColor}`}>
              <GitBranch className={`w-6 h-6 ${status.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold text-foreground">
                  {pipeline.name}
                </h1>
                <div className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${status.bgColor} ${status.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    pipeline.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-current'
                  }`} />
                  {status.label}
                </div>
              </div>
              {pipeline.description && (
                <p className="text-sm text-muted-foreground mt-1">{pipeline.description}</p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={fetchPipeline}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="shrink-0 px-6 border-b border-white/5 bg-white/[0.01]">
        <div className="flex gap-1">
          {[
            { key: 'overview', label: 'Overview', icon: <GitBranch className="w-4 h-4" /> },
            { key: 'health', label: 'Health', icon: <Activity className="w-4 h-4" /> },
            { key: 'metrics', label: 'Metrics', icon: <Activity className="w-4 h-4" /> },
            { key: 'enrichments', label: 'Enrichments', icon: <GitBranch className="w-4 h-4 rotate-180" /> },
            { key: 'events', label: 'Events', icon: <History className="w-4 h-4" /> },
            { key: 'settings', label: 'Settings', icon: <Server className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`
                px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors
                ${activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Left Column - Pipeline Info */}
            <div className="col-span-2 space-y-6">
              {/* Pipeline Flow */}
              <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                <h3 className="text-sm font-medium text-foreground mb-4">Pipeline Flow</h3>
                <div className="flex items-center gap-4">
                  {/* Source */}
                  <div className="flex-1 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-foreground">Source</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">PostgreSQL</div>
                    <div className="space-y-1">
                      {pipeline.sourceTables.slice(0, 3).map((table, i) => (
                        <code key={i} className="block text-xs font-mono text-blue-300 bg-black/20 px-2 py-1 rounded">
                          {table}
                        </code>
                      ))}
                      {pipeline.sourceTables.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{pipeline.sourceTables.length - 3} more tables
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0">
                    <ChevronRight className="w-6 h-6 text-muted-foreground" />
                  </div>

                  {/* Kafka */}
                  <div className="flex-1 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium text-foreground">Kafka</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">Confluent Cloud</div>
                    <div className="text-xs text-purple-300">
                      {pipeline.sourceTables.length} topic{pipeline.sourceTables.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0">
                    <ChevronRight className="w-6 h-6 text-muted-foreground" />
                  </div>

                  {/* Sink */}
                  <div className="flex-1 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Server className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium text-foreground capitalize">{pipeline.sinkType}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {pipeline.sinkConfig.host}:{pipeline.sinkConfig.port}
                    </div>
                    <div className="text-xs text-amber-300">
                      {pipeline.sinkConfig.database}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Created</span>
                  </div>
                  <div className="text-sm text-foreground">
                    {formatDistanceToNow(new Date(pipeline.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Last Updated</span>
                  </div>
                  <div className="text-sm text-foreground">
                    {formatDistanceToNow(new Date(pipeline.updatedAt), { addSuffix: true })}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tables</span>
                  </div>
                  <div className="text-sm text-foreground">
                    {pipeline.sourceTables.length} syncing
                  </div>
                </div>
              </div>

              {/* Template Info */}
              {pipeline.templateId && (
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground">Pipeline Template</h4>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      This pipeline is using a transformation template
                    </p>
                    <code className="text-xs font-mono text-indigo-300 mt-2 block">
                      ID: {pipeline.templateId}
                    </code>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {pipeline.errorMessage && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-300 mb-1">Error</h4>
                    <p className="text-sm text-red-200">{pipeline.errorMessage}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Controls */}
            <div>
              <PipelineControls
                pipeline={pipeline}
                onStart={async () => handleStart()}
                onStop={async () => handleStop()}
                onPause={async () => handlePause()}
                onResume={async () => handleResume()}
                onDelete={async () => handleDelete()}
              />
            </div>
          </div>
        )}

        {/* Health Tab */}
        {activeTab === 'health' && (
          <PipelineHealth
            health={health}
            isLoading={isLoadingHealth}
            onRefresh={fetchHealth}
          />
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <PipelineMetrics
            metrics={metrics}
            isLoading={isLoadingMetrics}
            onRefresh={fetchMetrics}
          />
        )}

        {/* Enrichments Tab */}
        {activeTab === 'enrichments' && (
          <EnrichmentList
            enrichments={enrichments}
            isLoading={isLoadingEnrichments}
            onActivate={handleActivateEnrichment}
            onDeactivate={handleDeactivateEnrichment}
            onDelete={handleDeleteEnrichment}
            onCreateNew={() => router.push(`/dashboard/pipelines/${pipelineId}/enrichments/new`)}
          />
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-foreground">Event History</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchEvents}
                disabled={isLoadingEvents}
                className="gap-2"
              >
                {isLoadingEvents ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </Button>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No events recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg bg-black/20 border border-white/5 flex items-start gap-3"
                  >
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                      ${event.eventType === 'started' || event.eventType === 'resumed'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : event.eventType === 'failed' || event.eventType === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : event.eventType === 'paused'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-white/5 text-muted-foreground'}
                    `}>
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground capitalize">
                          {event.eventType.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {event.message && (
                        <p className="text-xs text-muted-foreground mt-1">{event.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <h3 className="font-display font-semibold text-foreground mb-6">Pipeline Configuration</h3>

            <div className="space-y-6">
              {/* Source Config */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Source Configuration</h4>
                <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credential ID</span>
                    <code className="text-foreground font-mono text-xs">{pipeline.sourceCredentialId}</code>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tables</span>
                    <span className="text-foreground">{pipeline.sourceTables.length}</span>
                  </div>
                  {pipeline.sourceConnectorName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Connector</span>
                      <code className="text-foreground font-mono text-xs">{pipeline.sourceConnectorName}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Sink Config */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Sink Configuration</h4>
                <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-foreground capitalize">{pipeline.sinkType}</span>
                  </div>
                  {pipeline.sinkConfig.host && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Host</span>
                      <code className="text-foreground font-mono text-xs">
                        {pipeline.sinkConfig.host}:{pipeline.sinkConfig.port}
                      </code>
                    </div>
                  )}
                  {pipeline.sinkConfig.database && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Database</span>
                      <code className="text-foreground font-mono text-xs">{pipeline.sinkConfig.database}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
