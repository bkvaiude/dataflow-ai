'use client';

import { useState } from 'react';
import { AlertHistory, AlertSeverity } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Zap,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Mail,
  MailX,
  Clock,
  History,
} from 'lucide-react';

interface AlertHistoryTableProps {
  history: AlertHistory[];
  isLoading?: boolean;
}

const severityConfig: Record<AlertSeverity, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
}> = {
  critical: {
    icon: <Zap className="w-3.5 h-3.5" />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    label: 'Critical',
  },
  warning: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    label: 'Warning',
  },
  info: {
    icon: <Info className="w-3.5 h-3.5" />,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    label: 'Info',
  },
};

export function AlertHistoryTable({ history, isLoading = false }: AlertHistoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-white/5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="h-8 w-8 bg-white/5 rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
        <History className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <h3 className="text-lg font-medium text-foreground mb-1">No Alert History</h3>
        <p className="text-sm text-muted-foreground">
          Alerts will appear here when your rules are triggered
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Recent Alerts</h3>
        <span className="text-xs text-muted-foreground">
          {history.length} alert{history.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="divide-y divide-white/5">
        {history.map((alert) => {
          const severity = severityConfig[alert.severity];
          const isExpanded = expandedRows.has(alert.id);

          return (
            <div key={alert.id} className="group">
              <button
                onClick={() => toggleRow(alert.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
              >
                {/* Severity icon */}
                <div className={`
                  w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                  ${severity.bgColor} ${severity.color}
                `}>
                  {severity.icon}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${severity.color}`}>
                      {severity.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {alert.anomalyType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm text-foreground mt-0.5 truncate">
                    Pipeline alert triggered
                  </div>
                </div>

                {/* Email status */}
                <div className="flex items-center gap-2 shrink-0">
                  {alert.emailSent ? (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="text-xs">Sent</span>
                    </div>
                  ) : alert.emailError ? (
                    <div className="flex items-center gap-1 text-red-400" title={alert.emailError}>
                      <MailX className="w-3.5 h-3.5" />
                      <span className="text-xs">Failed</span>
                    </div>
                  ) : null}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                  </span>
                </div>

                {/* Expand icon */}
                <div className="text-muted-foreground">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 -mt-2">
                  <div className="ml-13 p-4 rounded-xl bg-black/20 border border-white/5">
                    <div className="grid gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Triggered At:</span>
                        <span className="text-foreground ml-2">
                          {format(new Date(alert.triggeredAt), 'PPpp')}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground">Anomaly Type:</span>
                        <span className="text-foreground ml-2 capitalize">
                          {alert.anomalyType.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {Object.entries(alert.anomalyDetails).length > 0 && (
                        <div>
                          <span className="text-muted-foreground block mb-2">Details:</span>
                          <pre className="p-3 rounded-lg bg-black/30 text-xs font-mono text-foreground overflow-x-auto">
                            {JSON.stringify(alert.anomalyDetails, null, 2)}
                          </pre>
                        </div>
                      )}

                      {alert.emailError && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <span className="text-red-400 text-xs">Email Error:</span>
                          <p className="text-red-300 text-xs mt-1">{alert.emailError}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
