'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { ChatAction, AlertRuleType, AlertSeverity } from '@/types';
import { ExternalLink, Link2, Zap, Loader2, AlertTriangle, RefreshCw, X, Database, Table, Server, Bell } from 'lucide-react';
import { initiateOAuth } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { getSocket } from '@/lib/socket';

// Import confirmation components
import {
  SourceSelector,
  CredentialForm,
  TableSelector,
  DestinationSelector,
  PipelineConfirmation,
  AlertConfigForm,
  GenericConfirmation,
} from './confirmations';

interface ActionButtonProps {
  action: ChatAction;
  onClick?: () => void;
}

export function ActionButton({ action, onClick }: ActionButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { user } = useAuthStore();
  const { addConnectedProvider } = useChatStore();

  // Auto-show confirmation UI for confirmation action types
  useEffect(() => {
    if (
      action.type === 'confirm_source_select' ||
      action.type === 'confirm_credentials' ||
      action.type === 'confirm_tables' ||
      action.type === 'confirm_destination' ||
      action.type === 'confirm_pipeline_create' ||
      action.type === 'confirm_alert_config' ||
      action.type === 'confirm_action'
    ) {
      setShowConfirmation(true);
    }
  }, [action.type]);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_callback') {
        setIsLoading(false);
        if (event.data.success && event.data.provider) {
          const providerKey = event.data.provider.replace('-', '_');
          addConnectedProvider(providerKey);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addConnectedProvider]);

  // Helper to send confirmation via socket
  const sendConfirmation = (actionType: string, data: Record<string, unknown>) => {
    const socket = getSocket();
    if (socket && user?.id) {
      socket.emit('chat_message', {
        message: `[Confirmation: ${actionType}]`,
        user_id: user.id,
        _confirmation: {
          action_type: actionType,
          ...data,
        },
      });
    }
    setShowConfirmation(false);
    setIsLoading(false);
  };

  // Helper to send cancellation
  const sendCancellation = (actionType: string, sessionId?: string) => {
    const socket = getSocket();
    if (socket && user?.id) {
      socket.emit('chat_message', {
        message: 'I cancelled the operation.',
        user_id: user.id,
        _confirmation: {
          action_type: actionType,
          cancelled: true,
          sessionId,
        },
      });
    }
    setShowConfirmation(false);
    setIsLoading(false);
  };

  const handleOAuthClick = async () => {
    if (!user?.id) {
      console.error('User not authenticated');
      return;
    }

    const provider = (action.provider || 'google_ads').replace('_', '-');
    setIsLoading(true);

    const loadingPage = 'data:text/html,<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><p>Loading...</p></body></html>';
    const popup = window.open(loadingPage, 'oauth_popup', 'width=600,height=700,scrollbars=yes');

    if (!popup) {
      console.error('Popup was blocked');
      setIsLoading(false);
      return;
    }

    try {
      const result = await initiateOAuth(provider, user.id);

      if (result.success && result.data) {
        const authUrl = (result.data as any).auth_url || result.data.authUrl;
        if (authUrl) {
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

  // Source selection submission
  const handleSourceSelect = (credentialId: string, credentialName: string, host: string, database: string) => {
    if (!action.sourceContext) return;
    setIsLoading(true);
    sendConfirmation('confirm_source_select', {
      credentialId,
      credentialName,
      host,
      database,
      sessionId: action.sourceContext.sessionId,
    });
  };

  // Handle "Create New" source action
  const handleCreateNewSource = () => {
    if (!action.sourceContext) return;
    // Send message that user wants to create new source
    sendConfirmation('confirm_source_select', {
      createNew: true,
      sessionId: action.sourceContext.sessionId,
    });
  };

  // Credential form submission
  const handleCredentialSubmit = (data: { password: string; testConnection: boolean }) => {
    if (!action.credentialContext) return;
    setIsLoading(true);
    sendConfirmation('confirm_credentials', {
      ...action.credentialContext,
      password: data.password,
      testConnection: data.testConnection,
    });
  };

  // Table selection submission
  const handleTableConfirm = (selectedTables: string[]) => {
    if (!action.tableContext) return;
    setIsLoading(true);
    sendConfirmation('confirm_tables', {
      credentialId: action.tableContext.credentialId,
      selectedTables,
      sessionId: action.tableContext.sessionId,
    });
  };

  // Destination selection submission
  const handleDestinationConfirm = (destination: 'clickhouse' | 'kafka' | 's3') => {
    if (!action.destinationContext) return;
    setIsLoading(true);
    sendConfirmation('confirm_destination', {
      credentialId: action.destinationContext.credentialId,
      selectedTables: action.destinationContext.selectedTables,
      destination,
      sessionId: action.destinationContext.sessionId,
    });
  };

  // Pipeline creation submission
  const handlePipelineConfirm = (pipelineName: string) => {
    if (!action.pipelineContext) return;
    setIsLoading(true);
    sendConfirmation('confirm_pipeline_create', {
      ...action.pipelineContext,
      pipelineName,
    });
  };

  // Alert config submission
  const handleAlertConfirm = (config: {
    name: string;
    ruleType: AlertRuleType;
    severity: AlertSeverity;
    thresholdConfig: Record<string, number>;
    enabledDays: number[];
    enabledHours: { start: number; end: number };
    recipients: string[];
  }) => {
    if (!action.alertContext) return;
    setIsLoading(true);
    sendConfirmation('confirm_alert_config', {
      pipelineId: action.alertContext.pipelineId,
      ...config,
      sessionId: action.alertContext.sessionId,
    });
  };

  // Generic action confirmation
  const handleGenericConfirm = () => {
    if (!action.actionContext) return;
    setIsLoading(true);
    sendConfirmation('confirm_action', {
      actionId: action.actionContext.actionId,
      confirmed: true,
      metadata: action.actionContext.metadata,
    });
  };

  const handleClick = () => {
    if (action.type === 'oauth') {
      handleOAuthClick();
    } else if (action.type === 'link' && action.url) {
      // Use router.push for internal links to preserve auth context
      if (action.url.startsWith('/')) {
        router.push(action.url);
      } else {
        window.open(action.url, '_blank');
      }
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
      case 'confirm_source_select':
        return <Database className="w-4 h-4" />;
      case 'confirm_credentials':
        return <Database className="w-4 h-4" />;
      case 'confirm_tables':
        return <Table className="w-4 h-4" />;
      case 'confirm_destination':
        return <Server className="w-4 h-4" />;
      case 'confirm_alert_config':
        return <Bell className="w-4 h-4" />;
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

  // Render confirm_reprocess action (two buttons)
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

  // Render source selector (show existing data sources)
  if (action.type === 'confirm_source_select' && action.sourceContext && showConfirmation) {
    return (
      <div className="w-full py-2">
        <SourceSelector
          context={action.sourceContext}
          onSelect={handleSourceSelect}
          onCreateNew={handleCreateNewSource}
          onCancel={() => sendCancellation('confirm_source_select', action.sourceContext?.sessionId)}
        />
      </div>
    );
  }

  // Render credential form
  if (action.type === 'confirm_credentials' && action.credentialContext && showConfirmation) {
    return (
      <div className="w-full py-2">
        <CredentialForm
          context={action.credentialContext}
          onSubmit={handleCredentialSubmit}
          onCancel={() => sendCancellation('confirm_credentials', action.credentialContext?.sessionId)}
        />
      </div>
    );
  }

  // Render table selector
  if (action.type === 'confirm_tables' && action.tableContext && showConfirmation) {
    return (
      <div className="w-full py-2">
        <TableSelector
          context={action.tableContext}
          onConfirm={handleTableConfirm}
          onCancel={() => sendCancellation('confirm_tables', action.tableContext?.sessionId)}
        />
      </div>
    );
  }

  // Render destination selector
  if (action.type === 'confirm_destination' && action.destinationContext && showConfirmation) {
    return (
      <div className="w-full py-2">
        <DestinationSelector
          context={action.destinationContext}
          onConfirm={handleDestinationConfirm}
          onCancel={() => sendCancellation('confirm_destination', action.destinationContext?.sessionId)}
        />
      </div>
    );
  }

  // Render pipeline confirmation
  if (action.type === 'confirm_pipeline_create' && action.pipelineContext && showConfirmation) {
    return (
      <div className="w-full py-2">
        <PipelineConfirmation
          context={action.pipelineContext}
          onConfirm={handlePipelineConfirm}
          onCancel={() => sendCancellation('confirm_pipeline_create', action.pipelineContext?.sessionId)}
        />
      </div>
    );
  }

  // Render alert config form
  if (action.type === 'confirm_alert_config' && action.alertContext && showConfirmation) {
    return (
      <div className="w-full py-2">
        <AlertConfigForm
          context={action.alertContext}
          onConfirm={handleAlertConfirm}
          onCancel={() => sendCancellation('confirm_alert_config', action.alertContext?.sessionId)}
        />
      </div>
    );
  }

  // Render generic confirmation
  if (action.type === 'confirm_action' && action.actionContext && showConfirmation) {
    return (
      <div className="w-full py-2">
        <GenericConfirmation
          context={action.actionContext}
          onConfirm={handleGenericConfirm}
          onCancel={() => sendCancellation('confirm_action')}
        />
      </div>
    );
  }

  // Default button render
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
