'use client';

import { AlertStats as AlertStatsType } from '@/types';
import {
  Bell,
  BellRing,
  AlertTriangle,
  Info,
  Zap,
  TrendingUp,
} from 'lucide-react';

interface AlertStatsProps {
  stats: AlertStatsType | null;
  isLoading?: boolean;
}

export function AlertStats({ stats, isLoading = false }: AlertStatsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 animate-pulse"
          >
            <div className="h-10 w-10 rounded-xl bg-white/5 mb-3" />
            <div className="h-8 w-16 bg-white/5 rounded mb-2" />
            <div className="h-4 w-24 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const defaultStats: AlertStatsType = stats || {
    totalRules: 0,
    activeRules: 0,
    alertsToday: 0,
    alertsThisWeek: 0,
    bySeverity: { info: 0, warning: 0, critical: 0 },
  };

  const cards = [
    {
      title: 'Total Rules',
      value: defaultStats.totalRules,
      icon: <Bell className="w-5 h-5" />,
      gradient: 'from-blue-500/20 to-cyan-500/20',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Active Rules',
      value: defaultStats.activeRules,
      icon: <BellRing className="w-5 h-5" />,
      gradient: 'from-emerald-500/20 to-teal-500/20',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
      suffix: `/ ${defaultStats.totalRules}`,
    },
    {
      title: 'Alerts Today',
      value: defaultStats.alertsToday,
      icon: <TrendingUp className="w-5 h-5" />,
      gradient: 'from-amber-500/20 to-orange-500/20',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      title: 'This Week',
      value: defaultStats.alertsThisWeek,
      icon: <Zap className="w-5 h-5" />,
      gradient: 'from-purple-500/20 to-pink-500/20',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => (
          <div
            key={card.title}
            className={`
              relative overflow-hidden p-5 rounded-2xl
              bg-gradient-to-br ${card.gradient}
              border ${card.borderColor}
              transition-all duration-300 hover:scale-[1.02]
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={`w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center mb-3 ${card.iconColor}`}>
              {card.icon}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">
                {card.value}
              </span>
              {card.suffix && (
                <span className="text-sm text-muted-foreground">{card.suffix}</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{card.title}</div>
          </div>
        ))}
      </div>

      {/* Severity breakdown */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
        <h3 className="text-sm font-medium text-foreground mb-4">Alerts by Severity</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-rose-400" />
              <span className="text-xs text-rose-400 font-medium">Critical</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {defaultStats.bySeverity.critical}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">Warning</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {defaultStats.bySeverity.warning}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-sky-400" />
              <span className="text-xs text-sky-400 font-medium">Info</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {defaultStats.bySeverity.info}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
