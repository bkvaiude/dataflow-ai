'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  FileJson,
  Sparkles,
  CheckCircle,
  Loader2,
  ArrowRight,
  Key,
  Table2,
  Code,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { SchemaPreviewContext } from '@/types';

interface SchemaPreviewFormProps {
  context: SchemaPreviewContext;
  onConfirm: (data: { analyticsIntent: string; approvedSchema: NonNullable<SchemaPreviewContext['generatedSchema']> }) => void;
  onCancel: () => void;
}

export function SchemaPreviewForm({ context, onConfirm, onCancel }: SchemaPreviewFormProps) {
  const [analyticsIntent, setAnalyticsIntent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchema, setGeneratedSchema] = useState(context.generatedSchema);
  const [showSql, setShowSql] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateSchema = async () => {
    if (!analyticsIntent.trim()) return;
    setIsGenerating(true);

    // In a real implementation, this would call the backend API
    // For now, we'll simulate schema generation with a delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Create a mock generated schema based on source schema
    const mockSchema: NonNullable<SchemaPreviewContext['generatedSchema']> = {
      columns: [
        ...context.sourceSchema.map((col) => ({
          name: col.name,
          sourceType: col.type,
          clickhouseType: mapToClickHouseType(col.type),
          nullable: col.nullable,
          isPrimaryKey: col.isPk,
          description: `Mapped from ${col.type}`,
        })),
        // CDC metadata columns
        { name: '_deleted', sourceType: 'boolean', clickhouseType: 'UInt8', nullable: false, isPrimaryKey: false, description: 'CDC deletion flag' },
        { name: '_version', sourceType: 'bigint', clickhouseType: 'UInt64', nullable: false, isPrimaryKey: false, description: 'CDC version for deduplication' },
        { name: '_inserted_at', sourceType: 'timestamp', clickhouseType: 'DateTime64(3)', nullable: false, isPrimaryKey: false, description: 'CDC insertion timestamp' },
      ],
      engine: 'ReplacingMergeTree',
      orderBy: context.sourceSchema.filter((c) => c.isPk).map((c) => c.name),
      partitionBy: analyticsIntent.toLowerCase().includes('time') ? 'toYYYYMM(created_at)' : undefined,
      createTableSql: `CREATE TABLE ${context.clickhouseConfig.database}.${context.clickhouseConfig.table} (...)`,
    };

    setGeneratedSchema(mockSchema);
    setIsGenerating(false);
  };

  const handleConfirm = () => {
    if (!generatedSchema) return;
    setIsLoading(true);
    onConfirm({ analyticsIntent, approvedSchema: generatedSchema });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <FileJson className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Schema Configuration</CardTitle>
            <CardDescription className="text-sm">
              Describe your analytics goals and review the generated schema
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Analytics Intent Input */}
        {context.promptForIntent && !generatedSchema && (
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Describe Your Analytics Goals
            </Label>
            <textarea
              value={analyticsIntent}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnalyticsIntent(e.target.value)}
              placeholder="e.g., I want to track user activity patterns, analyze conversion funnels, and monitor real-time engagement metrics..."
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              AI will optimize the ClickHouse schema based on your analytics requirements
            </p>
            <Button
              onClick={handleGenerateSchema}
              disabled={!analyticsIntent.trim() || isGenerating}
              className="w-full"
              variant="secondary"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Schema...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Optimized Schema
                </>
              )}
            </Button>
          </div>
        )}

        {/* Schema Preview */}
        {generatedSchema && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Column Mappings</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {generatedSchema.columns.length} columns
              </Badge>
            </div>

            {/* Columns Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Column</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Source</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground"></th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">ClickHouse</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Nullable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {generatedSchema.columns.map((col, idx) => (
                      <tr key={col.name} className={idx >= generatedSchema.columns.length - 3 ? 'bg-muted/20' : ''}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500" />}
                            <span className="font-mono text-xs">{col.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            {col.sourceType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <ArrowRight className="w-4 h-4 text-muted-foreground inline-block" />
                        </td>
                        <td className="px-3 py-2">
                          <Badge className="text-xs font-mono bg-orange-500/10 text-orange-500 hover:bg-orange-500/20">
                            {col.clickhouseType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs ${col.nullable ? 'text-muted-foreground' : 'text-amber-500'}`}>
                            {col.nullable ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Engine Info */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Engine:</span>
                <Badge variant="secondary" className="text-xs font-mono">
                  {generatedSchema.engine}
                </Badge>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">ORDER BY:</span>
                <Badge variant="secondary" className="text-xs font-mono">
                  ({generatedSchema.orderBy.join(', ') || 'id'})
                </Badge>
              </div>
              {generatedSchema.partitionBy && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground">PARTITION BY:</span>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {generatedSchema.partitionBy}
                  </Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* SQL Preview Toggle */}
            <button
              onClick={() => setShowSql(!showSql)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Code className="w-4 h-4" />
              <span>View CREATE TABLE SQL</span>
              {showSql ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showSql && generatedSchema.createTableSql && (
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 overflow-x-auto">
                <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                  {generatedSchema.createTableSql}
                </pre>
              </div>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading || isGenerating}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading || !generatedSchema}
          className="min-w-[160px]"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Schema
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// Helper function to map PostgreSQL types to ClickHouse types
function mapToClickHouseType(pgType: string): string {
  const typeMap: Record<string, string> = {
    // Integers
    'smallint': 'Int16',
    'integer': 'Int32',
    'bigint': 'Int64',
    'serial': 'Int32',
    'bigserial': 'Int64',
    // Floats
    'real': 'Float32',
    'double precision': 'Float64',
    'numeric': 'Decimal(18, 4)',
    'decimal': 'Decimal(18, 4)',
    // Strings
    'character varying': 'String',
    'varchar': 'String',
    'text': 'String',
    'char': 'String',
    // Boolean
    'boolean': 'UInt8',
    // Dates/Times
    'date': 'Date',
    'timestamp': 'DateTime64(3)',
    'timestamp without time zone': 'DateTime64(3)',
    'timestamp with time zone': 'DateTime64(3)',
    'time': 'String',
    // JSON
    'json': 'String',
    'jsonb': 'String',
    // UUID
    'uuid': 'UUID',
    // Arrays
    'array': 'Array(String)',
  };

  const lowerType = pgType.toLowerCase();
  for (const [pg, ch] of Object.entries(typeMap)) {
    if (lowerType.includes(pg)) {
      return ch;
    }
  }
  return 'String';
}
