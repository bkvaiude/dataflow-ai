'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EnrichmentList } from '@/components/enrichments';
import type { Enrichment, Pipeline } from '@/types';
import {
  ArrowLeft,
  ChevronRight,
  GitMerge,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function PipelineEnrichmentsPage() {
  const router = useRouter();
  const params = useParams();
  const pipelineId = params.id as string;
  const { user } = useAuthStore();
  const [session, setSession] = useState<string | null>(null);

  useEffect(() => {
    const storedSession = localStorage.getItem('session');
    setSession(storedSession);
  }, []);

  // State
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [enrichments, setEnrichments] = useState<Enrichment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEnrichments, setIsLoadingEnrichments] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch pipeline
  const fetchPipeline = useCallback(async () => {
    if (!session || !pipelineId) return;

    try {
      const response = await fetch(`${API_URL}/api/pipelines/${pipelineId}?session=${session}`);
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
  }, [session, pipelineId, API_URL, router]);

  // Fetch enrichments
  const fetchEnrichments = useCallback(async () => {
    if (!session || !pipelineId) return;

    setIsLoadingEnrichments(true);
    try {
      const response = await fetch(
        `${API_URL}/api/enrichments?pipeline_id=${pipelineId}&session=${session}`
      );
      if (response.ok) {
        const data = await response.json();
        setEnrichments(
          (data || []).map((e: Record<string, unknown>) => ({
            id: e.id,
            pipelineId: e.pipeline_id,
            name: e.name,
            description: e.description,
            sourceStreamName: e.source_stream_name,
            sourceTopic: e.source_topic,
            lookupTables: e.lookup_tables,
            joinType: e.join_type,
            joinKeys: e.join_keys,
            outputColumns: e.output_columns,
            outputStreamName: e.output_stream_name,
            outputTopic: e.output_topic,
            ksqldbQueryId: e.ksqldb_query_id,
            status: e.status,
            createdAt: e.created_at,
            updatedAt: e.updated_at,
            activatedAt: e.activated_at,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch enrichments:', error);
    } finally {
      setIsLoadingEnrichments(false);
    }
  }, [session, pipelineId, API_URL]);

  // Enrichment actions
  const handleActivate = async (id: string) => {
    if (!session) return;

    try {
      const response = await fetch(
        `${API_URL}/api/enrichments/${id}/activate?session=${session}`,
        { method: 'POST' }
      );
      if (response.ok) {
        await fetchEnrichments();
      }
    } catch (error) {
      console.error('Failed to activate enrichment:', error);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!session) return;

    try {
      const response = await fetch(
        `${API_URL}/api/enrichments/${id}/deactivate?session=${session}`,
        { method: 'POST' }
      );
      if (response.ok) {
        await fetchEnrichments();
      }
    } catch (error) {
      console.error('Failed to deactivate enrichment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!session) return;

    try {
      const response = await fetch(
        `${API_URL}/api/enrichments/${id}?session=${session}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        await fetchEnrichments();
      }
    } catch (error) {
      console.error('Failed to delete enrichment:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (user && session) {
      fetchPipeline();
      fetchEnrichments();
    }
  }, [user, session, fetchPipeline, fetchEnrichments]);

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/pipelines/${pipelineId}`)}
            className="text-muted-foreground hover:text-foreground"
          >
            {pipeline.name}
          </Button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">Enrichments</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
              <GitMerge className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                Stream Enrichments
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enrich {pipeline.name} data with lookup tables
              </p>
            </div>
          </div>

          <Button
            onClick={() => router.push(`/dashboard/pipelines/${pipelineId}/enrichments/new`)}
            className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            New Enrichment
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <EnrichmentList
          enrichments={enrichments}
          isLoading={isLoadingEnrichments}
          onSelectEnrichment={(e) => router.push(`/dashboard/pipelines/${pipelineId}/enrichments/${e.id}`)}
          onActivate={handleActivate}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
          onCreateNew={() => router.push(`/dashboard/pipelines/${pipelineId}/enrichments/new`)}
        />
      </main>
    </div>
  );
}
