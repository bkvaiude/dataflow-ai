'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Trash2,
  AlertTriangle,
  Server,
  Database,
  Cpu,
  HardDrive,
  Radio,
  Bell,
  Loader2,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  XCircle,
  Shield,
  Unplug
} from 'lucide-react';

export interface CleanupResource {
  resourceId: string;
  resourceType: string;
  resourceName: string;
  status: string;
  canDelete: boolean;
}

export interface CleanupConfirmContext {
  pipelineId: string;
  pipelineName: string;
  resources: CleanupResource[];
  totalResources: number;
  costSavings: {
    daily: number;
    monthly: number;
    yearly: number;
    breakdown?: Record<string, number>;
  };
  deletionOrder: string[];
  sessionId: string;
}

interface CleanupConfirmationProps {
  context: CleanupConfirmContext;
  onConfirm: (keepDestinationData: boolean) => void;
  onCancel: () => void;
}

export function CleanupConfirmation({ context, onConfirm, onCancel }: CleanupConfirmationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [keepDestinationData, setKeepDestinationData] = useState(true);
  const [confirmTyped, setConfirmTyped] = useState('');

  const handleDelete = () => {
    setIsLoading(true);
    onConfirm(keepDestinationData);
  };

  const formatCurrency = (amount: number) => {
    if (amount < 0.01 && amount > 0) return '<$0.01';
    return `$${amount.toFixed(2)}`;
  };

  const getResourceIcon = (resourceType: string) => {
    const typeLower = resourceType.toLowerCase();
    if (typeLower.includes('connector') || typeLower.includes('source')) {
      return <Unplug className="w-4 h-4" />;
    }
    if (typeLower.includes('sink')) {
      return <Server className="w-4 h-4" />;
    }
    if (typeLower.includes('topic') || typeLower.includes('kafka')) {
      return <Radio className="w-4 h-4" />;
    }
    if (typeLower.includes('stream') || typeLower.includes('ksql')) {
      return <Cpu className="w-4 h-4" />;
    }
    if (typeLower.includes('table') || typeLower.includes('clickhouse') || typeLower.includes('database')) {
      return <Database className="w-4 h-4" />;
    }
    if (typeLower.includes('alert')) {
      return <Bell className="w-4 h-4" />;
    }
    if (typeLower.includes('slot') || typeLower.includes('publication')) {
      return <HardDrive className="w-4 h-4" />;
    }
    return <Server className="w-4 h-4" />;
  };

  const getResourceTypeColor = (resourceType: string) => {
    const typeLower = resourceType.toLowerCase();
    if (typeLower.includes('connector')) return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    if (typeLower.includes('topic') || typeLower.includes('kafka')) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    if (typeLower.includes('stream') || typeLower.includes('ksql')) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    if (typeLower.includes('table') || typeLower.includes('clickhouse')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    if (typeLower.includes('alert')) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
  };

  const groupedResources = context.resources.reduce((acc, resource) => {
    const type = resource.resourceType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(resource);
    return acc;
  }, {} as Record<string, CleanupResource[]>);

  const destinationResources = context.resources.filter(r =>
    r.resourceType.toLowerCase().includes('clickhouse') ||
    r.resourceType.toLowerCase().includes('destination')
  );

  const isDeleteEnabled = confirmTyped.toLowerCase() === 'delete';

  return (
    <Card className="w-full max-w-2xl mx-auto border-red-900/50 bg-card/95 backdrop-blur-sm shadow-lg shadow-red-500/5 overflow-hidden">
      {/* Decorative top bar with warning gradient */}
      <div className="h-1 w-full bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-display flex items-center gap-2 text-red-400">
                Delete Pipeline
                <AlertTriangle className="w-4 h-4" />
              </CardTitle>
              <CardDescription className="text-sm">
                {context.pipelineName}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-xs text-red-400 border-red-500/30 bg-red-500/10"
          >
            {context.totalResources} resources
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">
                This action cannot be undone
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                All pipeline resources will be permanently deleted. Data flow will stop immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Resources to Delete */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Resources to be deleted</span>
          </div>

          <ScrollArea className="h-[200px] rounded-xl border border-border/50">
            <div className="p-3 space-y-3">
              {Object.entries(groupedResources).map(([type, resources]) => (
                <div key={type} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                    {getResourceIcon(type)}
                    <span>{type.replace(/_/g, ' ')}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {resources.length}
                    </Badge>
                  </div>
                  {resources.map((resource) => (
                    <div
                      key={resource.resourceId}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${getResourceTypeColor(type)}`}
                    >
                      <div className="flex items-center gap-2">
                        {resource.canDelete ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className="font-mono text-xs truncate max-w-[300px]">
                          {resource.resourceName || resource.resourceId}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          resource.status === 'active'
                            ? 'text-green-400 border-green-500/30'
                            : 'text-muted-foreground border-border'
                        }`}
                      >
                        {resource.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator className="bg-border/50" />

        {/* Keep Destination Data Option */}
        {destinationResources.length > 0 && (
          <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Shield className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <Label htmlFor="keep-data" className="text-sm font-medium cursor-pointer">
                    Keep destination data
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Preserve {destinationResources.length} table(s) in ClickHouse
                  </p>
                </div>
              </div>
              <Switch
                id="keep-data"
                checked={keepDestinationData}
                onCheckedChange={setKeepDestinationData}
                className="data-[state=checked]:bg-cyan-500"
              />
            </div>
            {!keepDestinationData && (
              <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  Destination tables and all data will be permanently deleted
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cost Savings */}
        <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingDown className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <span className="text-sm font-medium">Estimated Cost Savings</span>
              <p className="text-xs text-muted-foreground">After cleanup completes</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-xs text-muted-foreground mb-1">Daily</div>
              <div className="text-lg font-display font-semibold text-green-400">
                {formatCurrency(context.costSavings.daily)}
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-xs text-muted-foreground mb-1">Monthly</div>
              <div className="text-lg font-display font-semibold text-green-400">
                {formatCurrency(context.costSavings.monthly)}
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-xs text-muted-foreground mb-1">Yearly</div>
              <div className="text-lg font-display font-semibold text-green-400">
                {formatCurrency(context.costSavings.yearly)}
              </div>
            </div>
          </div>

          {context.costSavings.breakdown && Object.keys(context.costSavings.breakdown).length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-500/20">
              <div className="flex flex-wrap gap-2">
                {Object.entries(context.costSavings.breakdown).map(([type, amount]) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className="text-xs text-green-400 border-green-500/30"
                  >
                    {type.replace(/_/g, ' ')}: {formatCurrency(amount)}/day
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Input */}
        <div className="space-y-2">
          <Label htmlFor="confirm-delete" className="text-sm text-muted-foreground">
            Type <span className="font-mono text-red-400 font-bold">delete</span> to confirm
          </Label>
          <input
            id="confirm-delete"
            type="text"
            value={confirmTyped}
            onChange={(e) => setConfirmTyped(e.target.value)}
            placeholder="Type 'delete' to confirm"
            className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border/50 focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 text-sm font-mono placeholder:text-muted-foreground/50 transition-all"
          />
        </div>
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
          variant="destructive"
          onClick={handleDelete}
          disabled={isLoading || !isDeleteEnabled}
          className="min-w-[160px] bg-red-600 hover:bg-red-500 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Pipeline
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
