'use client';

import { useState } from 'react';
import type { DiscoveredTable, SchemaDiscoveryResult } from '@/types';
import {
  ChevronRight,
  ChevronDown,
  Table2,
  Columns3,
  Key,
  Link2,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Binary,
  FileJson,
  CircleDot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Search,
  Database,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SchemaViewerProps {
  schema: SchemaDiscoveryResult | null;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
  onPreviewTable?: (table: DiscoveredTable) => void;
  previewingTable?: string | null;
}

function getTypeIcon(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('int') || normalizedType.includes('numeric') || normalizedType.includes('decimal')) {
    return <Hash className="w-3 h-3" />;
  }
  if (normalizedType.includes('char') || normalizedType.includes('text')) {
    return <Type className="w-3 h-3" />;
  }
  if (normalizedType.includes('timestamp') || normalizedType.includes('date') || normalizedType.includes('time')) {
    return <Calendar className="w-3 h-3" />;
  }
  if (normalizedType.includes('bool')) {
    return <ToggleLeft className="w-3 h-3" />;
  }
  if (normalizedType.includes('bytea') || normalizedType.includes('binary')) {
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

  if (normalizedType.includes('int') || normalizedType.includes('numeric') || normalizedType.includes('decimal')) {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
  if (normalizedType.includes('char') || normalizedType.includes('text')) {
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
  if (normalizedType.includes('timestamp') || normalizedType.includes('date') || normalizedType.includes('time')) {
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  }
  if (normalizedType.includes('bool')) {
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  }
  if (normalizedType.includes('json')) {
    return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  }
  if (normalizedType.includes('uuid')) {
    return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
  }

  return 'bg-white/10 text-muted-foreground border-white/20';
}

function formatRowCount(count?: number): string {
  if (count === undefined || count === null) return '';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M rows`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K rows`;
  return `${count} rows`;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface TableRowProps {
  table: DiscoveredTable;
  isExpanded: boolean;
  onToggle: () => void;
  onPreview?: (table: DiscoveredTable) => void;
  isPreviewing?: boolean;
}

function TableRow({ table, isExpanded, onToggle, onPreview, isPreviewing }: TableRowProps) {
  const hasForeignKeys = table.foreignKeys && table.foreignKeys.length > 0;

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      isPreviewing
        ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
    }`}>
      {/* Table Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
        >
        <span className="text-muted-foreground transition-transform duration-200">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>

        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Table2 className="w-4 h-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-foreground truncate">
              {table.schemaName}.{table.tableName}
            </span>

            {table.hasPrimaryKey && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">
                <Key className="w-3 h-3 text-yellow-500" />
              </span>
            )}

            {hasForeignKeys && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                <Link2 className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-blue-400">{table.foreignKeys.length}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{table.columns.length} columns</span>
            {table.rowCountEstimate !== undefined && (
              <span>{formatRowCount(table.rowCountEstimate)}</span>
            )}
            {table.tableSizeBytes !== undefined && (
              <span>{formatBytes(table.tableSizeBytes)}</span>
            )}
          </div>
        </div>

          {/* CDC Status Badge */}
          <div className="shrink-0">
            {table.cdcEligible ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                CDC Ready
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                <XCircle className="w-3.5 h-3.5" />
                Not Eligible
              </span>
            )}
          </div>
        </button>

        {/* Preview Button */}
        {onPreview && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(table);
            }}
            className={`shrink-0 gap-1.5 text-xs ${
              isPreviewing
                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {isPreviewing ? 'Viewing' : 'Preview'}
          </Button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/5 animate-fade-in">
          {/* CDC Issues */}
          {table.cdcIssues && table.cdcIssues.length > 0 && (
            <div className="px-4 py-3 bg-red-500/5 border-b border-white/5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {table.cdcIssues.map((issue, i) => (
                    <p key={i} className="text-xs text-red-400">{issue}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Columns */}
          <div className="divide-y divide-white/5">
            {table.columns.map((column, index) => (
              <div
                key={column.name}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <div className="w-8 flex justify-center">
                  {column.isPk ? (
                    <Key className="w-3.5 h-3.5 text-yellow-500" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  )}
                </div>

                <span className="font-mono text-sm text-foreground min-w-[140px]">
                  {column.name}
                </span>

                <span className={`
                  flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono
                  ${getTypeBadgeColor(column.type)}
                `}>
                  {getTypeIcon(column.type)}
                  {column.type}
                </span>

                <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                  {column.nullable && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px]">NULL</span>
                  )}
                  {column.default && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-mono truncate max-w-[120px]" title={column.default}>
                      = {column.default}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Foreign Keys */}
          {hasForeignKeys && (
            <div className="px-4 py-3 bg-blue-500/5 border-t border-white/5">
              <div className="text-xs font-medium text-blue-400 mb-2 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" />
                Foreign Keys
              </div>
              <div className="space-y-1.5">
                {table.foreignKeys.map((fk, i) => (
                  <div key={i} className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                    <span className="text-foreground">{fk.columns.join(', ')}</span>
                    <span className="text-white/30">→</span>
                    <span className="text-blue-400">{fk.refTable}</span>
                    <span className="text-white/30">(</span>
                    <span>{fk.refColumns.join(', ')}</span>
                    <span className="text-white/30">)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SchemaViewer({ schema, isLoading = false, onRefresh, onPreviewTable, previewingTable }: SchemaViewerProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const toggleTable = (tableKey: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableKey)) {
        next.delete(tableKey);
      } else {
        next.add(tableKey);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!schema) return;
    const allKeys = new Set<string>();
    schema.schemas.forEach((s) => {
      s.tables.forEach((t) => {
        allKeys.add(`${s.schemaName}.${t.tableName}`);
      });
    });
    setExpandedTables(allKeys);
  };

  const collapseAll = () => {
    setExpandedTables(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-2">
          Discovering Schema
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Analyzing tables, columns, and relationships...
        </p>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
            <Database className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-2">
          No Schema Discovered
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Select a database connection and click "Discover Schema" to explore tables and columns.
        </p>
      </div>
    );
  }

  // Flatten all tables for search
  const allTables = schema.schemas.flatMap((s) =>
    s.tables.map((t) => ({ ...t, schemaName: s.schemaName }))
  );

  // Filter tables based on search
  const filteredTables = searchQuery
    ? allTables.filter(
        (t) =>
          t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.schemaName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.columns.some((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : allTables;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-display font-semibold text-foreground">
            Database Schema
          </h3>
          <p className="text-sm text-muted-foreground">
            {schema.summary.totalTables} tables discovered • {schema.summary.cdcEligibleTables} CDC eligible
          </p>
        </div>

        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="text-2xl font-display font-bold text-foreground">
            {schema.summary.totalTables}
          </div>
          <div className="text-xs text-muted-foreground">Total Tables</div>
        </div>
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="text-2xl font-display font-bold text-green-400">
            {schema.summary.cdcEligibleTables}
          </div>
          <div className="text-xs text-green-400/70">CDC Ready</div>
        </div>
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <div className="text-2xl font-display font-bold text-yellow-400">
            {schema.summary.tablesWithoutPk}
          </div>
          <div className="text-xs text-yellow-400/70">No Primary Key</div>
        </div>
      </div>

      {/* Search & Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tables or columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">
            Collapse All
          </Button>
        </div>
      </div>

      {/* Tables List */}
      <div className="space-y-2">
        {filteredTables.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No tables found matching "{searchQuery}"
          </div>
        ) : (
          filteredTables.map((table) => {
            const tableKey = `${table.schemaName}.${table.tableName}`;
            return (
              <TableRow
                key={tableKey}
                table={table}
                isExpanded={expandedTables.has(tableKey)}
                onToggle={() => toggleTable(tableKey)}
                onPreview={onPreviewTable}
                isPreviewing={previewingTable === tableKey}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
