'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bell, Clock, Calendar, Mail, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import type { AlertConfirmContext, AlertRuleType, AlertSeverity } from '@/types';

interface AlertConfigFormProps {
  context: AlertConfirmContext;
  onConfirm: (config: AlertFormData) => void;
  onCancel: () => void;
}

interface AlertFormData {
  name: string;
  ruleType: AlertRuleType;
  severity: AlertSeverity;
  thresholdConfig: Record<string, number>;
  enabledDays: number[];
  enabledHours: { start: number; end: number };
  recipients: string[];
}

const DAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

const SEVERITY_OPTIONS: { value: AlertSeverity; label: string; color: string }[] = [
  { value: 'info', label: 'Info', color: 'bg-blue-500' },
  { value: 'warning', label: 'Warning', color: 'bg-amber-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
];

export function AlertConfigForm({ context, onConfirm, onCancel }: AlertConfigFormProps) {
  const [name, setName] = useState(context.suggestedName);
  const [selectedRuleType, setSelectedRuleType] = useState<AlertRuleType>(
    context.ruleTypes.find((r) => r.recommended)?.type || context.ruleTypes[0]?.type || 'gap_detection'
  );
  const [severity, setSeverity] = useState<AlertSeverity>(context.defaultConfig.severity);
  const [enabledDays, setEnabledDays] = useState<Set<number>>(
    new Set(context.defaultConfig.enabledDays)
  );
  const [startHour, setStartHour] = useState(context.defaultConfig.enabledHours.start);
  const [endHour, setEndHour] = useState(context.defaultConfig.enabledHours.end);
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [gapMinutes, setGapMinutes] = useState(5);
  const [multiplier, setMultiplier] = useState(2.0);
  const [isLoading, setIsLoading] = useState(false);

  const toggleDay = (day: number) => {
    // Use functional update to ensure we get latest state (avoids closure issues)
    setEnabledDays(prev => {
      const newDays = new Set(prev);
      if (newDays.has(day)) {
        newDays.delete(day);
      } else {
        newDays.add(day);
      }
      return newDays;
    });
  };

  const addRecipient = () => {
    const email = recipientInput.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setRecipientInput('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleConfirm = () => {
    if (!name.trim()) return;
    setIsLoading(true);

    const thresholdConfig: Record<string, number> = {};
    if (selectedRuleType === 'gap_detection') {
      thresholdConfig.minutes = gapMinutes;
    } else if (selectedRuleType === 'volume_spike') {
      thresholdConfig.multiplier = multiplier;
    } else if (selectedRuleType === 'volume_drop') {
      thresholdConfig.threshold = 0.2;
    }

    onConfirm({
      name: name.trim(),
      ruleType: selectedRuleType,
      severity,
      thresholdConfig,
      enabledDays: Array.from(enabledDays).sort(),
      enabledHours: { start: startHour, end: endHour },
      recipients,
    });
  };

  const selectedRuleInfo = context.ruleTypes.find((r) => r.type === selectedRuleType);

  return (
    <Card className="w-full max-w-xl mx-auto border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Configure Alert</CardTitle>
            <CardDescription className="text-sm">
              Set up monitoring for {context.pipelineName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Alert Name */}
        <div className="space-y-2">
          <Label htmlFor="alertName" className="text-sm font-medium">
            Alert Name
          </Label>
          <Input
            id="alertName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter alert name"
          />
        </div>

        {/* Rule Type Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Alert Type</Label>
          <div className="grid grid-cols-2 gap-2">
            {context.ruleTypes.map((rule) => (
              <div
                key={rule.type}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedRuleType === rule.type
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border/80'
                }`}
                onClick={() => setSelectedRuleType(rule.type)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{rule.name}</span>
                  {rule.recommended && (
                    <Badge variant="secondary" className="text-xs">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Threshold Config Based on Rule Type */}
        {selectedRuleType === 'gap_detection' && (
          <div className="space-y-2">
            <Label htmlFor="gapMinutes" className="text-sm font-medium">
              Gap Threshold (minutes)
            </Label>
            <Input
              id="gapMinutes"
              type="number"
              min={1}
              max={60}
              value={gapMinutes}
              onChange={(e) => setGapMinutes(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Alert when no events received for this duration
            </p>
          </div>
        )}

        {selectedRuleType === 'volume_spike' && (
          <div className="space-y-2">
            <Label htmlFor="multiplier" className="text-sm font-medium">
              Spike Multiplier
            </Label>
            <Input
              id="multiplier"
              type="number"
              min={1.5}
              max={10}
              step={0.5}
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Alert when volume exceeds {multiplier}x the baseline
            </p>
          </div>
        )}

        <Separator />

        {/* Severity */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Severity</Label>
          <div className="flex gap-2">
            {SEVERITY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={severity === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSeverity(opt.value)}
                className={severity === opt.value ? opt.color : ''}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Schedule - Days */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Active Days
          </Label>
          <div className="flex gap-1">
            {DAYS.map((day) => (
              <Button
                key={day.value}
                variant={enabledDays.has(day.value) ? 'default' : 'outline'}
                size="sm"
                className="w-10 h-10 p-0"
                onClick={() => toggleDay(day.value)}
              >
                {day.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Schedule - Hours */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Active Hours
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              max={23}
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="number"
              min={0}
              max={23}
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">(24h format)</span>
          </div>
        </div>

        <Separator />

        {/* Recipients */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Recipients
          </Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="email@example.com"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
            />
            <Button variant="outline" onClick={addRecipient}>
              Add
            </Button>
          </div>
          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recipients.map((email) => (
                <Badge
                  key={email}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeRecipient(email)}
                >
                  {email} &times;
                </Badge>
              ))}
            </div>
          )}
          {recipients.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-500">
              <AlertTriangle className="w-3 h-3" />
              <span>No recipients configured - alerts will only be logged</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading || !name.trim() || enabledDays.size === 0}
          className="min-w-[140px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Create Alert
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
