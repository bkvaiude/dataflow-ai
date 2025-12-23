'use client';

import { Button } from '@/components/ui/button';
import type { ChatAction } from '@/types';
import { ExternalLink, Link2, Zap } from 'lucide-react';

interface ActionButtonProps {
  action: ChatAction;
  onClick?: () => void;
}

export function ActionButton({ action, onClick }: ActionButtonProps) {
  const handleClick = () => {
    if (action.type === 'link' && action.url) {
      window.open(action.url, '_blank');
    } else if (action.onClick) {
      action.onClick();
    } else if (onClick) {
      onClick();
    }
  };

  const getIcon = () => {
    switch (action.type) {
      case 'oauth':
        return <Zap className="w-4 h-4" />;
      case 'link':
        return <ExternalLink className="w-4 h-4" />;
      default:
        return <Link2 className="w-4 h-4" />;
    }
  };

  const getButtonClass = () => {
    switch (action.type) {
      case 'oauth':
        return 'bg-primary hover:bg-primary/90 text-primary-foreground glow-primary';
      case 'link':
        return 'bg-accent hover:bg-accent/90 text-accent-foreground glow-accent';
      default:
        return 'bg-secondary hover:bg-secondary/80 text-secondary-foreground';
    }
  };

  return (
    <Button
      onClick={handleClick}
      className={`${getButtonClass()} font-medium transition-all duration-300 hover:scale-105`}
    >
      {getIcon()}
      <span className="ml-2">{action.label}</span>
    </Button>
  );
}
