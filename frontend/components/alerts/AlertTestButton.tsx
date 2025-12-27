'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface AlertTestButtonProps {
  ruleId: string;
  onTest: (ruleId: string) => Promise<boolean>;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showLabel?: boolean;
}

export function AlertTestButton({
  ruleId,
  onTest,
  size = 'default',
  variant = 'outline',
  showLabel = true,
}: AlertTestButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const success = await onTest(ruleId);
      setResult(success ? 'success' : 'error');
    } catch {
      setResult('error');
    } finally {
      setIsLoading(false);
      // Reset result after 3 seconds
      setTimeout(() => setResult(null), 3000);
    }
  };

  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {showLabel && <span>Testing...</span>}
        </>
      );
    }

    if (result === 'success') {
      return (
        <>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {showLabel && <span className="text-emerald-400">Sent!</span>}
        </>
      );
    }

    if (result === 'error') {
      return (
        <>
          <XCircle className="w-4 h-4 text-red-400" />
          {showLabel && <span className="text-red-400">Failed</span>}
        </>
      );
    }

    return (
      <>
        <Play className="w-4 h-4" />
        {showLabel && <span>Test Alert</span>}
      </>
    );
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleTest}
      disabled={isLoading}
      className={`gap-2 transition-colors ${
        result === 'success' ? 'border-emerald-500/30 bg-emerald-500/10' :
        result === 'error' ? 'border-red-500/30 bg-red-500/10' : ''
      }`}
    >
      {getButtonContent()}
    </Button>
  );
}
