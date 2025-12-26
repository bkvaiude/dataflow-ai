// ============================================================================
// Sample Data Preview Types
// ============================================================================

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
}

export interface SampleDataResult {
  tableName: string;
  schemaName: string;
  columns: ColumnMetadata[];
  rows: unknown[][];
  rowCount: number;
  totalRowsEstimate: number;
  fetchedAt: string;
}

// ============================================================================
// Transform Types
// ============================================================================

export type TransformType = 'join' | 'filter' | 'aggregation';

export interface JoinTransform {
  type: 'join';
  leftTable: string;
  rightTable: string;
  joinType: 'inner' | 'left' | 'right' | 'full';
  leftKey: string;
  rightKey: string;
}

export interface FilterTransform {
  type: 'filter';
  table: string;
  whereClause: string;
}

export interface AggregationTransform {
  type: 'aggregation';
  table: string;
  groupBy: string[];
  aggregations: AggregationFunction[];
}

export interface AggregationFunction {
  column: string;
  function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  alias: string;
}

export type Transform = JoinTransform | FilterTransform | AggregationTransform;

export interface TransformStats {
  leftRows?: number;
  rightRows?: number;
  inputRows: number;
  outputRows: number;
  nullCount: number;
  nullColumns: Record<string, number>;
}

export interface TransformResult {
  resultColumns: ColumnMetadata[];
  resultRows: unknown[][];
  sqlExecuted: string;
  stats: TransformStats;
}

// ============================================================================
// Anomaly Detection Types
// ============================================================================

export type AnomalyType = 'null_ratio' | 'type_coercion' | 'cardinality' | 'missing_field' | 'row_drop';

export type AnomalySeverity = 'info' | 'warning' | 'error';

export interface AnomalyDetails {
  nullCount?: number;
  totalCount?: number;
  nullPercentage?: number;
  affectedRows?: number[];
  threshold?: number;
  actualValue?: number;
  expectedType?: string;
  actualType?: string;
  inputRows?: number;
  outputRows?: number;
  multiplier?: number;
}

export interface Anomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  column?: string;
  message: string;
  details: AnomalyDetails;
}

export interface AnomalySummary {
  totalAnomalies: number;
  errors: number;
  warnings: number;
  info: number;
}

export interface AnalysisResult {
  anomalies: Anomaly[];
  summary: AnomalySummary;
  canProceed: boolean;
}

// ============================================================================
// Template Types
// ============================================================================

export interface AnomalyThresholdConfig {
  nullRatio: {
    enabled: boolean;
    warningThreshold: number;
    errorThreshold: number;
  };
  typeCoercion: {
    enabled: boolean;
  };
  cardinality: {
    enabled: boolean;
    multiplierThreshold: number;
  };
  missingRequired: {
    enabled: boolean;
  };
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description?: string;
  transforms: Transform[];
  anomalyConfig: AnomalyThresholdConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFormData {
  name: string;
  description?: string;
  transforms: Transform[];
  anomalyConfig: AnomalyThresholdConfig;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface SampleDataRequest {
  credential_id: string;
  table_name: string;
  schema_name?: string;
  limit?: number;
  columns?: string[];
}

export interface TransformRequest {
  credential_id: string;
  transform: Transform;
  schema_name?: string;
  limit?: number;
}

export interface AnalyzeRequest {
  original_data: SampleDataResult;
  transformed_data: TransformResult;
  transformation_type: TransformType;
  config?: AnomalyThresholdConfig;
}

// Default anomaly configuration
export const DEFAULT_ANOMALY_CONFIG: AnomalyThresholdConfig = {
  nullRatio: {
    enabled: true,
    warningThreshold: 5,
    errorThreshold: 20,
  },
  typeCoercion: {
    enabled: true,
  },
  cardinality: {
    enabled: true,
    multiplierThreshold: 2,
  },
  missingRequired: {
    enabled: true,
  },
};
