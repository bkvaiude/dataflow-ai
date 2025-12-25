'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { ChatAction } from '@/types';
import { ExternalLink, Link2, Zap, Loader2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { initiateOAuth } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { getSocket } from '@/lib/socket';

interface ActionButtonProps {
  action: ChatAction;
  onClick?: () => void;
}

export function ActionButton({ action, onClick }: ActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();
  const { addConnectedProvider } = useChatStore();

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_callback') {
        setIsLoading(false);
        if (event.data.success && event.data.provider) {
          // Convert provider format: google-ads -> google_ads
          const providerKey = event.data.provider.replace('-', '_');
          addConnectedProvider(providerKey);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addConnectedProvider]);

  const handleOAuthClick = async () => {
    if (!user?.id) {
      console.error('User not authenticated');
      return;
    }

    // Convert provider format: google_ads -> google-ads (backend expects hyphens)
    const provider = (action.provider || 'google_ads').replace('_', '-');
    setIsLoading(true);

    // Open popup FIRST (synchronously) to avoid browser blocking
    // Using a data URL for the loading state
    const loadingPage = 'data:text/html,<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><p>Loading...</p></body></html>';
    const popup = window.open(
      loadingPage,
      'oauth_popup',
      'width=600,height=700,scrollbars=yes'
    );

    if (!popup) {
      console.error('Popup was blocked');
      setIsLoading(false);
      return;
    }

    try {
      const result = await initiateOAuth(provider, user.id);

      if (result.success && result.data) {
        // Backend returns auth_url (snake_case), handle both cases
        const authUrl = (result.data as any).auth_url || result.data.authUrl;
        if (authUrl) {
          // Redirect popup to OAuth URL
          popup.location.href = authUrl;
        } else {
          popup.close();
          setIsLoading(false);
        }
      } else {
        console.error('OAuth init failed:', result.error);
        popup.close();
        setIsLoading(false);
      }
    } catch (error) {
      console.error('OAuth error:', error);
      popup.close();
      setIsLoading(false);
    }
  };

  const handleConfirmReprocess = (confirmed: boolean) => {
    if (!action.confirmationData || !user?.id) return;

    setIsLoading(true);

    const socket = getSocket();
    if (socket) {
      const message = confirmed
        ? `Yes, reprocess my ${action.confirmationData.connectorId} data`
        : 'No, skip reprocessing and use existing data';

      socket.emit('chat_message', {
        message,
        user_id: user.id,
        _reprocess_confirmation: {
          confirmed,
          ...action.confirmationData,
        },
      });
    }

    setIsLoading(false);
  };

  const handleClick = () => {
    if (action.type === 'oauth') {
      handleOAuthClick();
    } else if (action.type === 'link' && action.url) {
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
      case 'confirm_reprocess':
        return <AlertTriangle className="w-4 h-4" />;
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

  // Render two buttons for confirm_reprocess action type
  if (action.type === 'confirm_reprocess') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => handleConfirmReprocess(true)}
          disabled={isLoading}
          className="bg-amber-500 hover:bg-amber-600 text-white font-medium transition-all duration-300 hover:scale-105"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2">Yes, Reprocess</span>
        </Button>
        <Button
          onClick={() => handleConfirmReprocess(false)}
          disabled={isLoading}
          variant="outline"
          className="font-medium transition-all duration-300 hover:scale-105"
        >
          <X className="w-4 h-4" />
          <span className="ml-2">Skip</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      className={`${getButtonClass()} font-medium transition-all duration-300 hover:scale-105`}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : getIcon()}
      <span className="ml-2">{isLoading ? 'Connecting...' : action.label}</span>
    </Button>
  );
}
