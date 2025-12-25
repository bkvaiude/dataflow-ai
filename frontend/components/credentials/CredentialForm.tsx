'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CredentialFormData } from '@/types';
import {
  X,
  Database,
  Server,
  Key,
  User,
  Hash,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Lock,
} from 'lucide-react';

interface CredentialFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CredentialFormData) => Promise<{ success: boolean; message: string }>;
}

type DatabaseType = 'postgresql' | 'mysql';

const DATABASE_OPTIONS: { id: DatabaseType; name: string; icon: string; available: boolean }[] = [
  { id: 'postgresql', name: 'PostgreSQL', icon: '🐘', available: true },
  { id: 'mysql', name: 'MySQL', icon: '🐬', available: false },
];

export function CredentialForm({ isOpen, onClose, onSubmit }: CredentialFormProps) {
  const [formData, setFormData] = useState<CredentialFormData>({
    name: '',
    sourceType: 'postgresql',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    testConnection: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await onSubmit(formData);
      setResult(response);
      if (response.success) {
        setTimeout(() => {
          onClose();
          setFormData({
            name: '',
            sourceType: 'postgresql',
            host: '',
            port: 5432,
            database: '',
            username: '',
            password: '',
            testConnection: true,
          });
          setResult(null);
        }, 1500);
      }
    } catch {
      setResult({ success: false, message: 'Connection failed. Check your credentials.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 animate-fade-in-up">
        {/* Glow effect behind modal */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-purple-500/20 to-primary/20 rounded-2xl blur-xl opacity-50" />

        <div className="relative glass rounded-2xl overflow-hidden">
          {/* Header with gradient border */}
          <div className="relative px-6 py-5 border-b border-white/5">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-semibold text-foreground">
                    Connect Database
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Credentials encrypted with AES-256
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Database Type Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Database Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {DATABASE_OPTIONS.map((db) => (
                  <button
                    key={db.id}
                    type="button"
                    disabled={!db.available}
                    onClick={() => setFormData({ ...formData, sourceType: db.id, port: db.id === 'postgresql' ? 5432 : 3306 })}
                    className={`
                      relative p-3 rounded-xl border transition-all duration-200
                      ${formData.sourceType === db.id
                        ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20'}
                      ${!db.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{db.icon}</span>
                      <div className="text-left">
                        <div className="font-medium text-sm">{db.name}</div>
                        {!db.available && (
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Coming Soon
                          </div>
                        )}
                      </div>
                    </div>
                    {formData.sourceType === db.id && db.available && (
                      <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Connection Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" />
                Connection Name
              </label>
              <Input
                placeholder="e.g., Production Database"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-white/5 border-white/10 focus:border-primary"
              />
            </div>

            {/* Host & Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Server className="w-3.5 h-3.5" />
                  Host
                </label>
                <Input
                  placeholder="localhost or db.example.com"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Port
                </label>
                <Input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 5432 })}
                  required
                  className="bg-white/5 border-white/10 focus:border-primary font-mono"
                />
              </div>
            </div>

            {/* Database Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Database className="w-3.5 h-3.5" />
                Database Name
              </label>
              <Input
                placeholder="my_database"
                value={formData.database}
                onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                required
                className="bg-white/5 border-white/10 focus:border-primary font-mono"
              />
            </div>

            {/* Username & Password */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  Username
                </label>
                <Input
                  placeholder="postgres"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 focus:border-primary font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Key className="w-3.5 h-3.5" />
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 focus:border-primary"
                />
              </div>
            </div>

            {/* Test Connection Toggle */}
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.testConnection}
                  onChange={(e) => setFormData({ ...formData, testConnection: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 rounded-full bg-white/10 peer-checked:bg-primary/30 transition-colors" />
                <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-muted-foreground peer-checked:bg-primary peer-checked:translate-x-4 transition-all" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Test Connection</div>
                <div className="text-xs text-muted-foreground">Verify before saving</div>
              </div>
              <Zap className="w-4 h-4 text-primary" />
            </label>

            {/* Result Message */}
            {result && (
              <div className={`
                p-4 rounded-xl flex items-center gap-3 animate-fade-in-up
                ${result.success
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-red-500/10 border border-red-500/30'}
              `}>
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <span className={`text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                  {result.message}
                </span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium relative overflow-hidden group"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formData.testConnection ? 'Testing Connection...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Connect Database
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
