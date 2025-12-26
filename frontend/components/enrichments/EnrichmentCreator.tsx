'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  LookupTable,
  JoinKey,
  ColumnInfo,
  EnrichmentPreview as EnrichmentPreviewType,
  CreateEnrichmentRequest,
} from '@/types';
import { LookupTableSelector } from './LookupTableSelector';
import { JoinBuilder } from './JoinBuilder';
import { ColumnSelector } from './ColumnSelector';
import { EnrichmentPreview } from './EnrichmentPreview';
import {
  X,
  Zap,
  Database,
  GitMerge,
  Columns,
  Eye,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

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

interface EnrichmentCreatorProps {
  pipelineId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEnrichmentRequest) => Promise<{ success: boolean; message?: string }>;
  availableStreams: AvailableStream[];
  availableTables: AvailableTable[];
  onFetchPreview?: (config: {
    sourceTopic: string;
    lookupTables: LookupTable[];
    joinKeys: JoinKey[];
    outputColumns: string[];
    joinType: 'LEFT' | 'INNER';
  }) => Promise<EnrichmentPreviewType>;
}

type Step = 'source' | 'tables' | 'join' | 'columns' | 'preview' | 'review';

const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'source', label: 'Source', icon: <Zap className="w-4 h-4" /> },
  { key: 'tables', label: 'Lookups', icon: <Database className="w-4 h-4" /> },
  { key: 'join', label: 'Join', icon: <GitMerge className="w-4 h-4" /> },
  { key: 'columns', label: 'Columns', icon: <Columns className="w-4 h-4" /> },
  { key: 'preview', label: 'Preview', icon: <Eye className="w-4 h-4" /> },
  { key: 'review', label: 'Create', icon: <CheckCircle2 className="w-4 h-4" /> },
];

export function EnrichmentCreator({
  pipelineId,
  isOpen,
  onClose,
  onSubmit,
  availableStreams,
  availableTables,
  onFetchPreview,
}: EnrichmentCreatorProps) {
  const [currentStep, setCurrentStep] = useState<Step>('source');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedStream, setSelectedStream] = useState<AvailableStream | null>(null);
  const [selectedTables, setSelectedTables] = useState<LookupTable[]>([]);
  const [joinKeys, setJoinKeys] = useState<JoinKey[]>([]);
  const [joinType, setJoinType] = useState<'LEFT' | 'INNER'>('LEFT');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<EnrichmentPreviewType | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('source');
      setName('');
      setDescription('');
      setSelectedStream(null);
      setSelectedTables([]);
      setJoinKeys([]);
      setJoinType('LEFT');
      setSelectedColumns([]);
      setPreview(null);
      setError(null);
    }
  }, [isOpen]);

  const handleNext = async () => {
    const stepIndex = steps.findIndex((s) => s.key === currentStep);

    // Fetch preview when moving to preview step
    if (currentStep === 'columns' && onFetchPreview && selectedStream) {
      setIsLoadingPreview(true);
      try {
        const previewData = await onFetchPreview({
          sourceTopic: selectedStream.topic,
          lookupTables: selectedTables,
          joinKeys,
          outputColumns: selectedColumns,
          joinType,
        });
        setPreview(previewData);
      } catch (err) {
        console.error('Failed to fetch preview:', err);
        setPreview({
          sampleData: [],
          rowCount: 0,
          nullStats: {},
          warnings: ['Failed to generate preview'],
        });
      } finally {
        setIsLoadingPreview(false);
      }
    }

    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].key);
    }
  };

  const handleBack = () => {
    const stepIndex = steps.findIndex((s) => s.key === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].key);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStream) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit({
        pipelineId,
        name,
        description: description || undefined,
        sourceTopic: selectedStream.topic,
        lookupTables: selectedTables,
        joinKeys,
        outputColumns: selectedColumns,
        joinType,
      });

      if (result.success) {
        onClose();
      } else {
        setError(result.message || 'Failed to create enrichment');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'source':
        return !!selectedStream;
      case 'tables':
        return selectedTables.length > 0;
      case 'join':
        return joinKeys.length > 0;
      case 'columns':
        return selectedColumns.length > 0;
      case 'preview':
        return true;
      case 'review':
        return !!name;
      default:
        return false;
    }
  };

  // Prepare column groups for the ColumnSelector
  const columnGroups = selectedStream
    ? [
        {
          source: selectedStream.name,
          alias: 's',
          columns: selectedStream.columns,
          color: '#3b82f6', // blue
        },
        ...selectedTables.map((table) => ({
          source: table.topic.split('.').pop() || table.alias,
          alias: table.alias,
          columns: table.schema || [],
          color: '#10b981', // green
        })),
      ]
    : [];

  // Prepare lookup tables with names for JoinBuilder
  const lookupTablesWithNames = selectedTables.map((table) => ({
    ...table,
    name: table.topic.split('.').pop() || table.alias,
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl mx-4 bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
              <GitMerge className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground">
                Create Enrichment
              </h2>
              <p className="text-xs text-muted-foreground">
                Enrich stream data with lookup tables
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-white/5 bg-white/[0.01] shrink-0 overflow-x-auto">
          <div className="flex items-center justify-between min-w-max">
            {steps.map((step, index) => {
              const isActive = step.key === currentStep;
              const isPast = steps.findIndex((s) => s.key === currentStep) > index;

              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                        w-8 h-8 rounded-lg flex items-center justify-center border transition-all
                        ${isActive
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                          : isPast
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-white/5 border-white/10 text-muted-foreground'}
                      `}
                    >
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
                    </div>
                    <span
                      className={`text-sm font-medium hidden sm:block ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-8 h-px mx-2 ${
                        isPast ? 'bg-emerald-500/50' : 'bg-white/10'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Step 1: Select Source Stream */}
          {currentStep === 'source' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Select Source Stream
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Choose the streaming data to enrich with lookup tables
                </p>
              </div>

              {availableStreams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No streams available.</p>
                  <p className="text-sm">Start a pipeline first to create source streams.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableStreams.map((stream) => (
                    <button
                      key={stream.topic}
                      onClick={() => setSelectedStream(stream)}
                      className={`
                        w-full p-4 rounded-xl border text-left transition-all
                        ${selectedStream?.topic === stream.topic
                          ? 'border-cyan-500/50 bg-cyan-500/5 ring-1 ring-cyan-500/20'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{stream.name}</div>
                            <code className="text-xs text-muted-foreground font-mono">
                              {stream.topic}
                            </code>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stream.columns.length} columns
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Lookup Tables */}
          {currentStep === 'tables' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Select Lookup Tables
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Choose tables to join with your stream for enrichment
                </p>
              </div>

              <LookupTableSelector
                availableTables={availableTables}
                selectedTables={selectedTables}
                onSelectionChange={setSelectedTables}
              />
            </div>
          )}

          {/* Step 3: Configure JOIN */}
          {currentStep === 'join' && selectedStream && (
            <JoinBuilder
              streamName={selectedStream.name}
              streamColumns={selectedStream.columns}
              lookupTables={lookupTablesWithNames}
              joinKeys={joinKeys}
              joinType={joinType}
              onJoinKeysChange={setJoinKeys}
              onJoinTypeChange={setJoinType}
            />
          )}

          {/* Step 4: Select Output Columns */}
          {currentStep === 'columns' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Select Output Columns
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Choose which columns to include in the enriched output
                </p>
              </div>

              <ColumnSelector
                columnGroups={columnGroups}
                selectedColumns={selectedColumns}
                onSelectionChange={setSelectedColumns}
                maxHeight="380px"
              />
            </div>
          )}

          {/* Step 5: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
                  <p className="text-muted-foreground">Generating preview...</p>
                </div>
              ) : preview ? (
                <EnrichmentPreview
                  preview={preview}
                  onRefresh={() => handleNext()}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Preview not available</p>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Review & Create */}
          {currentStep === 'review' && selectedStream && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Name Your Enrichment
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Give your enrichment a memorable name and review the configuration
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Enrichment Name *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="User Login Enrichment"
                    className="bg-white/5 border-white/10 focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enrich login events with user profile data..."
                    className="bg-white/5 border-white/10 focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* Configuration Summary */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Configuration Summary
                </h4>

                {/* Visual flow */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm text-foreground">{selectedStream.name}</div>
                      <div className="text-[10px] text-muted-foreground">source stream</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <div className="w-6 h-px bg-gradient-to-r from-blue-500/50 to-green-500/50" />
                    <div className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 flex items-center gap-1">
                      <Database className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] text-green-400">{selectedTables.length}</span>
                    </div>
                    <div className="w-6 h-px bg-gradient-to-r from-green-500/50 to-cyan-500/50" />
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground" />

                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <GitMerge className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm text-foreground">Enriched Output</div>
                      <div className="text-[10px] text-muted-foreground">{selectedColumns.length} columns</div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 rounded-lg bg-black/20">
                    <span className="text-muted-foreground">Join Type:</span>
                    <span className={`ml-2 font-medium ${joinType === 'LEFT' ? 'text-amber-400' : 'text-blue-400'}`}>
                      {joinType} JOIN
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20">
                    <span className="text-muted-foreground">Join Keys:</span>
                    <span className="ml-2 font-medium text-foreground">{joinKeys.length}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20">
                    <span className="text-muted-foreground">Lookup Tables:</span>
                    <span className="ml-2 font-medium text-foreground">{selectedTables.length}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20">
                    <span className="text-muted-foreground">Output Columns:</span>
                    <span className="ml-2 font-medium text-foreground">{selectedColumns.length}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                  <X className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between shrink-0">
          <Button
            variant="ghost"
            onClick={currentStep === 'source' ? onClose : handleBack}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep === 'source' ? 'Cancel' : 'Back'}
          </Button>

          {currentStep === 'review' ? (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Enrichment
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isLoadingPreview}
              className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white gap-2"
            >
              {isLoadingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
