'use client';

import { useState } from 'react';
import type { AnalysisResult, Anomaly, AnomalySeverity } from '@/types/preview';
import {
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Shield,
  TrendingUp,
  ArrowLeftRight,
  Columns3,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface AnomalyWarningsProps {
  analysis: AnalysisResult | null;
  isLoading?: boolean;
}

function getSeverityIcon(severity: AnomalySeverity) {
  switch (severity) {
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'info':
      return <Info className="w-4 h-4 text-blue-400" />;
  }
}

function getSeverityStyles(severity: AnomalySeverity) {
  switch (severity) {
    case 'error':
      return {
        card: 'bg-red-500/5 border-red-500/20 hover:border-red-500/30',
        badge: 'bg-red-500/20 text-red-400',
        text: 'text-red-400',
        glow: 'from-red-500/20',
      };
    case 'warning':
      return {
        card: 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-400',
        text: 'text-amber-400',
        glow: 'from-amber-500/20',
      };
    case 'info':
      return {
        card: 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/30',
        badge: 'bg-blue-500/20 text-blue-400',
        text: 'text-blue-400',
        glow: 'from-blue-500/20',
      };
  }
}

function getAnomalyIcon(type: string) {
  switch (type) {
    case 'null_ratio':
      return <Columns3 className="w-4 h-4" />;
    case 'cardinality':
      return <TrendingUp className="w-4 h-4" />;
    case 'type_coercion':
      return <ArrowLeftRight className="w-4 h-4" />;
    case 'missing_field':
      return <XCircle className="w-4 h-4" />;
    default:
      return <AlertTriangle className="w-4 h-4" />;
  }
}

function getAnomalyTypeName(type: string) {
  switch (type) {
    case 'null_ratio':
      return 'NULL Ratio';
    case 'cardinality':
      return 'Cardinality Explosion';
    case 'type_coercion':
      return 'Type Coercion';
    case 'missing_field':
      return 'Missing Field';
    case 'row_drop':
      return 'Row Drop';
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

interface AnomalyCardProps {
  anomaly: Anomaly;
  index: number;
}

function AnomalyCard({ anomaly, index }: AnomalyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = getSeverityStyles(anomaly.severity);
  const hasDetails = anomaly.details && Object.keys(anomaly.details).length > 0;

  return (
    <div
      className={`
        rounded-xl border overflow-hidden transition-all duration-200
        ${styles.card}
      `}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={`
          w-full px-4 py-3 flex items-start gap-3 text-left transition-colors
          ${hasDetails ? 'cursor-pointer' : 'cursor-default'}
        `}
      >
        {/* Severity Icon */}
        <div className="shrink-0 mt-0.5">
          {getSeverityIcon(anomaly.severity)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${styles.text}`}>
              {getAnomalyTypeName(anomaly.type)}
            </span>

            {anomaly.column && (
              <code className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-foreground font-mono">
                {anomaly.column}
              </code>
            )}

            {anomaly.details.nullPercentage !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${styles.badge}`}>
                {anomaly.details.nullPercentage.toFixed(1)}%
              </span>
            )}

            {anomaly.details.multiplier !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${styles.badge}`}>
                {anomaly.details.multiplier.toFixed(1)}x
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-1">
            {anomaly.message}
          </p>
        </div>

        {/* Expand Button */}
        {hasDetails && (
          <span className="text-muted-foreground shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        )}
      </button>

      {/* Expanded Details */}
      {isExpanded && hasDetails && (
        <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            {anomaly.details.nullCount !== undefined && (
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-muted-foreground mb-1">NULL Count</div>
                <div className="text-lg font-mono font-bold text-foreground">
                  {anomaly.details.nullCount.toLocaleString()}
                </div>
              </div>
            )}

            {anomaly.details.totalCount !== undefined && (
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-muted-foreground mb-1">Total Rows</div>
                <div className="text-lg font-mono font-bold text-foreground">
                  {anomaly.details.totalCount.toLocaleString()}
                </div>
              </div>
            )}

            {anomaly.details.inputRows !== undefined && (
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-muted-foreground mb-1">Input Rows</div>
                <div className="text-lg font-mono font-bold text-foreground">
                  {anomaly.details.inputRows.toLocaleString()}
                </div>
              </div>
            )}

            {anomaly.details.outputRows !== undefined && (
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-muted-foreground mb-1">Output Rows</div>
                <div className="text-lg font-mono font-bold text-foreground">
                  {anomaly.details.outputRows.toLocaleString()}
                </div>
              </div>
            )}

            {anomaly.details.threshold !== undefined && (
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-muted-foreground mb-1">Threshold</div>
                <div className="text-lg font-mono font-bold text-foreground">
                  {anomaly.details.threshold}%
                </div>
              </div>
            )}

            {anomaly.details.actualValue !== undefined && (
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-muted-foreground mb-1">Actual Value</div>
                <div className={`text-lg font-mono font-bold ${styles.text}`}>
                  {anomaly.details.actualValue}%
                </div>
              </div>
            )}

            {anomaly.details.expectedType && (
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-muted-foreground mb-1">Expected Type</div>
                <div className="text-base font-mono font-medium text-green-400">
                  {anomaly.details.expectedType}
                </div>
              </div>
            )}

            {anomaly.details.actualType && (
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-muted-foreground mb-1">Actual Type</div>
                <div className={`text-base font-mono font-medium ${styles.text}`}>
                  {anomaly.details.actualType}
                </div>
              </div>
            )}
          </div>

          {/* Progress bar for NULL percentage */}
          {anomaly.details.nullPercentage !== undefined && anomaly.details.threshold !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">NULL Ratio</span>
                <span className={styles.text}>
                  {anomaly.details.nullPercentage.toFixed(1)}% / {anomaly.details.threshold}% threshold
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all bg-gradient-to-r ${styles.glow} to-transparent`}
                  style={{
                    width: `${Math.min((anomaly.details.nullPercentage / anomaly.details.threshold) * 100, 100)}%`,
                    backgroundColor: anomaly.severity === 'error' ? '#ef4444' : anomaly.severity === 'warning' ? '#f59e0b' : '#3b82f6',
                  }}
                />
              </div>
            </div>
          )}

          {/* Affected rows list */}
          {anomaly.details.affectedRows && anomaly.details.affectedRows.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                Affected Rows ({anomaly.details.affectedRows.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {anomaly.details.affectedRows.slice(0, 20).map((rowIndex) => (
                  <span
                    key={rowIndex}
                    className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground font-mono"
                  >
                    #{rowIndex + 1}
                  </span>
                ))}
                {anomaly.details.affectedRows.length > 20 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                    +{anomaly.details.affectedRows.length - 20} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnomalyWarnings({ analysis, isLoading = false }: AnomalyWarningsProps) {
  if (isLoading) {
    return (
      <div className="glass rounded-2xl overflow-hidden p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Analyzing data quality...</span>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const { anomalies, summary, canProceed } = analysis;

  if (anomalies.length === 0) {
    return (
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-green-500/5 to-emerald-500/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-display font-semibold text-green-400">
                All Checks Passed
              </h3>
              <p className="text-sm text-muted-foreground">
                No data quality issues detected. You can proceed with the pipeline.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className={`
        glass rounded-2xl overflow-hidden
        ${!canProceed ? 'ring-1 ring-red-500/30' : ''}
      `}>
        <div className={`
          p-5 flex items-center justify-between
          ${!canProceed
            ? 'bg-gradient-to-r from-red-500/10 to-transparent'
            : 'bg-gradient-to-r from-amber-500/10 to-transparent'}
        `}>
          <div className="flex items-center gap-4">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center
              ${!canProceed
                ? 'bg-red-500/20 border border-red-500/30'
                : 'bg-amber-500/20 border border-amber-500/30'}
            `}>
              <Shield className={`w-6 h-6 ${!canProceed ? 'text-red-500' : 'text-amber-500'}`} />
            </div>
            <div>
              <h3 className={`text-lg font-display font-semibold ${!canProceed ? 'text-red-400' : 'text-amber-400'}`}>
                {!canProceed ? 'Issues Require Attention' : 'Review Warnings'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {summary.totalAnomalies} issue{summary.totalAnomalies !== 1 ? 's' : ''} detected in your data
              </p>
            </div>
          </div>

          {/* Summary Badges */}
          <div className="flex items-center gap-2">
            {summary.errors > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium">
                <XCircle className="w-4 h-4" />
                {summary.errors} Error{summary.errors !== 1 ? 's' : ''}
              </span>
            )}
            {summary.warnings > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />
                {summary.warnings} Warning{summary.warnings !== 1 ? 's' : ''}
              </span>
            )}
            {summary.info > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium">
                <Info className="w-4 h-4" />
                {summary.info} Info
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Anomaly Cards */}
      <div className="space-y-2">
        {anomalies.map((anomaly, index) => (
          <AnomalyCard key={`${anomaly.type}-${anomaly.column}-${index}`} anomaly={anomaly} index={index} />
        ))}
      </div>

      {/* Proceed Warning */}
      {!canProceed && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Cannot proceed with current configuration
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Please address the errors above before creating the pipeline. You may need to adjust your JOIN conditions or filter criteria.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
