'use client';

import { useState, useCallback } from 'react';
import type {
  Transform,
  JoinTransform,
  FilterTransform,
  AggregationTransform,
  AnomalyThresholdConfig,
  TemplateFormData,
  AggregationFunction,
} from '@/types/preview';
import { DEFAULT_ANOMALY_CONFIG } from '@/types/preview';
import type { DiscoveredTable } from '@/types';
import {
  X,
  Plus,
  Trash2,
  Link2,
  Filter,
  BarChart3,
  Settings2,
  Save,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Columns3,
  TrendingUp,
  ArrowLeftRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TemplateBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: TemplateFormData) => Promise<void>;
  tables: DiscoveredTable[];
  initialData?: TemplateFormData;
  isEditing?: boolean;
}

type TransformType = 'join' | 'filter' | 'aggregation';

const JOIN_TYPES = [
  { value: 'inner', label: 'INNER JOIN', description: 'Only matching rows' },
  { value: 'left', label: 'LEFT JOIN', description: 'All rows from left + matches' },
  { value: 'right', label: 'RIGHT JOIN', description: 'All rows from right + matches' },
  { value: 'full', label: 'FULL JOIN', description: 'All rows from both tables' },
] as const;

const AGG_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const;

function TransformCard({
  transform,
  index,
  tables,
  onUpdate,
  onRemove,
}: {
  transform: Transform;
  index: number;
  tables: DiscoveredTable[];
  onUpdate: (index: number, transform: Transform) => void;
  onRemove: (index: number) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getIcon = () => {
    switch (transform.type) {
      case 'join':
        return <Link2 className="w-4 h-4" />;
      case 'filter':
        return <Filter className="w-4 h-4" />;
      case 'aggregation':
        return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getColor = () => {
    switch (transform.type) {
      case 'join':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'filter':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'aggregation':
        return 'bg-violet-500/10 border-violet-500/20 text-violet-400';
    }
  };

  const getTableColumns = (tableName: string) => {
    const table = tables.find(t => `${t.schemaName}.${t.tableName}` === tableName || t.tableName === tableName);
    return table?.columns || [];
  };

  const renderJoinConfig = (t: JoinTransform) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Left Table</label>
          <select
            value={t.leftTable}
            onChange={(e) => onUpdate(index, { ...t, leftTable: e.target.value, leftKey: '' })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-primary outline-none"
          >
            <option value="">Select table...</option>
            {tables.map((table) => (
              <option key={`${table.schemaName}.${table.tableName}`} value={`${table.schemaName}.${table.tableName}`}>
                {table.schemaName}.{table.tableName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Right Table</label>
          <select
            value={t.rightTable}
            onChange={(e) => onUpdate(index, { ...t, rightTable: e.target.value, rightKey: '' })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-primary outline-none"
          >
            <option value="">Select table...</option>
            {tables.map((table) => (
              <option key={`${table.schemaName}.${table.tableName}`} value={`${table.schemaName}.${table.tableName}`}>
                {table.schemaName}.{table.tableName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Join Type</label>
        <div className="grid grid-cols-4 gap-2">
          {JOIN_TYPES.map((jt) => (
            <button
              key={jt.value}
              type="button"
              onClick={() => onUpdate(index, { ...t, joinType: jt.value })}
              className={`
                p-2 rounded-lg border text-xs font-medium transition-all
                ${t.joinType === jt.value
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20'}
              `}
            >
              {jt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Left Key</label>
          <select
            value={t.leftKey}
            onChange={(e) => onUpdate(index, { ...t, leftKey: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-primary outline-none"
            disabled={!t.leftTable}
          >
            <option value="">Select column...</option>
            {getTableColumns(t.leftTable).map((col) => (
              <option key={col.name} value={col.name}>
                {col.name} ({col.type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Right Key</label>
          <select
            value={t.rightKey}
            onChange={(e) => onUpdate(index, { ...t, rightKey: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-primary outline-none"
            disabled={!t.rightTable}
          >
            <option value="">Select column...</option>
            {getTableColumns(t.rightTable).map((col) => (
              <option key={col.name} value={col.name}>
                {col.name} ({col.type})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderFilterConfig = (t: FilterTransform) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Table</label>
        <select
          value={t.table}
          onChange={(e) => onUpdate(index, { ...t, table: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-primary outline-none"
        >
          <option value="">Select table...</option>
          {tables.map((table) => (
            <option key={`${table.schemaName}.${table.tableName}`} value={`${table.schemaName}.${table.tableName}`}>
              {table.schemaName}.{table.tableName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">WHERE Clause</label>
        <Input
          value={t.whereClause}
          onChange={(e) => onUpdate(index, { ...t, whereClause: e.target.value })}
          placeholder="status = 'active' AND amount > 100"
          className="font-mono text-sm bg-white/5 border-white/10"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Enter a SQL WHERE condition. Avoid using quotes around column names.
        </p>
      </div>
    </div>
  );

  const renderAggregationConfig = (t: AggregationTransform) => {
    const addAggregation = () => {
      const newAgg: AggregationFunction = { column: '', function: 'COUNT', alias: '' };
      onUpdate(index, { ...t, aggregations: [...t.aggregations, newAgg] });
    };

    const updateAggregation = (aggIndex: number, updates: Partial<AggregationFunction>) => {
      const newAggs = [...t.aggregations];
      newAggs[aggIndex] = { ...newAggs[aggIndex], ...updates };
      onUpdate(index, { ...t, aggregations: newAggs });
    };

    const removeAggregation = (aggIndex: number) => {
      const newAggs = t.aggregations.filter((_, i) => i !== aggIndex);
      onUpdate(index, { ...t, aggregations: newAggs });
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Table</label>
          <select
            value={t.table}
            onChange={(e) => onUpdate(index, { ...t, table: e.target.value, groupBy: [], aggregations: [] })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-primary outline-none"
          >
            <option value="">Select table...</option>
            {tables.map((table) => (
              <option key={`${table.schemaName}.${table.tableName}`} value={`${table.schemaName}.${table.tableName}`}>
                {table.schemaName}.{table.tableName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Group By</label>
          <div className="flex flex-wrap gap-2">
            {getTableColumns(t.table).map((col) => (
              <button
                key={col.name}
                type="button"
                onClick={() => {
                  const newGroupBy = t.groupBy.includes(col.name)
                    ? t.groupBy.filter(c => c !== col.name)
                    : [...t.groupBy, col.name];
                  onUpdate(index, { ...t, groupBy: newGroupBy });
                }}
                className={`
                  px-2 py-1 rounded text-xs font-mono transition-all
                  ${t.groupBy.includes(col.name)
                    ? 'bg-primary/20 border border-primary/50 text-primary'
                    : 'bg-white/5 border border-white/10 text-muted-foreground hover:border-white/20'}
                `}
              >
                {col.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted-foreground">Aggregations</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addAggregation}
              className="h-6 text-xs gap-1"
            >
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {t.aggregations.map((agg, aggIndex) => (
              <div key={aggIndex} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                <select
                  value={agg.function}
                  onChange={(e) => updateAggregation(aggIndex, { function: e.target.value as AggregationFunction['function'] })}
                  className="px-2 py-1 rounded bg-white/10 border border-white/10 text-xs focus:border-primary outline-none"
                >
                  {AGG_FUNCTIONS.map((fn) => (
                    <option key={fn} value={fn}>{fn}</option>
                  ))}
                </select>
                <span className="text-muted-foreground text-xs">(</span>
                <select
                  value={agg.column}
                  onChange={(e) => updateAggregation(aggIndex, { column: e.target.value })}
                  className="flex-1 px-2 py-1 rounded bg-white/10 border border-white/10 text-xs focus:border-primary outline-none font-mono"
                >
                  <option value="">Column...</option>
                  <option value="*">*</option>
                  {getTableColumns(t.table).map((col) => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
                <span className="text-muted-foreground text-xs">)</span>
                <span className="text-muted-foreground text-xs">AS</span>
                <Input
                  value={agg.alias}
                  onChange={(e) => updateAggregation(aggIndex, { alias: e.target.value })}
                  placeholder="alias"
                  className="w-24 h-6 text-xs font-mono bg-white/10 border-white/10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAggregation(aggIndex)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${getColor()}`}>
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`p-2 rounded-lg ${getColor()}`}>
            {getIcon()}
          </span>
          <div>
            <span className="text-sm font-medium text-foreground capitalize">
              {transform.type}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              Step {index + 1}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-white/5">
          {transform.type === 'join' && renderJoinConfig(transform as JoinTransform)}
          {transform.type === 'filter' && renderFilterConfig(transform as FilterTransform)}
          {transform.type === 'aggregation' && renderAggregationConfig(transform as AggregationTransform)}
        </div>
      )}
    </div>
  );
}

export function TemplateBuilder({
  isOpen,
  onClose,
  onSave,
  tables,
  initialData,
  isEditing = false,
}: TemplateBuilderProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [transforms, setTransforms] = useState<Transform[]>(initialData?.transforms || []);
  const [anomalyConfig, setAnomalyConfig] = useState<AnomalyThresholdConfig>(
    initialData?.anomalyConfig || DEFAULT_ANOMALY_CONFIG
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showAnomalyConfig, setShowAnomalyConfig] = useState(false);

  const addTransform = (type: TransformType) => {
    let newTransform: Transform;

    switch (type) {
      case 'join':
        newTransform = {
          type: 'join',
          leftTable: '',
          rightTable: '',
          joinType: 'left',
          leftKey: '',
          rightKey: '',
        };
        break;
      case 'filter':
        newTransform = {
          type: 'filter',
          table: '',
          whereClause: '',
        };
        break;
      case 'aggregation':
        newTransform = {
          type: 'aggregation',
          table: '',
          groupBy: [],
          aggregations: [],
        };
        break;
    }

    setTransforms([...transforms, newTransform]);
  };

  const updateTransform = (index: number, transform: Transform) => {
    const newTransforms = [...transforms];
    newTransforms[index] = transform;
    setTransforms(newTransforms);
  };

  const removeTransform = (index: number) => {
    setTransforms(transforms.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        transforms,
        anomalyConfig,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl glass">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground">
              {isEditing ? 'Edit Template' : 'Create Pipeline Template'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure transforms and anomaly detection thresholds
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Name & Description */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Template Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Pipeline Template"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>

          {/* Transforms */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Transforms
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTransform('join')}
                  className="h-7 text-xs gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                >
                  <Link2 className="w-3 h-3" /> JOIN
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTransform('filter')}
                  className="h-7 text-xs gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  <Filter className="w-3 h-3" /> FILTER
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTransform('aggregation')}
                  className="h-7 text-xs gap-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                >
                  <BarChart3 className="w-3 h-3" /> AGGREGATE
                </Button>
              </div>
            </div>

            {transforms.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-xl">
                <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No transforms added yet</p>
                <p className="text-xs mt-1">Click the buttons above to add transforms</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transforms.map((transform, index) => (
                  <TransformCard
                    key={index}
                    transform={transform}
                    index={index}
                    tables={tables}
                    onUpdate={updateTransform}
                    onRemove={removeTransform}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Anomaly Detection Config */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAnomalyConfig(!showAnomalyConfig)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Anomaly Detection Settings
              </h3>
              {showAnomalyConfig ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showAnomalyConfig && (
              <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/10 animate-fade-in">
                {/* NULL Ratio */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Columns3 className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-foreground">NULL Ratio Detection</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnomalyConfig({
                        ...anomalyConfig,
                        nullRatio: { ...anomalyConfig.nullRatio, enabled: !anomalyConfig.nullRatio.enabled }
                      })}
                      className={`
                        w-10 h-5 rounded-full transition-colors relative
                        ${anomalyConfig.nullRatio.enabled ? 'bg-primary' : 'bg-white/10'}
                      `}
                    >
                      <div className={`
                        absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                        ${anomalyConfig.nullRatio.enabled ? 'left-5' : 'left-0.5'}
                      `} />
                    </button>
                  </div>
                  {anomalyConfig.nullRatio.enabled && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Warning Threshold (%)</label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={anomalyConfig.nullRatio.warningThreshold}
                          onChange={(e) => setAnomalyConfig({
                            ...anomalyConfig,
                            nullRatio: { ...anomalyConfig.nullRatio, warningThreshold: Number(e.target.value) }
                          })}
                          className="h-8 text-sm bg-white/5 border-white/10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Error Threshold (%)</label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={anomalyConfig.nullRatio.errorThreshold}
                          onChange={(e) => setAnomalyConfig({
                            ...anomalyConfig,
                            nullRatio: { ...anomalyConfig.nullRatio, errorThreshold: Number(e.target.value) }
                          })}
                          className="h-8 text-sm bg-white/5 border-white/10"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Cardinality */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium text-foreground">Cardinality Explosion</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnomalyConfig({
                        ...anomalyConfig,
                        cardinality: { ...anomalyConfig.cardinality, enabled: !anomalyConfig.cardinality.enabled }
                      })}
                      className={`
                        w-10 h-5 rounded-full transition-colors relative
                        ${anomalyConfig.cardinality.enabled ? 'bg-primary' : 'bg-white/10'}
                      `}
                    >
                      <div className={`
                        absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                        ${anomalyConfig.cardinality.enabled ? 'left-5' : 'left-0.5'}
                      `} />
                    </button>
                  </div>
                  {anomalyConfig.cardinality.enabled && (
                    <div className="pl-6">
                      <label className="block text-xs text-muted-foreground mb-1">Multiplier Threshold (x)</label>
                      <Input
                        type="number"
                        min={1}
                        step={0.5}
                        value={anomalyConfig.cardinality.multiplierThreshold}
                        onChange={(e) => setAnomalyConfig({
                          ...anomalyConfig,
                          cardinality: { ...anomalyConfig.cardinality, multiplierThreshold: Number(e.target.value) }
                        })}
                        className="h-8 text-sm bg-white/5 border-white/10 w-32"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Warn if output rows exceed input rows × this multiplier
                      </p>
                    </div>
                  )}
                </div>

                {/* Type Coercion */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-medium text-foreground">Type Coercion Warnings</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnomalyConfig({
                      ...anomalyConfig,
                      typeCoercion: { enabled: !anomalyConfig.typeCoercion.enabled }
                    })}
                    className={`
                      w-10 h-5 rounded-full transition-colors relative
                      ${anomalyConfig.typeCoercion.enabled ? 'bg-primary' : 'bg-white/10'}
                    `}
                  >
                    <div className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                      ${anomalyConfig.typeCoercion.enabled ? 'left-5' : 'left-0.5'}
                    `} />
                  </button>
                </div>

                {/* Missing Required */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-foreground">Missing Required Fields</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnomalyConfig({
                      ...anomalyConfig,
                      missingRequired: { enabled: !anomalyConfig.missingRequired.enabled }
                    })}
                    className={`
                      w-10 h-5 rounded-full transition-colors relative
                      ${anomalyConfig.missingRequired.enabled ? 'bg-primary' : 'bg-white/10'}
                    `}
                  >
                    <div className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                      ${anomalyConfig.missingRequired.enabled ? 'left-5' : 'left-0.5'}
                    `} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Update Template' : 'Save Template'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
