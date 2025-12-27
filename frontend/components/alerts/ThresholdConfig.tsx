'use client';

import { AlertRuleType } from '@/types';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Columns,
  Info,
} from 'lucide-react';

interface ThresholdConfigProps {
  ruleType: AlertRuleType;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  disabled?: boolean;
  columns?: string[];
}

export function ThresholdConfig({
  ruleType,
  config,
  onChange,
  disabled = false,
  columns = [],
}: ThresholdConfigProps) {
  const updateConfig = (key: string, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const renderVolumeSpikeConfig = () => (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">Spike Detection</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Trigger alert when volume exceeds the threshold multiplier compared to the baseline
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Time Window (minutes)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={config.windowMinutes || 5}
            onChange={(e) => updateConfig('windowMinutes', parseInt(e.target.value) || 5)}
            disabled={disabled}
            className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Compare volume over this period
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Spike Multiplier
          </label>
          <div className="relative">
            <input
              type="number"
              min={1.5}
              max={100}
              step={0.5}
              value={config.multiplier || 3}
              onChange={(e) => updateConfig('multiplier', parseFloat(e.target.value) || 3)}
              disabled={disabled}
              className="w-full h-10 px-3 pr-8 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 disabled:opacity-50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              ×
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Alert when volume exceeds {config.multiplier || 3}× baseline
          </p>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          <span>
            Example: With 5min window and 3× multiplier, alert fires if current 5min volume is 3× the average
          </span>
        </div>
      </div>
    </div>
  );

  const renderVolumeDropConfig = () => (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">Drop Detection</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Trigger alert when volume falls below the threshold ratio compared to baseline
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Time Window (minutes)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={config.windowMinutes || 5}
            onChange={(e) => updateConfig('windowMinutes', parseInt(e.target.value) || 5)}
            disabled={disabled}
            className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Compare volume over this period
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Drop Threshold
          </label>
          <div className="relative">
            <input
              type="number"
              min={0.01}
              max={0.99}
              step={0.05}
              value={config.ratio || 0.5}
              onChange={(e) => updateConfig('ratio', parseFloat(e.target.value) || 0.5)}
              disabled={disabled}
              className="w-full h-10 px-3 pr-8 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 disabled:opacity-50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Alert when volume drops below {((config.ratio || 0.5) * 100).toFixed(0)}% of baseline
          </p>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          <span>
            Example: With 5min window and 50% threshold, alert fires if current 5min volume is less than half the average
          </span>
        </div>
      </div>
    </div>
  );

  const renderGapDetectionConfig = () => (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">Gap Detection</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Trigger alert when no events are received within the specified time window
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Gap Duration (minutes)
        </label>
        <input
          type="number"
          min={1}
          max={1440}
          value={config.gapMinutes || 10}
          onChange={(e) => updateConfig('gapMinutes', parseInt(e.target.value) || 10)}
          disabled={disabled}
          className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Alert after {config.gapMinutes || 10} minutes of no events
        </p>
      </div>

      {/* Quick presets */}
      <div>
        <span className="text-xs text-muted-foreground mb-2 block">Quick presets:</span>
        <div className="flex flex-wrap gap-2">
          {[
            { label: '5 min', value: 5 },
            { label: '15 min', value: 15 },
            { label: '30 min', value: 30 },
            { label: '1 hour', value: 60 },
            { label: '2 hours', value: 120 },
          ].map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => updateConfig('gapMinutes', preset.value)}
              disabled={disabled}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${config.gapMinutes === preset.value
                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10'
                }
                border disabled:opacity-50
              `}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          <span>
            Useful for detecting pipeline stalls, data source disconnections, or heartbeat failures
          </span>
        </div>
      </div>
    </div>
  );

  const renderNullRatioConfig = () => (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
            <Columns className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">Null Ratio Monitoring</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Trigger alert when the null rate for a specific column exceeds the threshold
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Column to Monitor
          </label>
          {columns.length > 0 ? (
            <select
              value={config.columnName || ''}
              onChange={(e) => updateConfig('columnName', e.target.value)}
              disabled={disabled}
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-white/20 cursor-pointer disabled:opacity-50"
            >
              <option value="" className="bg-zinc-900">Select column...</option>
              {columns.map((col) => (
                <option key={col} value={col} className="bg-zinc-900">
                  {col}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={config.columnName || ''}
              onChange={(e) => updateConfig('columnName', e.target.value)}
              placeholder="e.g., user_id, email"
              disabled={disabled}
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 disabled:opacity-50"
            />
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Field name to check for null values
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Null Threshold
          </label>
          <div className="relative">
            <input
              type="number"
              min={0.01}
              max={1}
              step={0.01}
              value={config.nullThreshold || 0.1}
              onChange={(e) => updateConfig('nullThreshold', parseFloat(e.target.value) || 0.1)}
              disabled={disabled}
              className="w-full h-10 px-3 pr-8 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 disabled:opacity-50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Alert when null rate exceeds {((config.nullThreshold || 0.1) * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Sample Window (minutes)
        </label>
        <input
          type="number"
          min={1}
          max={60}
          value={config.windowMinutes || 5}
          onChange={(e) => updateConfig('windowMinutes', parseInt(e.target.value) || 5)}
          disabled={disabled}
          className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Time window for calculating null ratio
        </p>
      </div>

      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          <span>
            Monitors data quality issues like missing required fields, schema drift, or integration problems
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">Threshold Configuration</h3>
        <p className="text-xs text-muted-foreground">
          Configure when the alert should trigger
        </p>
      </div>

      {ruleType === 'volume_spike' && renderVolumeSpikeConfig()}
      {ruleType === 'volume_drop' && renderVolumeDropConfig()}
      {ruleType === 'gap_detection' && renderGapDetectionConfig()}
      {ruleType === 'null_ratio' && renderNullRatioConfig()}
    </div>
  );
}
