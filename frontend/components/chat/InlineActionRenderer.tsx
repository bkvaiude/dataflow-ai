'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Database,
  Table,
  Filter,
  Server,
  FileCode,
  DollarSign,
  Bell,
  GitBranch,
  Package,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Code2,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import type { ParsedAction } from '@/lib/actionParser';
import { mapActionType } from '@/lib/actionParser';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/lib/socket';

interface InlineActionRendererProps {
  action: ParsedAction;
  onComplete?: () => void;
}

/**
 * Renders inline confirmation UI based on the action type
 * These are beautiful, contextual components that replace raw JSON
 */
export function InlineActionRenderer({ action, onComplete }: InlineActionRendererProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { user } = useAuthStore();
  const actionType = mapActionType(action.type);

  const sendConfirmation = (confirmed: boolean, extraData?: Record<string, unknown>) => {
    const socket = getSocket();
    if (socket && user?.id) {
      setIsLoading(true);

      const message = confirmed ? 'yes' : 'no';

      // user_id is retrieved from Socket.IO session on backend - no need to send it
      socket.emit('chat_message', {
        message,
        _confirmation: {
          action_type: action.type,
          confirmed,
          ...action.data,
          ...extraData,
        },
      });

      setTimeout(() => {
        setIsLoading(false);
        setIsComplete(true);
        onComplete?.();
      }, 500);
    }
  };

  if (isComplete) {
    return null;
  }

  // Render based on action type
  switch (actionType) {
    case 'source_select':
      return (
        <SourceSelectCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    case 'tables':
      return (
        <TablesCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    case 'filter':
      return (
        <FilterCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    case 'schema':
    case 'destination_schema':
      return (
        <SchemaCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    case 'destination':
      return (
        <DestinationCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    case 'cost':
      return (
        <CostCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    case 'alert_config':
      return (
        <AlertCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    case 'topic':
      return (
        <TopicCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    case 'resources':
      return (
        <ResourcesCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    case 'pipeline_create':
      return (
        <PipelineCreateCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );

    default:
      return (
        <GenericCard
          data={action.data}
          isLoading={isLoading}
          onConfirm={() => sendConfirmation(true)}
          onCancel={() => sendConfirmation(false)}
        />
      );
  }
}

// ============================================================================
// Individual Card Components with Beautiful Design
// ============================================================================

interface CardProps {
  data: Record<string, unknown>;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function SourceSelectCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  return (
    <Card className="w-full border-primary/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-cyan-500 to-primary" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 glow-primary">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Confirm Data Source</CardTitle>
            <p className="text-xs text-muted-foreground">
              {data.name as string || 'Selected source'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {data.database ? (
            <div className="p-2 rounded-lg bg-muted/30">
              <span className="text-muted-foreground text-xs">Database:</span>
              <p className="font-mono text-primary">{data.database as string}</p>
            </div>
          ) : null}
          {data.host ? (
            <div className="p-2 rounded-lg bg-muted/30">
              <span className="text-muted-foreground text-xs">Host:</span>
              <p className="font-mono truncate">{data.host as string}</p>
            </div>
          ) : null}
          {data.source_type ? (
            <div className="p-2 rounded-lg bg-muted/30">
              <span className="text-muted-foreground text-xs">Type:</span>
              <p className="font-mono">{data.source_type as string}</p>
            </div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          <XCircle className="w-4 h-4 mr-1.5" />
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-primary glow-primary">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Use This Source
        </Button>
      </CardFooter>
    </Card>
  );
}

function TablesCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  const tables = data.tables as string || data.table as string;

  return (
    <Card className="w-full border-cyan-500/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Table className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Confirm Table Selection</CardTitle>
            <p className="text-xs text-muted-foreground">Recommended based on your request</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <CheckCircle className="w-4 h-4 text-cyan-400" />
          <code className="text-sm font-mono text-cyan-400">{tables}</code>
          <Badge variant="outline" className="ml-auto text-xs border-cyan-500/30 text-cyan-400">
            Recommended
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Change Selection
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-cyan-600 hover:bg-cyan-500">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Confirm Table
        </Button>
      </CardFooter>
    </Card>
  );
}

function FilterCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  const whereClause = data.where_clause as string || data.sql_where as string || '';
  const rowCount = data.row_count as number || data.filteredRows as number;
  const originalCount = data.original_row_count as number || data.totalRows as number;

  return (
    <Card className="w-full border-purple-500/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <Filter className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              Data Filter Detected
              <Sparkles className="w-4 h-4 text-amber-400" />
            </CardTitle>
            <p className="text-xs text-muted-foreground">AI generated filter from your requirement</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        {/* SQL Display */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl blur-xl opacity-50" />
          <div className="relative p-3 rounded-xl bg-zinc-900/80 border border-purple-500/30 font-mono text-sm">
            <Code2 className="w-4 h-4 text-purple-400 inline mr-2" />
            <span className="text-purple-300">{whereClause}</span>
          </div>
        </div>

        {/* Impact */}
        {rowCount && originalCount && (
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="px-3 py-1.5 rounded-lg bg-muted/50 text-xs">
              {originalCount.toLocaleString()} rows
            </div>
            <ArrowRight className="w-4 h-4 text-purple-400" />
            <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-xs text-purple-400 font-medium border border-purple-500/30">
              {rowCount.toLocaleString()} rows
            </div>
            <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
              <TrendingDown className="w-3 h-3 mr-1" />
              {(((originalCount - rowCount) / originalCount) * 100).toFixed(0)}% less
            </Badge>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Sync All Data
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-purple-600 hover:bg-purple-500">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Apply Filter
        </Button>
      </CardFooter>
    </Card>
  );
}

function SchemaCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  const columns = data.columns as string || '';
  let parsedColumns: Array<{ name: string; type: string }> = [];

  try {
    if (typeof columns === 'string' && columns.startsWith('[')) {
      parsedColumns = JSON.parse(columns.replace(/'/g, '"'));
    }
  } catch {
    // Keep empty
  }

  return (
    <Card className="w-full border-amber-500/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <FileCode className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Schema Preview</CardTitle>
            <p className="text-xs text-muted-foreground">Review the table structure</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {parsedColumns.length > 0 ? (
          <ScrollArea className="h-[120px]">
            <div className="space-y-1">
              {parsedColumns.map((col, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 text-xs">
                  <code className="font-mono text-amber-400">{col.name}</code>
                  <Badge variant="outline" className="text-xs">{col.type}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
            Schema information available
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Modify
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-amber-600 hover:bg-amber-500">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Confirm Schema
        </Button>
      </CardFooter>
    </Card>
  );
}

function DestinationCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  const destType = data.destination_type as string || 'clickhouse';

  return (
    <Card className="w-full border-green-500/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
            <Server className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Confirm Destination</CardTitle>
            <p className="text-xs text-muted-foreground">Data will be synced here</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <Database className="w-5 h-5 text-green-400" />
          <span className="font-medium text-green-400 capitalize">{destType}</span>
          <Badge variant="outline" className="ml-auto text-xs border-green-500/30 text-green-400">
            Ready
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Change
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-green-600 hover:bg-green-500">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Use {destType}
        </Button>
      </CardFooter>
    </Card>
  );
}

function CostCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  const totalCost = data.total_cost as number || 0;
  const monthlyCost = data.monthly_cost as number || totalCost * 30;

  return (
    <Card className="w-full border-emerald-500/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Cost Estimate</CardTitle>
            <p className="text-xs text-muted-foreground">Estimated pipeline costs</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-xs text-muted-foreground mb-1">Estimated daily cost</p>
          <p className="text-3xl font-display font-bold text-emerald-400">
            ${totalCost.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            ~${monthlyCost.toFixed(0)}/month
          </p>
        </div>

        {/* Cost breakdown */}
        <div className="mt-3 space-y-1.5 text-xs">
          {data.kafka_cost ? (
            <div className="flex justify-between px-2">
              <span className="text-muted-foreground">Kafka throughput</span>
              <span className="font-mono">${(data.kafka_cost as number).toFixed(2)}</span>
            </div>
          ) : null}
          {data.connector_cost ? (
            <div className="flex justify-between px-2">
              <span className="text-muted-foreground">Connector tasks</span>
              <span className="font-mono">${(data.connector_cost as number).toFixed(2)}</span>
            </div>
          ) : null}
          {data.ksqldb_cost ? (
            <div className="flex justify-between px-2">
              <span className="text-muted-foreground">ksqlDB processing</span>
              <span className="font-mono">${(data.ksqldb_cost as number).toFixed(2)}</span>
            </div>
          ) : null}
          {data.storage_cost ? (
            <div className="flex justify-between px-2">
              <span className="text-muted-foreground">Storage</span>
              <span className="font-mono">${(data.storage_cost as number).toFixed(2)}</span>
            </div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Go Back
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-500">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Proceed
        </Button>
      </CardFooter>
    </Card>
  );
}

function AlertCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  const alertType = data.alert_type as string || 'gap_detection';
  const threshold = data.threshold as number || 5;
  const timeUnit = data.time_unit as string || 'minutes';

  return (
    <Card className="w-full border-rose-500/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-red-500 to-rose-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <Bell className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Alert Configuration</CardTitle>
            <p className="text-xs text-muted-foreground">Real-time monitoring setup</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span className="font-medium text-rose-400 capitalize">
              {alertType.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Alert when no events for <span className="text-rose-400 font-medium">{threshold} {timeUnit}</span>
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Skip Alert
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-rose-600 hover:bg-rose-500">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Enable Alert
        </Button>
      </CardFooter>
    </Card>
  );
}

function TopicCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  const rawTopic = data.raw_topic as string;
  const filteredTopic = data.filtered_topic as string;

  return (
    <Card className="w-full border-blue-500/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <GitBranch className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Kafka Topic Names</CardTitle>
            <p className="text-xs text-muted-foreground">Auto-generated topic configuration</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        {rawTopic && (
          <div className="p-2 rounded-lg bg-muted/30">
            <span className="text-xs text-muted-foreground">Raw topic:</span>
            <p className="font-mono text-sm text-blue-400 truncate">{rawTopic}</p>
          </div>
        )}
        {filteredTopic && (
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-xs text-muted-foreground">Filtered topic:</span>
            <p className="font-mono text-sm text-blue-400 truncate">{filteredTopic}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Customize
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-blue-600 hover:bg-blue-500">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Confirm Topics
        </Button>
      </CardFooter>
    </Card>
  );
}

function ResourcesCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  return (
    <Card className="w-full border-violet-500/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Package className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Resources to Create</CardTitle>
            <p className="text-xs text-muted-foreground">Pipeline infrastructure</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-1.5 text-sm">
          {data.kafka_topics ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
              <GitBranch className="w-4 h-4 text-violet-400" />
              <span>Kafka topics</span>
              <Badge variant="outline" className="ml-auto text-xs">{(data.kafka_topics as string[]).length}</Badge>
            </div>
          ) : null}
          {data.ksqldb_streams ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
              <FileCode className="w-4 h-4 text-violet-400" />
              <span>ksqlDB streams</span>
            </div>
          ) : null}
          {data.destination_table ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
              <Database className="w-4 h-4 text-violet-400" />
              <span>Destination table: <code className="text-violet-400">{data.destination_table as string}</code></span>
            </div>
          ) : null}
          {data.debezium_connector ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
              <Server className="w-4 h-4 text-violet-400" />
              <span>Debezium connector</span>
            </div>
          ) : null}
          {data.sink_connector ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
              <Server className="w-4 h-4 text-violet-400" />
              <span>Sink connector</span>
            </div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Go Back
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-violet-600 hover:bg-violet-500">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Create Resources
        </Button>
      </CardFooter>
    </Card>
  );
}

function PipelineCreateCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  return (
    <Card className="w-full border-primary/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-cyan-500 to-primary animate-pulse" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 glow-primary">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Ready to Create Pipeline</CardTitle>
            <p className="text-xs text-muted-foreground">Final confirmation</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-2 text-sm">
          {data.source ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
              <span className="text-muted-foreground">Source</span>
              <span className="font-medium">{data.source as string}</span>
            </div>
          ) : null}
          {data.table ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
              <span className="text-muted-foreground">Table</span>
              <code className="text-primary">{data.table as string}</code>
            </div>
          ) : null}
          {data.filter ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-purple-500/10">
              <span className="text-muted-foreground">Filter</span>
              <code className="text-purple-400 text-xs">{data.filter as string}</code>
            </div>
          ) : null}
          {data.destination ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
              <span className="text-muted-foreground">Destination</span>
              <span className="font-medium text-green-400">{data.destination as string}</span>
            </div>
          ) : null}
          {data.alert ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
              <span className="text-muted-foreground">Alert</span>
              <span className="text-rose-400">{data.alert as string}</span>
            </div>
          ) : null}
          {data.cost ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10">
              <span className="text-muted-foreground">Est. Cost</span>
              <span className="font-medium text-emerald-400">{data.cost as string}</span>
            </div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Go Back
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="bg-primary glow-primary hover:bg-primary/90">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          Create Pipeline
        </Button>
      </CardFooter>
    </Card>
  );
}

function GenericCard({ data, isLoading, onConfirm, onCancel }: CardProps) {
  return (
    <Card className="w-full border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-zinc-500 via-zinc-400 to-zinc-500" />
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display">Confirmation Required</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground">
          {data.action_type as string || 'Please confirm to proceed'}
        </p>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-3 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
          Confirm
        </Button>
      </CardFooter>
    </Card>
  );
}
