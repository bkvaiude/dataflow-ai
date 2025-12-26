"""
ClickHouse Service
Manages ClickHouse connections, table operations, and data queries.
"""

import os
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from decimal import Decimal


# PostgreSQL to ClickHouse type mapping
PG_TO_CLICKHOUSE_TYPES = {
    'integer': 'Int32',
    'int': 'Int32',
    'int4': 'Int32',
    'bigint': 'Int64',
    'int8': 'Int64',
    'smallint': 'Int16',
    'int2': 'Int16',
    'serial': 'UInt32',
    'bigserial': 'UInt64',
    'boolean': 'UInt8',
    'bool': 'UInt8',
    'varchar': 'String',
    'character varying': 'String',
    'text': 'String',
    'char': 'String',
    'character': 'String',
    'decimal': 'Decimal(18, 4)',
    'numeric': 'Decimal(18, 4)',
    'real': 'Float32',
    'float4': 'Float32',
    'double precision': 'Float64',
    'float8': 'Float64',
    'date': 'Date',
    'timestamp': 'DateTime64(3)',
    'timestamp without time zone': 'DateTime64(3)',
    'timestamp with time zone': 'DateTime64(3)',
    'timestamptz': 'DateTime64(3)',
    'time': 'String',
    'time without time zone': 'String',
    'time with time zone': 'String',
    'json': 'String',
    'jsonb': 'String',
    'uuid': 'UUID',
    'bytea': 'String',
    'inet': 'String',
    'cidr': 'String',
    'macaddr': 'String',
    'array': 'Array(String)',
}


class ClickHouseService:
    """
    Service for managing ClickHouse connections and operations.
    Uses clickhouse-connect library for efficient data access.
    """

    def __init__(self):
        self.host = os.getenv("CLICKHOUSE_HOST", "localhost")
        self.port = int(os.getenv("CLICKHOUSE_PORT", "8123"))
        self.user = os.getenv("CLICKHOUSE_USER", "default")
        self.password = os.getenv("CLICKHOUSE_PASSWORD", "")
        self.database = os.getenv("CLICKHOUSE_DATABASE", "dataflow")

        self._client = None

    def _get_client(self):
        """Get or create ClickHouse client"""
        if self._client is None:
            try:
                import clickhouse_connect

                self._client = clickhouse_connect.get_client(
                    host=self.host,
                    port=self.port,
                    username=self.user,
                    password=self.password,
                    database=self.database
                )
            except Exception as e:
                print(f"[CLICKHOUSE] Failed to create client: {e}")
                return None

        return self._client

    def is_configured(self) -> bool:
        """Check if ClickHouse is properly configured"""
        return bool(self.host)

    def test_connection(
        self,
        host: str = None,
        port: int = None,
        user: str = None,
        password: str = None,
        database: str = None
    ) -> Dict[str, Any]:
        """
        Test ClickHouse connection.

        Args:
            host: ClickHouse host (optional, uses env if not provided)
            port: ClickHouse port
            user: Username
            password: Password
            database: Database name

        Returns:
            Connection test result
        """
        try:
            import clickhouse_connect

            client = clickhouse_connect.get_client(
                host=host or self.host,
                port=port or self.port,
                username=user or self.user,
                password=password or self.password,
                database=database or self.database
            )

            # Test query
            result = client.query("SELECT version()")
            version = result.result_rows[0][0] if result.result_rows else "unknown"

            return {
                'success': True,
                'message': 'Connection successful',
                'version': version,
                'host': host or self.host,
                'database': database or self.database
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def create_database(self, database: str = None) -> bool:
        """Create database if it doesn't exist"""
        db_name = database or self.database

        try:
            import clickhouse_connect

            # Connect without database first
            client = clickhouse_connect.get_client(
                host=self.host,
                port=self.port,
                username=self.user,
                password=self.password
            )

            client.command(f"CREATE DATABASE IF NOT EXISTS {db_name}")
            print(f"[CLICKHOUSE] Created database: {db_name}")
            return True

        except Exception as e:
            raise Exception(f"Failed to create database: {str(e)}")

    def create_table(
        self,
        table_name: str,
        columns: List[Dict[str, Any]],
        engine: str = "ReplacingMergeTree",
        order_by: List[str] = None,
        partition_by: str = None
    ) -> Dict[str, Any]:
        """
        Create a ClickHouse table.

        Args:
            table_name: Name of the table
            columns: List of column definitions [{'name': str, 'type': str, 'nullable': bool}]
            engine: Table engine (default: ReplacingMergeTree for upserts)
            order_by: ORDER BY columns (required for MergeTree engines)
            partition_by: Optional partition expression

        Returns:
            Table creation result
        """
        client = self._get_client()
        if not client:
            print(f"[CLICKHOUSE] Mock mode - would create table: {table_name}")
            return {'table_name': table_name, 'created': True, 'mock': True}

        try:
            # Build column definitions
            col_defs = []
            for col in columns:
                ch_type = self._map_type(col.get('type', 'String'))
                if col.get('nullable', True):
                    ch_type = f"Nullable({ch_type})"
                col_defs.append(f"`{col['name']}` {ch_type}")

            # Add metadata columns for CDC
            col_defs.append("`_deleted` UInt8 DEFAULT 0")
            col_defs.append("`_version` UInt64 DEFAULT 0")
            col_defs.append("`_inserted_at` DateTime64(3) DEFAULT now64(3)")

            columns_sql = ",\n    ".join(col_defs)

            # Determine ORDER BY
            if not order_by:
                # Try to find primary key column
                pk_cols = [c['name'] for c in columns if c.get('is_primary_key')]
                order_by = pk_cols if pk_cols else [columns[0]['name']]

            order_by_sql = ", ".join(f"`{c}`" for c in order_by)

            # Build CREATE TABLE statement
            sql = f"""
            CREATE TABLE IF NOT EXISTS {self.database}.{table_name} (
                {columns_sql}
            )
            ENGINE = {engine}(_version)
            """

            if partition_by:
                sql += f"\nPARTITION BY {partition_by}"

            sql += f"\nORDER BY ({order_by_sql})"

            client.command(sql)
            print(f"[CLICKHOUSE] Created table: {table_name}")

            return {
                'table_name': table_name,
                'database': self.database,
                'engine': engine,
                'order_by': order_by,
                'columns': len(columns),
                'created': True
            }

        except Exception as e:
            if "already exists" in str(e).lower():
                return {
                    'table_name': table_name,
                    'already_exists': True,
                    'created': False
                }
            raise Exception(f"Failed to create table: {str(e)}")

    def _map_type(self, pg_type: str) -> str:
        """Map PostgreSQL type to ClickHouse type"""
        pg_type_lower = pg_type.lower().strip()

        # Handle parameterized types
        if pg_type_lower.startswith('varchar') or pg_type_lower.startswith('character varying'):
            return 'String'
        if pg_type_lower.startswith('numeric') or pg_type_lower.startswith('decimal'):
            return 'Decimal(18, 4)'
        if pg_type_lower.startswith('timestamp'):
            return 'DateTime64(3)'

        return PG_TO_CLICKHOUSE_TYPES.get(pg_type_lower, 'String')

    def verify_table_schema(
        self,
        table_name: str,
        expected_columns: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Verify a table exists and has expected schema.

        Args:
            table_name: Table name to check
            expected_columns: Expected column definitions

        Returns:
            Verification result with compatibility info
        """
        client = self._get_client()
        if not client:
            return {
                'exists': True,
                'compatible': True,
                'mock': True
            }

        try:
            # Check if table exists
            result = client.query(f"""
                SELECT name, type
                FROM system.columns
                WHERE database = '{self.database}' AND table = '{table_name}'
            """)

            if not result.result_rows:
                # Table doesn't exist - generate CREATE TABLE SQL
                return {
                    'exists': False,
                    'compatible': False,
                    'create_table_sql': self._generate_create_sql(table_name, expected_columns)
                }

            # Build actual schema map
            actual_columns = {row[0]: row[1] for row in result.result_rows}

            # Check for missing columns
            missing = []
            type_mismatches = []

            for col in expected_columns:
                col_name = col['name']
                expected_type = self._map_type(col.get('type', 'String'))

                if col_name not in actual_columns:
                    missing.append(col_name)
                else:
                    actual_type = actual_columns[col_name]
                    # Simplified type comparison (ignoring Nullable wrapper)
                    if expected_type.replace('Nullable(', '').replace(')', '') not in actual_type:
                        type_mismatches.append({
                            'column': col_name,
                            'expected': expected_type,
                            'actual': actual_type
                        })

            return {
                'exists': True,
                'compatible': len(missing) == 0 and len(type_mismatches) == 0,
                'missing_columns': missing,
                'type_mismatches': type_mismatches,
                'actual_columns': list(actual_columns.keys())
            }

        except Exception as e:
            raise Exception(f"Failed to verify table schema: {str(e)}")

    def _generate_create_sql(self, table_name: str, columns: List[Dict[str, Any]]) -> str:
        """Generate CREATE TABLE SQL for missing table"""
        col_defs = []
        for col in columns:
            ch_type = self._map_type(col.get('type', 'String'))
            if col.get('nullable', True):
                ch_type = f"Nullable({ch_type})"
            col_defs.append(f"    `{col['name']}` {ch_type}")

        col_defs.append("    `_deleted` UInt8 DEFAULT 0")
        col_defs.append("    `_version` UInt64 DEFAULT 0")
        col_defs.append("    `_inserted_at` DateTime64(3) DEFAULT now64(3)")

        columns_sql = ",\n".join(col_defs)

        # Find primary key for ORDER BY
        pk_cols = [c['name'] for c in columns if c.get('is_primary_key')]
        order_by = pk_cols if pk_cols else [columns[0]['name']]
        order_by_sql = ", ".join(f"`{c}`" for c in order_by)

        return f"""CREATE TABLE {self.database}.{table_name} (
{columns_sql}
)
ENGINE = ReplacingMergeTree(_version)
ORDER BY ({order_by_sql})"""

    def get_table_info(self, table_name: str) -> Dict[str, Any]:
        """Get table metadata"""
        client = self._get_client()
        if not client:
            return {'table_name': table_name, 'mock': True}

        try:
            # Get columns
            cols_result = client.query(f"""
                SELECT name, type, default_expression
                FROM system.columns
                WHERE database = '{self.database}' AND table = '{table_name}'
            """)

            # Get row count
            count_result = client.query(f"SELECT count() FROM {self.database}.{table_name}")
            row_count = count_result.result_rows[0][0] if count_result.result_rows else 0

            # Get table size
            size_result = client.query(f"""
                SELECT sum(bytes_on_disk)
                FROM system.parts
                WHERE database = '{self.database}' AND table = '{table_name}'
            """)
            size_bytes = size_result.result_rows[0][0] if size_result.result_rows else 0

            columns = [
                {'name': row[0], 'type': row[1], 'default': row[2]}
                for row in cols_result.result_rows
            ]

            return {
                'table_name': table_name,
                'database': self.database,
                'columns': columns,
                'row_count': row_count,
                'size_bytes': size_bytes,
                'exists': True
            }

        except Exception as e:
            if "doesn't exist" in str(e).lower():
                return {'table_name': table_name, 'exists': False}
            raise Exception(f"Failed to get table info: {str(e)}")

    def execute_query(self, query: str) -> Dict[str, Any]:
        """
        Execute a query and return results.

        Args:
            query: SQL query to execute

        Returns:
            Query results with columns and rows
        """
        client = self._get_client()
        if not client:
            return {'error': 'ClickHouse not configured', 'mock': True}

        try:
            result = client.query(query)

            return {
                'columns': result.column_names,
                'rows': result.result_rows,
                'row_count': len(result.result_rows)
            }

        except Exception as e:
            raise Exception(f"Query failed: {str(e)}")

    def insert_batch(
        self,
        table_name: str,
        columns: List[str],
        rows: List[Tuple]
    ) -> Dict[str, Any]:
        """
        Insert batch of rows.

        Args:
            table_name: Target table
            columns: Column names
            rows: List of row tuples

        Returns:
            Insert result
        """
        client = self._get_client()
        if not client:
            print(f"[CLICKHOUSE] Mock mode - would insert {len(rows)} rows to {table_name}")
            return {'inserted': len(rows), 'mock': True}

        try:
            client.insert(
                table=f"{self.database}.{table_name}",
                column_names=columns,
                data=rows
            )

            print(f"[CLICKHOUSE] Inserted {len(rows)} rows to {table_name}")
            return {
                'table_name': table_name,
                'inserted': len(rows),
                'columns': columns
            }

        except Exception as e:
            raise Exception(f"Insert failed: {str(e)}")

    def list_tables(self) -> List[str]:
        """List all tables in the database"""
        client = self._get_client()
        if not client:
            return []

        try:
            result = client.query(f"""
                SELECT name FROM system.tables
                WHERE database = '{self.database}'
            """)

            return [row[0] for row in result.result_rows]

        except Exception as e:
            print(f"[CLICKHOUSE] Failed to list tables: {str(e)}")
            return []

    def drop_table(self, table_name: str) -> bool:
        """Drop a table"""
        client = self._get_client()
        if not client:
            print(f"[CLICKHOUSE] Mock mode - would drop table: {table_name}")
            return True

        try:
            client.command(f"DROP TABLE IF EXISTS {self.database}.{table_name}")
            print(f"[CLICKHOUSE] Dropped table: {table_name}")
            return True

        except Exception as e:
            raise Exception(f"Failed to drop table: {str(e)}")


# Singleton instance
clickhouse_service = ClickHouseService()
