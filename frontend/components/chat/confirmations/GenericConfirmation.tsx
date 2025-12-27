'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { GenericActionContext } from '@/types';

interface GenericConfirmationProps {
  context: GenericActionContext;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GenericConfirmation({ context, onConfirm, onCancel }: GenericConfirmationProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    onConfirm();
  };

  const getVariantStyles = () => {
    switch (context.variant) {
      case 'danger':
        return {
          icon: <XCircle className="w-6 h-6 text-red-500" />,
          confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
          confirmClass: 'bg-amber-600 hover:bg-amber-700 text-white',
        };
      default:
        return {
          icon: <CheckCircle className="w-6 h-6 text-primary" />,
          confirmClass: 'bg-primary hover:bg-primary/90 text-primary-foreground',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card className="w-full max-w-md mx-auto border-border/50 bg-card/95 backdrop-blur-sm">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-3">
          {styles.icon}
        </div>
        <CardTitle className="text-lg">{context.title}</CardTitle>
        <CardDescription className="text-sm">
          {context.description}
        </CardDescription>
      </CardHeader>

      <CardFooter className="flex gap-3 justify-center pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="min-w-[100px]"
        >
          {context.cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading}
          className={`min-w-[100px] ${styles.confirmClass}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            context.confirmLabel
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
