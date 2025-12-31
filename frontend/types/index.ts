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

// Chat Action Types - Extended for Interactive Confirmations
export type ChatActionType =
  | 'oauth'
  | 'link'
  | 'button'
  | 'confirm_reprocess'
  // New confirmation types for interactive workflow
  | 'confirm_source_select'    // Select existing data source or create new
  | 'confirm_credentials'      // Secure credential form (fallback when no sources)
  | 'confirm_destination'      // Choose sink (ClickHouse/Kafka)
  | 'confirm_tables'           // Multi-select tables
  | 'confirm_filter'           // Data filter confirmation
  | 'confirm_cost'             // Cost estimation before pipeline creation
  | 'confirm_pipeline_create'  // Final pipeline confirmation
  | 'confirm_alert_config'     // Alert settings form
  | 'confirm_action'           // Generic yes/no confirmation
  // ClickHouse sink configuration steps
  | 'confirm_clickhouse_config'  // Step 1: ClickHouse DB/table selection
  | 'confirm_schema_preview'     // Step 2: Schema preview and approval
  | 'confirm_topic_registry';    // Step 3: Kafka topic and schema registry confirmation

export interface ChatAction {
  type: ChatActionType;
  provider?: string;
  url?: string;
  label: string;
  onClick?: () => void;
  // Legacy reprocess confirmation data
  confirmationData?: {
    connectorId: string;
    customerId: string;
    userId: string;
  };
  // New confirmation payloads
  sourceContext?: SourceSelectContext;
  credentialContext?: CredentialConfirmContext;
  tableContext?: TableConfirmContext;
  destinationContext?: DestinationConfirmContext;
  filterContext?: FilterConfirmContext;
  pipelineContext?: PipelineConfirmContext;
  alertContext?: AlertConfirmContext;
  actionContext?: GenericActionContext;
  // ClickHouse sink configuration contexts
  clickhouseContext?: ClickHouseConfigContext;
  schemaContext?: SchemaPreviewContext;
  topicContext?: TopicRegistryContext;
  // Cost estimation context
  costContext?: CostEstimateContext;
}

// Cost component for cost estimation
export interface CostComponent {
  name: string;
  description: string;
  unitCost: number;
  unit: string;
  quantity: number;
  dailyCost: number;
  monthlyCost: number;
}

// Cost estimation context for confirm_cost action
export interface CostEstimateContext {
  pipelineName: string;
  components: CostComponent[];
  totals: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  notes: string[];
  assumptions: {
    tables?: number;
    estimatedEventsPerDay?: number;
    effectiveEventsPerDay?: number;
    avgRowSizeBytes?: number;
    filterApplied?: boolean;
    filterReductionPercent?: number;
    aggregationApplied?: boolean;
  };
  sessionId: string;
}

// ============================================================================
// Confirmation Context Types for Interactive Chat Flow
// ============================================================================

// Context for source selection (existing credentials or create new)
export interface SourceSelectContext {
  sessionId: string;
  sourceType?: 'postgresql' | 'mysql';
  message?: string;
}

// Context for secure credential collection
export interface CredentialConfirmContext {
  name: string;
  sourceType: 'postgresql' | 'mysql';
  host: string;
  port: number;
  database: string;
  username: string;
  // Note: password is NOT included - user enters it securely
  sessionId: string;  // For tracking the workflow session
}

// Context for table selection
export interface TableConfirmContext {
  credentialId: string;
  credentialName: string;
  tables: Array<{
    name: string;
    schema: string;
    rowCount: number;
    cdcEligible: boolean;
    issues?: string[];
  }>;
  recommendedTables?: string[];
  sessionId: string;
}

// Context for destination selection
export interface DestinationConfirmContext {
  credentialId: string;
  selectedTables: string[];
  destinations: Array<{
    type: 'clickhouse' | 'kafka' | 's3';
    name: string;
    description: string;
    available: boolean;
    recommended?: boolean;
  }>;
  sessionId: string;
}

// Context for data filter confirmation
export interface FilterConfirmContext {
  credentialId: string;
  table: string;
  filterSql: string;
  filterColumn: string;
  filterOperator: string;
  filterValues: string[];
  filterDescription: string;
  confidence: number;
  originalRowCount: number;
  filteredRowCount?: number;
  sampleData?: Array<Record<string, unknown>>;
  tableColumns?: Array<{ name: string; type: string }>;
  sessionId: string;
}

// Context for final pipeline confirmation
export interface PipelineConfirmContext {
  credentialId: string;
  credentialName: string;
  host: string;
  database: string;
  selectedTables: string[];
  sinkType: 'clickhouse' | 'kafka' | 's3';
  suggestedName: string;
  sessionId: string;
}

// Context for alert configuration
export interface AlertConfirmContext {
  pipelineId: string;
  pipelineName: string;
  suggestedName: string;
  ruleTypes: Array<{
    type: AlertRuleType;
    name: string;
    description: string;
    recommended?: boolean;
  }>;
  defaultConfig: {
    severity: AlertSeverity;
    enabledDays: number[];
    enabledHours: { start: number; end: number };
    cooldownMinutes: number;
  };
  sessionId: string;
}

// Context for generic yes/no actions
export interface GenericActionContext {
  actionId: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'warning' | 'danger';
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ClickHouse Sink Configuration Contexts
// ============================================================================

// Context for ClickHouse database/table configuration (Step 1)
export interface ClickHouseConfigContext {
  credentialId: string;
  selectedTables: string[];
  sessionId: string;
  existingTables: Array<{
    database: string;
    table: string;
    columns: ColumnInfo[];
    rowCount: number;
  }>;
  suggestedDatabase: string;
  suggestedTable: string;
}

// Context for schema preview and approval (Step 2)
export interface SchemaPreviewContext {
  credentialId: string;
  selectedTables: string[];
  clickhouseConfig: {
    database: string;
    table: string;
    createNew: boolean;
  };
  sourceSchema: ColumnInfo[];
  generatedSchema?: {
    columns: Array<{
      name: string;
      sourceType: string;
      clickhouseType: string;
      nullable: boolean;
      isPrimaryKey: boolean;
      description?: string;
    }>;
    engine: string;
    orderBy: string[];
    partitionBy?: string;
    createTableSql?: string;
  };
  promptForIntent: boolean;
  sessionId: string;
}

// Context for Kafka topic and schema registry confirmation (Step 3)
export interface TopicRegistryContext {
  credentialId: string;
  selectedTables: string[];
  clickhouseConfig: {
    database: string;
    table: string;
  };
  approvedSchema: SchemaPreviewContext['generatedSchema'];
  topicName: string;
  avroSchema: {
    type: string;
    name: string;
    namespace: string;
    fields: Array<{
      name: string;
      type: string | string[];
    }>;
  };
  schemaRegistrySubject: string;
  sessionId: string;
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

// ============================================================================
// CDC Pipeline Types
// ============================================================================

export type PipelineStatus = 'pending' | 'running' | 'paused' | 'failed' | 'stopped';

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  sourceCredentialId: string;
  sourceTables: string[];
  sourceConnectorName?: string;
  sinkType: 'clickhouse' | 'kafka' | 's3';
  sinkConfig: SinkConfig;
  sinkConnectorName?: string;
  templateId?: string;
  status: PipelineStatus;
  lastHealthCheck?: string;
  errorMessage?: string;
  metricsCache?: PipelineMetricsCache;
  metricsUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  stoppedAt?: string;
}

export interface SinkConfig {
  // ClickHouse sink
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  // Kafka sink
  bootstrapServers?: string;
  topic?: string;
  // S3 sink
  bucket?: string;
  region?: string;
  prefix?: string;
}

export interface PipelineMetricsCache {
  totalEvents?: number;
  eventsPerSecond?: number;
  lagMs?: number;
  lastEventAt?: string;
}

export interface PipelineEvent {
  id: string;
  pipelineId: string;
  eventType: 'created' | 'started' | 'paused' | 'resumed' | 'stopped' | 'failed' | 'error';
  message?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface PipelineHealth {
  pipelineId: string;
  status: PipelineStatus;
  sourceConnector: ConnectorStatus;
  sinkConnector: ConnectorStatus;
  lastCheck: string;
  errors: PipelineError[];
}

export interface ConnectorStatus {
  name?: string;
  status: 'running' | 'paused' | 'failed' | 'unknown';
  taskCount?: number;
  failedTasks?: number;
}

export interface PipelineError {
  timestamp: string;
  component: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PipelineMetrics {
  pipelineId: string;
  lag: {
    currentMs: number;
    avgMs: number;
    maxMs: number;
  };
  throughput: {
    eventsPerSecond: number;
    bytesPerSecond: number;
    totalEvents: number;
  };
  windowSeconds: number;
  updatedAt: string;
}

export interface CreatePipelineRequest {
  name: string;
  description?: string;
  sourceCredentialId: string;
  sourceTables: string[];
  sinkType: 'clickhouse' | 'kafka' | 's3';
  sinkConfig: SinkConfig;
  templateId?: string;
}

// ============================================================================
// Enrichment Types (Stream-Table JOINs)
// ============================================================================

export type EnrichmentStatus = 'pending' | 'active' | 'failed' | 'stopped';

export interface LookupTable {
  topic: string;
  key: string;
  alias: string;
  ksqldbTable?: string;
  schema?: ColumnInfo[];
}

export interface JoinKey {
  streamColumn: string;
  tableColumn: string;
  tableAlias?: string;
}

export interface Enrichment {
  id: string;
  pipelineId: string;
  name: string;
  description?: string;
  sourceStreamName: string;
  sourceTopic: string;
  lookupTables: LookupTable[];
  joinType: 'LEFT' | 'INNER';
  joinKeys: JoinKey[];
  outputColumns: string[];
  outputStreamName: string;
  outputTopic: string;
  ksqldbQueryId?: string;
  status: EnrichmentStatus;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
}

export interface CreateEnrichmentRequest {
  pipelineId: string;
  name: string;
  description?: string;
  sourceTopic: string;
  lookupTables: LookupTable[];
  joinKeys: JoinKey[];
  outputColumns: string[];
  joinType?: 'LEFT' | 'INNER';
}

export interface EnrichmentPreview {
  sampleData: Record<string, unknown>[];
  rowCount: number;
  nullStats: Record<string, { count: number; percentage: number }>;
  warnings: string[];
}

export interface EnrichmentMetrics {
  messagesProcessed?: number;
  messagesPerSecond?: number;
  lagMs?: number;
  lastProcessedAt?: string;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertRuleType = 'volume_spike' | 'volume_drop' | 'gap_detection' | 'null_ratio';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertRule {
  id: string;
  userId: string;
  pipelineId: string;
  name: string;
  description?: string;
  ruleType: AlertRuleType;
  thresholdConfig: {
    // For volume_spike/drop
    windowMinutes?: number;
    multiplier?: number;  // spike
    ratio?: number;       // drop
    threshold?: number;   // drop (alias for ratio from chat form)
    // For gap_detection
    gapMinutes?: number;
    minutes?: number;     // alias for gapMinutes/windowMinutes from chat form
    // For null_ratio
    columnName?: string;
    nullThreshold?: number;
  };
  severity: AlertSeverity;
  recipients: string[];
  enabledDays: number[];  // 0-6 (Sun-Sat)
  enabledHours: { start: number; end: number };
  cooldownMinutes: number;
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertHistory {
  id: string;
  ruleId: string;
  pipelineId: string;
  anomalyType: string;
  anomalyDetails: Record<string, unknown>;
  severity: AlertSeverity;
  triggeredAt: string;
  emailSent: boolean;
  emailError?: string;
}

export interface AlertStats {
  totalRules: number;
  activeRules: number;
  alertsToday: number;
  alertsThisWeek: number;
  bySeverity: { info: number; warning: number; critical: number };
}

export interface CreateAlertRuleRequest {
  pipelineId: string;
  name: string;
  description?: string;
  ruleType: AlertRuleType;
  thresholdConfig: AlertRule['thresholdConfig'];
  severity: AlertSeverity;
  recipients: string[];
  enabledDays?: number[];
  enabledHours?: { start: number; end: number };
  cooldownMinutes?: number;
  isActive?: boolean;
}
