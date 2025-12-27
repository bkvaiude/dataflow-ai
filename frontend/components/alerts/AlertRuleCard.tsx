'use client';

import { useState } from 'react';
import { AlertRule, AlertRuleType, AlertSeverity } from '@/types';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  BellOff,
  TrendingUp,
  TrendingDown,
  Clock,
  Columns,
  Pencil,
  Play,
  Trash2,
  MoreVertical,
  Zap,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface AlertRuleCardProps {
  rule: AlertRule;
  onEdit?: (rule: AlertRule) => void;
  onTest?: (ruleId: string) => void;
  onDelete?: (ruleId: string) => void;
  onToggleActive?: (ruleId: string, active: boolean) => void;
}

const ruleTypeConfig: Record<AlertRuleType, {
  icon: React.ReactNode;
  label: string;
  gradient: string;
  description: string;
}> = {
  volume_spike: {
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    label: 'Spike',
    gradient: 'from-rose-500/20 to-orange-500/20',
    description: 'Traffic surge detection',
  },
  volume_drop: {
    icon: <TrendingDown className="w-3.5 h-3.5" />,
    label: 'Drop',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    description: 'Traffic decline detection',
  },
  gap_detection: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: 'Gap',
    gradient: 'from-amber-500/20 to-yellow-500/20',
    description: 'Event absence detection',
  },
  null_ratio: {
    icon: <Columns className="w-3.5 h-3.5" />,
    label: 'Null',
    gradient: 'from-purple-500/20 to-pink-500/20',
    description: 'Data quality monitoring',
  },
};

const severityConfig: Record<AlertSeverity, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  info: {
    icon: <Info className="w-3 h-3" />,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    label: 'Info',
  },
  warning: {
    icon: <AlertTriangle className="w-3 h-3" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    label: 'Warning',
  },
  critical: {
    icon: <Zap className="w-3 h-3" />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    label: 'Critical',
  },
};

export function AlertRuleCard({
  rule,
  onEdit,
  onTest,
  onDelete,
  onToggleActive,
}: AlertRuleCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const typeConfig = ruleTypeConfig[rule.ruleType];
  const severity = severityConfig[rule.severity];

  const handleToggle = async () => {
    if (!onToggleActive || isToggling) return;
    setIsToggling(true);
    try {
      await onToggleActive(rule.id, !rule.isActive);
    } finally {
      setIsToggling(false);
    }
  };

  const formatThreshold = () => {
    const config = rule.thresholdConfig;
    switch (rule.ruleType) {
      case 'volume_spike':
        return `>${config.multiplier}x in ${config.windowMinutes || config.minutes || 5}min`;
      case 'volume_drop':
        return `<${((config.ratio || config.threshold || 0) * 100).toFixed(0)}% in ${config.windowMinutes || config.minutes || 5}min`;
      case 'gap_detection':
        // Support both "minutes" (from chat form) and "gapMinutes" (from rules form)
        return `No events for ${config.minutes || config.gapMinutes || 5}min`;
      case 'null_ratio':
        return `>${((config.nullThreshold || 0) * 100).toFixed(0)}% nulls in ${config.columnName || 'column'}`;
      default:
        return '';
    }
  };

  return (
    <div
      className={`
        group relative overflow-hidden
        rounded-2xl border transition-all duration-300 ease-out
        ${rule.isActive
          ? 'border-white/10 bg-white/[0.02]'
          : 'border-white/5 bg-white/[0.01] opacity-75'
        }
        ${isHovered ? 'border-white/20 bg-white/[0.04] shadow-xl shadow-black/20' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowActions(false);
      }}
    >
      {/* Gradient accent based on rule type */}
      <div
        className={`
          absolute inset-0 bg-gradient-to-br ${typeConfig.gradient}
          opacity-0 group-hover:opacity-100 transition-opacity duration-500
        `}
      />

      {/* Active indicator pulse */}
      {rule.isActive && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>
      )}

      {/* Content */}
      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {/* Rule type badge */}
              <div className={`
                inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                bg-gradient-to-r ${typeConfig.gradient} border border-white/10
              `}>
                {typeConfig.icon}
                <span className="text-white/90">{typeConfig.label}</span>
              </div>

              {/* Severity badge */}
              <div className={`
                inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                ${severity.bgColor} ${severity.borderColor} border ${severity.color}
              `}>
                {severity.icon}
                <span>{severity.label}</span>
              </div>
            </div>

            <h3 className="text-base font-semibold text-foreground truncate mt-2">
              {rule.name}
            </h3>

            {rule.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {rule.description}
              </p>
            )}
          </div>

          {/* Toggle button */}
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`
              relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
              transition-all duration-200 border
              ${rule.isActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400 hover:bg-zinc-500/20'
              }
              ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={rule.isActive ? 'Deactivate rule' : 'Activate rule'}
          >
            {rule.isActive ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Threshold display */}
        <div className="mb-4 p-3 rounded-xl bg-black/20 border border-white/5">
          <div className="text-xs text-muted-foreground mb-1">Threshold</div>
          <code className="text-sm font-mono text-foreground">
            {formatThreshold()}
          </code>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>
              <strong className="text-foreground">{rule.triggerCount}</strong> triggers
            </span>
          </div>

          {rule.lastTriggeredAt && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Last {formatDistanceToNow(new Date(rule.lastTriggeredAt), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={`
          flex items-center gap-2 pt-3 border-t border-white/5
          transition-all duration-200
          ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit?.(rule)}
            className="flex-1 h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTest?.(rule.id)}
            className="flex-1 h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
          >
            <Play className="w-3.5 h-3.5" />
            Test
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete?.(rule.id)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Recipients indicator */}
      {rule.recipients.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      )}
    </div>
  );
}
