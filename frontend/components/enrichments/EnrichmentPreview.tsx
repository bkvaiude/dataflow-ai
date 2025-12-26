'use client';

import { EnrichmentPreview as EnrichmentPreviewType } from '@/types';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Eye,
  RefreshCw,
  Table as TableIcon,
  BarChart3,
} from 'lucide-react';

interface EnrichmentPreviewProps {
  preview: EnrichmentPreviewType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

function getNullSeverity(percentage: number): 'ok' | 'warning' | 'error' {
  if (percentage >= 20) return 'error';
  if (percentage >= 5) return 'warning';
  return 'ok';
}

const severityConfig = {
  ok: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    icon: CheckCircle2,
  },
  warning: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: AlertTriangle,
  },
  error: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: XCircle,
  },
};

export function EnrichmentPreview({
  preview,
  isLoading = false,
  onRefresh,
  onApprove,
  onReject,
}: EnrichmentPreviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
        <div className="h-40 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-20 bg-white/5 rounded-lg animate-pulse" />
      </div>
    );
  }

  const columns = preview.sampleData.length > 0 ? Object.keys(preview.sampleData[0]) : [];
  const hasWarnings = preview.warnings.length > 0;
  const hasHighNulls = Object.values(preview.nullStats).some((s) => s.percentage >= 5);

  // Overall severity
  const overallSeverity = Object.values(preview.nullStats).some((s) => s.percentage >= 20)
    ? 'error'
    : hasHighNulls
      ? 'warning'
      : 'ok';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Eye className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Preview Results</h3>
            <p className="text-xs text-muted-foreground">
              {preview.rowCount} sample rows processed
            </p>
          </div>
        </div>

        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        )}
      </div>

      {/* Overall Status */}
      <div className={`
        flex items-center gap-3 p-4 rounded-xl border
        ${severityConfig[overallSeverity].bgColor}
        ${severityConfig[overallSeverity].borderColor}
      `}>
        {(() => {
          const Icon = severityConfig[overallSeverity].icon;
          return <Icon className={`w-5 h-5 ${severityConfig[overallSeverity].color}`} />;
        })()}
        <div>
          <p className={`text-sm font-medium ${severityConfig[overallSeverity].color}`}>
            {overallSeverity === 'ok' && 'Join looks healthy!'}
            {overallSeverity === 'warning' && 'Some columns have NULL values'}
            {overallSeverity === 'error' && 'High NULL rate detected - review join configuration'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {overallSeverity === 'ok'
              ? 'All columns have acceptable NULL rates below 5%'
              : `${Object.values(preview.nullStats).filter((s) => s.percentage >= 5).length} column(s) may need attention`}
          </p>
        </div>
      </div>

      {/* NULL Statistics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">NULL Statistics</h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(preview.nullStats).map(([column, stats]) => {
            const severity = getNullSeverity(stats.percentage);
            const config = severityConfig[severity];

            return (
              <div
                key={column}
                className={`
                  p-3 rounded-lg border
                  ${config.bgColor} ${config.borderColor}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <code className="text-xs font-mono text-foreground truncate">{column}</code>
                  {severity !== 'ok' && (() => {
                    const Icon = config.icon;
                    return <Icon className={`w-3 h-3 ${config.color} shrink-0`} />;
                  })()}
                </div>
                <div className={`text-lg font-semibold ${config.color}`}>
                  {stats.percentage.toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {stats.count} of {preview.rowCount} NULL
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${severity === 'ok' ? 'bg-emerald-400' : severity === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(stats.percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-medium text-foreground">Warnings</h4>
          </div>
          <div className="space-y-1.5">
            {preview.warnings.map((warning, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20"
              >
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">{warning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample Data Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Sample Data</h4>
        </div>

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2.5 text-left font-mono font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sampleData.slice(0, 10).map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    {columns.map((col) => {
                      const value = row[col];
                      const isNull = value === null || value === undefined;

                      return (
                        <td
                          key={col}
                          className={`
                            px-3 py-2 font-mono whitespace-nowrap
                            ${isNull ? 'text-red-400/70 italic' : 'text-foreground'}
                          `}
                        >
                          {isNull ? 'NULL' : String(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.sampleData.length > 10 && (
            <div className="px-3 py-2 bg-white/[0.02] border-t border-white/5 text-xs text-muted-foreground text-center">
              Showing 10 of {preview.sampleData.length} rows
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {(onApprove || onReject) && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {onReject && (
            <Button
              variant="ghost"
              onClick={onReject}
              className="gap-2"
            >
              <XCircle className="w-4 h-4" />
              Revise Configuration
            </Button>
          )}
          {onApprove && (
            <Button
              onClick={onApprove}
              className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white gap-2"
              disabled={overallSeverity === 'error'}
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve & Continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
