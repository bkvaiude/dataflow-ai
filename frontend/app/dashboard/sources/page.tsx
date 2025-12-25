'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CredentialForm } from '@/components/credentials/CredentialForm';
import { CredentialList } from '@/components/credentials/CredentialList';
import { SchemaViewer } from '@/components/schema/SchemaViewer';
import { CDCReadinessCard } from '@/components/schema/CDCReadinessCard';
import type {
  Credential,
  CredentialFormData,
  SchemaDiscoveryResult,
  CDCReadinessResult,
} from '@/types';
import {
  Database,
  Plus,
  Zap,
  Layers,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function SourcesPage() {
  const { user, token } = useAuthStore();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);

  // Schema and CDC state
  const [schema, setSchema] = useState<SchemaDiscoveryResult | null>(null);
  const [cdcReadiness, setCdcReadiness] = useState<CDCReadinessResult | null>(null);
  const [isDiscoveringSchema, setIsDiscoveringSchema] = useState(false);
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch credentials on mount
  useEffect(() => {
    if (user && token) {
      fetchCredentials();
    }
  }, [user, token]);

  const fetchCredentials = async () => {
    setIsLoadingCredentials(true);
    try {
      const response = await fetch(`${API_URL}/api/credentials`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCredentials(data.credentials || []);
      }
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
    } finally {
      setIsLoadingCredentials(false);
    }
  };

  const handleCreateCredential = async (formData: CredentialFormData): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_URL}/api/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          source_type: formData.sourceType,
          host: formData.host,
          port: formData.port,
          database: formData.database,
          username: formData.username,
          password: formData.password,
          test_connection: formData.testConnection,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchCredentials();
        return { success: true, message: data.message || 'Connection saved successfully!' };
      } else {
        return { success: false, message: data.detail || 'Failed to save connection' };
      }
    } catch (error) {
      console.error('Failed to create credential:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const handleDeleteCredential = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/api/credentials/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchCredentials();
        if (selectedCredential?.id === id) {
          setSelectedCredential(null);
          setSchema(null);
          setCdcReadiness(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete credential:', error);
    }
  };

  const handleTestCredential = async (id: string): Promise<{ success: boolean; latencyMs?: number }> => {
    try {
      const startTime = Date.now();
      const response = await fetch(`${API_URL}/api/credentials/${id}/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const latencyMs = Date.now() - startTime;
      const data = await response.json();

      if (response.ok && data.is_valid) {
        await fetchCredentials();
        return { success: true, latencyMs };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error('Failed to test credential:', error);
      return { success: false };
    }
  };

  const handleDiscoverSchema = useCallback(async () => {
    if (!selectedCredential) return;

    setIsDiscoveringSchema(true);
    try {
      const response = await fetch(`${API_URL}/api/sources/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          credential_id: selectedCredential.id,
          schema_filter: 'public',
          include_row_counts: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSchema(data);
      } else {
        console.error('Schema discovery failed');
      }
    } catch (error) {
      console.error('Failed to discover schema:', error);
    } finally {
      setIsDiscoveringSchema(false);
    }
  }, [selectedCredential, token, API_URL]);

  const handleCheckReadiness = useCallback(async () => {
    if (!selectedCredential) return;

    setIsCheckingReadiness(true);
    try {
      const response = await fetch(`${API_URL}/api/sources/check-readiness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          credential_id: selectedCredential.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCdcReadiness(data);
      } else {
        console.error('CDC readiness check failed');
      }
    } catch (error) {
      console.error('Failed to check CDC readiness:', error);
    } finally {
      setIsCheckingReadiness(false);
    }
  }, [selectedCredential, token, API_URL]);

  const handleSelectCredential = (credential: Credential) => {
    setSelectedCredential(credential);
    setSchema(null);
    setCdcReadiness(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="shrink-0 px-6 py-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                Database Sources
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your CDC-enabled database connections
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsFormOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Database
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Credentials List */}
        <aside className="w-80 shrink-0 border-r border-white/5 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h2 className="text-sm font-medium text-muted-foreground">
              Connections ({credentials.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <CredentialList
              credentials={credentials}
              selectedId={selectedCredential?.id}
              onSelect={handleSelectCredential}
              onDelete={handleDeleteCredential}
              onTest={handleTestCredential}
              isLoading={isLoadingCredentials}
            />
          </div>
        </aside>

        {/* Right Panel - Details */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {selectedCredential ? (
            <>
              {/* Selected Credential Header */}
              <div className="shrink-0 px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {selectedCredential.sourceType === 'postgresql' ? '🐘' : '🐬'}
                    </span>
                    <div>
                      <h2 className="text-lg font-display font-semibold text-foreground">
                        {selectedCredential.name}
                      </h2>
                      <code className="text-xs text-muted-foreground font-mono">
                        {selectedCredential.host}:{selectedCredential.port}/{selectedCredential.database}
                      </code>
                    </div>
                    <div className={`
                      w-2.5 h-2.5 rounded-full ml-2
                      ${selectedCredential.isValid
                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                        : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}
                    `} />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDiscoverSchema}
                      disabled={isDiscoveringSchema || !selectedCredential.isValid}
                      className="gap-2"
                    >
                      {isDiscoveringSchema ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Layers className="w-4 h-4" />
                      )}
                      Discover Schema
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheckReadiness}
                      disabled={isCheckingReadiness || !selectedCredential.isValid}
                      className="gap-2"
                    >
                      {isCheckingReadiness ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Check CDC Readiness
                    </Button>
                  </div>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Quick Actions */}
                {!schema && !cdcReadiness && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleDiscoverSchema}
                      disabled={isDiscoveringSchema || !selectedCredential.isValid}
                      className="group p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-primary/30 transition-all text-left"
                    >
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                        <Layers className="w-6 h-6 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-display font-semibold text-foreground mb-1">
                        Discover Schema
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Explore tables, columns, and relationships in your database.
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Start Discovery <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>

                    <button
                      onClick={handleCheckReadiness}
                      disabled={isCheckingReadiness || !selectedCredential.isValid}
                      className="group p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-primary/30 transition-all text-left"
                    >
                      <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                        <Zap className="w-6 h-6 text-green-400" />
                      </div>
                      <h3 className="text-lg font-display font-semibold text-foreground mb-1">
                        Check CDC Readiness
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Verify your database is configured for Change Data Capture.
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Run Check <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  </div>
                )}

                {/* CDC Readiness Card */}
                {(cdcReadiness || isCheckingReadiness) && (
                  <CDCReadinessCard
                    readiness={cdcReadiness}
                    isLoading={isCheckingReadiness}
                    onRefresh={handleCheckReadiness}
                  />
                )}

                {/* Schema Viewer */}
                {(schema || isDiscoveringSchema) && (
                  <SchemaViewer
                    schema={schema}
                    isLoading={isDiscoveringSchema}
                    onRefresh={handleDiscoverSchema}
                  />
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="relative mb-8 inline-block">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                  <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/10 flex items-center justify-center mx-auto">
                    <Database className="w-12 h-12 text-primary" />
                  </div>
                </div>

                <h2 className="text-2xl font-display font-bold text-foreground mb-3">
                  {credentials.length === 0 ? 'Connect Your First Database' : 'Select a Connection'}
                </h2>
                <p className="text-muted-foreground mb-8">
                  {credentials.length === 0
                    ? 'Add a PostgreSQL database to start discovering schemas and setting up CDC pipelines.'
                    : 'Choose a database connection from the list to explore its schema and check CDC readiness.'}
                </p>

                {credentials.length === 0 && (
                  <Button
                    onClick={() => setIsFormOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Database
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Credential Form Modal */}
      <CredentialForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateCredential}
      />
    </div>
  );
}
