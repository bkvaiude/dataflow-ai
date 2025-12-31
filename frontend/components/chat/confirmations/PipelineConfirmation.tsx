'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GitBranch, Database, Server, Table, CheckCircle, Loader2, ArrowRight, DollarSign, TrendingDown, Zap } from 'lucide-react';
import type { PipelineConfirmContext } from '@/types';

interface PipelineConfirmationProps {
  context: PipelineConfirmContext;
  onConfirm: (pipelineName: string) => void;
  onCancel: () => void;
}

const sinkIcons: Record<string, React.ReactNode> = {
  clickhouse: <Database className="w-5 h-5" />,
  kafka: <Server className="w-5 h-5" />,
  s3: <Server className="w-5 h-5" />,
};

const sinkNames: Record<string, string> = {
  clickhouse: 'ClickHouse',
  kafka: 'Kafka',
  s3: 'Amazon S3',
};

export function PipelineConfirmation({ context, onConfirm, onCancel }: PipelineConfirmationProps) {
  const [pipelineName, setPipelineName] = useState(context.suggestedName);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = () => {
    if (!pipelineName.trim()) return;
    setIsLoading(true);
    onConfirm(pipelineName.trim());
  };

  return (
    <Card className="w-full max-w-xl mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <GitBranch className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Review Pipeline Configuration</CardTitle>
            <CardDescription className="text-sm">
              Confirm the details before creating your pipeline
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Pipeline Name */}
        <div className="space-y-2">
          <Label htmlFor="pipelineName" className="text-sm font-medium">
            Pipeline Name
          </Label>
          <Input
            id="pipelineName"
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
            placeholder="Enter pipeline name"
            className="font-medium"
          />
        </div>

        <Separator />

        {/* Visual Pipeline Flow */}
        <div className="relative">
          {/* Source */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Source</span>
                <Badge variant="outline" className="text-xs">PostgreSQL</Badge>
              </div>
              <div className="font-mono text-sm mt-1">
                {context.host} / {context.database}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {context.credentialName}
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center py-2">
            <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90" />
          </div>

          {/* Tables */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Table className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tables</span>
                <Badge variant="secondary" className="text-xs">
                  {context.selectedTables.length}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {context.selectedTables.slice(0, 5).map((table) => (
                  <Badge key={table} variant="outline" className="font-mono text-xs">
                    {table}
                  </Badge>
                ))}
                {context.selectedTables.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{context.selectedTables.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center py-2">
            <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90" />
          </div>

          {/* Destination */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <div className="p-2 rounded-lg bg-purple-500/20">
              {sinkIcons[context.sinkType]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Destination</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {sinkNames[context.sinkType]}
                </Badge>
              </div>
              <div className="text-sm mt-1">
                Real-time CDC streaming via Kafka Connect
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading || !pipelineName.trim()}
          className="min-w-[140px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Create Pipeline
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
