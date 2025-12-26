'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EnrichmentCreator } from '@/components/enrichments';
import type {
  Pipeline,
  ColumnInfo,
  LookupTable,
  JoinKey,
  CreateEnrichmentRequest,
  EnrichmentPreview,
} from '@/types';
import {
  ArrowLeft,
  ChevronRight,
  GitMerge,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface AvailableStream {
  topic: string;
  name: string;
  columns: ColumnInfo[];
}

interface AvailableTable {
  topic: string;
  name: string;
  keyColumn: string;
  schema: ColumnInfo[];
  rowEstimate?: number;
}

export default function NewEnrichmentPage() {
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
  const [isLoading, setIsLoading] = useState(true);
  const [availableStreams, setAvailableStreams] = useState<AvailableStream[]>([]);
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([]);

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

        // Generate available streams from pipeline source tables
        const streams: AvailableStream[] = data.source_tables.map((table: string) => ({
          topic: `dataflow.${data.source_connector_name || 'source'}.${table.replace('.', '_')}`,
          name: table.split('.').pop() || table,
          columns: [
            // Mock columns - in production these would come from schema discovery
            { name: 'id', type: 'BIGINT', nullable: false, isPk: true },
            { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPk: false },
            { name: 'updated_at', type: 'TIMESTAMP', nullable: true, isPk: false },
          ],
        }));
        setAvailableStreams(streams);

        // Generate available lookup tables (from same source)
        const tables: AvailableTable[] = data.source_tables.map((table: string) => ({
          topic: `dataflow.${data.source_connector_name || 'source'}.${table.replace('.', '_')}`,
          name: table.split('.').pop() || table,
          keyColumn: 'id',
          schema: [
            { name: 'id', type: 'BIGINT', nullable: false, isPk: true },
            { name: 'name', type: 'VARCHAR', nullable: true, isPk: false },
            { name: 'email', type: 'VARCHAR', nullable: true, isPk: false },
            { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPk: false },
          ],
          rowEstimate: 10000,
        }));
        setAvailableTables(tables);
      } else if (response.status === 404) {
        router.push('/dashboard/pipelines');
      }
    } catch (error) {
      console.error('Failed to fetch pipeline:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session, pipelineId, API_URL, router]);

  // Create enrichment
  const handleCreateEnrichment = async (
    data: CreateEnrichmentRequest
  ): Promise<{ success: boolean; message?: string }> => {
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${API_URL}/api/enrichments?session=${session}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: data.pipelineId,
          name: data.name,
          description: data.description,
          source_topic: data.sourceTopic,
          lookup_tables: data.lookupTables.map((t) => ({
            topic: t.topic,
            key: t.key,
            alias: t.alias,
            ksqldb_table: t.ksqldbTable,
          })),
          join_keys: data.joinKeys.map((k) => ({
            stream_column: k.streamColumn,
            table_column: k.tableColumn,
            table_alias: k.tableAlias,
          })),
          output_columns: data.outputColumns,
          join_type: data.joinType || 'LEFT',
        }),
      });

      if (response.ok) {
        router.push(`/dashboard/pipelines/${pipelineId}/enrichments`);
        return { success: true };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          message: errorData.detail || 'Failed to create enrichment',
        };
      }
    } catch (error) {
      console.error('Failed to create enrichment:', error);
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  // Fetch preview
  const handleFetchPreview = async (config: {
    sourceTopic: string;
    lookupTables: LookupTable[];
    joinKeys: JoinKey[];
    outputColumns: string[];
    joinType: 'LEFT' | 'INNER';
  }): Promise<EnrichmentPreview> => {
    if (!session) {
      return {
        sampleData: [],
        rowCount: 0,
        nullStats: {},
        warnings: ['Not authenticated'],
      };
    }

    try {
      const response = await fetch(`${API_URL}/api/enrichments/preview?session=${session}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_topic: config.sourceTopic,
          lookup_tables: config.lookupTables.map((t) => ({
            topic: t.topic,
            key: t.key,
            alias: t.alias,
          })),
          join_keys: config.joinKeys.map((k) => ({
            stream_column: k.streamColumn,
            table_column: k.tableColumn,
            table_alias: k.tableAlias,
          })),
          output_columns: config.outputColumns,
          join_type: config.joinType,
          limit: 10,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          sampleData: data.sample_data || [],
          rowCount: data.row_count || 0,
          nullStats: data.null_stats || {},
          warnings: data.warnings || [],
        };
      } else {
        return {
          sampleData: [],
          rowCount: 0,
          nullStats: {},
          warnings: ['Failed to generate preview'],
        };
      }
    } catch (error) {
      console.error('Failed to fetch preview:', error);
      return {
        sampleData: [],
        rowCount: 0,
        nullStats: {},
        warnings: ['Error generating preview'],
      };
    }
  };

  // Initial fetch
  useEffect(() => {
    if (user && session) {
      fetchPipeline();
    }
  }, [user, session, fetchPipeline]);

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/pipelines/${pipelineId}/enrichments`)}
            className="text-muted-foreground hover:text-foreground"
          >
            Enrichments
          </Button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">New</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
            <GitMerge className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Create Enrichment
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add a stream-table JOIN to enrich your CDC data
            </p>
          </div>
        </div>
      </header>

      {/* Content - Full page wizard */}
      <main className="flex-1 overflow-y-auto">
        <EnrichmentCreator
          pipelineId={pipelineId}
          isOpen={true}
          onClose={() => router.push(`/dashboard/pipelines/${pipelineId}/enrichments`)}
          onSubmit={handleCreateEnrichment}
          availableStreams={availableStreams}
          availableTables={availableTables}
          onFetchPreview={handleFetchPreview}
        />
      </main>
    </div>
  );
}
