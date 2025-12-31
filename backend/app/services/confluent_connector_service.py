"""
Confluent Connector Service
Manages Debezium CDC connectors via local Kafka Connect or Confluent Cloud Connect API.
"""

import os
import json
import base64
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime

from app.config import settings


class ConfluentConnectorService:
    """
    Service for managing Kafka Connect connectors.
    Supports both local Kafka Connect (for local databases) and Confluent Cloud managed connectors.
    """

    def __init__(self):
        # Local Kafka Connect (preferred for local development)
        self.kafka_connect_url = settings.kafka_connect_url

        # Confluent Cloud API (for managed connectors)
        self.api_key = settings.confluent_cloud_api_key
        self.api_secret = settings.confluent_cloud_api_secret
        self.environment_id = settings.confluent_environment_id
        self.cluster_id = settings.confluent_cluster_id

        # Kafka and Schema Registry settings
        self.kafka_bootstrap = settings.kafka_bootstrap_servers
        self.kafka_api_key = settings.kafka_api_key
        self.kafka_api_secret = settings.kafka_api_secret
        self.schema_registry_url = settings.schema_registry_url
        self.schema_registry_key = settings.schema_registry_api_key
        self.schema_registry_secret = settings.schema_registry_api_secret

        # Base URL for Confluent Cloud Connect API
        self.cloud_base_url = f"https://api.confluent.cloud/connect/v1/environments/{self.environment_id}/clusters/{self.cluster_id}"

    def _get_base_url(self) -> str:
        """Get the appropriate base URL based on configuration"""
        if self.use_local_connect():
            return f"{self.kafka_connect_url}/connectors"
        return f"{self.cloud_base_url}/connectors"

    def _get_headers(self) -> Dict[str, str]:
        """Get appropriate headers based on mode"""
        if self.use_local_connect():
            # Local Kafka Connect doesn't need auth
            return {"Content-Type": "application/json"}
        else:
            # Confluent Cloud API requires Basic Auth
            credentials = f"{self.api_key}:{self.api_secret}"
            encoded = base64.b64encode(credentials.encode()).decode()
            return {
                "Authorization": f"Basic {encoded}",
                "Content-Type": "application/json"
            }

    def _get_session(self):
        """Get database session"""
        from app.services.db_service import db_service
        return db_service._get_session()

    def use_local_connect(self) -> bool:
        """Check if local Kafka Connect is configured"""
        return settings.has_kafka_connect_url

    def use_cloud_connect(self) -> bool:
        """Check if Confluent Cloud Connect is configured"""
        return settings.has_confluent_cloud_api

    def is_configured(self) -> bool:
        """Check if any connector service is properly configured"""
        return self.use_local_connect() or self.use_cloud_connect()

    def create_source_connector(
        self,
        user_id: str,
        credential_id: str,
        pipeline_id: str,
        tables: List[str],
        snapshot_mode: str = "initial"
    ) -> Dict[str, Any]:
        """
        Create a Debezium PostgreSQL source connector.

        Args:
            user_id: User ID
            credential_id: ID of stored database credentials
            pipeline_id: Unique pipeline identifier
            tables: List of tables to capture (format: "schema.table")
            snapshot_mode: 'initial', 'never', or 'always'

        Returns:
            Connector configuration and status
        """
        from app.services.credential_service import credential_service

        # Get decrypted credentials
        cred_data = credential_service.get_decrypted_credentials(user_id, credential_id)
        if not cred_data:
            raise ValueError(f"Credential {credential_id} not found")

        credentials = cred_data['credentials']
        # Use full pipeline_id (with hyphens removed) to ensure unique topic prefixes
        # This prevents schema registry conflicts when pipelines are recreated
        unique_id = pipeline_id.replace("-", "")
        connector_name = f"dataflow-pg-{unique_id[:12]}"
        server_name = f"dataflow_{unique_id}"

        # Build table include list
        table_include_list = ",".join(tables)

        # Connector configuration for Debezium PostgreSQL
        connector_config = {
            "name": connector_name,
            "config": {
                "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
                "database.hostname": credentials.get('host'),
                "database.port": str(credentials.get('port', 5432)),
                "database.user": credentials.get('username'),
                "database.password": credentials.get('password'),
                "database.dbname": credentials.get('database'),
                "topic.prefix": server_name,
                "table.include.list": table_include_list,
                "slot.name": f"dataflow_{unique_id[:16]}",
                "publication.name": f"dataflow_{unique_id[:16]}_pub",
                "plugin.name": "pgoutput",
                "snapshot.mode": snapshot_mode,
                # Transforms
                "transforms": "unwrap",
                "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
                "transforms.unwrap.drop.tombstones": "false",
                "transforms.unwrap.delete.handling.mode": "rewrite"
            }
        }

        # Configure Avro converters with Schema Registry for both local and cloud
        # This ensures schemas are registered for data contracts
        connector_config["config"].update({
            "key.converter": "io.confluent.connect.avro.AvroConverter",
            "key.converter.schema.registry.url": self.schema_registry_url,
            "key.converter.basic.auth.credentials.source": "USER_INFO",
            "key.converter.basic.auth.user.info": f"{self.schema_registry_key}:{self.schema_registry_secret}",
            "value.converter": "io.confluent.connect.avro.AvroConverter",
            "value.converter.schema.registry.url": self.schema_registry_url,
            "value.converter.basic.auth.credentials.source": "USER_INFO",
            "value.converter.basic.auth.user.info": f"{self.schema_registry_key}:{self.schema_registry_secret}",
        })

        # Add Kafka SASL config for local connect (connecting to Confluent Cloud)
        if self.use_local_connect():
            connector_config["config"].update({
                "database.history.kafka.bootstrap.servers": self.kafka_bootstrap,
                "database.history.kafka.topic": f"{server_name}.schema-history",
                "database.history.producer.security.protocol": "SASL_SSL",
                "database.history.producer.sasl.mechanism": "PLAIN",
                "database.history.producer.sasl.jaas.config": f'org.apache.kafka.common.security.plain.PlainLoginModule required username="{self.kafka_api_key}" password="{self.kafka_api_secret}";',
                "database.history.consumer.security.protocol": "SASL_SSL",
                "database.history.consumer.sasl.mechanism": "PLAIN",
                "database.history.consumer.sasl.jaas.config": f'org.apache.kafka.common.security.plain.PlainLoginModule required username="{self.kafka_api_key}" password="{self.kafka_api_secret}";',
            })

        if not self.is_configured():
            # Mock mode for development
            print(f"[CONNECTOR] Mock mode - would create connector: {connector_name}")
            return {
                'connector_name': connector_name,
                'status': 'RUNNING',
                'config': connector_config['config'],
                'mock': True,
                'server_name': server_name,
                'tables': tables,
                'created_at': datetime.utcnow().isoformat()
            }

        try:
            mode = "local" if self.use_local_connect() else "cloud"
            print(f"[CONNECTOR] Creating source connector via {mode}: {connector_name}")

            response = httpx.post(
                self._get_base_url(),
                headers=self._get_headers(),
                json=connector_config,
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()

            print(f"[CONNECTOR] Created source connector: {connector_name}")
            return {
                'connector_name': connector_name,
                'status': 'RUNNING',
                'config': connector_config['config'],
                'response': result,
                'server_name': server_name,
                'tables': tables,
                'created_at': datetime.utcnow().isoformat(),
                'mode': mode
            }

        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if e.response else str(e)
            raise Exception(f"Failed to create connector: {error_detail}")
        except Exception as e:
            raise Exception(f"Connector creation failed: {str(e)}")

    def get_connector_status(self, connector_name: str) -> Dict[str, Any]:
        """
        Get status of a connector.

        Args:
            connector_name: Name of the connector

        Returns:
            Status information including state and tasks
        """
        if not self.is_configured():
            return {
                'name': connector_name,
                'connector': {'state': 'RUNNING'},
                'tasks': [{'id': 0, 'state': 'RUNNING'}],
                'mock': True
            }

        try:
            response = httpx.get(
                f"{self._get_base_url()}/{connector_name}/status",
                headers=self._get_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {'name': connector_name, 'connector': {'state': 'NOT_FOUND'}}
            raise Exception(f"Failed to get connector status: {e.response.text}")

    def pause_connector(self, connector_name: str) -> bool:
        """Pause a running connector"""
        if not self.is_configured():
            print(f"[CONNECTOR] Mock mode - would pause connector: {connector_name}")
            return True

        try:
            response = httpx.put(
                f"{self._get_base_url()}/{connector_name}/pause",
                headers=self._get_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            print(f"[CONNECTOR] Paused connector: {connector_name}")
            return True

        except Exception as e:
            raise Exception(f"Failed to pause connector: {str(e)}")

    def resume_connector(self, connector_name: str) -> bool:
        """Resume a paused connector"""
        if not self.is_configured():
            print(f"[CONNECTOR] Mock mode - would resume connector: {connector_name}")
            return True

        try:
            response = httpx.put(
                f"{self._get_base_url()}/{connector_name}/resume",
                headers=self._get_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            print(f"[CONNECTOR] Resumed connector: {connector_name}")
            return True

        except Exception as e:
            raise Exception(f"Failed to resume connector: {str(e)}")

    def delete_connector(self, connector_name: str) -> bool:
        """Delete a connector"""
        if not self.is_configured():
            print(f"[CONNECTOR] Mock mode - would delete connector: {connector_name}")
            return True

        try:
            response = httpx.delete(
                f"{self._get_base_url()}/{connector_name}",
                headers=self._get_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            print(f"[CONNECTOR] Deleted connector: {connector_name}")
            return True

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return True  # Already deleted
            raise Exception(f"Failed to delete connector: {e.response.text}")

    def restart_connector(self, connector_name: str) -> bool:
        """Restart a connector"""
        if not self.is_configured():
            print(f"[CONNECTOR] Mock mode - would restart connector: {connector_name}")
            return True

        try:
            response = httpx.post(
                f"{self._get_base_url()}/{connector_name}/restart",
                headers=self._get_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            print(f"[CONNECTOR] Restarted connector: {connector_name}")
            return True

        except Exception as e:
            raise Exception(f"Failed to restart connector: {str(e)}")

    def list_connectors(self) -> List[str]:
        """List all connectors"""
        if not self.is_configured():
            return []

        try:
            response = httpx.get(
                self._get_base_url(),
                headers=self._get_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

        except Exception as e:
            print(f"[CONNECTOR] Failed to list connectors: {str(e)}")
            return []

    def get_connector_config(self, connector_name: str) -> Dict[str, Any]:
        """Get connector configuration"""
        if not self.is_configured():
            return {'name': connector_name, 'mock': True}

        try:
            response = httpx.get(
                f"{self._get_base_url()}/{connector_name}/config",
                headers=self._get_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

        except Exception as e:
            raise Exception(f"Failed to get connector config: {str(e)}")

    def create_sink_connector(
        self,
        pipeline_id: str,
        sink_config: Dict[str, Any],
        topics: List[str]
    ) -> Dict[str, Any]:
        """
        Create a ClickHouse sink connector.

        Args:
            pipeline_id: Unique pipeline identifier
            sink_config: Sink configuration containing ClickHouse connection details
                {
                    'host': 'clickhouse-host',
                    'port': 8123,
                    'database': 'dataflow',
                    'username': 'default',
                    'password': 'password',
                    'table_mappings': [
                        {'topic': 'topic_name', 'table': 'table_name'}
                    ]
                }
            topics: List of Kafka topics to consume from

        Returns:
            Connector configuration and status
        """
        # Use consistent unique_id format with source connector
        unique_id = pipeline_id.replace("-", "")
        connector_name = f"dataflow-clickhouse-{unique_id[:12]}"

        # Build topic list and table mappings
        topic_list = ",".join(topics)

        # Extract ClickHouse connection details
        ch_host = sink_config.get('host', 'localhost')
        ch_port = sink_config.get('port', 8123)
        ch_database = sink_config.get('database', 'dataflow')
        ch_username = sink_config.get('username', 'default')
        ch_password = sink_config.get('password', '')

        # Note: ClickHouse Kafka Connect Sink does NOT support custom table names
        # Table name must match topic name exactly - topic.to.table.map is not supported

        # Connector configuration for ClickHouse Kafka Connect Sink
        connector_config = {
            "name": connector_name,
            "config": {
                "connector.class": "com.clickhouse.kafka.connect.ClickHouseSinkConnector",
                "tasks.max": "1",
                "topics": topic_list,

                # ClickHouse connection
                "hostname": ch_host,
                "port": str(ch_port),
                "database": ch_database,
                "username": ch_username,
                "password": ch_password,
                "ssl": "false",

                # Kafka consumer configuration with SASL auth
                "consumer.override.security.protocol": "SASL_SSL",
                "consumer.override.sasl.mechanism": "PLAIN",
                "consumer.override.sasl.jaas.config": f'org.apache.kafka.common.security.plain.PlainLoginModule required username="{self.kafka_api_key}" password="{self.kafka_api_secret}";',

                # Data format - consume from Avro topics
                "key.converter": "io.confluent.connect.avro.AvroConverter",
                "key.converter.schema.registry.url": self.schema_registry_url,
                "key.converter.basic.auth.credentials.source": "USER_INFO",
                "key.converter.basic.auth.user.info": f"{self.schema_registry_key}:{self.schema_registry_secret}",
                "value.converter": "io.confluent.connect.avro.AvroConverter",
                "value.converter.schema.registry.url": self.schema_registry_url,
                "value.converter.basic.auth.credentials.source": "USER_INFO",
                "value.converter.basic.auth.user.info": f"{self.schema_registry_key}:{self.schema_registry_secret}",

                # Insert settings
                "exactlyOnce": "false",
                "batch.size": "1000",
                "buffer.count": "10000",

                # Error handling
                "errors.tolerance": "none",
                "errors.log.enable": "true",
                "errors.log.include.messages": "true"
            }
        }

        if not self.is_configured():
            # Mock mode for development
            print(f"[CONNECTOR] Mock mode - would create sink connector: {connector_name}")
            return {
                'connector_name': connector_name,
                'status': 'RUNNING',
                'config': connector_config['config'],
                'mock': True,
                'topics': topics,
                'clickhouse_host': ch_host,
                'clickhouse_database': ch_database,
                'created_at': datetime.utcnow().isoformat()
            }

        try:
            mode = "local" if self.use_local_connect() else "cloud"
            print(f"[CONNECTOR] Creating sink connector via {mode}: {connector_name}")

            response = httpx.post(
                self._get_base_url(),
                headers=self._get_headers(),
                json=connector_config,
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()

            print(f"[CONNECTOR] Created sink connector: {connector_name}")
            return {
                'connector_name': connector_name,
                'status': 'RUNNING',
                'config': connector_config['config'],
                'response': result,
                'topics': topics,
                'clickhouse_host': ch_host,
                'clickhouse_database': ch_database,
                'created_at': datetime.utcnow().isoformat(),
                'mode': mode
            }

        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if e.response else str(e)
            raise Exception(f"Failed to create sink connector: {error_detail}")
        except Exception as e:
            raise Exception(f"Sink connector creation failed: {str(e)}")

    def check_connect_health(self) -> Dict[str, Any]:
        """Check if Kafka Connect is healthy and reachable"""
        if not self.is_configured():
            return {
                'healthy': False,
                'mode': 'mock',
                'message': 'No connector service configured'
            }

        try:
            if self.use_local_connect():
                # Check local Kafka Connect health
                response = httpx.get(
                    f"{self.kafka_connect_url}/",
                    timeout=5.0
                )
                response.raise_for_status()
                info = response.json()
                return {
                    'healthy': True,
                    'mode': 'local',
                    'version': info.get('version', 'unknown'),
                    'commit': info.get('commit', 'unknown')
                }
            else:
                # Check Confluent Cloud API
                response = httpx.get(
                    self._get_base_url(),
                    headers=self._get_headers(),
                    timeout=5.0
                )
                response.raise_for_status()
                return {
                    'healthy': True,
                    'mode': 'cloud',
                    'connectors': len(response.json())
                }

        except Exception as e:
            return {
                'healthy': False,
                'mode': 'local' if self.use_local_connect() else 'cloud',
                'error': str(e)
            }


# Singleton instance
confluent_connector_service = ConfluentConnectorService()
