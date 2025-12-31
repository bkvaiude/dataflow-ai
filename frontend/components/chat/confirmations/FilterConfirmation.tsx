'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Filter,
  Code2,
  TrendingDown,
  Table,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Database
} from 'lucide-react';

export interface FilterConfirmContext {
  originalRequirement: string;
  column: string;
  operator: string;
  values: string[];
  sqlWhere: string;
  totalRows: number;
  filteredRows: number;
  filterRatio: number;
  reductionPercent: number;
  previewRows: Array<Record<string, unknown>>;
  previewColumns: string[];
  alternativeColumns?: string[];
  confidence: number;
  sessionId: string;
}

interface FilterConfirmationProps {
  context: FilterConfirmContext;
  onConfirm: (applyFilter: boolean) => void;
  onCancel: () => void;
}

export function FilterConfirmation({ context, onConfirm, onCancel }: FilterConfirmationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'filter' | 'all' | null>(null);

  const handleApplyFilter = () => {
    setSelectedAction('filter');
    setIsLoading(true);
    onConfirm(true);
  };

  const handleSyncAll = () => {
    setSelectedAction('all');
    setIsLoading(true);
    onConfirm(false);
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const confidenceColor = context.confidence >= 0.7
    ? 'text-green-400'
    : context.confidence >= 0.4
    ? 'text-amber-400'
    : 'text-red-400';

  return (
    <Card className="w-full max-w-2xl mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden">
      {/* Decorative top bar with gradient */}
      <div className="h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-primary" />

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 glow-primary">
              <Filter className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                Data Filter Detected
                <Sparkles className="w-4 h-4 text-amber-400" />
              </CardTitle>
              <CardDescription className="text-sm">
                AI analyzed your requirement and generated a filter
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${confidenceColor} border-current`}
          >
            {Math.round(context.confidence * 100)}% match
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Original Requirement */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-purple-500/20 mt-0.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Your Requirement
              </p>
              <p className="text-sm font-medium italic">
                "{context.originalRequirement}"
              </p>
            </div>
          </div>
        </div>

        {/* Generated SQL */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Generated Filter</span>
          </div>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative p-4 rounded-xl bg-zinc-900/80 border border-primary/30 font-mono text-sm overflow-x-auto">
              <span className="text-purple-400">WHERE</span>{' '}
              <span className="text-primary">{context.column}</span>{' '}
              <span className="text-zinc-400">{context.operator}</span>{' '}
              <span className="text-amber-400">
                {context.values.length > 1
                  ? `(${context.values.map(v => `'${v}'`).join(', ')})`
                  : `'${context.values[0]}'`}
              </span>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Impact Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-2">
              <Database className="w-3.5 h-3.5" />
              Total Rows
            </div>
            <div className="text-2xl font-display font-semibold">
              {formatNumber(context.totalRows)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/30 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-center gap-1 text-primary text-xs mb-2">
                <Filter className="w-3.5 h-3.5" />
                Filtered
              </div>
              <div className="text-2xl font-display font-semibold text-primary">
                {formatNumber(context.filteredRows)}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/30 text-center">
            <div className="flex items-center justify-center gap-1 text-green-400 text-xs mb-2">
              <TrendingDown className="w-3.5 h-3.5" />
              Reduction
            </div>
            <div className="text-2xl font-display font-semibold text-green-400">
              {context.reductionPercent.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Visual Flow */}
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="px-3 py-1.5 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            {formatNumber(context.totalRows)} rows
          </div>
          <ArrowRight className="w-5 h-5 text-primary animate-pulse" />
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-sm text-primary font-medium border border-primary/30">
            {formatNumber(context.filteredRows)} rows
          </div>
        </div>

        {/* Sample Preview */}
        {context.previewRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sample Filtered Data</span>
            </div>
            <ScrollArea className="h-[140px] rounded-xl border border-border/50">
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50">
                      {context.previewColumns.slice(0, 5).map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-mono text-muted-foreground"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {context.previewRows.slice(0, 5).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                      >
                        {context.previewColumns.slice(0, 5).map((col) => (
                          <td key={col} className="px-3 py-2 font-mono truncate max-w-[120px]">
                            {row[col] !== null && row[col] !== undefined
                              ? String(row[col])
                              : <span className="text-muted-foreground/50">null</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Alternative Columns Hint */}
        {context.alternativeColumns && context.alternativeColumns.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Alternative filter columns:{' '}
            {context.alternativeColumns.map((col, i) => (
              <span key={col}>
                <code className="px-1 py-0.5 rounded bg-muted/50">{col}</code>
                {i < context.alternativeColumns!.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-3 justify-end pt-4 border-t border-border/50">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="min-w-[100px]"
        >
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={handleSyncAll}
          disabled={isLoading}
          className="min-w-[120px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
        >
          {isLoading && selectedAction === 'all' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <XCircle className="w-4 h-4 mr-2" />
              Sync All Data
            </>
          )}
        </Button>
        <Button
          onClick={handleApplyFilter}
          disabled={isLoading}
          className="min-w-[140px] bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
        >
          {isLoading && selectedAction === 'filter' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Apply Filter
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
