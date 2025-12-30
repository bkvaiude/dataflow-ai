'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Server, Plus, Loader2, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { getIdToken, getAccessToken, getSession } from '@/lib/firebase';

interface SourceCredential {
  id: string;
  name: string;
  source_type: string;
  host?: string;
  database?: string;
  port?: number;
  is_valid: boolean;
  created_at?: string;
}

interface SourceSelectorContext {
  sessionId?: string;
  sourceType?: string;
}

interface SourceSelectorProps {
  context: SourceSelectorContext;
  onSelect: (credentialId: string, credentialName: string, host: string, database: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function SourceSelector({ context, onSelect, onCreateNew, onCancel }: SourceSelectorProps) {
  const [credentials, setCredentials] = useState<SourceCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check for JWT access token first, then fallback to session
      const accessToken = getAccessToken();
      const session = getSession();

      let url = `${API_URL}/api/credentials/`;
      const headers: Record<string, string> = {};

      if (accessToken) {
        // Use JWT Bearer token
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else if (session) {
        // Use session as query parameter
        url += `?session=${encodeURIComponent(session)}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch credentials');
      }

      const data = await response.json();
      // Filter by source type if specified
      const filtered = context.sourceType
        ? data.filter((c: SourceCredential) => c.source_type === context.sourceType)
        : data;
      setCredentials(filtered);
    } catch (err) {
      console.error('Error fetching credentials:', err);
      setError('Failed to load data sources');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (cred: SourceCredential) => {
    setSelectedId(cred.id);
    onSelect(cred.id, cred.name, cred.host || '', cred.database || '');
  };

  const handleCreateNew = () => {
    // Open data sources page in new tab
    window.open('/dashboard/sources', '_blank');
    onCreateNew();
  };

  return (
    <Card className="w-full max-w-lg mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Select Data Source</CardTitle>
              <CardDescription className="text-sm">
                Choose an existing connection or create a new one
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchCredentials}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading data sources...</span>
          </div>
        ) : error ? (
          <div className="text-center py-6 text-red-500">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCredentials} className="mt-2">
              Retry
            </Button>
          </div>
        ) : credentials.length === 0 ? (
          <div className="text-center py-6">
            <Database className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">No data sources configured yet</p>
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Your First Data Source
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  onClick={() => handleSelect(cred)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50 ${
                    selectedId === cred.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded bg-muted">
                        <Server className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">{cred.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {cred.host}:{cred.port} / {cred.database}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={cred.is_valid ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {cred.is_valid ? 'Connected' : 'Invalid'}
                      </Badge>
                      {selectedId === cred.id && (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Button */}
            <div className="pt-2 border-t border-border/50">
              <Button
                variant="outline"
                onClick={handleCreateNew}
                className="w-full gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New Data Source
                <ExternalLink className="w-3 h-3 ml-1 text-muted-foreground" />
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}
