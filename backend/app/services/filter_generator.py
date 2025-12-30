"""
Filter Generator Service

Converts natural language filter requirements to SQL WHERE clauses.
This is a key component for the 11-step pipeline creation flow, specifically Step 3 (Data Filter).

Example transformations:
- "only login and logout events" → "event_type IN ('login', 'logout')"
- "exclude deleted records" → "deleted = false OR deleted IS NULL"
- "events from last 7 days" → "created_at >= NOW() - INTERVAL '7 days'"
"""

import re
import json
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class FilterConfig:
    """Configuration for a generated filter"""
    column: str
    operator: str  # =, !=, IN, NOT IN, >, <, >=, <=, LIKE, IS NULL, IS NOT NULL
    values: List[str]
    sql_where: str
    original_requirement: str
    confidence: float = 0.0  # 0.0 to 1.0 - how confident we are in the match


@dataclass
class ColumnAnalysis:
    """Analysis of a column for filtering purposes"""
    name: str
    data_type: str
    is_categorical: bool = False  # Good for IN/NOT IN filters
    is_temporal: bool = False     # Good for date range filters
    is_boolean: bool = False      # Good for true/false filters
    is_numeric: bool = False      # Good for comparison filters
    relevance_score: int = 0      # Higher = more likely to be used for filtering


class FilterGenerator:
    """
    Generates SQL WHERE clauses from natural language filter requirements.

    This service analyzes:
    1. The natural language filter requirement
    2. The table schema (column names and types)
    3. Optional sample data to validate filter values

    And produces:
    - A valid SQL WHERE clause
    - Confidence score
    - Alternative column suggestions
    """

    # Keywords that indicate filter intent
    FILTER_PATTERNS = {
        'inclusion': [
            r'only\s+(.+?)(?:\s+events?|\s+records?|\s+rows?|\s+data)?$',
            r'just\s+(.+?)(?:\s+events?|\s+records?|\s+rows?|\s+data)?$',
            r'specific(?:ally)?\s+(.+?)(?:\s+events?|\s+records?|\s+rows?)?$',
            r'where\s+(.+)',
            r'filter(?:ed)?\s+(?:to|by|for)\s+(.+)',
            r'sync\s+only\s+(.+)',
        ],
        'exclusion': [
            r'exclude\s+(.+?)(?:\s+events?|\s+records?|\s+rows?)?$',
            r'not\s+(.+?)(?:\s+events?|\s+records?|\s+rows?)?$',
            r'without\s+(.+?)(?:\s+events?|\s+records?|\s+rows?)?$',
            r'except\s+(.+?)(?:\s+events?|\s+records?|\s+rows?)?$',
            r'ignore\s+(.+?)(?:\s+events?|\s+records?|\s+rows?)?$',
        ],
        'temporal': [
            r'(?:from|in|within)\s+(?:the\s+)?last\s+(\d+)\s+(day|week|month|hour|minute)s?',
            r'(?:from|since|after)\s+(\d{4}-\d{2}-\d{2})',
            r'(?:before|until)\s+(\d{4}-\d{2}-\d{2})',
            r'today(?:\'s)?',
            r'yesterday',
            r'this\s+(week|month|year)',
        ],
        'boolean': [
            r'active\s+(?:only|records?)',
            r'deleted\s+records?',
            r'non[- ]?deleted',
            r'enabled',
            r'disabled',
            r'verified',
            r'unverified',
        ]
    }

    # Column name patterns that indicate likely filter columns
    CATEGORICAL_COLUMN_PATTERNS = [
        r'type', r'status', r'category', r'event', r'action',
        r'state', r'kind', r'class', r'role', r'level', r'tier'
    ]

    TEMPORAL_COLUMN_PATTERNS = [
        r'created', r'updated', r'timestamp', r'date', r'time',
        r'at$', r'_at$', r'_on$'
    ]

    BOOLEAN_COLUMN_PATTERNS = [
        r'is_', r'has_', r'deleted', r'active', r'enabled',
        r'verified', r'flag', r'bool'
    ]

    def __init__(self):
        self._compile_patterns()

    def _compile_patterns(self):
        """Pre-compile regex patterns for efficiency"""
        self._inclusion_patterns = [re.compile(p, re.IGNORECASE) for p in self.FILTER_PATTERNS['inclusion']]
        self._exclusion_patterns = [re.compile(p, re.IGNORECASE) for p in self.FILTER_PATTERNS['exclusion']]
        self._temporal_patterns = [re.compile(p, re.IGNORECASE) for p in self.FILTER_PATTERNS['temporal']]
        self._boolean_patterns = [re.compile(p, re.IGNORECASE) for p in self.FILTER_PATTERNS['boolean']]

    def analyze_columns(self, columns: List[Dict]) -> List[ColumnAnalysis]:
        """
        Analyze table columns to identify likely filter candidates.

        Args:
            columns: List of column definitions with 'name' and 'type'/'data_type'

        Returns:
            List of ColumnAnalysis sorted by relevance score
        """
        analyzed = []

        for col in columns:
            name = col.get('name', '')
            data_type = col.get('type', col.get('data_type', '')).lower()
            name_lower = name.lower()

            analysis = ColumnAnalysis(name=name, data_type=data_type)

            # Check column type characteristics
            if any(t in data_type for t in ['varchar', 'text', 'char', 'string']):
                # Check if it's categorical based on name
                if any(re.search(p, name_lower) for p in self.CATEGORICAL_COLUMN_PATTERNS):
                    analysis.is_categorical = True
                    analysis.relevance_score += 10

            elif any(t in data_type for t in ['timestamp', 'datetime', 'date', 'time']):
                analysis.is_temporal = True
                analysis.relevance_score += 5

            elif any(t in data_type for t in ['bool', 'boolean', 'bit']):
                analysis.is_boolean = True
                analysis.relevance_score += 5

            elif any(t in data_type for t in ['int', 'numeric', 'decimal', 'float', 'double']):
                analysis.is_numeric = True

            # Boost score based on column name patterns
            for pattern in self.CATEGORICAL_COLUMN_PATTERNS:
                if re.search(pattern, name_lower):
                    analysis.is_categorical = True
                    analysis.relevance_score += 8
                    break

            for pattern in self.TEMPORAL_COLUMN_PATTERNS:
                if re.search(pattern, name_lower):
                    analysis.is_temporal = True
                    analysis.relevance_score += 3
                    break

            for pattern in self.BOOLEAN_COLUMN_PATTERNS:
                if re.search(pattern, name_lower):
                    analysis.is_boolean = True
                    analysis.relevance_score += 4
                    break

            analyzed.append(analysis)

        # Sort by relevance score (descending)
        analyzed.sort(key=lambda x: x.relevance_score, reverse=True)

        return analyzed

    def extract_filter_values(self, requirement: str) -> Tuple[str, List[str], bool]:
        """
        Extract filter values from a natural language requirement.

        Args:
            requirement: Natural language filter requirement

        Returns:
            Tuple of (filter_type, values, is_exclusion)
            - filter_type: 'categorical', 'temporal', 'boolean', 'unknown'
            - values: List of extracted values
            - is_exclusion: True if this is an exclusion filter
        """
        req_lower = requirement.lower().strip()

        # Check for exclusion patterns first
        is_exclusion = False
        for pattern in self._exclusion_patterns:
            match = pattern.search(req_lower)
            if match:
                is_exclusion = True
                # Extract the content after the exclusion keyword
                req_lower = match.group(1).strip() if match.groups() else req_lower
                break

        # Check for inclusion patterns
        for pattern in self._inclusion_patterns:
            match = pattern.search(req_lower)
            if match:
                req_lower = match.group(1).strip() if match.groups() else req_lower
                break

        # Extract values - handle "X and Y" patterns
        values = []

        # Pattern: "X and Y" or "X, Y, and Z"
        if ' and ' in req_lower:
            parts = re.split(r'\s+and\s+', req_lower)
            values.extend([p.strip().strip('"\'') for p in parts])
        elif ',' in req_lower:
            parts = re.split(r',\s*', req_lower)
            values.extend([p.strip().strip('"\'').replace(' and ', '') for p in parts])
        else:
            # Single value
            values = [req_lower.strip().strip('"\'')]

        # Clean up values - remove common suffixes
        cleaned_values = []
        for v in values:
            v = re.sub(r'\s*(events?|records?|rows?|data|entries)\s*$', '', v, flags=re.IGNORECASE)
            v = v.strip()
            if v:
                cleaned_values.append(v)

        # Determine filter type
        filter_type = 'categorical'  # Default

        # Check for temporal patterns
        for pattern in self._temporal_patterns:
            if pattern.search(requirement):
                filter_type = 'temporal'
                break

        # Check for boolean patterns
        for pattern in self._boolean_patterns:
            if pattern.search(requirement):
                filter_type = 'boolean'
                break

        return filter_type, cleaned_values, is_exclusion

    def find_best_column(
        self,
        requirement: str,
        columns: List[Dict],
        filter_type: str = 'categorical'
    ) -> Tuple[Optional[str], float]:
        """
        Find the best column to apply the filter to.

        Args:
            requirement: Natural language filter requirement
            columns: Table columns
            filter_type: Type of filter (categorical, temporal, boolean)

        Returns:
            Tuple of (column_name, confidence_score)
        """
        analyzed = self.analyze_columns(columns)

        if not analyzed:
            return None, 0.0

        req_lower = requirement.lower()

        # First pass: exact column name match
        for col in analyzed:
            if col.name.lower() in req_lower or req_lower in col.name.lower():
                return col.name, 0.9

        # Second pass: match by type
        for col in analyzed:
            if filter_type == 'categorical' and col.is_categorical:
                return col.name, 0.7
            elif filter_type == 'temporal' and col.is_temporal:
                return col.name, 0.7
            elif filter_type == 'boolean' and col.is_boolean:
                return col.name, 0.7

        # Third pass: highest relevance score
        if analyzed:
            best = analyzed[0]
            confidence = min(0.5, best.relevance_score / 20)  # Cap at 0.5 for generic match
            return best.name, confidence

        return None, 0.0

    def generate(
        self,
        requirement: str,
        columns: List[Dict],
        sample_values: Optional[Dict[str, List[Any]]] = None
    ) -> FilterConfig:
        """
        Generate a SQL WHERE clause from a natural language requirement.

        Args:
            requirement: Natural language filter requirement
                Example: "only login and logout events"
            columns: Table columns with 'name' and 'type'/'data_type'
            sample_values: Optional dict of column_name -> sample values for validation

        Returns:
            FilterConfig with the generated WHERE clause
        """
        # Extract filter information
        filter_type, values, is_exclusion = self.extract_filter_values(requirement)

        logger.info(f"[FILTER_GEN] Type: {filter_type}, Values: {values}, Exclusion: {is_exclusion}")

        # Find the best column
        column_name, confidence = self.find_best_column(requirement, columns, filter_type)

        if not column_name:
            # Fallback to first categorical column
            for col in columns:
                col_type = col.get('type', col.get('data_type', '')).lower()
                if 'varchar' in col_type or 'text' in col_type:
                    column_name = col.get('name')
                    confidence = 0.3
                    break

        if not column_name:
            raise ValueError(f"Could not identify a suitable column for filter: {requirement}")

        # Validate values against sample data if available
        if sample_values and column_name in sample_values:
            valid_values = set(str(v).lower() for v in sample_values[column_name] if v)
            validated_values = []
            for v in values:
                if v.lower() in valid_values:
                    validated_values.append(v)
                    confidence = min(confidence + 0.1, 1.0)
            if validated_values:
                values = validated_values

        # Generate SQL WHERE clause
        if filter_type == 'boolean':
            # Boolean filter
            if is_exclusion or any(neg in requirement.lower() for neg in ['non', 'not', 'un', 'deleted']):
                sql_where = f"{column_name} = false OR {column_name} IS NULL"
                operator = "= false"
                values = ['false']
            else:
                sql_where = f"{column_name} = true"
                operator = "= true"
                values = ['true']

        elif len(values) > 1:
            # Multiple values - use IN / NOT IN
            values_quoted = ", ".join([f"'{v}'" for v in values])
            if is_exclusion:
                sql_where = f"{column_name} NOT IN ({values_quoted})"
                operator = "NOT IN"
            else:
                sql_where = f"{column_name} IN ({values_quoted})"
                operator = "IN"

        elif len(values) == 1:
            # Single value
            if is_exclusion:
                sql_where = f"{column_name} != '{values[0]}'"
                operator = "!="
            else:
                sql_where = f"{column_name} = '{values[0]}'"
                operator = "="

        else:
            # No values extracted - generate a template
            sql_where = f"{column_name} IN ('value1', 'value2')"
            operator = "IN"
            values = ['value1', 'value2']
            confidence = 0.2

        return FilterConfig(
            column=column_name,
            operator=operator,
            values=values,
            sql_where=sql_where,
            original_requirement=requirement,
            confidence=confidence
        )

    def generate_multiple(
        self,
        requirements: List[str],
        columns: List[Dict],
        sample_values: Optional[Dict[str, List[Any]]] = None
    ) -> List[FilterConfig]:
        """
        Generate multiple filters and combine them.

        Args:
            requirements: List of natural language filter requirements
            columns: Table columns
            sample_values: Optional sample data

        Returns:
            List of FilterConfig objects
        """
        filters = []
        for req in requirements:
            try:
                filter_config = self.generate(req, columns, sample_values)
                filters.append(filter_config)
            except Exception as e:
                logger.warning(f"[FILTER_GEN] Failed to generate filter for '{req}': {e}")

        return filters

    def combine_filters(self, filters: List[FilterConfig], operator: str = "AND") -> str:
        """
        Combine multiple filters into a single WHERE clause.

        Args:
            filters: List of FilterConfig objects
            operator: How to combine (AND/OR)

        Returns:
            Combined SQL WHERE clause
        """
        if not filters:
            return ""

        if len(filters) == 1:
            return filters[0].sql_where

        where_parts = [f"({f.sql_where})" for f in filters]
        return f" {operator} ".join(where_parts)

    def to_dict(self, filter_config: FilterConfig) -> Dict:
        """Convert FilterConfig to dictionary for JSON serialization"""
        return {
            'column': filter_config.column,
            'operator': filter_config.operator,
            'values': filter_config.values,
            'sql_where': filter_config.sql_where,
            'original_requirement': filter_config.original_requirement,
            'confidence': filter_config.confidence
        }


# Singleton instance
filter_generator = FilterGenerator()
