'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, Search, CheckCircle, AlertTriangle, Loader2, Database } from 'lucide-react';
import type { TableConfirmContext } from '@/types';

interface TableSelectorProps {
  context: TableConfirmContext;
  onConfirm: (selectedTables: string[]) => void;
  onCancel: () => void;
}

export function TableSelector({ context, onConfirm, onCancel }: TableSelectorProps) {
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    new Set(context.recommendedTables || [])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return context.tables;
    const query = searchQuery.toLowerCase();
    return context.tables.filter(
      (table) =>
        table.name.toLowerCase().includes(query) ||
        table.schema.toLowerCase().includes(query)
    );
  }, [context.tables, searchQuery]);

  const eligibleTables = context.tables.filter((t) => t.cdcEligible);

  const toggleTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }
    setSelectedTables(newSelected);
  };

  const selectAll = () => {
    setSelectedTables(new Set(eligibleTables.map((t) => `${t.schema}.${t.name}`)));
  };

  const deselectAll = () => {
    setSelectedTables(new Set());
  };

  const handleConfirm = () => {
    setIsLoading(true);
    onConfirm(Array.from(selectedTables));
  };

  const formatRowCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Table className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Select Tables</CardTitle>
              <CardDescription className="text-sm">
                Choose which tables to sync from {context.credentialName}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {selectedTables.size} selected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search and Bulk Actions */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Clear
          </Button>
        </div>

        {/* Table List */}
        <ScrollArea className="h-[300px] rounded-lg border">
          <div className="p-2 space-y-1">
            {filteredTables.map((table) => {
              const fullName = `${table.schema}.${table.name}`;
              const isSelected = selectedTables.has(fullName);
              const isRecommended = context.recommendedTables?.includes(fullName);

              return (
                <div
                  key={fullName}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted/50'
                  } ${!table.cdcEligible ? 'opacity-60' : ''}`}
                  onClick={() => table.cdcEligible && toggleTable(fullName)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={!table.cdcEligible}
                    className="pointer-events-none"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-mono text-sm truncate">
                        {table.schema}.{table.name}
                      </span>
                      {isRecommended && (
                        <Badge variant="secondary" className="text-xs">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    {table.issues && table.issues.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-amber-500">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{table.issues[0]}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-mono">{formatRowCount(table.rowCount)} rows</span>
                    {table.cdcEligible ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>
              );
            })}

            {filteredTables.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No tables found matching "{searchQuery}"
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="text-sm text-muted-foreground">
          {eligibleTables.length} of {context.tables.length} tables are CDC-eligible
        </div>
      </CardContent>

      <CardFooter className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading || selectedTables.size === 0}
          className="min-w-[120px]"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Continue ({selectedTables.size})
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
