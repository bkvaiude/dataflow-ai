"""
Conversation Context Service for DataFlow AI

This module manages the conversation state across the 11-step pipeline creation flow.
It persists user requirements, selections, and progress through the workflow.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import json
import re
from fuzzywuzzy import fuzz


class PipelineStep(str, Enum):
    """Pipeline creation workflow steps"""
    SOURCE_IDENTIFICATION = "source_identification"
    TABLE_SELECTION = "table_selection"
    DATA_FILTER = "data_filter"
    SCHEMA_VALIDATION = "schema_validation"
    KAFKA_TOPIC_NAMING = "kafka_topic_naming"
    DESTINATION_SELECTION = "destination_selection"
    DESTINATION_SCHEMA = "destination_schema"
    RESOURCE_CREATION = "resource_creation"
    ALERT_CONFIGURATION = "alert_configuration"
    COST_ESTIMATION = "cost_estimation"
    FINAL_CONFIRMATION = "final_confirmation"


@dataclass
class ExtractedRequirements:
    """Requirements extracted from user's natural language message"""
    source_hint: Optional[str] = None
    table_hint: Optional[str] = None
    filter_requirement: Optional[str] = None
    destination_hint: Optional[str] = None
    alert_requirement: Optional[str] = None
    aggregation_requirement: Optional[str] = None
    raw_message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_hint": self.source_hint,
            "table_hint": self.table_hint,
            "filter_requirement": self.filter_requirement,
            "destination_hint": self.destination_hint,
            "alert_requirement": self.alert_requirement,
            "aggregation_requirement": self.aggregation_requirement,
            "raw_message": self.raw_message,
        }


@dataclass
class SourceConfig:
    """Confirmed source configuration"""
    credential_id: Optional[str] = None
    credential_name: Optional[str] = None
    source_type: Optional[str] = None
    host: Optional[str] = None
    database: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "credential_id": self.credential_id,
            "credential_name": self.credential_name,
            "source_type": self.source_type,
            "host": self.host,
            "database": self.database,
        }


@dataclass
class TableConfig:
    """Confirmed table configuration"""
    schema_name: str
    table_name: str
    columns: List[Dict[str, Any]] = field(default_factory=list)
    primary_keys: List[str] = field(default_factory=list)
    row_count_estimate: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_name": self.schema_name,
            "table_name": self.table_name,
            "columns": self.columns,
            "primary_keys": self.primary_keys,
            "row_count_estimate": self.row_count_estimate,
        }


@dataclass
class FilterConfig:
    """Data filter configuration"""
    table_name: str
    column: str
    operator: str
    values: List[Any]
    sql_where: str
    filtered_row_count: int = 0
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "table_name": self.table_name,
            "column": self.column,
            "operator": self.operator,
            "values": self.values,
            "sql_where": self.sql_where,
            "filtered_row_count": self.filtered_row_count,
            "description": self.description,
        }


@dataclass
class DestinationConfig:
    """Confirmed destination configuration"""
    destination_type: Optional[str] = None
    destination_id: Optional[str] = None
    database: Optional[str] = None
    table_name: Optional[str] = None
    schema: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "destination_type": self.destination_type,
            "destination_id": self.destination_id,
            "database": self.database,
            "table_name": self.table_name,
            "schema": self.schema,
        }


@dataclass
class AlertConfig:
    """Alert configuration"""
    alert_type: str
    threshold: Any
    severity: str = "warning"
    recipients: List[str] = field(default_factory=list)
    enabled: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_type": self.alert_type,
            "threshold": self.threshold,
            "severity": self.severity,
            "recipients": self.recipients,
            "enabled": self.enabled,
        }


@dataclass
class CostEstimate:
    """Cost estimation breakdown"""
    connector_cost: float = 0.0
    throughput_cost: float = 0.0
    processing_cost: float = 0.0
    storage_cost: float = 0.0
    total_daily: float = 0.0
    total_monthly: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "connector_cost": self.connector_cost,
            "throughput_cost": self.throughput_cost,
            "processing_cost": self.processing_cost,
            "storage_cost": self.storage_cost,
            "total_daily": self.total_daily,
            "total_monthly": self.total_monthly,
        }


@dataclass
class PipelineResources:
    """Resources created for the pipeline"""
    topics: List[str] = field(default_factory=list)
    streams: List[str] = field(default_factory=list)
    tables: List[str] = field(default_factory=list)
    connectors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "topics": self.topics,
            "streams": self.streams,
            "tables": self.tables,
            "connectors": self.connectors,
        }


class ConversationContext:
    """
    Maintains conversation state across the 11-step pipeline creation flow.

    This class persists:
    - Original user message and extracted requirements
    - Current step and completed steps
    - Confirmed configurations (source, tables, filters, destination, alerts)
    - Cost estimates
    - Resources to be created
    """

    def __init__(self, session_id: str, user_id: str):
        self.session_id = session_id
        self.user_id = user_id
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

        # Original request
        self.original_request: str = ""

        # Extracted requirements from natural language
        self.requirements: ExtractedRequirements = ExtractedRequirements()

        # Step tracking
        self.current_step: Optional[PipelineStep] = None
        self.completed_steps: List[PipelineStep] = []

        # Confirmed configurations
        self.source: SourceConfig = SourceConfig()
        self.tables: List[TableConfig] = []
        self.filters: List[FilterConfig] = []
        self.destination: DestinationConfig = DestinationConfig()
        self.alerts: List[AlertConfig] = []
        self.cost_estimate: CostEstimate = CostEstimate()

        # Resources to be created
        self.resources: PipelineResources = PipelineResources()

        # Pipeline ID (set after creation)
        self.pipeline_id: Optional[str] = None
        self.pipeline_name: Optional[str] = None

    def set_original_request(self, message: str):
        """Store the original user request"""
        self.original_request = message
        self.updated_at = datetime.utcnow()

    def set_requirements(self, requirements: ExtractedRequirements):
        """Store extracted requirements"""
        self.requirements = requirements
        self.updated_at = datetime.utcnow()

    def advance_to_step(self, step: PipelineStep):
        """Advance to a new step in the workflow"""
        if self.current_step and self.current_step not in self.completed_steps:
            self.completed_steps.append(self.current_step)
        self.current_step = step
        self.updated_at = datetime.utcnow()

    def go_back_to_step(self, step: PipelineStep):
        """Go back to a previous step (user changed mind)"""
        if step in self.completed_steps:
            # Remove this step and all subsequent steps from completed
            step_index = self.completed_steps.index(step)
            self.completed_steps = self.completed_steps[:step_index]
        self.current_step = step
        self.updated_at = datetime.utcnow()

    def mark_step_completed(self, step: PipelineStep):
        """Mark a step as completed"""
        if step not in self.completed_steps:
            self.completed_steps.append(step)
        self.updated_at = datetime.utcnow()

    def set_source(self, source: SourceConfig):
        """Store confirmed source configuration"""
        self.source = source
        self.updated_at = datetime.utcnow()

    def set_tables(self, tables: List[TableConfig]):
        """Store selected tables"""
        self.tables = tables
        self.updated_at = datetime.utcnow()

    def add_filter(self, filter_config: FilterConfig):
        """Add a data filter"""
        self.filters.append(filter_config)
        self.updated_at = datetime.utcnow()

    def clear_filters(self):
        """Clear all filters (user wants all data)"""
        self.filters = []
        self.updated_at = datetime.utcnow()

    def set_destination(self, destination: DestinationConfig):
        """Store confirmed destination configuration"""
        self.destination = destination
        self.updated_at = datetime.utcnow()

    def add_alert(self, alert: AlertConfig):
        """Add an alert configuration"""
        self.alerts.append(alert)
        self.updated_at = datetime.utcnow()

    def set_cost_estimate(self, cost: CostEstimate):
        """Store cost estimate"""
        self.cost_estimate = cost
        self.updated_at = datetime.utcnow()

    def set_pipeline(self, pipeline_id: str, pipeline_name: str):
        """Store created pipeline info"""
        self.pipeline_id = pipeline_id
        self.pipeline_name = pipeline_name
        self.updated_at = datetime.utcnow()

    def add_resource(self, resource_type: str, resource_name: str):
        """Track a created resource"""
        if resource_type == "topic":
            self.resources.topics.append(resource_name)
        elif resource_type == "stream":
            self.resources.streams.append(resource_name)
        elif resource_type == "table":
            self.resources.tables.append(resource_name)
        elif resource_type == "connector":
            self.resources.connectors.append(resource_name)
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Serialize context to dictionary"""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "original_request": self.original_request,
            "requirements": self.requirements.to_dict(),
            "current_step": self.current_step.value if self.current_step else None,
            "completed_steps": [s.value for s in self.completed_steps],
            "source": self.source.to_dict(),
            "tables": [t.to_dict() for t in self.tables],
            "filters": [f.to_dict() for f in self.filters],
            "destination": self.destination.to_dict(),
            "alerts": [a.to_dict() for a in self.alerts],
            "cost_estimate": self.cost_estimate.to_dict(),
            "resources": self.resources.to_dict(),
            "pipeline_id": self.pipeline_id,
            "pipeline_name": self.pipeline_name,
        }

    def get_summary(self) -> str:
        """Get a human-readable summary of current context"""
        summary_parts = []

        if self.source.credential_name:
            summary_parts.append(f"Source: {self.source.credential_name} ({self.source.database})")

        if self.tables:
            table_names = [f"{t.schema_name}.{t.table_name}" for t in self.tables]
            summary_parts.append(f"Tables: {', '.join(table_names)}")

        if self.filters:
            filter_descs = [f.description for f in self.filters]
            summary_parts.append(f"Filters: {', '.join(filter_descs)}")

        if self.destination.destination_type:
            summary_parts.append(f"Destination: {self.destination.destination_type}")

        if self.alerts:
            alert_types = [a.alert_type for a in self.alerts]
            summary_parts.append(f"Alerts: {', '.join(alert_types)}")

        if self.cost_estimate.total_daily > 0:
            summary_parts.append(f"Estimated cost: ${self.cost_estimate.total_daily:.2f}/day")

        return "\n".join(summary_parts) if summary_parts else "No configuration yet"


class RequirementExtractor:
    """
    Extracts structured requirements from user's natural language message.

    This is the AI's first step - understanding what the user wants before
    starting the step-by-step workflow.
    """

    # Keywords for detecting filter intent
    FILTER_KEYWORDS = [
        "only", "just", "filter", "where", "specific", "exclude",
        "include", "certain", "particular", "limited to"
    ]

    # Keywords for detecting alert intent
    ALERT_KEYWORDS = [
        "alert", "notify", "monitor", "watch", "gap", "missing",
        "no events", "no data", "spike", "drop", "anomaly"
    ]

    # Keywords for detecting aggregation intent
    AGGREGATION_KEYWORDS = [
        "count", "sum", "average", "avg", "per hour", "per day",
        "per minute", "aggregate", "group by", "total"
    ]

    # Known destination types
    DESTINATION_TYPES = [
        "clickhouse", "bigquery", "s3", "snowflake", "elasticsearch",
        "kafka", "redshift", "postgresql", "mysql"
    ]

    def __init__(self):
        pass

    def extract(self, message: str) -> ExtractedRequirements:
        """Extract structured requirements from user message"""
        requirements = ExtractedRequirements(raw_message=message)
        message_lower = message.lower()

        # Extract source hint (database name)
        requirements.source_hint = self._extract_source_hint(message)

        # Extract table hint
        requirements.table_hint = self._extract_table_hint(message)

        # Extract filter requirement
        requirements.filter_requirement = self._extract_filter_requirement(message)

        # Extract destination hint
        requirements.destination_hint = self._extract_destination_hint(message_lower)

        # Extract alert requirement
        requirements.alert_requirement = self._extract_alert_requirement(message)

        # Extract aggregation requirement
        requirements.aggregation_requirement = self._extract_aggregation_requirement(message)

        return requirements

    def _extract_source_hint(self, message: str) -> Optional[str]:
        """Extract database/source name from message"""
        # Look for patterns like "with <database>", "from <database>", "<database> database"
        patterns = [
            r"with\s+([a-zA-Z0-9_]+(?:_db|_database)?)\s+database",
            r"from\s+([a-zA-Z0-9_]+(?:_db|_database)?)\s+database",
            r"([a-zA-Z0-9_]+(?:_db|_database))\s+database",
            r"database\s+([a-zA-Z0-9_]+)",
            r"connect(?:ed)?\s+to\s+([a-zA-Z0-9_]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                return match.group(1)

        return None

    def _extract_table_hint(self, message: str) -> Optional[str]:
        """Extract table name hints from message"""
        # Look for patterns like "audit logs", "users table", "orders"
        patterns = [
            r"(?:sync|watch|monitor|track)\s+(?:the\s+)?([a-zA-Z0-9_\s]+?)(?:\s+table|\s+data|\s+events)",
            r"([a-zA-Z0-9_]+)\s+logs?",
            r"([a-zA-Z0-9_]+)\s+table",
            r"table\s+([a-zA-Z0-9_]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                hint = match.group(1).strip()
                # Convert "audit logs" to "audit_logs"
                return hint.replace(" ", "_")

        return None

    def _extract_filter_requirement(self, message: str) -> Optional[str]:
        """Extract filter requirement from message"""
        message_lower = message.lower()

        # Check if any filter keyword is present
        has_filter_intent = any(kw in message_lower for kw in self.FILTER_KEYWORDS)

        if not has_filter_intent:
            return None

        # Extract the filter clause
        # Look for patterns like "only login and logout events", "just active users"
        patterns = [
            r"only\s+(.+?)(?:\s+to\s+|\s+events?\s+|\s+from\s+|$)",
            r"just\s+(.+?)(?:\s+to\s+|\s+events?\s+|\s+from\s+|$)",
            r"filter\s+(?:for\s+)?(.+?)(?:\s+to\s+|\s+from\s+|$)",
            r"specific(?:ally)?\s+(.+?)(?:\s+to\s+|\s+from\s+|$)",
        ]

        for pattern in patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        # Fallback: return the text after filter keywords
        for kw in self.FILTER_KEYWORDS:
            if kw in message_lower:
                idx = message_lower.index(kw)
                after_kw = message[idx + len(kw):].strip()
                # Take until the next major clause
                end_patterns = [" to ", " and also ", " and set", " from ", " into "]
                for ep in end_patterns:
                    if ep in after_kw.lower():
                        end_idx = after_kw.lower().index(ep)
                        return after_kw[:end_idx].strip()
                return after_kw[:50].strip()  # Limit length

        return None

    def _extract_destination_hint(self, message_lower: str) -> Optional[str]:
        """Extract destination type from message"""
        for dest in self.DESTINATION_TYPES:
            if dest in message_lower:
                return dest
        return None

    def _extract_alert_requirement(self, message: str) -> Optional[str]:
        """Extract alert requirement from message"""
        message_lower = message.lower()

        # Check if any alert keyword is present
        has_alert_intent = any(kw in message_lower for kw in self.ALERT_KEYWORDS)

        if not has_alert_intent:
            return None

        # Extract the alert clause
        patterns = [
            r"alert\s+when\s+(.+?)(?:\s+and\s+also|$)",
            r"notify\s+(?:me\s+)?when\s+(.+?)(?:\s+and\s+also|$)",
            r"monitor\s+(?:for\s+)?(.+?)(?:\s+and\s+also|$)",
            r"watch\s+(?:for\s+)?(.+?)(?:\s+and\s+also|$)",
            r"set\s+up\s+(?:an?\s+)?alert\s+(?:for\s+)?(.+?)(?:\s+and\s+also|$)",
        ]

        for pattern in patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        # Look for gap detection patterns
        if "gap" in message_lower or "no logs" in message_lower or "no events" in message_lower:
            return "gap_detection"

        return None

    def _extract_aggregation_requirement(self, message: str) -> Optional[str]:
        """Extract aggregation requirement from message"""
        message_lower = message.lower()

        # Check if any aggregation keyword is present
        has_agg_intent = any(kw in message_lower for kw in self.AGGREGATION_KEYWORDS)

        if not has_agg_intent:
            return None

        # Extract the aggregation clause
        patterns = [
            r"count\s+(.+?)(?:\s+per\s+|\s+by\s+|$)",
            r"aggregate\s+(.+?)(?:\s+per\s+|\s+by\s+|$)",
            r"sum\s+(?:of\s+)?(.+?)(?:\s+per\s+|\s+by\s+|$)",
        ]

        for pattern in patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        return None


class SourceMatcher:
    """
    Matches source hints from user message to existing credentials.
    Uses fuzzy matching to find the best match.
    """

    def __init__(self, credentials: List[Dict[str, Any]]):
        """
        Initialize with list of existing credentials.
        Each credential should have: id, name, database, host
        """
        self.credentials = credentials

    def find_matching_source(self, hint: str, threshold: int = 60) -> Optional[Dict[str, Any]]:
        """
        Find credential matching the hint using fuzzy matching.

        Args:
            hint: User's source hint (e.g., "dataflow_test_audit_db")
            threshold: Minimum similarity score (0-100)

        Returns:
            Best matching credential or None
        """
        if not hint or not self.credentials:
            return None

        best_match = None
        best_score = 0

        for cred in self.credentials:
            # Match against database name (highest priority)
            db_score = fuzz.ratio(hint.lower(), cred.get("database", "").lower())

            # Match against credential name
            name_score = fuzz.ratio(hint.lower(), cred.get("name", "").lower())

            # Match against host
            host_score = fuzz.partial_ratio(hint.lower(), cred.get("host", "").lower())

            # Use the best score
            score = max(db_score, name_score, host_score)

            if score > best_score and score >= threshold:
                best_score = score
                best_match = cred

        return best_match

    def find_all_matching_sources(self, hint: str, threshold: int = 50) -> List[Dict[str, Any]]:
        """
        Find all credentials matching the hint above threshold.

        Returns:
            List of matching credentials sorted by score (descending)
        """
        if not hint or not self.credentials:
            return []

        matches = []

        for cred in self.credentials:
            db_score = fuzz.ratio(hint.lower(), cred.get("database", "").lower())
            name_score = fuzz.ratio(hint.lower(), cred.get("name", "").lower())
            host_score = fuzz.partial_ratio(hint.lower(), cred.get("host", "").lower())

            score = max(db_score, name_score, host_score)

            if score >= threshold:
                matches.append({**cred, "match_score": score})

        # Sort by score descending
        matches.sort(key=lambda x: x["match_score"], reverse=True)

        return matches


class TableMatcher:
    """
    Matches table hints from user message to discovered tables.
    Uses fuzzy matching to suggest relevant tables.
    """

    def __init__(self, tables: List[Dict[str, Any]]):
        """
        Initialize with list of discovered tables.
        Each table should have: table_name, schema_name
        """
        self.tables = tables

    def find_matching_table(self, hint: str, threshold: int = 60) -> Optional[Dict[str, Any]]:
        """
        Find table matching the hint using fuzzy matching.
        """
        if not hint or not self.tables:
            return None

        # Normalize hint (replace spaces with underscores)
        hint_normalized = hint.replace(" ", "_").lower()

        best_match = None
        best_score = 0

        for table in self.tables:
            table_name = table.get("table_name", "").lower()

            # Direct match
            score = fuzz.ratio(hint_normalized, table_name)

            # Partial match (hint might be subset)
            partial_score = fuzz.partial_ratio(hint_normalized, table_name)

            # Use best score
            final_score = max(score, partial_score)

            if final_score > best_score and final_score >= threshold:
                best_score = final_score
                best_match = table

        return best_match

    def find_all_matching_tables(self, hint: str, threshold: int = 40) -> List[Dict[str, Any]]:
        """
        Find all tables matching the hint above threshold.
        """
        if not hint or not self.tables:
            return self.tables  # Return all if no hint

        hint_normalized = hint.replace(" ", "_").lower()
        matches = []

        for table in self.tables:
            table_name = table.get("table_name", "").lower()
            score = fuzz.ratio(hint_normalized, table_name)
            partial_score = fuzz.partial_ratio(hint_normalized, table_name)
            final_score = max(score, partial_score)

            matches.append({**table, "match_score": final_score, "suggested": final_score >= threshold})

        # Sort by score descending
        matches.sort(key=lambda x: x["match_score"], reverse=True)

        return matches


# Global context storage (in-memory for now, can be moved to Redis/DB)
_contexts: Dict[str, ConversationContext] = {}


def get_context(session_id: str, user_id: str) -> ConversationContext:
    """Get or create conversation context for a session"""
    if session_id not in _contexts:
        _contexts[session_id] = ConversationContext(session_id, user_id)
    return _contexts[session_id]


def clear_context(session_id: str):
    """Clear context for a session"""
    if session_id in _contexts:
        del _contexts[session_id]


def get_all_contexts() -> Dict[str, ConversationContext]:
    """Get all active contexts (for debugging)"""
    return _contexts
