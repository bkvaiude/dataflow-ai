'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Database, Eye, EyeOff, Loader2, CheckCircle, XCircle, Server } from 'lucide-react';
import type { CredentialConfirmContext } from '@/types';

interface CredentialFormProps {
  context: CredentialConfirmContext;
  onSubmit: (data: { password: string; testConnection: boolean }) => void;
  onCancel: () => void;
}

export function CredentialForm({ context, onSubmit, onCancel }: CredentialFormProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [testConnection, setTestConnection] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    onSubmit({ password, testConnection });
  };

  return (
    <Card className="w-full max-w-lg mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Database Credentials</CardTitle>
            <CardDescription className="text-sm">
              Enter your database password securely
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Connection Info Summary */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Host:</span>
              <span className="font-mono">{context.host}:{context.port}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Database className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Database:</span>
              <span className="font-mono">{context.database}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground ml-6">Username:</span>
              <span className="font-mono">{context.username}</span>
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter database password"
                className="pr-10 font-mono"
                autoComplete="off"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Eye className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Test Connection Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="testConnection"
              checked={testConnection}
              onCheckedChange={(checked) => setTestConnection(checked as boolean)}
            />
            <Label htmlFor="testConnection" className="text-sm cursor-pointer">
              Test connection before saving
            </Label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="min-w-[140px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {testConnection ? 'Testing...' : 'Saving...'}
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {testConnection ? 'Test & Continue' : 'Continue'}
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
