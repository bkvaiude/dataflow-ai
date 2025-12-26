'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Credential, DiscoveredTable, SinkConfig, CreatePipelineRequest } from '@/types';
import {
  X,
  Database,
  Server,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Layers,
  Table,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface PipelineCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePipelineRequest) => Promise<{ success: boolean; message?: string }>;
  credentials: Credential[];
  onFetchTables: (credentialId: string) => Promise<DiscoveredTable[]>;
}

type Step = 'source' | 'tables' | 'sink' | 'review';

const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'source', label: 'Source', icon: <Database className="w-4 h-4" /> },
  { key: 'tables', label: 'Tables', icon: <Table className="w-4 h-4" /> },
  { key: 'sink', label: 'Destination', icon: <Server className="w-4 h-4" /> },
  { key: 'review', label: 'Review', icon: <CheckCircle2 className="w-4 h-4" /> },
];

export function PipelineCreator({
  isOpen,
  onClose,
  onSubmit,
  credentials,
  onFetchTables,
}: PipelineCreatorProps) {
  const [currentStep, setCurrentStep] = useState<Step>('source');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>('');
  const [availableTables, setAvailableTables] = useState<DiscoveredTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [sinkType, setSinkType] = useState<'clickhouse' | 'kafka' | 's3'>('clickhouse');
  const [sinkConfig, setSinkConfig] = useState<SinkConfig>({
    host: 'localhost',
    port: 8123,
    database: 'dataflow',
    username: 'default',
    password: '',
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('source');
      setName('');
      setDescription('');
      setSelectedCredentialId('');
      setAvailableTables([]);
      setSelectedTables([]);
      setSinkType('clickhouse');
      setSinkConfig({
        host: 'localhost',
        port: 8123,
        database: 'dataflow',
        username: 'default',
        password: '',
      });
      setError(null);
    }
  }, [isOpen]);

  // Fetch tables when credential is selected
  useEffect(() => {
    if (selectedCredentialId && currentStep === 'tables') {
      setIsLoadingTables(true);
      onFetchTables(selectedCredentialId)
        .then((tables) => {
          setAvailableTables(tables);
        })
        .catch((err) => {
          console.error('Failed to fetch tables:', err);
          setAvailableTables([]);
        })
        .finally(() => {
          setIsLoadingTables(false);
        });
    }
  }, [selectedCredentialId, currentStep, onFetchTables]);

  const handleNext = () => {
    const stepIndex = steps.findIndex((s) => s.key === currentStep);
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
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit({
        name,
        description: description || undefined,
        sourceCredentialId: selectedCredentialId,
        sourceTables: selectedTables,
        sinkType,
        sinkConfig,
      });

      if (result.success) {
        onClose();
      } else {
        setError(result.message || 'Failed to create pipeline');
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
        return !!selectedCredentialId;
      case 'tables':
        return selectedTables.length > 0;
      case 'sink':
        return sinkConfig.host && sinkConfig.database;
      case 'review':
        return !!name;
      default:
        return false;
    }
  };

  const toggleTable = (tableName: string) => {
    setSelectedTables((prev) =>
      prev.includes(tableName)
        ? prev.filter((t) => t !== tableName)
        : [...prev, tableName]
    );
  };

  const selectAllTables = () => {
    if (selectedTables.length === availableTables.filter(t => t.cdcEligible).length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(availableTables.filter(t => t.cdcEligible).map(t => `${t.schemaName}.${t.tableName}`));
    }
  };

  const selectedCredential = credentials.find((c) => c.id === selectedCredentialId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground">
                Create Pipeline
              </h2>
              <p className="text-xs text-muted-foreground">
                Set up a new CDC data pipeline
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
        <div className="px-6 py-4 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center justify-between">
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
                          ? 'bg-primary/20 border-primary/50 text-primary'
                          : isPast
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-white/5 border-white/10 text-muted-foreground'}
                      `}
                    >
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-12 h-px mx-4 ${
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
        <div className="p-6 min-h-[300px]">
          {/* Step 1: Select Source */}
          {currentStep === 'source' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Select Source Database
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Choose the database connection to stream changes from
                </p>
              </div>

              {credentials.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No database connections found.</p>
                  <p className="text-sm">Add a connection in the Sources page first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {credentials.map((cred) => (
                    <button
                      key={cred.id}
                      onClick={() => setSelectedCredentialId(cred.id)}
                      className={`
                        w-full p-4 rounded-xl border text-left transition-all
                        ${selectedCredentialId === cred.id
                          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {cred.sourceType === 'postgresql' ? '🐘' : '🐬'}
                          </span>
                          <div>
                            <div className="font-medium text-foreground">{cred.name}</div>
                            <code className="text-xs text-muted-foreground font-mono">
                              {cred.host}:{cred.port}/{cred.database}
                            </code>
                          </div>
                        </div>
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            cred.isValid
                              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                              : 'bg-red-500'
                          }`}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Tables */}
          {currentStep === 'tables' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    Select Tables to Sync
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Choose which tables to include in the CDC pipeline
                  </p>
                </div>
                {availableTables.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllTables}
                    className="text-xs"
                  >
                    {selectedTables.length === availableTables.filter(t => t.cdcEligible).length
                      ? 'Deselect All'
                      : 'Select All CDC-Ready'}
                  </Button>
                )}
              </div>

              {isLoadingTables ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : availableTables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Table className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tables found in this database.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
                  {availableTables.map((table) => {
                    const fullName = `${table.schemaName}.${table.tableName}`;
                    const isSelected = selectedTables.includes(fullName);

                    return (
                      <button
                        key={fullName}
                        onClick={() => table.cdcEligible && toggleTable(fullName)}
                        disabled={!table.cdcEligible}
                        className={`
                          w-full p-3 rounded-xl border text-left transition-all
                          ${!table.cdcEligible
                            ? 'opacity-50 cursor-not-allowed border-white/5 bg-white/[0.01]'
                            : isSelected
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-white/10 bg-white/[0.02] hover:border-white/20'}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`
                                w-5 h-5 rounded border flex items-center justify-center
                                ${isSelected
                                  ? 'bg-primary border-primary'
                                  : 'border-white/20'}
                              `}
                            >
                              {isSelected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                            </div>
                            <div>
                              <code className="text-sm font-mono text-foreground">
                                {fullName}
                              </code>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">
                                  {table.columns.length} columns
                                </span>
                                {table.rowCountEstimate && (
                                  <span className="text-xs text-muted-foreground">
                                    ~{table.rowCountEstimate.toLocaleString()} rows
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {table.cdcEligible ? (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                              <Zap className="w-3 h-3" />
                              CDC Ready
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-amber-400">
                              <AlertCircle className="w-3 h-3" />
                              {table.cdcIssues?.[0] || 'Not eligible'}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedTables.length > 0 && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                  <span className="text-primary font-medium">{selectedTables.length}</span>
                  <span className="text-muted-foreground"> table{selectedTables.length !== 1 ? 's' : ''} selected</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Configure Sink */}
          {currentStep === 'sink' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Configure Destination
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Set up where to stream the data changes
                </p>
              </div>

              {/* Sink Type Selector */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {(['clickhouse', 'kafka', 's3'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSinkType(type)}
                    className={`
                      p-3 rounded-xl border text-center transition-all
                      ${sinkType === type
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'}
                    `}
                  >
                    <div className="text-lg mb-1">
                      {type === 'clickhouse' ? '🔶' : type === 'kafka' ? '📊' : '☁️'}
                    </div>
                    <div className="text-sm font-medium capitalize">{type}</div>
                  </button>
                ))}
              </div>

              {/* ClickHouse Config */}
              {sinkType === 'clickhouse' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Host</label>
                      <Input
                        value={sinkConfig.host || ''}
                        onChange={(e) => setSinkConfig({ ...sinkConfig, host: e.target.value })}
                        placeholder="localhost"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Port</label>
                      <Input
                        type="number"
                        value={sinkConfig.port || ''}
                        onChange={(e) => setSinkConfig({ ...sinkConfig, port: parseInt(e.target.value) })}
                        placeholder="8123"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Database</label>
                    <Input
                      value={sinkConfig.database || ''}
                      onChange={(e) => setSinkConfig({ ...sinkConfig, database: e.target.value })}
                      placeholder="dataflow"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Username</label>
                      <Input
                        value={sinkConfig.username || ''}
                        onChange={(e) => setSinkConfig({ ...sinkConfig, username: e.target.value })}
                        placeholder="default"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Password</label>
                      <Input
                        type="password"
                        value={sinkConfig.password || ''}
                        onChange={(e) => setSinkConfig({ ...sinkConfig, password: e.target.value })}
                        placeholder="••••••••"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Coming Soon for other sinks */}
              {(sinkType === 'kafka' || sinkType === 's3') && (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">{sinkType.toUpperCase()} sink coming soon</p>
                  <p className="text-sm">Currently only ClickHouse is supported</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Name Your Pipeline
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Give your pipeline a memorable name and review the configuration
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Pipeline Name *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My CDC Pipeline"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Sync user data to analytics..."
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              {/* Configuration Summary */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                <h4 className="text-sm font-medium text-foreground">Configuration Summary</h4>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black/20">
                  <span className="text-lg">
                    {selectedCredential?.sourceType === 'postgresql' ? '🐘' : '🐬'}
                  </span>
                  <div>
                    <div className="text-sm text-foreground">{selectedCredential?.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedTables.length} tables</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex-1 h-px bg-gradient-to-r from-blue-500/50 via-white/20 to-amber-500/50" />
                  <ChevronRight className="w-4 h-4" />
                  <div className="flex-1 h-px bg-gradient-to-r from-amber-500/50 via-white/20 to-primary/50" />
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black/20">
                  <span className="text-lg">🔶</span>
                  <div>
                    <div className="text-sm text-foreground capitalize">{sinkType}</div>
                    <div className="text-xs text-muted-foreground">
                      {sinkConfig.host}:{sinkConfig.port}/{sinkConfig.database}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Pipeline
                  <Zap className="w-4 h-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
