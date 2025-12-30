'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  TrendingUp,
  Server,
  Database,
  Cpu,
  HardDrive,
  CheckCircle,
  Info,
  Calendar,
  CalendarDays,
  CalendarRange,
  Loader2,
  Zap,
  BarChart3
} from 'lucide-react';

export interface CostComponent {
  name: string;
  description: string;
  unitCost: number;
  unit: string;
  quantity: number;
  dailyCost: number;
  monthlyCost: number;
}

export interface CostEstimateContext {
  pipelineName: string;
  components: CostComponent[];
  totals: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  notes: string[];
  assumptions: {
    tables?: number;
    estimatedEventsPerDay?: number;
    effectiveEventsPerDay?: number;
    avgRowSizeBytes?: number;
    filterApplied?: boolean;
    filterReductionPercent?: number;
    aggregationApplied?: boolean;
  };
  sessionId: string;
}

interface CostEstimateProps {
  context: CostEstimateContext;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CostEstimate({ context, onConfirm, onCancel }: CostEstimateProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

  const handleConfirm = () => {
    setIsLoading(true);
    onConfirm();
  };

  const formatCurrency = (amount: number) => {
    if (amount < 0.01 && amount > 0) return '<$0.01';
    return `$${amount.toFixed(2)}`;
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const getComponentIcon = (name: string) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('connector') || nameLower.includes('source') || nameLower.includes('sink')) {
      return <Server className="w-4 h-4" />;
    }
    if (nameLower.includes('throughput') || nameLower.includes('data')) {
      return <TrendingUp className="w-4 h-4" />;
    }
    if (nameLower.includes('kafka') || nameLower.includes('storage')) {
      return <HardDrive className="w-4 h-4" />;
    }
    if (nameLower.includes('ksql') || nameLower.includes('processing')) {
      return <Cpu className="w-4 h-4" />;
    }
    if (nameLower.includes('clickhouse') || nameLower.includes('destination')) {
      return <Database className="w-4 h-4" />;
    }
    return <Zap className="w-4 h-4" />;
  };

  const getCostForView = (component: CostComponent) => {
    switch (viewMode) {
      case 'daily': return component.dailyCost;
      case 'monthly': return component.monthlyCost;
      case 'yearly': return component.monthlyCost * 12;
    }
  };

  const getTotalForView = () => {
    switch (viewMode) {
      case 'daily': return context.totals.daily;
      case 'monthly': return context.totals.monthly;
      case 'yearly': return context.totals.yearly;
    }
  };

  const maxCost = Math.max(...context.components.map(c => getCostForView(c)));

  return (
    <Card className="w-full max-w-2xl mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden">
      {/* Decorative top bar with gradient */}
      <div className="h-1 w-full bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                Cost Estimate
                <BarChart3 className="w-4 h-4 text-green-400" />
              </CardTitle>
              <CardDescription className="text-sm">
                {context.pipelineName}
              </CardDescription>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 border border-border/50">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'daily'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3 h-3" />
              Daily
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'monthly'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              Monthly
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'yearly'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarRange className="w-3 h-3" />
              Yearly
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Total Cost Display */}
        <div className="relative p-6 rounded-xl bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent border border-green-500/30 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-500/10 via-transparent to-transparent" />
          <div className="relative text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Estimated {viewMode} cost
            </p>
            <div className="text-4xl font-display font-bold text-green-400">
              {formatCurrency(getTotalForView())}
            </div>
            {viewMode === 'daily' && (
              <p className="text-sm text-muted-foreground mt-2">
                ~{formatCurrency(context.totals.monthly)}/month
              </p>
            )}
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Cost Breakdown</span>
          </div>

          <div className="space-y-2">
            {context.components.map((component, index) => {
              const cost = getCostForView(component);
              const percentage = maxCost > 0 ? (cost / maxCost) * 100 : 0;

              return (
                <div
                  key={index}
                  className="p-3 rounded-xl bg-muted/20 border border-border/30 hover:border-border/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-green-500/10 text-green-400">
                        {getComponentIcon(component.name)}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{component.name}</span>
                        <p className="text-xs text-muted-foreground">{component.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-medium text-green-400">
                        {formatCurrency(cost)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(component.unitCost)}/{component.unit}
                      </p>
                    </div>
                  </div>

                  {/* Cost Bar */}
                  <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Assumptions */}
        {context.assumptions && Object.keys(context.assumptions).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Assumptions</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {context.assumptions.tables && (
                <div className="p-2 rounded-lg bg-muted/20 text-xs">
                  <span className="text-muted-foreground">Tables:</span>{' '}
                  <span className="font-medium">{context.assumptions.tables}</span>
                </div>
              )}
              {context.assumptions.estimatedEventsPerDay && (
                <div className="p-2 rounded-lg bg-muted/20 text-xs">
                  <span className="text-muted-foreground">Events/day:</span>{' '}
                  <span className="font-medium">~{formatNumber(context.assumptions.estimatedEventsPerDay)}</span>
                </div>
              )}
              {context.assumptions.effectiveEventsPerDay && context.assumptions.filterApplied && (
                <div className="p-2 rounded-lg bg-muted/20 text-xs">
                  <span className="text-muted-foreground">After filter:</span>{' '}
                  <span className="font-medium text-green-400">~{formatNumber(context.assumptions.effectiveEventsPerDay)}</span>
                </div>
              )}
              {context.assumptions.avgRowSizeBytes && (
                <div className="p-2 rounded-lg bg-muted/20 text-xs">
                  <span className="text-muted-foreground">Avg row size:</span>{' '}
                  <span className="font-medium">{context.assumptions.avgRowSizeBytes} bytes</span>
                </div>
              )}
              {context.assumptions.filterApplied && context.assumptions.filterReductionPercent && (
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs col-span-2">
                  <span className="text-green-400">Filter saves {context.assumptions.filterReductionPercent.toFixed(0)}% of data volume</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {context.notes && context.notes.length > 0 && (
          <div className="space-y-2">
            {context.notes.map((note, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{note}</span>
              </div>
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
          Go Back
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading}
          className="min-w-[160px] bg-green-600 text-white hover:bg-green-500"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirm & Create
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
