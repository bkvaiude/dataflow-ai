'use client';

import { useState, useMemo } from 'react';
import { ColumnInfo } from '@/types';
import { Input } from '@/components/ui/input';
import {
  Search,
  Check,
  Columns,
  Key,
  Circle,
} from 'lucide-react';

interface ColumnGroup {
  source: string;
  alias: string;
  columns: ColumnInfo[];
  color: string;
}

interface ColumnSelectorProps {
  columnGroups: ColumnGroup[];
  selectedColumns: string[];
  onSelectionChange: (columns: string[]) => void;
  maxHeight?: string;
}

export function ColumnSelector({
  columnGroups,
  selectedColumns,
  onSelectionChange,
  maxHeight = '320px',
}: ColumnSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return columnGroups;

    const lowerSearch = searchTerm.toLowerCase();
    return columnGroups.map((group) => ({
      ...group,
      columns: group.columns.filter(
        (col) =>
          col.name.toLowerCase().includes(lowerSearch) ||
          col.type.toLowerCase().includes(lowerSearch)
      ),
    })).filter((group) => group.columns.length > 0);
  }, [columnGroups, searchTerm]);

  const toggleColumn = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      onSelectionChange(selectedColumns.filter((c) => c !== columnId));
    } else {
      onSelectionChange([...selectedColumns, columnId]);
    }
  };

  const selectAllInGroup = (group: ColumnGroup) => {
    const groupColumnIds = group.columns.map((col) => `${group.alias}.${col.name}`);
    const allSelected = groupColumnIds.every((id) => selectedColumns.includes(id));

    if (allSelected) {
      onSelectionChange(selectedColumns.filter((c) => !groupColumnIds.includes(c)));
    } else {
      const newSelection = [...selectedColumns];
      groupColumnIds.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      onSelectionChange(newSelection);
    }
  };

  const totalColumns = columnGroups.reduce((acc, g) => acc + g.columns.length, 0);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search columns..."
          className="pl-9 bg-white/5 border-white/10 focus:border-cyan-500/50"
        />
      </div>

      {/* Selection stats */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          <Columns className="w-3.5 h-3.5 inline mr-1.5" />
          {totalColumns} columns available
        </span>
        <span className="text-cyan-400 font-medium">
          {selectedColumns.length} selected
        </span>
      </div>

      {/* Column list */}
      <div
        className="space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        style={{ maxHeight }}
      >
        {filteredGroups.map((group) => {
          const groupColumnIds = group.columns.map((col) => `${group.alias}.${col.name}`);
          const selectedInGroup = groupColumnIds.filter((id) => selectedColumns.includes(id)).length;
          const allSelected = selectedInGroup === group.columns.length;

          return (
            <div key={group.alias} className="space-y-2">
              {/* Group header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: group.color + '40', border: `1px solid ${group.color}` }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {group.source}
                  </span>
                  <code className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-white/5">
                    {group.alias}
                  </code>
                </div>
                <button
                  onClick={() => selectAllInGroup(group)}
                  className="text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Columns */}
              <div className="space-y-1 pl-5">
                {group.columns.map((col) => {
                  const columnId = `${group.alias}.${col.name}`;
                  const isSelected = selectedColumns.includes(columnId);

                  return (
                    <button
                      key={columnId}
                      onClick={() => toggleColumn(columnId)}
                      className={`
                        w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all
                        ${isSelected
                          ? 'bg-cyan-500/10 border border-cyan-500/30'
                          : 'bg-white/[0.02] border border-transparent hover:bg-white/5 hover:border-white/10'}
                      `}
                    >
                      {/* Checkbox */}
                      <div className={`
                        w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all
                        ${isSelected
                          ? 'bg-cyan-500 border-cyan-500'
                          : 'border-white/20'}
                      `}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>

                      {/* Column info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {col.isPk && (
                            <Key className="w-3 h-3 text-amber-400 shrink-0" />
                          )}
                          <span className="font-mono text-sm text-foreground truncate">
                            {col.name}
                          </span>
                        </div>
                      </div>

                      {/* Type badge */}
                      <div className="flex items-center gap-1.5">
                        {!col.nullable && (
                          <span title="NOT NULL">
                            <Circle className="w-2 h-2 text-red-400 fill-current" />
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-white/5 uppercase">
                          {col.type.replace(/\(.*\)/, '')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredGroups.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <p>No columns match "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
