'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Database, Table2, Plus, FolderOpen, CheckCircle, Loader2, ChevronDown } from 'lucide-react';
import type { ClickHouseConfigContext } from '@/types';

interface ClickHouseConfigFormProps {
  context: ClickHouseConfigContext;
  onConfirm: (config: { database: string; table: string; createNew: boolean }) => void;
  onCancel: () => void;
}

export function ClickHouseConfigForm({ context, onConfirm, onCancel }: ClickHouseConfigFormProps) {
  // Safe access with fallbacks - read from context first
  const existingTables = context?.existingTables || [];
  const suggestedDatabase = context?.suggestedDatabase || 'default';
  const suggestedTable = context?.suggestedTable || 'events';

  const [mode, setMode] = useState<'create' | 'existing'>(
    existingTables.length > 0 ? 'existing' : 'create'
  );
  const [database, setDatabase] = useState(suggestedDatabase);
  const [table, setTable] = useState(suggestedTable);
  const [selectedExisting, setSelectedExisting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showExistingDropdown, setShowExistingDropdown] = useState(false);

  const handleConfirm = () => {
    if (mode === 'create' && (!database.trim() || !table.trim())) return;
    if (mode === 'existing' && !selectedExisting) return;

    setIsLoading(true);

    if (mode === 'existing' && selectedExisting) {
      const [db, tbl] = selectedExisting.split('.');
      onConfirm({ database: db, table: tbl, createNew: false });
    } else {
      onConfirm({ database: database.trim(), table: table.trim(), createNew: true });
    }
  };

  const handleSelectExisting = (db: string, tbl: string) => {
    setSelectedExisting(`${db}.${tbl}`);
    setDatabase(db);
    setTable(tbl);
    setShowExistingDropdown(false);
  };

  return (
    <Card className="w-full max-w-xl mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Database className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Configure ClickHouse Destination</CardTitle>
            <CardDescription className="text-sm">
              Select or create a ClickHouse table for your CDC data
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Mode Toggle */}
        <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'create'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Plus className="w-4 h-4" />
            Create New
          </button>
          <button
            onClick={() => setMode('existing')}
            disabled={existingTables.length === 0}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'existing'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            } ${existingTables.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <FolderOpen className="w-4 h-4" />
            Use Existing
          </button>
        </div>

        {mode === 'create' ? (
          <>
            {/* Database Input */}
            <div className="space-y-2">
              <Label htmlFor="database" className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                Database Name
              </Label>
              <Input
                id="database"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="e.g., dataflow"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Will be created if it doesn't exist
              </p>
            </div>

            {/* Table Input */}
            <div className="space-y-2">
              <Label htmlFor="table" className="text-sm font-medium flex items-center gap-2">
                <Table2 className="w-4 h-4 text-muted-foreground" />
                Table Name
              </Label>
              <Input
                id="table"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                placeholder="e.g., audit_logs_cdc"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                CDC metadata columns will be added automatically
              </p>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Full table path:</p>
              <code className="text-sm font-mono text-foreground">
                {database || 'database'}.{table || 'table'}
              </code>
            </div>
          </>
        ) : (
          <>
            {/* Existing Tables Dropdown */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                Select Existing Table
              </Label>
              <div className="relative">
                <button
                  onClick={() => setShowExistingDropdown(!showExistingDropdown)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
                >
                  <span className={selectedExisting ? 'font-mono' : 'text-muted-foreground'}>
                    {selectedExisting || 'Choose a table...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showExistingDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showExistingDropdown && (
                  <div className="absolute z-10 w-full mt-1 py-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {existingTables.map((t) => (
                      <button
                        key={`${t.database}.${t.table}`}
                        onClick={() => handleSelectExisting(t.database, t.table)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-mono text-sm">{t.database}.{t.table}</span>
                        <Badge variant="secondary" className="text-xs">
                          {t.rowCount.toLocaleString()} rows
                        </Badge>
                      </button>
                    ))}
                    {existingTables.length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        No existing tables found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedExisting && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Selected table:</p>
                <code className="text-sm font-mono text-foreground">{selectedExisting}</code>
              </div>
            )}
          </>
        )}

        <Separator />

        {/* Source Tables Info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Table2 className="w-4 h-4" />
          <span>
            Syncing <strong className="text-foreground">{context.selectedTables.length}</strong> source table(s)
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={
            isLoading ||
            (mode === 'create' && (!database.trim() || !table.trim())) ||
            (mode === 'existing' && !selectedExisting)
          }
          className="min-w-[140px]"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Continue
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
