"""
JoinPlanner Service - Plans and generates ksqlDB statements for stream-table JOINs.

This service provides:
- ksqlDB DDL generation (CREATE STREAM, CREATE TABLE)
- JOIN statement generation and optimization
- Join key validation and compatibility checks
- Output cardinality estimation
- JOIN type recommendations
"""

from typing import Dict, List, Optional, Any
import logging
import re

logger = logging.getLogger(__name__)


class JoinPlanner:
    """Service for planning and validating stream-table JOINs."""

    def __init__(self, ksqldb_service=None):
        """
        Initialize JoinPlanner.

        Args:
            ksqldb_service: Optional KsqlDBService instance for validation queries
        """
        self.ksqldb = ksqldb_service

    async def plan_join(
        self,
        source_stream: str,
        source_topic: str,
        source_schema: List[Dict],
        lookup_tables: List[Dict],
        join_keys: List[Dict],
        output_columns: List[str],
        join_type: str = "LEFT",
        stream_key_column: Optional[str] = None
    ) -> Dict:
        """
        Plan a stream-table JOIN and generate ksqlDB statements.

        Args:
            source_stream: Name for the source stream (e.g., "login_events")
            source_topic: Kafka topic for the stream
            source_schema: Schema definition for stream [{"name": "user_id", "type": "BIGINT"}, ...]
            lookup_tables: List of lookup table configs
                [{
                    "name": "users",
                    "topic": "postgres.public.users",
                    "key": "id",
                    "alias": "u",
                    "schema": [{"name": "id", "type": "BIGINT"}, {"name": "email", "type": "VARCHAR"}]
                }]
            join_keys: Join key mappings
                [{
                    "stream_column": "user_id",
                    "table_column": "id",
                    "table_alias": "u"
                }]
            output_columns: Output column selection
                ["s.event_time", "s.ip_address", "u.email", "u.name"]
            join_type: "LEFT" or "INNER"
            stream_key_column: Optional key column for stream partitioning

        Returns:
            {
                "stream_statement": "CREATE STREAM...",
                "table_statements": ["CREATE TABLE..."],
                "join_statement": "CREATE STREAM enriched AS SELECT...",
                "output_topic": "enriched_login_events",
                "output_schema": [...],
                "validation": {
                    "valid": True,
                    "warnings": [],
                    "errors": []
                }
            }
        """
        validation = {
            "valid": True,
            "warnings": [],
            "errors": []
        }

        # Validate join type
        if join_type not in ["LEFT", "INNER"]:
            validation["errors"].append(f"Invalid join type: {join_type}. Must be LEFT or INNER.")
            validation["valid"] = False

        # Validate source schema
        if not source_schema:
            validation["errors"].append("Source schema is required")
            validation["valid"] = False

        # Validate lookup tables
        if not lookup_tables:
            validation["errors"].append("At least one lookup table is required")
            validation["valid"] = False

        # Validate join keys
        if not join_keys:
            validation["errors"].append("Join keys are required")
            validation["valid"] = False

        # Validate stream columns exist
        stream_col_names = {col["name"] for col in source_schema}
        for jk in join_keys:
            if jk["stream_column"] not in stream_col_names:
                validation["errors"].append(
                    f"Join key '{jk['stream_column']}' not found in stream schema"
                )
                validation["valid"] = False

        # Validate table schemas and join keys
        table_map = {tbl["alias"]: tbl for tbl in lookup_tables}
        for jk in join_keys:
            table_alias = jk.get("table_alias")
            if table_alias not in table_map:
                validation["errors"].append(
                    f"Table alias '{table_alias}' not found in lookup tables"
                )
                validation["valid"] = False
                continue

            table = table_map[table_alias]
            table_col_names = {col["name"] for col in table.get("schema", [])}

            if jk["table_column"] not in table_col_names:
                validation["errors"].append(
                    f"Join key '{jk['table_column']}' not found in table '{table['name']}' schema"
                )
                validation["valid"] = False

        # Validate output columns reference valid tables/stream
        output_validation = self._validate_output_columns_syntax(
            output_columns,
            source_stream,
            lookup_tables
        )
        validation["warnings"].extend(output_validation.get("warnings", []))
        validation["errors"].extend(output_validation.get("errors", []))
        if output_validation.get("errors"):
            validation["valid"] = False

        # Check for potential cardinality issues
        if len(lookup_tables) > 3:
            validation["warnings"].append(
                f"Joining {len(lookup_tables)} tables may cause performance issues"
            )

        # Recommend JOIN type based on nullability
        if self.ksqldb:
            for jk in join_keys:
                recommendation = await self._recommend_join_type(
                    source_schema,
                    table_map[jk["table_alias"]]["schema"],
                    jk["stream_column"],
                    jk["table_column"]
                )
                if recommendation and recommendation != join_type:
                    validation["warnings"].append(
                        f"Consider using {recommendation} JOIN instead of {join_type} "
                        f"based on nullability of join keys"
                    )

        # Generate statements if validation passed
        stream_statement = ""
        table_statements = []
        join_statement = ""
        output_topic = f"enriched_{source_stream}"
        output_schema = []

        if validation["valid"]:
            # Generate CREATE STREAM
            stream_statement = self.generate_stream_ddl(
                name=source_stream,
                topic=source_topic,
                schema=source_schema,
                key_column=stream_key_column
            )

            # Generate CREATE TABLE statements
            for table in lookup_tables:
                table_ddl = self.generate_table_ddl(
                    name=table["name"],
                    topic=table["topic"],
                    schema=table["schema"],
                    key_column=table["key"]
                )
                table_statements.append(table_ddl)

            # Generate JOIN statement
            join_statement = self.generate_join_statement(
                output_name=f"enriched_{source_stream}",
                source_stream=source_stream,
                lookup_tables=lookup_tables,
                join_keys=join_keys,
                output_columns=output_columns,
                join_type=join_type,
                output_topic=output_topic
            )

            # Infer output schema
            output_schema = self._infer_output_schema(
                output_columns,
                source_schema,
                lookup_tables
            )

        return {
            "stream_statement": stream_statement,
            "table_statements": table_statements,
            "join_statement": join_statement,
            "output_topic": output_topic,
            "output_schema": output_schema,
            "validation": validation
        }

    def generate_stream_ddl(
        self,
        name: str,
        topic: str,
        schema: List[Dict],
        key_column: Optional[str] = None
    ) -> str:
        """
        Generate CREATE STREAM statement.

        Args:
            name: Stream name
            topic: Kafka topic
            schema: List of column definitions [{"name": "col", "type": "VARCHAR"}]
            key_column: Optional key column for partitioning

        Returns:
            ksqlDB CREATE STREAM statement
        """
        # Build column definitions
        columns = []
        for col in schema:
            col_name = col["name"]
            col_type = col["type"].upper()
            columns.append(f"    {col_name} {col_type}")

        columns_str = ",\n".join(columns)

        # Build WITH clause
        with_clauses = [
            f"KAFKA_TOPIC='{topic}'",
            "VALUE_FORMAT='JSON'"
        ]

        if key_column:
            with_clauses.append(f"KEY_FORMAT='JSON'")
            with_clauses.append(f"PARTITIONS=3")

        with_str = ",\n    ".join(with_clauses)

        ddl = f"""CREATE STREAM {name} (
{columns_str}
) WITH (
    {with_str}
);"""

        return ddl

    def generate_table_ddl(
        self,
        name: str,
        topic: str,
        schema: List[Dict],
        key_column: str
    ) -> str:
        """
        Generate CREATE TABLE statement.

        Args:
            name: Table name
            topic: Kafka topic (typically CDC topic)
            schema: List of column definitions
            key_column: Primary key column

        Returns:
            ksqlDB CREATE TABLE statement
        """
        # Build column definitions
        columns = []
        for col in schema:
            col_name = col["name"]
            col_type = col["type"].upper()

            # Mark primary key
            if col_name == key_column:
                columns.append(f"    {col_name} {col_type} PRIMARY KEY")
            else:
                columns.append(f"    {col_name} {col_type}")

        columns_str = ",\n".join(columns)

        # Build WITH clause
        with_str = f"""KAFKA_TOPIC='{topic}',
    VALUE_FORMAT='JSON',
    KEY_FORMAT='JSON'"""

        ddl = f"""CREATE TABLE {name} (
{columns_str}
) WITH (
    {with_str}
);"""

        return ddl

    def generate_join_statement(
        self,
        output_name: str,
        source_stream: str,
        lookup_tables: List[Dict],
        join_keys: List[Dict],
        output_columns: List[str],
        join_type: str,
        output_topic: Optional[str] = None
    ) -> str:
        """
        Generate CREATE STREAM AS SELECT for JOIN.

        Args:
            output_name: Name for output stream
            source_stream: Source stream name
            lookup_tables: Lookup table configs with aliases
            join_keys: Join key mappings
            output_columns: Column selection
            join_type: "LEFT" or "INNER"
            output_topic: Optional output topic name

        Returns:
            ksqlDB JOIN statement
        """
        # Build SELECT clause
        select_columns = ", ".join(output_columns)

        # Build FROM clause with stream alias
        from_clause = f"FROM {source_stream} s"

        # Build JOIN clauses
        join_clauses = []
        table_map = {tbl["alias"]: tbl for tbl in lookup_tables}

        for jk in join_keys:
            table_alias = jk["table_alias"]
            table = table_map[table_alias]

            join_clause = f"""    {join_type} JOIN {table['name']} {table_alias}
        ON s.{jk['stream_column']} = {table_alias}.{jk['table_column']}"""

            join_clauses.append(join_clause)

        joins_str = "\n".join(join_clauses)

        # Build WITH clause
        with_parts = []
        if output_topic:
            with_parts.append(f"KAFKA_TOPIC='{output_topic}'")
        with_parts.append("VALUE_FORMAT='JSON'")
        with_parts.append("PARTITIONS=3")

        with_str = ", ".join(with_parts)

        # Assemble statement
        statement = f"""CREATE STREAM {output_name}
WITH ({with_str}) AS
SELECT
    {select_columns}
{from_clause}
{joins_str}
EMIT CHANGES;"""

        return statement

    async def validate_join_keys(
        self,
        stream_name: str,
        table_name: str,
        stream_key: str,
        table_key: str
    ) -> Dict:
        """
        Validate that join keys exist and have compatible types.

        Args:
            stream_name: Source stream name
            table_name: Lookup table name
            stream_key: Column name in stream
            table_key: Column name in table

        Returns:
            {"valid": bool, "errors": [], "warnings": []}
        """
        result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }

        if not self.ksqldb:
            result["warnings"].append("ksqlDB service not available for validation")
            return result

        try:
            # Describe stream and table to get schemas
            stream_desc = await self.ksqldb.describe_stream(stream_name)
            table_desc = await self.ksqldb.describe_table(table_name)

            # Find stream key type
            stream_key_type = None
            for field in stream_desc.get("fields", []):
                if field["name"] == stream_key:
                    stream_key_type = field["type"]
                    break

            if not stream_key_type:
                result["errors"].append(f"Column '{stream_key}' not found in stream '{stream_name}'")
                result["valid"] = False
                return result

            # Find table key type
            table_key_type = None
            for field in table_desc.get("fields", []):
                if field["name"] == table_key:
                    table_key_type = field["type"]
                    break

            if not table_key_type:
                result["errors"].append(f"Column '{table_key}' not found in table '{table_name}'")
                result["valid"] = False
                return result

            # Check type compatibility
            if not self._types_compatible(stream_key_type, table_key_type):
                result["errors"].append(
                    f"Incompatible types: stream.{stream_key} ({stream_key_type}) "
                    f"vs table.{table_key} ({table_key_type})"
                )
                result["valid"] = False

        except Exception as e:
            logger.error(f"Error validating join keys: {e}")
            result["errors"].append(f"Validation error: {str(e)}")
            result["valid"] = False

        return result

    async def validate_output_columns(
        self,
        columns: List[str],
        stream_name: str,
        tables: List[Dict]
    ) -> Dict:
        """
        Validate that requested output columns exist.

        Args:
            columns: Output column list ["s.col1", "t.col2"]
            stream_name: Stream name
            tables: List of table configs with aliases

        Returns:
            {"valid": bool, "errors": [], "warnings": []}
        """
        result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }

        if not self.ksqldb:
            result["warnings"].append("ksqlDB service not available for validation")
            return result

        try:
            # Get stream schema
            stream_desc = await self.ksqldb.describe_stream(stream_name)
            stream_fields = {f["name"]: f["type"] for f in stream_desc.get("fields", [])}

            # Get table schemas
            table_schemas = {}
            for table in tables:
                table_desc = await self.ksqldb.describe_table(table["name"])
                table_schemas[table["alias"]] = {
                    f["name"]: f["type"] for f in table_desc.get("fields", [])
                }

            # Validate each output column
            for col in columns:
                if "." in col:
                    alias, field = col.split(".", 1)

                    if alias == "s":
                        if field not in stream_fields:
                            result["errors"].append(f"Column '{field}' not found in stream")
                            result["valid"] = False
                    elif alias in table_schemas:
                        if field not in table_schemas[alias]:
                            result["errors"].append(
                                f"Column '{field}' not found in table alias '{alias}'"
                            )
                            result["valid"] = False
                    else:
                        result["errors"].append(f"Unknown alias '{alias}' in column '{col}'")
                        result["valid"] = False
                else:
                    result["warnings"].append(
                        f"Column '{col}' should use alias (e.g., 's.{col}')"
                    )

        except Exception as e:
            logger.error(f"Error validating output columns: {e}")
            result["errors"].append(f"Validation error: {str(e)}")
            result["valid"] = False

        return result

    def detect_join_type(
        self,
        stream_schema: List[Dict],
        table_schema: List[Dict],
        stream_join_key: str,
        table_join_key: str
    ) -> str:
        """
        Recommend LEFT vs INNER JOIN based on nullability.

        Args:
            stream_schema: Stream schema
            table_schema: Table schema
            stream_join_key: Join key in stream
            table_join_key: Join key in table

        Returns:
            "LEFT" or "INNER"
        """
        # Find stream join key nullability
        stream_key_nullable = True
        for col in stream_schema:
            if col["name"] == stream_join_key:
                stream_key_nullable = col.get("nullable", True)
                break

        # Find table join key nullability
        table_key_nullable = True
        for col in table_schema:
            if col["name"] == table_join_key:
                table_key_nullable = col.get("nullable", True)
                break

        # If stream key can be NULL, use LEFT JOIN to preserve stream rows
        if stream_key_nullable:
            return "LEFT"

        # If table key can be NULL, use LEFT JOIN to handle missing lookups
        if table_key_nullable:
            return "LEFT"

        # Both NOT NULL - INNER is safe
        return "INNER"

    async def estimate_output_cardinality(
        self,
        stream_topic: str,
        table_topic: str
    ) -> Dict:
        """
        Estimate if JOIN will cause row explosion.

        Args:
            stream_topic: Stream Kafka topic
            table_topic: Table Kafka topic

        Returns:
            {
                "estimated_multiplier": 1.2,
                "risk": "low|medium|high",
                "warnings": []
            }
        """
        result = {
            "estimated_multiplier": 1.0,
            "risk": "low",
            "warnings": []
        }

        # Without actual stats, provide heuristic warnings
        result["warnings"].append(
            "Enable JOIN monitoring to detect cardinality explosion in production"
        )

        # If we had access to topic stats, we could:
        # 1. Sample stream and table data
        # 2. Count distinct join keys
        # 3. Estimate average matches per stream record

        return result

    # Helper methods

    def _validate_output_columns_syntax(
        self,
        columns: List[str],
        stream_name: str,
        tables: List[Dict]
    ) -> Dict:
        """Validate output column syntax without ksqlDB."""
        result = {"errors": [], "warnings": []}

        valid_aliases = {"s"} | {t["alias"] for t in tables}

        for col in columns:
            if "." not in col:
                result["warnings"].append(
                    f"Column '{col}' should use alias (e.g., 's.{col}')"
                )
            else:
                alias = col.split(".")[0]
                if alias not in valid_aliases:
                    result["errors"].append(
                        f"Unknown alias '{alias}' in column '{col}'. "
                        f"Valid aliases: {', '.join(valid_aliases)}"
                    )

        return result

    async def _recommend_join_type(
        self,
        stream_schema: List[Dict],
        table_schema: List[Dict],
        stream_key: str,
        table_key: str
    ) -> Optional[str]:
        """Recommend JOIN type based on schema analysis."""
        # Simple heuristic: if either key is nullable, recommend LEFT
        for col in stream_schema:
            if col["name"] == stream_key and col.get("nullable", True):
                return "LEFT"

        for col in table_schema:
            if col["name"] == table_key and col.get("nullable", True):
                return "LEFT"

        return "INNER"

    def _types_compatible(self, type1: str, type2: str) -> bool:
        """Check if two ksqlDB types are compatible for JOIN."""
        # Normalize types
        t1 = type1.upper().strip()
        t2 = type2.upper().strip()

        # Exact match
        if t1 == t2:
            return True

        # Integer family compatibility
        int_types = {"BIGINT", "INTEGER", "INT", "SMALLINT", "TINYINT"}
        if t1 in int_types and t2 in int_types:
            return True

        # String family compatibility
        string_types = {"VARCHAR", "STRING"}
        if t1 in string_types and t2 in string_types:
            return True

        return False

    def _infer_output_schema(
        self,
        output_columns: List[str],
        source_schema: List[Dict],
        lookup_tables: List[Dict]
    ) -> List[Dict]:
        """Infer output schema from selected columns."""
        schema = []

        # Build schema maps
        stream_schema_map = {col["name"]: col for col in source_schema}
        table_schema_maps = {}
        for table in lookup_tables:
            table_schema_maps[table["alias"]] = {
                col["name"]: col for col in table.get("schema", [])
            }

        # Infer each output column
        for col_expr in output_columns:
            if "." in col_expr:
                alias, field = col_expr.split(".", 1)

                # Handle AS aliasing
                output_name = field
                if " AS " in field.upper():
                    field_parts = re.split(r"\s+AS\s+", field, flags=re.IGNORECASE)
                    field = field_parts[0].strip()
                    output_name = field_parts[1].strip()

                col_type = "VARCHAR"  # Default

                if alias == "s" and field in stream_schema_map:
                    col_type = stream_schema_map[field]["type"]
                elif alias in table_schema_maps and field in table_schema_maps[alias]:
                    col_type = table_schema_maps[alias][field]["type"]

                schema.append({
                    "name": output_name,
                    "type": col_type
                })
            else:
                # No alias - assume VARCHAR
                schema.append({
                    "name": col_expr,
                    "type": "VARCHAR"
                })

        return schema
