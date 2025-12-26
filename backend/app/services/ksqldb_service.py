"""
ksqlDB Service
Manages ksqlDB streams, tables, and queries for real-time stream processing.
"""

import os
import httpx
from typing import Dict, List, Optional, Any
import logging
import json

logger = logging.getLogger(__name__)


class KsqlDBService:
    """
    Service for interacting with ksqlDB server.
    Provides DDL operations (CREATE STREAM/TABLE), DML operations (INSERT, SELECT),
    and monitoring capabilities for ksqlDB resources.
    """

    def __init__(self):
        self.ksqldb_url = os.getenv("KSQLDB_URL", "http://localhost:8088")
        self.timeout = 30.0
        self._client = None

    def _get_headers(self) -> Dict[str, str]:
        """Get HTTP headers for ksqlDB requests"""
        return {
            "Accept": "application/vnd.ksql.v1+json",
            "Content-Type": "application/vnd.ksql.v1+json"
        }

    def is_configured(self) -> bool:
        """Check if ksqlDB is properly configured"""
        return bool(self.ksqldb_url)

    async def _execute_ksql(
        self,
        ksql: str,
        stream_properties: Optional[Dict] = None
    ) -> Dict:
        """
        Execute a ksqlDB statement.

        Args:
            ksql: ksqlDB statement to execute
            stream_properties: Optional stream properties

        Returns:
            Execution result
        """
        payload = {
            "ksql": ksql,
            "streamsProperties": stream_properties or {}
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.ksqldb_url}/ksql",
                    headers=self._get_headers(),
                    json=payload
                )
                response.raise_for_status()
                result = response.json()

                logger.info(f"[KSQLDB] Executed: {ksql[:100]}...")
                return result

        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if e.response else str(e)
            logger.error(f"[KSQLDB] HTTP error: {error_detail}")
            raise Exception(f"ksqlDB execution failed: {error_detail}")
        except Exception as e:
            logger.error(f"[KSQLDB] Error: {str(e)}")
            raise Exception(f"ksqlDB execution failed: {str(e)}")

    async def health_check(self) -> Dict:
        """
        Check ksqlDB server health.

        Returns:
            Health status including server info
        """
        if not self.is_configured():
            return {
                'healthy': False,
                'error': 'ksqlDB not configured',
                'mock': True
            }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.ksqldb_url}/info",
                    headers=self._get_headers()
                )
                response.raise_for_status()
                info = response.json()

                logger.info(f"[KSQLDB] Health check passed")
                return {
                    'healthy': True,
                    'version': info.get('KsqlServerInfo', {}).get('version'),
                    'cluster_id': info.get('KsqlServerInfo', {}).get('kafkaClusterId'),
                    'service_id': info.get('KsqlServerInfo', {}).get('ksqlServiceId')
                }

        except Exception as e:
            logger.error(f"[KSQLDB] Health check failed: {str(e)}")
            return {
                'healthy': False,
                'error': str(e)
            }

    # DDL Operations

    async def create_stream(
        self,
        name: str,
        topic: str,
        schema: List[Dict],
        value_format: str = "AVRO",
        key_column: Optional[str] = None,
        partitions: int = 3,
        replicas: int = 3
    ) -> Dict:
        """
        Create a ksqlDB STREAM from a Kafka topic.

        Args:
            name: Stream name (will be uppercase in ksqlDB)
            topic: Source Kafka topic
            schema: Column schema [{"name": "col", "type": "STRING"}]
            value_format: Data format (AVRO, JSON, PROTOBUF, DELIMITED)
            key_column: Optional key column name
            partitions: Number of partitions for underlying topic
            replicas: Replication factor for underlying topic

        Returns:
            Stream creation result
        """
        if not self.is_configured():
            logger.info(f"[KSQLDB] Mock mode - would create stream: {name}")
            return {
                'stream_name': name.upper(),
                'topic': topic,
                'created': True,
                'mock': True
            }

        # Build column definitions
        columns = []
        for col in schema:
            col_name = col['name'].upper()
            col_type = col['type'].upper()
            columns.append(f"{col_name} {col_type}")

        columns_sql = ", ".join(columns)

        # Build CREATE STREAM statement
        ksql = f"CREATE STREAM {name.upper()} ({columns_sql}) "
        ksql += f"WITH (KAFKA_TOPIC='{topic}', VALUE_FORMAT='{value_format}'"

        if key_column:
            ksql += f", KEY_FORMAT='AVRO', KEY='{key_column.upper()}'"

        ksql += f", PARTITIONS={partitions}, REPLICAS={replicas});"

        try:
            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Created stream: {name.upper()}")
            return {
                'stream_name': name.upper(),
                'topic': topic,
                'columns': len(schema),
                'created': True,
                'result': result
            }

        except Exception as e:
            if "already exists" in str(e).lower():
                logger.warning(f"[KSQLDB] Stream already exists: {name}")
                return {
                    'stream_name': name.upper(),
                    'already_exists': True,
                    'created': False
                }
            raise

    async def create_table(
        self,
        name: str,
        topic: str,
        schema: List[Dict],
        key_column: str,
        value_format: str = "AVRO",
        partitions: int = 3,
        replicas: int = 3
    ) -> Dict:
        """
        Create a ksqlDB TABLE from a Kafka topic.

        Args:
            name: Table name (will be uppercase in ksqlDB)
            topic: Source Kafka topic (must be compacted)
            schema: Column schema [{"name": "col", "type": "STRING"}]
            key_column: Primary key column name (required for tables)
            value_format: Data format (AVRO, JSON, PROTOBUF)
            partitions: Number of partitions for underlying topic
            replicas: Replication factor for underlying topic

        Returns:
            Table creation result
        """
        if not self.is_configured():
            logger.info(f"[KSQLDB] Mock mode - would create table: {name}")
            return {
                'table_name': name.upper(),
                'topic': topic,
                'created': True,
                'mock': True
            }

        # Build column definitions
        columns = []
        for col in schema:
            col_name = col['name'].upper()
            col_type = col['type'].upper()
            columns.append(f"{col_name} {col_type}")

        columns_sql = ", ".join(columns)

        # Build CREATE TABLE statement
        ksql = f"CREATE TABLE {name.upper()} ({columns_sql}) "
        ksql += f"WITH (KAFKA_TOPIC='{topic}', VALUE_FORMAT='{value_format}'"
        ksql += f", KEY_FORMAT='AVRO', KEY='{key_column.upper()}'"
        ksql += f", PARTITIONS={partitions}, REPLICAS={replicas});"

        try:
            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Created table: {name.upper()}")
            return {
                'table_name': name.upper(),
                'topic': topic,
                'key_column': key_column.upper(),
                'columns': len(schema),
                'created': True,
                'result': result
            }

        except Exception as e:
            if "already exists" in str(e).lower():
                logger.warning(f"[KSQLDB] Table already exists: {name}")
                return {
                    'table_name': name.upper(),
                    'already_exists': True,
                    'created': False
                }
            raise

    async def drop_stream(self, name: str, delete_topic: bool = False) -> Dict:
        """
        Drop a ksqlDB stream.

        Args:
            name: Stream name to drop
            delete_topic: Whether to also delete underlying Kafka topic

        Returns:
            Drop result
        """
        if not self.is_configured():
            logger.info(f"[KSQLDB] Mock mode - would drop stream: {name}")
            return {'stream_name': name.upper(), 'dropped': True, 'mock': True}

        delete_clause = "DELETE TOPIC" if delete_topic else ""
        ksql = f"DROP STREAM IF EXISTS {name.upper()} {delete_clause};"

        try:
            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Dropped stream: {name.upper()}")
            return {
                'stream_name': name.upper(),
                'dropped': True,
                'topic_deleted': delete_topic,
                'result': result
            }

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to drop stream: {str(e)}")
            raise

    async def drop_table(self, name: str, delete_topic: bool = False) -> Dict:
        """
        Drop a ksqlDB table.

        Args:
            name: Table name to drop
            delete_topic: Whether to also delete underlying Kafka topic

        Returns:
            Drop result
        """
        if not self.is_configured():
            logger.info(f"[KSQLDB] Mock mode - would drop table: {name}")
            return {'table_name': name.upper(), 'dropped': True, 'mock': True}

        delete_clause = "DELETE TOPIC" if delete_topic else ""
        ksql = f"DROP TABLE IF EXISTS {name.upper()} {delete_clause};"

        try:
            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Dropped table: {name.upper()}")
            return {
                'table_name': name.upper(),
                'dropped': True,
                'topic_deleted': delete_topic,
                'result': result
            }

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to drop table: {str(e)}")
            raise

    # Query Operations

    async def create_stream_as_select(
        self,
        name: str,
        query: str,
        output_topic: Optional[str] = None,
        partitions: int = 3,
        replicas: int = 3
    ) -> Dict:
        """
        Create a persistent stream from a SELECT query (for JOINs and transformations).

        Args:
            name: New stream name
            query: SELECT query (without CREATE prefix)
            output_topic: Optional output topic name
            partitions: Number of partitions
            replicas: Replication factor

        Returns:
            Stream creation result
        """
        if not self.is_configured():
            logger.info(f"[KSQLDB] Mock mode - would create stream as select: {name}")
            return {'stream_name': name.upper(), 'created': True, 'mock': True}

        # Build CREATE STREAM AS SELECT statement
        ksql = f"CREATE STREAM {name.upper()} "

        with_clause = f"WITH (KAFKA_TOPIC='{output_topic or name.lower()}', PARTITIONS={partitions}, REPLICAS={replicas})"
        ksql += with_clause + " AS " + query + ";"

        try:
            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Created stream from query: {name.upper()}")
            return {
                'stream_name': name.upper(),
                'topic': output_topic or name.lower(),
                'created': True,
                'result': result
            }

        except Exception as e:
            if "already exists" in str(e).lower():
                logger.warning(f"[KSQLDB] Stream already exists: {name}")
                return {
                    'stream_name': name.upper(),
                    'already_exists': True,
                    'created': False
                }
            raise

    async def create_table_as_select(
        self,
        name: str,
        query: str,
        output_topic: Optional[str] = None,
        partitions: int = 3,
        replicas: int = 3
    ) -> Dict:
        """
        Create a persistent table from a SELECT query (for aggregations).

        Args:
            name: New table name
            query: SELECT query with GROUP BY (without CREATE prefix)
            output_topic: Optional output topic name
            partitions: Number of partitions
            replicas: Replication factor

        Returns:
            Table creation result
        """
        if not self.is_configured():
            logger.info(f"[KSQLDB] Mock mode - would create table as select: {name}")
            return {'table_name': name.upper(), 'created': True, 'mock': True}

        # Build CREATE TABLE AS SELECT statement
        ksql = f"CREATE TABLE {name.upper()} "

        with_clause = f"WITH (KAFKA_TOPIC='{output_topic or name.lower()}', PARTITIONS={partitions}, REPLICAS={replicas})"
        ksql += with_clause + " AS " + query + ";"

        try:
            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Created table from query: {name.upper()}")
            return {
                'table_name': name.upper(),
                'topic': output_topic or name.lower(),
                'created': True,
                'result': result
            }

        except Exception as e:
            if "already exists" in str(e).lower():
                logger.warning(f"[KSQLDB] Table already exists: {name}")
                return {
                    'table_name': name.upper(),
                    'already_exists': True,
                    'created': False
                }
            raise

    async def execute_query(self, query: str) -> Dict:
        """
        Execute a query (SHOW, DESCRIBE, SELECT, etc.).

        Args:
            query: ksqlDB query to execute

        Returns:
            Query results
        """
        if not self.is_configured():
            return {'mock': True, 'results': []}

        try:
            # Remove trailing semicolon if present
            query = query.rstrip(';')

            result = await self._execute_ksql(query + ";")

            logger.info(f"[KSQLDB] Query executed successfully")
            return {
                'success': True,
                'results': result
            }

        except Exception as e:
            logger.error(f"[KSQLDB] Query failed: {str(e)}")
            raise

    async def get_query_status(self, query_id: str) -> Dict:
        """
        Get status of a running query.

        Args:
            query_id: Query ID to check

        Returns:
            Query status information
        """
        if not self.is_configured():
            return {'query_id': query_id, 'status': 'RUNNING', 'mock': True}

        try:
            ksql = f"DESCRIBE {query_id};"
            result = await self._execute_ksql(ksql)

            return {
                'query_id': query_id,
                'status': 'RUNNING',
                'details': result
            }

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to get query status: {str(e)}")
            raise

    async def terminate_query(self, query_id: str) -> Dict:
        """
        Terminate a running query.

        Args:
            query_id: Query ID to terminate

        Returns:
            Termination result
        """
        if not self.is_configured():
            logger.info(f"[KSQLDB] Mock mode - would terminate query: {query_id}")
            return {'query_id': query_id, 'terminated': True, 'mock': True}

        try:
            ksql = f"TERMINATE {query_id};"
            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Terminated query: {query_id}")
            return {
                'query_id': query_id,
                'terminated': True,
                'result': result
            }

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to terminate query: {str(e)}")
            raise

    # Monitoring

    async def list_streams(self) -> List[Dict]:
        """
        List all streams.

        Returns:
            List of stream metadata
        """
        if not self.is_configured():
            return []

        try:
            ksql = "SHOW STREAMS;"
            result = await self._execute_ksql(ksql)

            # Parse result - ksqlDB returns array of objects
            if result and len(result) > 0:
                streams = result[0].get('streams', [])
                logger.info(f"[KSQLDB] Found {len(streams)} streams")
                return streams

            return []

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to list streams: {str(e)}")
            return []

    async def list_tables(self) -> List[Dict]:
        """
        List all tables.

        Returns:
            List of table metadata
        """
        if not self.is_configured():
            return []

        try:
            ksql = "SHOW TABLES;"
            result = await self._execute_ksql(ksql)

            # Parse result - ksqlDB returns array of objects
            if result and len(result) > 0:
                tables = result[0].get('tables', [])
                logger.info(f"[KSQLDB] Found {len(tables)} tables")
                return tables

            return []

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to list tables: {str(e)}")
            return []

    async def list_queries(self) -> List[Dict]:
        """
        List all running queries.

        Returns:
            List of query metadata
        """
        if not self.is_configured():
            return []

        try:
            ksql = "SHOW QUERIES;"
            result = await self._execute_ksql(ksql)

            # Parse result - ksqlDB returns array of objects
            if result and len(result) > 0:
                queries = result[0].get('queries', [])
                logger.info(f"[KSQLDB] Found {len(queries)} running queries")
                return queries

            return []

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to list queries: {str(e)}")
            return []

    async def describe_stream(self, name: str) -> Dict:
        """
        Get stream schema and details.

        Args:
            name: Stream name to describe

        Returns:
            Stream metadata including schema
        """
        if not self.is_configured():
            return {'stream_name': name.upper(), 'mock': True}

        try:
            ksql = f"DESCRIBE {name.upper()};"
            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Described stream: {name.upper()}")
            return {
                'stream_name': name.upper(),
                'details': result
            }

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to describe stream: {str(e)}")
            raise

    async def describe_table(self, name: str) -> Dict:
        """
        Get table schema and details.

        Args:
            name: Table name to describe

        Returns:
            Table metadata including schema
        """
        if not self.is_configured():
            return {'table_name': name.upper(), 'mock': True}

        try:
            ksql = f"DESCRIBE {name.upper()};"
            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Described table: {name.upper()}")
            return {
                'table_name': name.upper(),
                'details': result
            }

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to describe table: {str(e)}")
            raise

    async def get_stream_info(self, name: str) -> Dict:
        """
        Get extended info about a stream including topic.

        Args:
            name: Stream name

        Returns:
            Extended stream information
        """
        if not self.is_configured():
            return {'stream_name': name.upper(), 'mock': True}

        try:
            ksql = f"DESCRIBE {name.upper()} EXTENDED;"
            result = await self._execute_ksql(ksql)

            # Parse extended info from result
            info = {
                'stream_name': name.upper(),
                'details': result
            }

            # Extract key information if available
            if result and len(result) > 0:
                source_desc = result[0].get('sourceDescription', {})
                info['topic'] = source_desc.get('topic')
                info['format'] = source_desc.get('format')
                info['partitions'] = source_desc.get('partitions')
                info['replicas'] = source_desc.get('replication')
                info['fields'] = source_desc.get('fields', [])

            logger.info(f"[KSQLDB] Got extended info for stream: {name.upper()}")
            return info

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to get stream info: {str(e)}")
            raise

    async def get_table_info(self, name: str) -> Dict:
        """
        Get extended info about a table including topic.

        Args:
            name: Table name

        Returns:
            Extended table information
        """
        if not self.is_configured():
            return {'table_name': name.upper(), 'mock': True}

        try:
            ksql = f"DESCRIBE {name.upper()} EXTENDED;"
            result = await self._execute_ksql(ksql)

            # Parse extended info from result
            info = {
                'table_name': name.upper(),
                'details': result
            }

            # Extract key information if available
            if result and len(result) > 0:
                source_desc = result[0].get('sourceDescription', {})
                info['topic'] = source_desc.get('topic')
                info['format'] = source_desc.get('format')
                info['partitions'] = source_desc.get('partitions')
                info['replicas'] = source_desc.get('replication')
                info['fields'] = source_desc.get('fields', [])
                info['key_field'] = source_desc.get('keyField')

            logger.info(f"[KSQLDB] Got extended info for table: {name.upper()}")
            return info

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to get table info: {str(e)}")
            raise

    async def insert_into_stream(
        self,
        stream_name: str,
        values: Dict[str, Any]
    ) -> Dict:
        """
        Insert a record into a stream.

        Args:
            stream_name: Target stream name
            values: Column values to insert

        Returns:
            Insert result
        """
        if not self.is_configured():
            logger.info(f"[KSQLDB] Mock mode - would insert into stream: {stream_name}")
            return {'stream_name': stream_name.upper(), 'inserted': True, 'mock': True}

        try:
            # Build INSERT statement
            columns = ", ".join(values.keys())
            # Format values - strings need quotes, others don't
            formatted_values = []
            for v in values.values():
                if isinstance(v, str):
                    formatted_values.append(f"'{v}'")
                elif v is None:
                    formatted_values.append("NULL")
                else:
                    formatted_values.append(str(v))

            values_str = ", ".join(formatted_values)

            ksql = f"INSERT INTO {stream_name.upper()} ({columns}) VALUES ({values_str});"

            result = await self._execute_ksql(ksql)

            logger.info(f"[KSQLDB] Inserted record into stream: {stream_name.upper()}")
            return {
                'stream_name': stream_name.upper(),
                'inserted': True,
                'result': result
            }

        except Exception as e:
            logger.error(f"[KSQLDB] Failed to insert into stream: {str(e)}")
            raise


# Singleton instance
ksqldb_service = KsqlDBService()
