'use client';

import { AlertRuleType } from '@/types';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Columns,
  Check,
} from 'lucide-react';

interface AlertTypeSelectorProps {
  value: AlertRuleType | null;
  onChange: (type: AlertRuleType) => void;
  disabled?: boolean;
}

const ruleTypes: {
  type: AlertRuleType;
  name: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  borderColor: string;
  examples: string[];
}[] = [
  {
    type: 'volume_spike',
    name: 'Volume Spike',
    description: 'Detect sudden increases in event volume',
    icon: <TrendingUp className="w-5 h-5" />,
    gradient: 'from-rose-500/20 to-orange-500/20',
    borderColor: 'border-rose-500/30',
    examples: ['Traffic surge', 'DDoS detection', 'Viral content'],
  },
  {
    type: 'volume_drop',
    name: 'Volume Drop',
    description: 'Detect significant decreases in event volume',
    icon: <TrendingDown className="w-5 h-5" />,
    gradient: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/30',
    examples: ['Service outage', 'Data source failure', 'API degradation'],
  },
  {
    type: 'gap_detection',
    name: 'Gap Detection',
    description: 'Alert when no events arrive within a time window',
    icon: <Clock className="w-5 h-5" />,
    gradient: 'from-amber-500/20 to-yellow-500/20',
    borderColor: 'border-amber-500/30',
    examples: ['Pipeline stall', 'Source disconnection', 'Heartbeat failure'],
  },
  {
    type: 'null_ratio',
    name: 'Null Ratio',
    description: 'Monitor data quality by tracking null field rates',
    icon: <Columns className="w-5 h-5" />,
    gradient: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/30',
    examples: ['Data corruption', 'Schema drift', 'Integration issues'],
  },
];

export function AlertTypeSelector({
  value,
  onChange,
  disabled = false,
}: AlertTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">Alert Type</h3>
        <p className="text-xs text-muted-foreground">
          Choose what kind of anomaly you want to detect
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ruleTypes.map((rule) => {
          const isSelected = value === rule.type;

          return (
            <button
              key={rule.type}
              type="button"
              onClick={() => !disabled && onChange(rule.type)}
              disabled={disabled}
              className={`
                relative group text-left p-4 rounded-xl transition-all duration-300
                border-2 overflow-hidden
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected
                  ? `bg-gradient-to-br ${rule.gradient} ${rule.borderColor}`
                  : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                }
              `}
            >
              {/* Selection checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Icon */}
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center mb-3
                transition-all duration-300
                ${isSelected
                  ? 'bg-black/20 text-white'
                  : 'bg-white/5 text-muted-foreground group-hover:text-foreground'
                }
              `}>
                {rule.icon}
              </div>

              {/* Content */}
              <div className="space-y-1">
                <h4 className={`
                  text-sm font-semibold transition-colors
                  ${isSelected ? 'text-white' : 'text-foreground'}
                `}>
                  {rule.name}
                </h4>
                <p className={`
                  text-xs transition-colors
                  ${isSelected ? 'text-white/70' : 'text-muted-foreground'}
                `}>
                  {rule.description}
                </p>
              </div>

              {/* Example tags */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {rule.examples.map((example) => (
                  <span
                    key={example}
                    className={`
                      text-[10px] px-2 py-0.5 rounded-full
                      ${isSelected
                        ? 'bg-black/20 text-white/80'
                        : 'bg-white/5 text-muted-foreground'
                      }
                    `}
                  >
                    {example}
                  </span>
                ))}
              </div>

              {/* Hover effect gradient */}
              <div className={`
                absolute inset-0 bg-gradient-to-br ${rule.gradient}
                opacity-0 group-hover:opacity-50 transition-opacity duration-500
                pointer-events-none
                ${isSelected ? 'hidden' : ''}
              `} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
