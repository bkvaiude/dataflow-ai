'use client';

import { useState } from 'react';
import type { PipelineTemplate } from '@/types/preview';
import {
  FileText,
  Play,
  Edit2,
  Trash2,
  Star,
  MoreVertical,
  Loader2,
  Plus,
  Settings2,
  Link2,
  Filter,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TemplateListProps {
  templates: PipelineTemplate[];
  isLoading?: boolean;
  onApply: (templateId: string) => Promise<void>;
  onEdit: (template: PipelineTemplate) => void;
  onDelete: (templateId: string) => Promise<void>;
  onSetDefault: (templateId: string) => Promise<void>;
  onCreateNew: () => void;
}

function getTransformIcon(type: string) {
  switch (type) {
    case 'join':
      return <Link2 className="w-3 h-3 text-blue-400" />;
    case 'filter':
      return <Filter className="w-3 h-3 text-amber-400" />;
    case 'aggregation':
      return <BarChart3 className="w-3 h-3 text-violet-400" />;
    default:
      return <Settings2 className="w-3 h-3 text-muted-foreground" />;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

interface TemplateCardProps {
  template: PipelineTemplate;
  onApply: (templateId: string) => Promise<void>;
  onEdit: (template: PipelineTemplate) => void;
  onDelete: (templateId: string) => Promise<void>;
  onSetDefault: (templateId: string) => Promise<void>;
}

function TemplateCard({ template, onApply, onEdit, onDelete, onSetDefault }: TemplateCardProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply(template.id);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    setIsDeleting(true);
    try {
      await onDelete(template.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`
      group relative p-4 rounded-xl border transition-all
      ${template.isDefault
        ? 'bg-primary/5 border-primary/20 hover:border-primary/40'
        : 'bg-white/[0.02] border-white/10 hover:border-white/20'}
    `}>
      {/* Default Badge */}
      {template.isDefault && (
        <div className="absolute -top-2 -right-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-medium uppercase tracking-wider border border-primary/30">
            <Star className="w-2.5 h-2.5" fill="currentColor" />
            Default
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            ${template.isDefault ? 'bg-primary/20' : 'bg-white/5'}
          `}>
            <FileText className={`w-5 h-5 ${template.isDefault ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h4 className="font-medium text-foreground">{template.name}</h4>
            <p className="text-xs text-muted-foreground">{formatDate(template.createdAt)}</p>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMenu(!showMenu)}
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 z-20 w-40 py-1 rounded-lg bg-[#1a1a1f] border border-white/10 shadow-xl animate-fade-in">
                <button
                  onClick={() => {
                    onEdit(template);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-white/5 flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                {!template.isDefault && (
                  <button
                    onClick={() => {
                      onSetDefault(template.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-white/5 flex items-center gap-2"
                  >
                    <Star className="w-3.5 h-3.5" /> Set as Default
                  </button>
                )}
                <button
                  onClick={() => {
                    handleDelete();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {template.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {template.description}
        </p>
      )}

      {/* Transforms */}
      <div className="flex items-center gap-1.5 mb-4">
        {template.transforms.map((transform, index) => (
          <span
            key={index}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10"
            title={transform.type}
          >
            {getTransformIcon(transform.type)}
            <span className="text-xs text-muted-foreground capitalize">{transform.type}</span>
          </span>
        ))}
        {template.transforms.length === 0 && (
          <span className="text-xs text-muted-foreground">No transforms configured</span>
        )}
      </div>

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        disabled={isApplying || isDeleting}
        className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 gap-2"
      >
        {isApplying ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Applying...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Apply Template
          </>
        )}
      </Button>
    </div>
  );
}

export function TemplateList({
  templates,
  isLoading = false,
  onApply,
  onEdit,
  onDelete,
  onSetDefault,
  onCreateNew,
}: TemplateListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading templates...</span>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="relative mb-6 inline-block">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-white/10 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-2">
          No Templates Yet
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
          Create reusable pipeline templates to quickly apply transforms and anomaly detection settings.
        </p>
        <Button
          onClick={onCreateNew}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Pipeline Templates ({templates.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateNew}
          className="h-7 text-xs gap-1"
        >
          <Plus className="w-3 h-3" /> New Template
        </Button>
      </div>

      <div className="grid gap-3">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onApply={onApply}
            onEdit={onEdit}
            onDelete={onDelete}
            onSetDefault={onSetDefault}
          />
        ))}
      </div>
    </div>
  );
}
