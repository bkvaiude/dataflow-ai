"""
Cost Estimator Service

Estimates costs for pipeline resources before creation.
This is key to the "no cost wastage" principle - users should know costs upfront.

Cost Components (Confluent Cloud pricing model):
1. Connector Tasks: $0.01/task/hour
2. Data Throughput: $0.10/GB transferred
3. Storage: $0.10/GB/month retained in Kafka
4. ksqlDB Processing: $0.10/CSU/hour
5. Destination Storage: varies by destination
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class CostComponent:
    """A single cost component"""
    name: str
    description: str
    unit_cost: float         # Cost per unit
    unit: str                # e.g., "task/hour", "GB", "CSU/hour"
    quantity: float          # Number of units
    daily_cost: float        # Total daily cost
    monthly_cost: float      # Total monthly cost


@dataclass
class CostEstimate:
    """Complete cost estimate for a pipeline"""
    pipeline_name: str
    components: List[CostComponent] = field(default_factory=list)
    daily_total: float = 0.0
    monthly_total: float = 0.0
    yearly_total: float = 0.0
    notes: List[str] = field(default_factory=list)
    estimated_at: datetime = field(default_factory=datetime.utcnow)
    assumptions: Dict[str, Any] = field(default_factory=dict)

    def add_component(self, component: CostComponent):
        self.components.append(component)
        self.daily_total += component.daily_cost
        self.monthly_total += component.monthly_cost
        self.yearly_total = self.monthly_total * 12

    def to_dict(self) -> Dict:
        return {
            "pipeline_name": self.pipeline_name,
            "components": [
                {
                    "name": c.name,
                    "description": c.description,
                    "unit_cost": c.unit_cost,
                    "unit": c.unit,
                    "quantity": round(c.quantity, 2),
                    "daily_cost": round(c.daily_cost, 4),
                    "monthly_cost": round(c.monthly_cost, 2)
                }
                for c in self.components
            ],
            "totals": {
                "daily": round(self.daily_total, 2),
                "monthly": round(self.monthly_total, 2),
                "yearly": round(self.yearly_total, 2)
            },
            "notes": self.notes,
            "assumptions": self.assumptions,
            "estimated_at": self.estimated_at.isoformat()
        }


class CostEstimator:
    """
    Service for estimating pipeline costs.

    Uses Confluent Cloud pricing model (approximate as of 2024):
    - Connector tasks: $0.01/task/hour
    - Data throughput: $0.10/GB
    - Storage: $0.10/GB/month
    - ksqlDB: $0.10/CSU/hour
    """

    # Pricing constants (approximate Confluent Cloud pricing)
    PRICING = {
        # Connector pricing
        "connector_task_hour": 0.01,      # $/task/hour
        "connector_task_day": 0.24,       # $/task/day (0.01 * 24)

        # Throughput pricing
        "throughput_gb": 0.10,            # $/GB transferred

        # Storage pricing
        "kafka_storage_gb_month": 0.10,   # $/GB/month
        "kafka_retention_days": 30,        # Default retention

        # ksqlDB pricing
        "ksqldb_csu_hour": 0.10,          # $/CSU/hour
        "ksqldb_min_csu": 0.5,            # Minimum CSU for simple processing

        # Destination storage (ClickHouse)
        "clickhouse_storage_gb_month": 0.02,  # $/GB/month
    }

    def __init__(self):
        pass

    def estimate_pipeline_cost(
        self,
        pipeline_config: Dict
    ) -> CostEstimate:
        """
        Estimate the cost of a pipeline based on its configuration.

        Args:
            pipeline_config: Dictionary with pipeline configuration:
                - name: Pipeline name
                - tables: List of table names
                - row_count: Estimated total rows
                - events_per_day: Estimated CDC events per day
                - avg_row_size_bytes: Average row size
                - has_filter: Whether filtering is applied
                - filter_reduction_percent: Percentage filtered out (0-100)
                - has_aggregation: Whether aggregation is applied
                - sink_type: Destination type (clickhouse, kafka, s3)
                - num_source_tasks: Number of source connector tasks
                - num_sink_tasks: Number of sink connector tasks

        Returns:
            CostEstimate with detailed breakdown
        """
        estimate = CostEstimate(
            pipeline_name=pipeline_config.get('name', 'Unnamed Pipeline')
        )

        # Extract configuration
        tables = pipeline_config.get('tables', [])
        num_tables = len(tables) if isinstance(tables, list) else 1
        row_count = pipeline_config.get('row_count', 0)
        events_per_day = pipeline_config.get('events_per_day', 0)
        avg_row_size = pipeline_config.get('avg_row_size_bytes', 500)
        has_filter = pipeline_config.get('has_filter', False)
        filter_reduction = pipeline_config.get('filter_reduction_percent', 0)
        has_aggregation = pipeline_config.get('has_aggregation', False)
        sink_type = pipeline_config.get('sink_type', 'clickhouse')
        num_source_tasks = pipeline_config.get('num_source_tasks', max(1, num_tables))
        num_sink_tasks = pipeline_config.get('num_sink_tasks', 1)

        # Calculate events if not provided
        if events_per_day == 0 and row_count > 0:
            # Assume 10% of rows change daily for active tables
            events_per_day = int(row_count * 0.1)

        # Apply filter reduction
        effective_events = events_per_day
        if has_filter and filter_reduction > 0:
            effective_events = int(events_per_day * (1 - filter_reduction / 100))

        # Store assumptions
        estimate.assumptions = {
            "tables": num_tables,
            "estimated_events_per_day": events_per_day,
            "effective_events_per_day": effective_events,
            "avg_row_size_bytes": avg_row_size,
            "filter_applied": has_filter,
            "filter_reduction_percent": filter_reduction if has_filter else 0,
            "aggregation_applied": has_aggregation
        }

        # Calculate data volume
        data_gb_day = (effective_events * avg_row_size) / (1024 ** 3)

        # 1. Source Connector Cost
        source_connector = CostComponent(
            name="Source Connector",
            description=f"Debezium CDC connector ({num_source_tasks} task(s))",
            unit_cost=self.PRICING["connector_task_day"],
            unit="task/day",
            quantity=num_source_tasks,
            daily_cost=num_source_tasks * self.PRICING["connector_task_day"],
            monthly_cost=num_source_tasks * self.PRICING["connector_task_day"] * 30
        )
        estimate.add_component(source_connector)

        # 2. Sink Connector Cost
        sink_connector = CostComponent(
            name="Sink Connector",
            description=f"{sink_type.title()} sink connector ({num_sink_tasks} task(s))",
            unit_cost=self.PRICING["connector_task_day"],
            unit="task/day",
            quantity=num_sink_tasks,
            daily_cost=num_sink_tasks * self.PRICING["connector_task_day"],
            monthly_cost=num_sink_tasks * self.PRICING["connector_task_day"] * 30
        )
        estimate.add_component(sink_connector)

        # 3. Data Throughput Cost
        throughput = CostComponent(
            name="Data Throughput",
            description=f"~{effective_events:,} events/day × {avg_row_size} bytes",
            unit_cost=self.PRICING["throughput_gb"],
            unit="GB",
            quantity=data_gb_day,
            daily_cost=data_gb_day * self.PRICING["throughput_gb"],
            monthly_cost=data_gb_day * self.PRICING["throughput_gb"] * 30
        )
        estimate.add_component(throughput)

        # 4. Kafka Storage Cost
        kafka_storage_gb = data_gb_day * self.PRICING["kafka_retention_days"]
        kafka_storage = CostComponent(
            name="Kafka Storage",
            description=f"{self.PRICING['kafka_retention_days']}-day retention",
            unit_cost=self.PRICING["kafka_storage_gb_month"],
            unit="GB/month",
            quantity=kafka_storage_gb,
            daily_cost=kafka_storage_gb * self.PRICING["kafka_storage_gb_month"] / 30,
            monthly_cost=kafka_storage_gb * self.PRICING["kafka_storage_gb_month"]
        )
        estimate.add_component(kafka_storage)

        # 5. ksqlDB Processing Cost (if filter or aggregation)
        if has_filter or has_aggregation:
            csu_needed = self.PRICING["ksqldb_min_csu"]
            if has_aggregation:
                csu_needed += 0.5  # More CSU for aggregation

            ksqldb = CostComponent(
                name="ksqlDB Processing",
                description="Stream processing for " + (
                    "filtering and aggregation" if has_filter and has_aggregation
                    else "filtering" if has_filter
                    else "aggregation"
                ),
                unit_cost=self.PRICING["ksqldb_csu_hour"],
                unit="CSU/hour",
                quantity=csu_needed * 24,  # CSU-hours per day
                daily_cost=csu_needed * 24 * self.PRICING["ksqldb_csu_hour"],
                monthly_cost=csu_needed * 24 * self.PRICING["ksqldb_csu_hour"] * 30
            )
            estimate.add_component(ksqldb)

        # 6. Destination Storage Cost
        if sink_type == "clickhouse":
            dest_storage_gb = data_gb_day * 30  # Assume 30-day retention
            dest_storage = CostComponent(
                name="ClickHouse Storage",
                description="Analytics warehouse storage",
                unit_cost=self.PRICING["clickhouse_storage_gb_month"],
                unit="GB/month",
                quantity=dest_storage_gb,
                daily_cost=dest_storage_gb * self.PRICING["clickhouse_storage_gb_month"] / 30,
                monthly_cost=dest_storage_gb * self.PRICING["clickhouse_storage_gb_month"]
            )
            estimate.add_component(dest_storage)

        # Add notes
        estimate.notes = [
            "Costs are estimates based on Confluent Cloud pricing",
            "Actual costs may vary based on usage patterns and tier",
            f"Based on ~{effective_events:,} events/day"
        ]

        if has_filter:
            savings = events_per_day - effective_events
            estimate.notes.append(
                f"Filter reduces data by {filter_reduction:.0f}% ({savings:,} events/day saved)"
            )

        return estimate

    def compare_with_filter(
        self,
        pipeline_config: Dict
    ) -> Dict:
        """
        Compare costs with and without filtering.

        Useful to show users the cost benefit of applying filters.

        Args:
            pipeline_config: Pipeline configuration

        Returns:
            Dict with 'without_filter', 'with_filter', and 'savings'
        """
        # Calculate cost without filter
        config_no_filter = {**pipeline_config, 'has_filter': False, 'filter_reduction_percent': 0}
        estimate_no_filter = self.estimate_pipeline_cost(config_no_filter)

        # Calculate cost with filter
        config_with_filter = {**pipeline_config, 'has_filter': True}
        estimate_with_filter = self.estimate_pipeline_cost(config_with_filter)

        # Calculate savings
        daily_savings = estimate_no_filter.daily_total - estimate_with_filter.daily_total
        monthly_savings = estimate_no_filter.monthly_total - estimate_with_filter.monthly_total

        return {
            "without_filter": {
                "daily": round(estimate_no_filter.daily_total, 2),
                "monthly": round(estimate_no_filter.monthly_total, 2)
            },
            "with_filter": {
                "daily": round(estimate_with_filter.daily_total, 2),
                "monthly": round(estimate_with_filter.monthly_total, 2)
            },
            "savings": {
                "daily": round(daily_savings, 2),
                "monthly": round(monthly_savings, 2),
                "yearly": round(monthly_savings * 12, 2),
                "percent": round((daily_savings / estimate_no_filter.daily_total * 100) if estimate_no_filter.daily_total > 0 else 0, 1)
            },
            "recommendation": (
                f"Filtering saves ${monthly_savings:.2f}/month ({daily_savings/estimate_no_filter.daily_total*100:.0f}%)"
                if daily_savings > 0 else "No significant cost difference"
            )
        }

    def estimate_from_tables(
        self,
        tables: List[Dict],
        sink_type: str = "clickhouse",
        has_filter: bool = False,
        filter_reduction_percent: float = 0
    ) -> CostEstimate:
        """
        Estimate costs from discovered table information.

        Args:
            tables: List of table info dicts with 'name', 'estimated_row_count', etc.
            sink_type: Destination type
            has_filter: Whether filtering is applied
            filter_reduction_percent: Filter reduction

        Returns:
            CostEstimate
        """
        total_rows = sum(t.get('estimated_row_count', 0) or t.get('row_count', 0) for t in tables)
        avg_columns = sum(len(t.get('columns', [])) for t in tables) / max(len(tables), 1)

        # Estimate row size based on column count (rough estimate)
        avg_row_size = int(avg_columns * 50)  # ~50 bytes per column average

        config = {
            "name": f"{len(tables)} table(s)",
            "tables": [t.get('table_name', t.get('name', '')) for t in tables],
            "row_count": total_rows,
            "avg_row_size_bytes": avg_row_size,
            "has_filter": has_filter,
            "filter_reduction_percent": filter_reduction_percent,
            "sink_type": sink_type,
            "num_source_tasks": max(1, len(tables)),
            "num_sink_tasks": 1
        }

        return self.estimate_pipeline_cost(config)


# Singleton instance
cost_estimator = CostEstimator()
