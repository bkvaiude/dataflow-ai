'use client';

import { useState } from 'react';
import { Pipeline, PipelineStatus } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Trash2,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';

interface PipelineControlsProps {
  pipeline: Pipeline;
  onStart?: (id: string) => Promise<void>;
  onStop?: (id: string) => Promise<void>;
  onPause?: (id: string) => Promise<void>;
  onResume?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isLoading?: boolean;
}

type ActionType = 'start' | 'stop' | 'pause' | 'resume' | 'delete';

export function PipelineControls({
  pipeline,
  onStart,
  onStop,
  onPause,
  onResume,
  onDelete,
  isLoading,
}: PipelineControlsProps) {
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleAction = async (action: ActionType, handler?: (id: string) => Promise<void>) => {
    if (!handler || isLoading || activeAction) return;

    setActiveAction(action);
    try {
      await handler(pipeline.id);
    } finally {
      setActiveAction(null);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isLoading || activeAction) return;

    setActiveAction('delete');
    try {
      await onDelete(pipeline.id);
    } finally {
      setActiveAction(null);
      setShowDeleteConfirm(false);
    }
  };

  const canStart = pipeline.status === 'stopped' || pipeline.status === 'pending' || pipeline.status === 'failed';
  const canPause = pipeline.status === 'running';
  const canResume = pipeline.status === 'paused';
  const canStop = pipeline.status === 'running' || pipeline.status === 'paused';

  return (
    <div className="space-y-4">
      {/* Main Controls */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
        <h3 className="text-sm font-medium text-foreground mb-4">Pipeline Controls</h3>

        <div className="flex flex-wrap gap-2">
          {/* Start Button */}
          {canStart && (
            <Button
              onClick={() => handleAction('start', onStart)}
              disabled={isLoading || !!activeAction}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 gap-2"
            >
              {activeAction === 'start' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {pipeline.status === 'failed' ? 'Restart' : 'Start'} Pipeline
            </Button>
          )}

          {/* Resume Button */}
          {canResume && (
            <Button
              onClick={() => handleAction('resume', onResume || onStart)}
              disabled={isLoading || !!activeAction}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 gap-2"
            >
              {activeAction === 'resume' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Resume Pipeline
            </Button>
          )}

          {/* Pause Button */}
          {canPause && (
            <Button
              onClick={() => handleAction('pause', onPause)}
              disabled={isLoading || !!activeAction}
              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 gap-2"
            >
              {activeAction === 'pause' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
              Pause Pipeline
            </Button>
          )}

          {/* Stop Button */}
          {canStop && (
            <Button
              onClick={() => handleAction('stop', onStop)}
              disabled={isLoading || !!activeAction}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 gap-2"
            >
              {activeAction === 'stop' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Stop Pipeline
            </Button>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
        <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          These actions are destructive and cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isLoading || !!activeAction}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Pipeline
          </Button>
        ) : (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-300 mb-4">
              Are you sure you want to delete <strong>{pipeline.name}</strong>? This will:
            </p>
            <ul className="text-xs text-red-200/80 list-disc list-inside mb-4 space-y-1">
              <li>Stop the pipeline if running</li>
              <li>Delete all Kafka connectors</li>
              <li>Remove pipeline configuration</li>
              <li>Clear all event history</li>
            </ul>
            <div className="flex gap-2">
              <Button
                onClick={handleDelete}
                disabled={isLoading || !!activeAction}
                className="bg-red-500 hover:bg-red-600 text-white gap-2"
              >
                {activeAction === 'delete' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Yes, Delete Pipeline
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="outline"
                className="border-white/10 gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Status Info */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
        <h3 className="text-sm font-medium text-foreground mb-3">Status Information</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Status</span>
            <span className={`font-medium capitalize ${
              pipeline.status === 'running' ? 'text-emerald-400' :
              pipeline.status === 'paused' ? 'text-amber-400' :
              pipeline.status === 'failed' ? 'text-red-400' :
              'text-muted-foreground'
            }`}>
              {pipeline.status}
            </span>
          </div>
          {pipeline.startedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started At</span>
              <span className="text-foreground">
                {new Date(pipeline.startedAt).toLocaleString()}
              </span>
            </div>
          )}
          {pipeline.stoppedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stopped At</span>
              <span className="text-foreground">
                {new Date(pipeline.stoppedAt).toLocaleString()}
              </span>
            </div>
          )}
          {pipeline.errorMessage && (
            <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-red-400">Error: </span>
              <span className="text-red-200">{pipeline.errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
