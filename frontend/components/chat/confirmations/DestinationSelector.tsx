'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Server, Cloud, CheckCircle, Loader2 } from 'lucide-react';
import type { DestinationConfirmContext } from '@/types';

interface DestinationSelectorProps {
  context: DestinationConfirmContext;
  onConfirm: (destination: 'clickhouse' | 'kafka' | 's3') => void;
  onCancel: () => void;
}

const destinationIcons: Record<string, React.ReactNode> = {
  clickhouse: <Database className="w-6 h-6" />,
  kafka: <Server className="w-6 h-6" />,
  s3: <Cloud className="w-6 h-6" />,
};

export function DestinationSelector({ context, onConfirm, onCancel }: DestinationSelectorProps) {
  const [selected, setSelected] = useState<'clickhouse' | 'kafka' | 's3' | null>(
    context.destinations.find((d) => d.recommended)?.type || null
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = () => {
    if (!selected) return;
    setIsLoading(true);
    onConfirm(selected);
  };

  return (
    <Card className="w-full max-w-xl mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Server className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Choose Destination</CardTitle>
            <CardDescription className="text-sm">
              Where should we sync your {context.selectedTables.length} table(s)?
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {context.destinations.map((dest) => (
          <div
            key={dest.type}
            className={`relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selected === dest.type
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-border/80 hover:bg-muted/50'
            } ${!dest.available ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => dest.available && setSelected(dest.type)}
          >
            <div
              className={`p-3 rounded-lg ${
                selected === dest.type ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              {destinationIcons[dest.type]}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{dest.name}</h3>
                {dest.recommended && (
                  <Badge variant="secondary" className="text-xs">
                    Recommended
                  </Badge>
                )}
                {!dest.available && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Coming Soon
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{dest.description}</p>
            </div>

            {selected === dest.type && (
              <CheckCircle className="absolute top-4 right-4 w-5 h-5 text-primary" />
            )}
          </div>
        ))}
      </CardContent>

      <CardFooter className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={isLoading || !selected} className="min-w-[120px]">
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
