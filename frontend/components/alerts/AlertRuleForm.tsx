'use client';

import { useState, useEffect } from 'react';
import { AlertRule, AlertRuleType, AlertSeverity, CreateAlertRuleRequest, Pipeline } from '@/types';
import { AlertTypeSelector } from './AlertTypeSelector';
import { ThresholdConfig } from './ThresholdConfig';
import { Button } from '@/components/ui/button';
import {
  X,
  Loader2,
  Save,
  AlertTriangle,
  Info,
  Zap,
  Mail,
  Clock,
  Calendar,
  Plus,
  Trash2,
} from 'lucide-react';

interface AlertRuleFormProps {
  rule?: AlertRule;
  pipelines: Pipeline[];
  onSubmit: (data: CreateAlertRuleRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const severityOptions: { value: AlertSeverity; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'info', label: 'Info', icon: <Info className="w-4 h-4" />, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  { value: 'warning', label: 'Warning', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { value: 'critical', label: 'Critical', icon: <Zap className="w-4 h-4" />, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
];

const daysOfWeek = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export function AlertRuleForm({
  rule,
  pipelines,
  onSubmit,
  onCancel,
  isLoading = false,
}: AlertRuleFormProps) {
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    pipelineId: string;
    ruleType: AlertRuleType | null;
    thresholdConfig: Record<string, any>;
    severity: AlertSeverity;
    recipients: string[];
    enabledDays: number[];
    enabledHours: { start: number; end: number };
    cooldownMinutes: number;
    isActive: boolean;
  }>({
    name: rule?.name || '',
    description: rule?.description || '',
    pipelineId: rule?.pipelineId || '',
    ruleType: rule?.ruleType || null,
    thresholdConfig: rule?.thresholdConfig || {},
    severity: rule?.severity || 'warning',
    recipients: rule?.recipients || [],
    enabledDays: rule?.enabledDays || [0, 1, 2, 3, 4, 5, 6],
    enabledHours: rule?.enabledHours || { start: 0, end: 24 },
    cooldownMinutes: rule?.cooldownMinutes || 30,
    isActive: rule?.isActive ?? true,
  });

  const [newRecipient, setNewRecipient] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(1);

  const isEditMode = !!rule;
  const totalSteps = 4;

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) {
        newErrors.name = 'Name is required';
      }
      if (!formData.pipelineId) {
        newErrors.pipelineId = 'Please select a pipeline';
      }
    }

    if (step === 2) {
      if (!formData.ruleType) {
        newErrors.ruleType = 'Please select an alert type';
      }
    }

    if (step === 3) {
      // Validate threshold config based on rule type
      if (formData.ruleType === 'null_ratio' && !formData.thresholdConfig.columnName) {
        newErrors.thresholdConfig = 'Column name is required for null ratio detection';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const addRecipient = () => {
    const email = newRecipient.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !formData.recipients.includes(email)) {
      setFormData((prev) => ({
        ...prev,
        recipients: [...prev.recipients, email],
      }));
      setNewRecipient('');
    }
  };

  const removeRecipient = (email: string) => {
    setFormData((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((r) => r !== email),
    }));
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      enabledDays: prev.enabledDays.includes(day)
        ? prev.enabledDays.filter((d) => d !== day)
        : [...prev.enabledDays, day].sort(),
    }));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    if (!formData.ruleType) return;

    const data: CreateAlertRuleRequest = {
      name: formData.name,
      description: formData.description || undefined,
      pipelineId: formData.pipelineId,
      ruleType: formData.ruleType,
      thresholdConfig: formData.thresholdConfig,
      severity: formData.severity,
      recipients: formData.recipients,
      enabledDays: formData.enabledDays,
      enabledHours: formData.enabledHours,
      cooldownMinutes: formData.cooldownMinutes,
      isActive: formData.isActive,
    };

    await onSubmit(data);
  };

  // Step progress indicator
  const renderProgressBar = () => (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="flex items-center flex-1">
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              transition-all duration-300
              ${i + 1 === currentStep
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white scale-110'
                : i + 1 < currentStep
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-muted-foreground border border-white/10'
              }
            `}
          >
            {i + 1 < currentStep ? '✓' : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div
              className={`
                flex-1 h-0.5 mx-2 transition-all duration-300
                ${i + 1 < currentStep ? 'bg-emerald-500/50' : 'bg-white/10'}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: Basic Info
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Basic Information</h3>
        <p className="text-sm text-muted-foreground">
          Give your alert rule a name and select the pipeline to monitor
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Rule Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., High Traffic Alert"
            className={`
              w-full h-11 px-4 rounded-xl bg-white/5 border text-foreground
              placeholder:text-muted-foreground focus:outline-none focus:ring-2
              ${errors.name ? 'border-rose-500/50 focus:ring-rose-500/30' : 'border-white/10 focus:border-white/20 focus:ring-white/10'}
            `}
          />
          {errors.name && (
            <p className="text-xs text-rose-400 mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this alert monitors..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Pipeline <span className="text-rose-400">*</span>
          </label>
          <select
            value={formData.pipelineId}
            onChange={(e) => setFormData((prev) => ({ ...prev, pipelineId: e.target.value }))}
            className={`
              w-full h-11 px-4 rounded-xl bg-white/5 border text-foreground
              focus:outline-none focus:ring-2 cursor-pointer
              ${errors.pipelineId ? 'border-rose-500/50 focus:ring-rose-500/30' : 'border-white/10 focus:border-white/20 focus:ring-white/10'}
            `}
          >
            <option value="" className="bg-zinc-900">Select a pipeline...</option>
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id} className="bg-zinc-900">
                {pipeline.name}
              </option>
            ))}
          </select>
          {errors.pipelineId && (
            <p className="text-xs text-rose-400 mt-1">{errors.pipelineId}</p>
          )}
        </div>
      </div>
    </div>
  );

  // Step 2: Alert Type
  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Alert Type</h3>
        <p className="text-sm text-muted-foreground">
          Select the type of anomaly you want to detect
        </p>
      </div>

      <AlertTypeSelector
        value={formData.ruleType}
        onChange={(type) => {
          setFormData((prev) => ({
            ...prev,
            ruleType: type,
            thresholdConfig: {}, // Reset config when type changes
          }));
        }}
      />

      {errors.ruleType && (
        <p className="text-xs text-rose-400 mt-2">{errors.ruleType}</p>
      )}
    </div>
  );

  // Step 3: Threshold Configuration
  const renderStep3 = () => (
    <div className="space-y-6">
      {formData.ruleType && (
        <ThresholdConfig
          ruleType={formData.ruleType}
          config={formData.thresholdConfig}
          onChange={(config) => setFormData((prev) => ({ ...prev, thresholdConfig: config }))}
        />
      )}

      {errors.thresholdConfig && (
        <p className="text-xs text-rose-400">{errors.thresholdConfig}</p>
      )}

      {/* Severity selection */}
      <div className="pt-4 border-t border-white/10">
        <h3 className="text-sm font-medium text-foreground mb-3">Alert Severity</h3>
        <div className="flex gap-3">
          {severityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, severity: option.value }))}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                border-2 transition-all duration-200
                ${formData.severity === option.value
                  ? option.color
                  : 'border-white/10 text-muted-foreground hover:border-white/20'
                }
              `}
            >
              {option.icon}
              <span className="font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Step 4: Notifications & Schedule
  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Notifications & Schedule</h3>
        <p className="text-sm text-muted-foreground">
          Configure who gets notified and when
        </p>
      </div>

      {/* Recipients */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
          <Mail className="w-4 h-4" />
          Email Recipients
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={newRecipient}
            onChange={(e) => setNewRecipient(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
            placeholder="Enter email address"
            className="flex-1 h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addRecipient}
            className="h-10 px-3"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {formData.recipients.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {formData.recipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  className="text-muted-foreground hover:text-rose-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="pt-4 border-t border-white/10">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
          <Calendar className="w-4 h-4" />
          Active Days
        </label>
        <div className="flex gap-2">
          {daysOfWeek.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`
                flex-1 py-2 rounded-lg text-sm font-medium transition-all
                border
                ${formData.enabledDays.includes(day.value)
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20'
                }
              `}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hours */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
          <Clock className="w-4 h-4" />
          Active Hours
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Start</label>
            <select
              value={formData.enabledHours.start}
              onChange={(e) => setFormData((prev) => ({
                ...prev,
                enabledHours: { ...prev.enabledHours, start: parseInt(e.target.value) },
              }))}
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i} className="bg-zinc-900">
                  {i.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">End</label>
            <select
              value={formData.enabledHours.end}
              onChange={(e) => setFormData((prev) => ({
                ...prev,
                enabledHours: { ...prev.enabledHours, end: parseInt(e.target.value) },
              }))}
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 25 }).map((_, i) => (
                <option key={i} value={i} className="bg-zinc-900">
                  {i === 24 ? '24:00' : `${i.toString().padStart(2, '0')}:00`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cooldown */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Cooldown Period (minutes)
        </label>
        <input
          type="number"
          min={1}
          max={1440}
          value={formData.cooldownMinutes}
          onChange={(e) => setFormData((prev) => ({ ...prev, cooldownMinutes: parseInt(e.target.value) || 30 }))}
          className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-white/20"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Minimum time between consecutive alerts
        </p>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
        <div>
          <span className="text-sm font-medium text-foreground">Enable Rule</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rule will start monitoring immediately when enabled
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
          className={`
            relative w-12 h-6 rounded-full transition-all duration-200
            ${formData.isActive ? 'bg-emerald-500' : 'bg-white/10'}
          `}
        >
          <span
            className={`
              absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200
              ${formData.isActive ? 'left-7' : 'left-1'}
            `}
          />
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEditMode ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Step {currentStep} of {totalSteps}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {renderProgressBar()}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex items-center justify-between shrink-0">
          <Button
            variant="ghost"
            onClick={currentStep > 1 ? prevStep : onCancel}
            disabled={isLoading}
          >
            {currentStep > 1 ? 'Back' : 'Cancel'}
          </Button>

          <div className="flex items-center gap-3">
            {currentStep < totalSteps ? (
              <Button
                onClick={nextStep}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isEditMode ? 'Update Rule' : 'Create Rule'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
