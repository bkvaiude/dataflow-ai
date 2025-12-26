'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ColumnInfo, LookupTable, JoinKey } from '@/types';
import {
  GitMerge,
  Zap,
  Database,
  ArrowRight,
  Link2,
  X,
  Info,
} from 'lucide-react';

interface StreamColumn extends ColumnInfo {
  id: string;
}

interface TableColumn extends ColumnInfo {
  id: string;
  tableAlias: string;
  tableName: string;
}

interface JoinBuilderProps {
  streamName: string;
  streamColumns: ColumnInfo[];
  lookupTables: (LookupTable & { name: string })[];
  joinKeys: JoinKey[];
  joinType: 'LEFT' | 'INNER';
  onJoinKeysChange: (keys: JoinKey[]) => void;
  onJoinTypeChange: (type: 'LEFT' | 'INNER') => void;
}

interface Connection {
  streamColumnId: string;
  tableColumnId: string;
  tableAlias: string;
}

export function JoinBuilder({
  streamName,
  streamColumns,
  lookupTables,
  joinKeys,
  joinType,
  onJoinKeysChange,
  onJoinTypeChange,
}: JoinBuilderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const streamColumnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const tableColumnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [dragState, setDragState] = useState<{
    from: string;
    fromType: 'stream' | 'table';
    mousePos: { x: number; y: number };
  } | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);

  // Convert joinKeys to connections on mount
  useEffect(() => {
    const newConnections = joinKeys.map((key) => ({
      streamColumnId: `stream-${key.streamColumn}`,
      tableColumnId: `${key.tableAlias}-${key.tableColumn}`,
      tableAlias: key.tableAlias || '',
    }));
    setConnections(newConnections);
  }, []);

  // Prepare stream columns with IDs
  const streamCols: StreamColumn[] = streamColumns.map((col) => ({
    ...col,
    id: `stream-${col.name}`,
  }));

  // Prepare table columns with IDs
  const tableCols: TableColumn[] = lookupTables.flatMap((table) =>
    (table.schema || []).map((col) => ({
      ...col,
      id: `${table.alias}-${col.name}`,
      tableAlias: table.alias,
      tableName: table.name || table.topic.split('.').pop() || table.alias,
    }))
  );

  const handleMouseDown = (id: string, type: 'stream' | 'table', e: React.MouseEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragState({
        from: id,
        fromType: type,
        mousePos: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragState({
      ...dragState,
      mousePos: { x: e.clientX - rect.left, y: e.clientY - rect.top },
    });
  }, [dragState]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!dragState || !containerRef.current) {
      setDragState(null);
      return;
    }

    // Find if we're over a valid target
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const columnEl = target?.closest('[data-column-id]') as HTMLElement;

    if (columnEl) {
      const targetId = columnEl.dataset.columnId;
      const targetType = columnEl.dataset.columnType;

      if (targetId && targetType && targetType !== dragState.fromType) {
        // Valid connection
        const streamId = dragState.fromType === 'stream' ? dragState.from : targetId;
        const tableId = dragState.fromType === 'table' ? dragState.from : targetId;
        const tableAlias = tableId.split('-')[0];

        // Check if connection already exists
        const exists = connections.some(
          (c) => c.streamColumnId === streamId && c.tableColumnId === tableId
        );

        if (!exists) {
          const newConnections = [...connections, { streamColumnId: streamId, tableColumnId: tableId, tableAlias }];
          setConnections(newConnections);

          // Update joinKeys
          const newJoinKeys: JoinKey[] = newConnections.map((c) => ({
            streamColumn: c.streamColumnId.replace('stream-', ''),
            tableColumn: c.tableColumnId.split('-').slice(1).join('-'),
            tableAlias: c.tableAlias,
          }));
          onJoinKeysChange(newJoinKeys);
        }
      }
    }

    setDragState(null);
  }, [dragState, connections, onJoinKeysChange]);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const removeConnection = (index: number) => {
    const newConnections = connections.filter((_, i) => i !== index);
    setConnections(newConnections);

    const newJoinKeys: JoinKey[] = newConnections.map((c) => ({
      streamColumn: c.streamColumnId.replace('stream-', ''),
      tableColumn: c.tableColumnId.split('-').slice(1).join('-'),
      tableAlias: c.tableAlias,
    }));
    onJoinKeysChange(newJoinKeys);
  };

  const getColumnPosition = (id: string, type: 'stream' | 'table') => {
    const refs = type === 'stream' ? streamColumnRefs : tableColumnRefs;
    const el = refs.current.get(id);
    const container = containerRef.current;

    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return {
        x: type === 'stream' ? elRect.right - containerRect.left : elRect.left - containerRect.left,
        y: elRect.top - containerRect.top + elRect.height / 2,
      };
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitMerge className="w-5 h-5 text-cyan-400" />
          <span className="font-medium text-foreground">Configure JOIN</span>
        </div>

        {/* JOIN Type Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
          <button
            onClick={() => onJoinTypeChange('LEFT')}
            className={`
              px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${joinType === 'LEFT'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-muted-foreground hover:text-foreground'}
            `}
          >
            LEFT JOIN
          </button>
          <button
            onClick={() => onJoinTypeChange('INNER')}
            className={`
              px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${joinType === 'INNER'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-muted-foreground hover:text-foreground'}
            `}
          >
            INNER JOIN
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-cyan-300">
          Drag from a stream column to a table column to create a join key.
          Multiple join keys create a composite join condition.
        </p>
      </div>

      {/* Visual Join Builder */}
      <div
        ref={containerRef}
        className="relative flex gap-8 p-6 rounded-xl bg-black/30 border border-white/10 min-h-[400px] overflow-hidden"
      >
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Existing connections */}
          {connections.map((conn, index) => {
            const streamPos = getColumnPosition(conn.streamColumnId, 'stream');
            const tablePos = getColumnPosition(conn.tableColumnId, 'table');

            if (!streamPos || !tablePos) return null;

            const midX = (streamPos.x + tablePos.x) / 2;
            const path = `M ${streamPos.x} ${streamPos.y} C ${midX} ${streamPos.y}, ${midX} ${tablePos.y}, ${tablePos.x} ${tablePos.y}`;

            return (
              <g key={index}>
                <path
                  d={path}
                  fill="none"
                  stroke="url(#connectionGradient)"
                  strokeWidth="2"
                  className="opacity-70"
                />
                <circle cx={streamPos.x} cy={streamPos.y} r="4" fill="#3b82f6" />
                <circle cx={tablePos.x} cy={tablePos.y} r="4" fill="#10b981" />
              </g>
            );
          })}

          {/* Dragging line */}
          {dragState && (
            <line
              x1={getColumnPosition(dragState.from, dragState.fromType)?.x || 0}
              y1={getColumnPosition(dragState.from, dragState.fromType)?.y || 0}
              x2={dragState.mousePos.x}
              y2={dragState.mousePos.y}
              stroke={dragState.fromType === 'stream' ? '#3b82f6' : '#10b981'}
              strokeWidth="2"
              strokeDasharray="6,3"
              className="opacity-70"
            />
          )}
        </svg>

        {/* Stream Panel */}
        <div className="flex-1 space-y-3 z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Source Stream</h4>
              <code className="text-xs text-muted-foreground font-mono">{streamName}</code>
            </div>
          </div>

          <div className="space-y-1.5">
            {streamCols.map((col) => (
              <div
                key={col.id}
                ref={(el) => { if (el) streamColumnRefs.current.set(col.id, el); }}
                data-column-id={col.id}
                data-column-type="stream"
                onMouseDown={(e) => handleMouseDown(col.id, 'stream', e)}
                className={`
                  relative flex items-center justify-between p-2.5 rounded-lg border cursor-grab transition-all
                  ${connections.some((c) => c.streamColumnId === col.id)
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-white/[0.03] border-white/10 hover:border-blue-500/30'}
                  ${dragState?.from === col.id ? 'ring-2 ring-blue-500/50' : ''}
                `}
              >
                <span className="font-mono text-sm text-foreground">{col.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{col.type.replace(/\(.*\)/, '')}</span>

                {/* Connection point */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>

        {/* Connection Zone */}
        <div className="flex flex-col items-center justify-center gap-3 min-w-[60px]">
          <ArrowRight className="w-6 h-6 text-muted-foreground" />
          <div className="text-xs text-muted-foreground text-center">
            {connections.length} join{connections.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Tables Panel */}
        <div className="flex-1 space-y-4 z-10">
          {lookupTables.map((table) => {
            const tableColumns = tableCols.filter((c) => c.tableAlias === table.alias);

            return (
              <div key={table.alias} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <Database className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{table.name || table.topic.split('.').pop()}</h4>
                      <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                        {table.alias}
                      </code>
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">{table.topic}</code>
                  </div>
                </div>

                <div className="space-y-1.5 pl-10">
                  {tableColumns.slice(0, 8).map((col) => (
                    <div
                      key={col.id}
                      ref={(el) => { if (el) tableColumnRefs.current.set(col.id, el); }}
                      data-column-id={col.id}
                      data-column-type="table"
                      onMouseDown={(e) => handleMouseDown(col.id, 'table', e)}
                      className={`
                        relative flex items-center justify-between p-2.5 rounded-lg border cursor-grab transition-all
                        ${connections.some((c) => c.tableColumnId === col.id)
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-white/[0.03] border-white/10 hover:border-green-500/30'}
                        ${dragState?.from === col.id ? 'ring-2 ring-green-500/50' : ''}
                      `}
                    >
                      {/* Connection point */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-green-500 border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity" />

                      <span className="font-mono text-sm text-foreground">{col.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{col.type.replace(/\(.*\)/, '')}</span>
                    </div>
                  ))}
                  {tableColumns.length > 8 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{tableColumns.length - 8} more columns
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Connections */}
      {connections.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4 text-cyan-400" />
            Join Keys ({connections.length})
          </h4>
          <div className="space-y-1.5">
            {connections.map((conn, index) => {
              const streamCol = conn.streamColumnId.replace('stream-', '');
              const tableCol = conn.tableColumnId.split('-').slice(1).join('-');

              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/10"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <code className="text-blue-400 font-mono">s.{streamCol}</code>
                    <span className="text-muted-foreground">=</span>
                    <code className="text-green-400 font-mono">{conn.tableAlias}.{tableCol}</code>
                  </div>
                  <button
                    onClick={() => removeConnection(index)}
                    className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
