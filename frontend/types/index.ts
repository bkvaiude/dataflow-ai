// User types
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
}

export interface ChatAction {
  type: 'oauth' | 'link' | 'button' | 'confirm_reprocess';
  provider?: string;
  url?: string;
  label: string;
  onClick?: () => void;
  confirmationData?: {
    connectorId: string;
    customerId: string;
    userId: string;
  };
}

// Connector types
export interface Connector {
  id: string;
  provider: 'google_ads' | 'facebook_ads' | 'shopify';
  name: string;
  status: 'available' | 'connected' | 'coming_soon';
  lastSync?: Date;
  accountName?: string;
}

// Dashboard/Metrics types
export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  cpc: number;
  ctr: number;
}

export interface DashboardData {
  url: string;
  insight: string;
  campaignsCount: number;
  metrics: CampaignMetrics[];
}

// WebSocket event types
export interface SocketEvents {
  connect: () => void;
  disconnect: () => void;
  chat_message: (data: { message: string; user_id: string }) => void;
  chat_response: (data: { message: string; actions?: ChatAction[] }) => void;
  error: (error: string) => void;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface OAuthInitResponse {
  authUrl: string;
  provider: string;
  message: string;
}

export interface ConnectorStatusResponse {
  connected: boolean;
  available: boolean;
  accountName?: string;
  lastSync?: string;
}

// ============================================================================
// CDC Source Management Types
// ============================================================================

// Credential types
export interface Credential {
  id: string;
  name: string;
  sourceType: 'postgresql' | 'mysql';
  host: string;
  database: string;
  port: number;
  isValid: boolean;
  lastValidatedAt?: string;
  createdAt: string;
}

export interface CredentialFormData {
  name: string;
  sourceType: 'postgresql' | 'mysql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  testConnection: boolean;
}

// Schema types
export interface DiscoveredTable {
  tableName: string;
  schemaName: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKey[];
  rowCountEstimate?: number;
  tableSizeBytes?: number;
  hasPrimaryKey: boolean;
  cdcEligible: boolean;
  cdcIssues: string[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  isPk: boolean;
}

export interface ForeignKey {
  columns: string[];
  refTable: string;
  refColumns: string[];
}

export interface SchemaDiscoveryResult {
  credentialId: string;
  discoveredAt: string;
  schemas: {
    schemaName: string;
    tables: DiscoveredTable[];
  }[];
  relationshipGraph: {
    nodes: string[];
    edges: { from: string; to: string; type: string }[];
  };
  summary: {
    totalTables: number;
    cdcEligibleTables: number;
    tablesWithoutPk: number;
  };
}

// CDC Readiness types
export interface CDCReadinessResult {
  credentialId: string;
  checkedAt: string;
  overallReady: boolean;
  server: {
    version: string;
    provider: string;
    providerDetected: boolean;
  };
  checks: Record<string, CDCCheck>;
  tableReadiness: TableReadiness[];
  recommendedActions: RecommendedAction[];
}

export interface CDCCheck {
  status: 'pass' | 'warning' | 'fail';
  currentValue?: string | number;
  requiredValue?: string;
  used?: number;
  available?: number;
  message: string;
  fixInstructions?: string;
  fix?: string;
}

export interface TableReadiness {
  table: string;
  ready: boolean;
  hasPrimaryKey: boolean;
  hasReplicaIdentity: boolean;
  replicaIdentity?: string;
  fix?: string;
}

export interface RecommendedAction {
  priority: 'high' | 'medium' | 'low';
  action: string;
  providerSpecific: boolean;
}
