'use client';

/**
 * Action Parser - Extracts embedded action JSON from AI message content
 * and maps them to appropriate confirmation components
 */

export interface ParsedAction {
  type: string;
  data: Record<string, unknown>;
  rawJson: string;
}

export interface ParsedMessage {
  cleanContent: string;
  actions: ParsedAction[];
}

/**
 * Extracts JSON code blocks from message content
 * Handles both triple-backtick and single-backtick formats
 */
export function parseMessageActions(content: string): ParsedMessage {
  const actions: ParsedAction[] = [];
  let cleanContent = content;

  // Match triple-backtick json blocks (multi-line)
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/g;
  let match;

  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);

      if (parsed.action_type) {
        actions.push({
          type: parsed.action_type,
          data: parsed,
          rawJson: match[0],
        });
      }
    } catch {
      // Invalid JSON, skip
      console.warn('Failed to parse JSON block');
    }
  }

  // Remove JSON blocks from content
  cleanContent = cleanContent.replace(jsonBlockRegex, '').trim();

  // Also try to match single backtick json blocks (less common)
  const singleTickRegex = /`json\s*(\{[\s\S]*?\})\s*`/g;
  while ((match = singleTickRegex.exec(content)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);

      if (parsed.action_type && !actions.some(a => a.type === parsed.action_type)) {
        actions.push({
          type: parsed.action_type,
          data: parsed,
          rawJson: match[0],
        });
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  cleanContent = cleanContent.replace(singleTickRegex, '').trim();

  // Clean up extra newlines
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n');

  return { cleanContent, actions };
}

/**
 * Maps action_type string to component type
 */
export type InlineActionType =
  | 'source_select'
  | 'tables'
  | 'filter'
  | 'schema'
  | 'destination'
  | 'destination_schema'
  | 'cost'
  | 'pipeline_create'
  | 'alert_config'
  | 'topic'
  | 'resources'
  | 'generic';

export function mapActionType(actionType: string): InlineActionType {
  const mapping: Record<string, InlineActionType> = {
    'confirm_source_select': 'source_select',
    'confirm_tables': 'tables',
    'confirm_filter': 'filter',
    'confirm_schema': 'schema',
    'confirm_destination': 'destination',
    'confirm_destination_schema': 'destination_schema',
    'confirm_cost': 'cost',
    'confirm_pipeline_create': 'pipeline_create',
    'confirm_alert_config': 'alert_config',
    'confirm_topic': 'topic',
    'confirm_resources': 'resources',
  };

  return mapping[actionType] || 'generic';
}

/**
 * Check if a message has any actionable content
 */
export function hasActions(content: string): boolean {
  const { actions } = parseMessageActions(content);
  return actions.length > 0;
}
