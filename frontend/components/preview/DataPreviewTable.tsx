'use client';

import { useState, useCallback } from 'react';
import type { SampleDataResult, ColumnMetadata } from '@/types/preview';
import {
  Table2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Binary,
  FileJson,
  CircleDot,
  Columns3,
  AlertCircle,
  Loader2,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataPreviewTableProps {
  data: SampleDataResult | null;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
  maxHeight?: string;
}

function getTypeIcon(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('int') || normalizedType.includes('numeric') || normalizedType.includes('decimal') || normalizedType.includes('float') || normalizedType.includes('double')) {
    return <Hash className="w-3 h-3" />;
  }
  if (normalizedType.includes('char') || normalizedType.includes('text') || normalizedType.includes('string')) {
    return <Type className="w-3 h-3" />;
  }
  if (normalizedType.includes('timestamp') || normalizedType.includes('date') || normalizedType.includes('time')) {
    return <Calendar className="w-3 h-3" />;
  }
  if (normalizedType.includes('bool')) {
    return <ToggleLeft className="w-3 h-3" />;
  }
  if (normalizedType.includes('bytea') || normalizedType.includes('binary') || normalizedType.includes('blob')) {
    return <Binary className="w-3 h-3" />;
  }
  if (normalizedType.includes('json')) {
    return <FileJson className="w-3 h-3" />;
  }
  if (normalizedType.includes('uuid')) {
    return <CircleDot className="w-3 h-3" />;
  }

  return <Columns3 className="w-3 h-3" />;
}

function getTypeBadgeColor(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('int') || normalizedType.includes('numeric') || normalizedType.includes('decimal') || normalizedType.includes('float') || normalizedType.includes('double')) {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
  if (normalizedType.includes('char') || normalizedType.includes('text') || normalizedType.includes('string')) {
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  }
  if (normalizedType.includes('timestamp') || normalizedType.includes('date') || normalizedType.includes('time')) {
    return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
  }
  if (normalizedType.includes('bool')) {
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }
  if (normalizedType.includes('json')) {
    return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  }
  if (normalizedType.includes('uuid')) {
    return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
  }
  if (normalizedType.includes('bytea') || normalizedType.includes('binary') || normalizedType.includes('blob')) {
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }

  return 'bg-white/10 text-muted-foreground border-white/20';
}

function formatCellValue(value: unknown, type: string): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  const strValue = String(value);

  // Truncate long values
  if (strValue.length > 100) {
    return strValue.substring(0, 100) + '...';
  }

  return strValue;
}

function CellContent({ value, type, onCopy }: { value: unknown; type: string; onCopy: (text: string) => void }) {
  const isNull = value === null || value === undefined;
  const displayValue = formatCellValue(value, type);

  return (
    <div
      className={`
        group relative px-3 py-2 min-w-[80px] max-w-[300px] cursor-pointer
        ${isNull ? 'bg-red-500/10' : 'hover:bg-white/[0.03]'}
        transition-colors
      `}
      onClick={() => !isNull && onCopy(String(value))}
      title={isNull ? 'NULL value' : `Click to copy: ${displayValue}`}
    >
      {isNull ? (
        <span className="flex items-center gap-1.5 text-red-400 text-xs font-mono">
          <AlertCircle className="w-3 h-3" />
          NULL
        </span>
      ) : (
        <span className="text-sm font-mono text-foreground/90 truncate block">
          {displayValue}
        </span>
      )}

      {/* Copy indicator on hover */}
      {!isNull && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Copy className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function DataPreviewTable({ data, isLoading = false, onRefresh, maxHeight = '500px' }: DataPreviewTableProps) {
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 50;

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCell(text);
      setTimeout(() => setCopiedCell(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          </div>
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">
            Loading Sample Data
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Fetching rows from your database...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
              <Table2 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">
            No Data Preview
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Select a table and click "Preview Data" to see sample rows.
          </p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(data.rows.length / rowsPerPage);
  const paginatedRows = data.rows.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );
  const startRow = currentPage * rowsPerPage + 1;
  const endRow = Math.min((currentPage + 1) * rowsPerPage, data.rows.length);

  // Count NULL values per column
  const nullCounts = data.columns.map((_, colIndex) =>
    data.rows.filter(row => row[colIndex] === null || row[colIndex] === undefined).length
  );

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-primary/5 to-violet-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-display font-semibold text-foreground flex items-center gap-2">
                {data.schemaName}.{data.tableName}
                {copiedCell && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1 animate-fade-in">
                    <Check className="w-3 h-3" /> Copied
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">
                Showing {startRow.toLocaleString()}-{endRow.toLocaleString()} of {data.rowCount.toLocaleString()} rows
                <span className="text-white/30 mx-2">•</span>
                {data.totalRowsEstimate.toLocaleString()} total in table
              </p>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="w-8 h-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page {currentPage + 1} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
                className="w-8 h-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Column count badges */}
        <div className="flex items-center gap-2 mt-3 text-xs">
          <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-muted-foreground">
            {data.columns.length} columns
          </span>
          {nullCounts.some(c => c > 0) && (
            <span className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {nullCounts.filter(c => c > 0).length} columns with NULLs
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1a1a1f] border-b border-white/10">
              {/* Row number header */}
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-[#1a1a1f] sticky left-0 z-20 border-r border-white/5">
                #
              </th>

              {data.columns.map((column, index) => (
                <th
                  key={column.name}
                  className="px-3 py-3 text-left bg-[#1a1a1f] min-w-[120px]"
                >
                  <div className="space-y-1.5">
                    <span className="font-mono text-sm font-medium text-foreground flex items-center gap-2">
                      {column.name}
                      {column.nullable && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-muted-foreground uppercase">
                          null
                        </span>
                      )}
                    </span>
                    <span className={`
                      inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono
                      ${getTypeBadgeColor(column.type)}
                    `}>
                      {getTypeIcon(column.type)}
                      {column.type}
                    </span>
                    {nullCounts[index] > 0 && (
                      <div className="text-[10px] text-red-400">
                        {nullCounts[index]} nulls ({((nullCounts[index] / data.rows.length) * 100).toFixed(1)}%)
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {paginatedRows.map((row, rowIndex) => {
              const actualRowIndex = currentPage * rowsPerPage + rowIndex;
              return (
                <tr
                  key={actualRowIndex}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  {/* Row number */}
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground bg-[#0f0f14] sticky left-0 border-r border-white/5">
                    {actualRowIndex + 1}
                  </td>

                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className="p-0 border-r border-white/[0.03] last:border-r-0">
                      <CellContent
                        value={cell}
                        type={data.columns[colIndex].type}
                        onCopy={handleCopy}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Fetched at {new Date(data.fetchedAt).toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          Click any cell to copy its value
        </p>
      </div>
    </div>
  );
}
