'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chatStore';
import {
  MessageSquare,
  Database,
  BarChart3,
  Settings,
  HelpCircle,
  Trash2,
  Plug,
  GitBranch,
} from 'lucide-react';

const connectors = [
  { id: 'google_ads', name: 'Google Ads', icon: '🎯', status: 'available' },
  { id: 'facebook_ads', name: 'Facebook Ads', icon: '📘', status: 'coming_soon' },
  { id: 'shopify', name: 'Shopify', icon: '🛒', status: 'coming_soon' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { connectedProviders, clearMessages } = useChatStore();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Navigation
          </h3>
          <div className="space-y-1">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                className={`w-full justify-start ${
                  isActive('/dashboard') && !isActive('/dashboard/sources')
                    ? 'text-foreground bg-sidebar-accent'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="w-4 h-4 mr-3" />
                Chat
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              disabled
            >
              <BarChart3 className="w-4 h-4 mr-3" />
              Dashboards
              <Badge variant="secondary" className="ml-auto text-xs">
                Soon
              </Badge>
            </Button>
            <Link href="/dashboard/sources">
              <Button
                variant="ghost"
                className={`w-full justify-start ${
                  isActive('/dashboard/sources')
                    ? 'text-foreground bg-sidebar-accent'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Database className="w-4 h-4 mr-3" />
                Data Sources
              </Button>
            </Link>
            <Link href="/dashboard/pipelines">
              <Button
                variant="ghost"
                className={`w-full justify-start ${
                  isActive('/dashboard/pipelines')
                    ? 'text-foreground bg-sidebar-accent'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <GitBranch className="w-4 h-4 mr-3" />
                Pipelines
              </Button>
            </Link>
          </div>
        </div>

        {/* Connectors */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Plug className="w-3 h-3" />
            Connectors
          </h3>
          <div className="space-y-2">
            {connectors.map((connector) => {
              const isConnected = connectedProviders.includes(connector.id);
              return (
                <div
                  key={connector.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                >
                  <div className="flex items-center gap-2">
                    <span>{connector.icon}</span>
                    <span className="text-sm">{connector.name}</span>
                  </div>
                  {isConnected ? (
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  ) : connector.status === 'coming_soon' ? (
                    <Badge variant="outline" className="text-xs">
                      Soon
                    </Badge>
                  ) : (
                    <div className="w-2 h-2 bg-muted rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={clearMessages}
        >
          <Trash2 className="w-4 h-4 mr-3" />
          Clear Chat
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          disabled
        >
          <Settings className="w-4 h-4 mr-3" />
          Settings
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          disabled
        >
          <HelpCircle className="w-4 h-4 mr-3" />
          Help
        </Button>
      </div>
    </aside>
  );
}
