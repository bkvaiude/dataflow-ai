'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  GitBranch,
  CheckCircle,
  Loader2,
  FileJson,
  Server,
  Database,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowRight,
  Workflow,
} from 'lucide-react';
import type { TopicRegistryContext } from '@/types';

interface TopicRegistryConfirmationProps {
  context: TopicRegistryContext;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TopicRegistryConfirmation({ context, onConfirm, onCancel }: TopicRegistryConfirmationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showAvroSchema, setShowAvroSchema] = useState(false);
  const [copied, setCopied] = useState(false);

  // Safely access nested properties with defaults
  const clickhouseConfig = context.clickhouseConfig || { database: '', table: '' };
  const avroSchema = context.avroSchema || { type: 'record', name: '', namespace: '', fields: [] };
  const approvedSchema = context.approvedSchema || { columns: [] };
  const fieldCount = avroSchema.fields?.length || 0;
  const columnCount = approvedSchema.columns?.length || 0;

  const handleConfirm = () => {
    setIsLoading(true);
    onConfirm();
  };

  const handleCopySchema = async () => {
    await navigator.clipboard.writeText(JSON.stringify(avroSchema, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="w-full max-w-xl mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <GitBranch className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Confirm Data Contract</CardTitle>
            <CardDescription className="text-sm">
              Review and approve the Kafka topic and Avro schema configuration
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Flow Visualization */}
        <div className="flex items-center justify-center gap-2 py-4 px-2 rounded-xl bg-muted/30 border border-border/50">
          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Database className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground">Source</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Server className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground">Kafka</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Database className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-xs text-muted-foreground">ClickHouse</span>
          </div>
        </div>

        <Separator />

        {/* Kafka Topic */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Workflow className="w-4 h-4 text-muted-foreground" />
            Kafka Topic
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <code className="text-sm font-mono text-emerald-500">{context.topicName}</code>
          </div>
        </div>

        {/* Schema Registry Subject */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileJson className="w-4 h-4 text-muted-foreground" />
            Schema Registry Subject
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <code className="text-sm font-mono text-violet-500">{context.schemaRegistrySubject}</code>
          </div>
        </div>

        {/* ClickHouse Destination */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="w-4 h-4 text-muted-foreground" />
            ClickHouse Table
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <code className="text-sm font-mono text-orange-500">
              {clickhouseConfig.database}.{clickhouseConfig.table}
            </code>
          </div>
        </div>

        <Separator />

        {/* Avro Schema Toggle */}
        <div className="space-y-2">
          <button
            onClick={() => setShowAvroSchema(!showAvroSchema)}
            className="flex items-center justify-between w-full text-sm font-medium hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-muted-foreground" />
              Avro Schema
              <Badge variant="secondary" className="text-xs">
                {fieldCount} fields
              </Badge>
            </div>
            {showAvroSchema ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {showAvroSchema && (
            <div className="relative">
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 overflow-x-auto max-h-[250px] overflow-y-auto">
                <pre className="text-xs font-mono text-zinc-300">
                  {JSON.stringify(avroSchema, null, 2)}
                </pre>
              </div>
              <button
                onClick={handleCopySchema}
                className="absolute top-2 right-2 p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors"
                title="Copy schema"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4 text-zinc-400" />
                )}
              </button>
            </div>
          )}
        </div>

        <Separator />

        {/* Summary */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/5 to-violet-500/5 border border-cyan-500/10">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">What will be created:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Kafka topic: <span className="text-foreground font-mono">{context.topicName}</span></li>
                <li>• Avro schema registered in Schema Registry</li>
                <li>• ClickHouse table with {columnCount} columns</li>
                <li>• CDC sink connector for real-time sync</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={isLoading} className="min-w-[180px]">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Create Data Contract
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
