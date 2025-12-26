"""
Topic Service
Manages Kafka topics and Schema Registry for Confluent Cloud.
"""

import os
import json
import base64
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime


class TopicService:
    """
    Service for managing Kafka topics and schemas on Confluent Cloud.
    Uses confluent-kafka AdminClient for topic operations and REST API for Schema Registry.
    """

    def __init__(self):
        self.bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "")
        self.api_key = os.getenv("KAFKA_API_KEY", "")
        self.api_secret = os.getenv("KAFKA_API_SECRET", "")
        self.schema_registry_url = os.getenv("SCHEMA_REGISTRY_URL", "")
        self.schema_registry_key = os.getenv("SCHEMA_REGISTRY_API_KEY", "")
        self.schema_registry_secret = os.getenv("SCHEMA_REGISTRY_API_SECRET", "")

        self._admin_client = None

    def _get_admin_client(self):
        """Get or create Kafka AdminClient"""
        if self._admin_client is None:
            try:
                from confluent_kafka.admin import AdminClient

                conf = {
                    'bootstrap.servers': self.bootstrap_servers,
                    'security.protocol': 'SASL_SSL',
                    'sasl.mechanisms': 'PLAIN',
                    'sasl.username': self.api_key,
                    'sasl.password': self.api_secret
                }
                self._admin_client = AdminClient(conf)
            except Exception as e:
                print(f"[TOPIC] Failed to create AdminClient: {e}")
                return None

        return self._admin_client

    def _get_schema_registry_headers(self) -> Dict[str, str]:
        """Generate auth headers for Schema Registry"""
        credentials = f"{self.schema_registry_key}:{self.schema_registry_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/vnd.schemaregistry.v1+json"
        }

    def is_configured(self) -> bool:
        """Check if Kafka is properly configured"""
        return bool(self.bootstrap_servers and self.api_key and self.api_secret)

    def create_topic(
        self,
        topic_name: str,
        partitions: int = 3,
        replication_factor: int = 3,
        retention_ms: int = 604800000,  # 7 days
        cleanup_policy: str = "delete"
    ) -> Dict[str, Any]:
        """
        Create a Kafka topic.

        Args:
            topic_name: Name of the topic
            partitions: Number of partitions
            replication_factor: Replication factor
            retention_ms: Message retention in milliseconds
            cleanup_policy: 'delete' or 'compact'

        Returns:
            Topic creation result
        """
        if not self.is_configured():
            print(f"[TOPIC] Mock mode - would create topic: {topic_name}")
            return {
                'topic_name': topic_name,
                'partitions': partitions,
                'replication_factor': replication_factor,
                'created': True,
                'mock': True
            }

        try:
            from confluent_kafka.admin import NewTopic

            admin = self._get_admin_client()
            if not admin:
                raise Exception("Failed to create AdminClient")

            topic = NewTopic(
                topic_name,
                num_partitions=partitions,
                replication_factor=replication_factor,
                config={
                    'retention.ms': str(retention_ms),
                    'cleanup.policy': cleanup_policy
                }
            )

            futures = admin.create_topics([topic])

            # Wait for completion
            for topic_name, future in futures.items():
                try:
                    future.result()
                    print(f"[TOPIC] Created topic: {topic_name}")
                except Exception as e:
                    if "already exists" in str(e).lower():
                        print(f"[TOPIC] Topic already exists: {topic_name}")
                    else:
                        raise e

            return {
                'topic_name': topic_name,
                'partitions': partitions,
                'replication_factor': replication_factor,
                'created': True
            }

        except Exception as e:
            raise Exception(f"Failed to create topic: {str(e)}")

    def get_topic_info(self, topic_name: str) -> Dict[str, Any]:
        """
        Get topic metadata.

        Args:
            topic_name: Name of the topic

        Returns:
            Topic metadata including partitions
        """
        if not self.is_configured():
            return {
                'topic_name': topic_name,
                'partitions': 3,
                'exists': True,
                'mock': True
            }

        try:
            admin = self._get_admin_client()
            if not admin:
                raise Exception("Failed to create AdminClient")

            # Get metadata
            cluster_metadata = admin.list_topics(topic=topic_name, timeout=10)
            topic_metadata = cluster_metadata.topics.get(topic_name)

            if topic_metadata is None:
                return {'topic_name': topic_name, 'exists': False}

            partitions = []
            for p in topic_metadata.partitions.values():
                partitions.append({
                    'id': p.id,
                    'leader': p.leader,
                    'replicas': list(p.replicas),
                    'isrs': list(p.isrs)
                })

            return {
                'topic_name': topic_name,
                'exists': True,
                'partitions': partitions,
                'partition_count': len(partitions)
            }

        except Exception as e:
            raise Exception(f"Failed to get topic info: {str(e)}")

    def delete_topic(self, topic_name: str) -> bool:
        """Delete a topic"""
        if not self.is_configured():
            print(f"[TOPIC] Mock mode - would delete topic: {topic_name}")
            return True

        try:
            admin = self._get_admin_client()
            if not admin:
                raise Exception("Failed to create AdminClient")

            futures = admin.delete_topics([topic_name])

            for topic_name, future in futures.items():
                future.result()
                print(f"[TOPIC] Deleted topic: {topic_name}")

            return True

        except Exception as e:
            if "does not exist" in str(e).lower():
                return True
            raise Exception(f"Failed to delete topic: {str(e)}")

    def list_topics(self, prefix: str = None) -> List[str]:
        """
        List all topics, optionally filtered by prefix.

        Args:
            prefix: Optional prefix to filter topics

        Returns:
            List of topic names
        """
        if not self.is_configured():
            return []

        try:
            admin = self._get_admin_client()
            if not admin:
                return []

            cluster_metadata = admin.list_topics(timeout=10)
            topics = list(cluster_metadata.topics.keys())

            if prefix:
                topics = [t for t in topics if t.startswith(prefix)]

            return topics

        except Exception as e:
            print(f"[TOPIC] Failed to list topics: {str(e)}")
            return []

    def register_schema(
        self,
        subject: str,
        schema: Dict[str, Any],
        schema_type: str = "AVRO"
    ) -> Dict[str, Any]:
        """
        Register a schema in Schema Registry.

        Args:
            subject: Schema subject (usually <topic>-key or <topic>-value)
            schema: Schema definition
            schema_type: Schema type (AVRO, JSON, PROTOBUF)

        Returns:
            Registration result with schema ID
        """
        if not self.schema_registry_url:
            print(f"[SCHEMA] Mock mode - would register schema for: {subject}")
            return {'subject': subject, 'id': 1, 'mock': True}

        try:
            payload = {
                "schema": json.dumps(schema) if isinstance(schema, dict) else schema,
                "schemaType": schema_type
            }

            response = httpx.post(
                f"{self.schema_registry_url}/subjects/{subject}/versions",
                headers=self._get_schema_registry_headers(),
                json=payload,
                timeout=10.0
            )
            response.raise_for_status()
            result = response.json()

            print(f"[SCHEMA] Registered schema for {subject}, ID: {result.get('id')}")
            return result

        except Exception as e:
            raise Exception(f"Failed to register schema: {str(e)}")

    def get_schema(self, subject: str, version: str = "latest") -> Dict[str, Any]:
        """
        Get a schema from Schema Registry.

        Args:
            subject: Schema subject
            version: Version number or 'latest'

        Returns:
            Schema definition
        """
        if not self.schema_registry_url:
            return {'subject': subject, 'version': version, 'mock': True}

        try:
            response = httpx.get(
                f"{self.schema_registry_url}/subjects/{subject}/versions/{version}",
                headers=self._get_schema_registry_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {'subject': subject, 'exists': False}
            raise Exception(f"Failed to get schema: {e.response.text}")

    def check_compatibility(
        self,
        subject: str,
        schema: Dict[str, Any],
        schema_type: str = "AVRO"
    ) -> Dict[str, Any]:
        """
        Check if a schema is compatible with existing versions.

        Args:
            subject: Schema subject
            schema: Schema to check
            schema_type: Schema type

        Returns:
            Compatibility result
        """
        if not self.schema_registry_url:
            return {'is_compatible': True, 'mock': True}

        try:
            payload = {
                "schema": json.dumps(schema) if isinstance(schema, dict) else schema,
                "schemaType": schema_type
            }

            response = httpx.post(
                f"{self.schema_registry_url}/compatibility/subjects/{subject}/versions/latest",
                headers=self._get_schema_registry_headers(),
                json=payload,
                timeout=10.0
            )
            response.raise_for_status()
            result = response.json()

            return {
                'is_compatible': result.get('is_compatible', True),
                'messages': result.get('messages', [])
            }

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                # No existing schema, so compatible by default
                return {'is_compatible': True, 'first_version': True}
            raise Exception(f"Failed to check compatibility: {e.response.text}")

    def list_subjects(self) -> List[str]:
        """List all schema subjects"""
        if not self.schema_registry_url:
            return []

        try:
            response = httpx.get(
                f"{self.schema_registry_url}/subjects",
                headers=self._get_schema_registry_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

        except Exception as e:
            print(f"[SCHEMA] Failed to list subjects: {str(e)}")
            return []

    def delete_subject(self, subject: str, permanent: bool = False) -> bool:
        """Delete a schema subject"""
        if not self.schema_registry_url:
            print(f"[SCHEMA] Mock mode - would delete subject: {subject}")
            return True

        try:
            url = f"{self.schema_registry_url}/subjects/{subject}"
            if permanent:
                url += "?permanent=true"

            response = httpx.delete(
                url,
                headers=self._get_schema_registry_headers(),
                timeout=10.0
            )
            response.raise_for_status()
            print(f"[SCHEMA] Deleted subject: {subject}")
            return True

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return True
            raise Exception(f"Failed to delete subject: {e.response.text}")


# Singleton instance
topic_service = TopicService()
