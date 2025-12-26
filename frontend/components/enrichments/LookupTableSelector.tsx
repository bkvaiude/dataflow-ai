'use client';

import { useState } from 'react';
import { LookupTable, ColumnInfo } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Database,
  Search,
  Check,
  Plus,
  X,
  Key,
  ChevronDown,
  ChevronRight,
  Table as TableIcon,
} from 'lucide-react';

interface AvailableTable {
  topic: string;
  name: string;
  keyColumn: string;
  schema: ColumnInfo[];
  rowEstimate?: number;
}

interface LookupTableSelectorProps {
  availableTables: AvailableTable[];
  selectedTables: LookupTable[];
  onSelectionChange: (tables: LookupTable[]) => void;
  isLoading?: boolean;
}

export function LookupTableSelector({
  availableTables,
  selectedTables,
  onSelectionChange,
  isLoading = false,
}: LookupTableSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [aliasInputs, setAliasInputs] = useState<Record<string, string>>({});

  const filteredTables = availableTables.filter(
    (table) =>
      table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      table.topic.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSelected = (topic: string) =>
    selectedTables.some((t) => t.topic === topic);

  const getNextAlias = () => {
    const usedAliases = selectedTables.map((t) => t.alias);
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (const letter of alphabet) {
      if (!usedAliases.includes(letter)) {
        return letter;
      }
    }
    return `t${selectedTables.length + 1}`;
  };

  const toggleTable = (table: AvailableTable) => {
    if (isSelected(table.topic)) {
      onSelectionChange(selectedTables.filter((t) => t.topic !== table.topic));
    } else {
      const alias = aliasInputs[table.topic] || getNextAlias();
      onSelectionChange([
        ...selectedTables,
        {
          topic: table.topic,
          key: table.keyColumn,
          alias,
          schema: table.schema,
        },
      ]);
    }
  };

  const updateAlias = (topic: string, alias: string) => {
    setAliasInputs({ ...aliasInputs, [topic]: alias });
    onSelectionChange(
      selectedTables.map((t) =>
        t.topic === topic ? { ...t, alias } : t
      )
    );
  };

  const removeTable = (topic: string) => {
    onSelectionChange(selectedTables.filter((t) => t.topic !== topic));
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search tables..."
          className="pl-9 bg-white/5 border-white/10 focus:border-green-500/50"
        />
      </div>

      {/* Selected tables summary */}
      {selectedTables.length > 0 && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              {selectedTables.length} table{selectedTables.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedTables.map((table) => (
              <div
                key={table.topic}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/20 text-xs"
              >
                <span className="font-mono text-green-300">{table.alias}:</span>
                <span className="text-foreground">{table.topic.split('.').pop()}</span>
                <button
                  onClick={() => removeTable(table.topic)}
                  className="ml-1 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available tables */}
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
        {filteredTables.map((table) => {
          const selected = isSelected(table.topic);
          const isExpanded = expandedTable === table.topic;

          return (
            <div
              key={table.topic}
              className={`
                rounded-xl border transition-all overflow-hidden
                ${selected
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'}
              `}
            >
              {/* Table header */}
              <div className="flex items-center p-3">
                <button
                  onClick={() => setExpandedTable(isExpanded ? null : table.topic)}
                  className="p-1 hover:bg-white/5 rounded transition-colors mr-2"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                <button
                  onClick={() => toggleTable(table)}
                  className={`
                    w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all mr-3
                    ${selected
                      ? 'bg-green-500 border-green-500'
                      : 'border-white/20 hover:border-green-500/50'}
                  `}
                >
                  {selected && <Check className="w-3 h-3 text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {table.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-xs text-muted-foreground font-mono truncate">
                      {table.topic}
                    </code>
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Key className="w-3 h-3" />
                      {table.keyColumn}
                    </div>
                  </div>
                </div>

                {selected && (
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-muted-foreground">Alias:</span>
                    <Input
                      value={selectedTables.find((t) => t.topic === table.topic)?.alias || ''}
                      onChange={(e) => updateAlias(table.topic, e.target.value.toLowerCase())}
                      className="w-12 h-7 text-xs font-mono text-center bg-white/5 border-white/20"
                      maxLength={3}
                    />
                  </div>
                )}
              </div>

              {/* Expanded schema view */}
              {isExpanded && (
                <div className="border-t border-white/5 p-3 bg-black/20">
                  <div className="text-xs text-muted-foreground mb-2">
                    {table.schema.length} columns
                    {table.rowEstimate && ` • ~${table.rowEstimate.toLocaleString()} rows`}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {table.schema.slice(0, 10).map((col) => (
                      <div
                        key={col.name}
                        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-white/5"
                      >
                        {col.isPk && <Key className="w-3 h-3 text-amber-400" />}
                        <span className="font-mono text-foreground truncate">{col.name}</span>
                        <span className="text-muted-foreground ml-auto uppercase text-[10px]">
                          {col.type.replace(/\(.*\)/, '')}
                        </span>
                      </div>
                    ))}
                  </div>
                  {table.schema.length > 10 && (
                    <div className="text-xs text-muted-foreground mt-2 text-center">
                      +{table.schema.length - 10} more columns
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredTables.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No tables match "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
