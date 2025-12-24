"""
Kafka Consumer Service with Schema Registry Support
Consumes Avro-deserialized messages from Kafka topics.
"""

import json
import os
from typing import Dict, Any, List, Optional
from app.config import settings
from app.tools.agent_tools import MOCK_PROCESSED_METRICS


class MockKafkaConsumer:
    """Mock Kafka consumer for development"""

    def __init__(self):
        print("MockKafkaConsumer initialized (development mode)")

    def get_latest_batch(self, topic: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Return mock data"""
        return MOCK_PROCESSED_METRICS

    def subscribe(self, topics: List[str]):
        """Mock subscribe"""
        pass

    def poll(self, timeout: float = 1.0):
        """Mock poll"""
        return None

    def close(self):
        """Mock close"""
        pass


class KafkaConsumerService:
    """
    Kafka Consumer Service with Schema Registry support.
    Uses Confluent Kafka with Avro deserialization in production, mock in development.
    """

    def __init__(self):
        self.is_mock = True
        self.consumer = None
        self.avro_deserializer = None
        self.schema_registry_client = None

        if settings.use_mock_kafka:
            self.consumer = MockKafkaConsumer()
        else:
            self._init_confluent_consumer()

    def _init_confluent_consumer(self):
        """Initialize real Confluent Kafka consumer with Schema Registry"""
        try:
            from confluent_kafka import Consumer

            # Consumer config
            consumer_config = {
                'bootstrap.servers': settings.kafka_bootstrap_servers,
                'security.protocol': 'SASL_SSL',
                'sasl.mechanisms': 'PLAIN',
                'sasl.username': settings.kafka_api_key,
                'sasl.password': settings.kafka_api_secret,
                'group.id': 'dataflow-ai-consumer',
                'auto.offset.reset': 'earliest',
                'enable.auto.commit': True,
                'auto.commit.interval.ms': 5000,
            }

            self.consumer = Consumer(consumer_config)
            self.is_mock = False

            # Initialize Schema Registry if configured
            if settings.schema_registry_url:
                self._init_schema_registry()

            print("Confluent Kafka Consumer initialized")

        except Exception as e:
            print(f"Failed to initialize Kafka consumer: {e}")
            self.consumer = MockKafkaConsumer()
            self.is_mock = True

    def _init_schema_registry(self):
        """Initialize Schema Registry client and Avro deserializers"""
        try:
            from confluent_kafka.schema_registry import SchemaRegistryClient
            from confluent_kafka.schema_registry.avro import AvroDeserializer

            # Schema Registry config
            sr_config = {
                'url': settings.schema_registry_url,
                'basic.auth.user.info': f'{settings.schema_registry_api_key}:{settings.schema_registry_api_secret}'
            }

            self.schema_registry_client = SchemaRegistryClient(sr_config)

            # Load schemas from files
            schema_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'schemas')

            # Raw Google Ads schema
            with open(os.path.join(schema_dir, 'raw_google_ads.avsc'), 'r') as f:
                raw_ads_schema_str = f.read()

            self.raw_ads_deserializer = AvroDeserializer(
                self.schema_registry_client,
                raw_ads_schema_str,
                from_dict=lambda obj, ctx: obj
            )

            # Processed metrics schema
            with open(os.path.join(schema_dir, 'processed_metrics.avsc'), 'r') as f:
                processed_schema_str = f.read()

            self.processed_metrics_deserializer = AvroDeserializer(
                self.schema_registry_client,
                processed_schema_str,
                from_dict=lambda obj, ctx: obj
            )

            print("Schema Registry initialized with Avro deserializers")

        except Exception as e:
            print(f"Failed to initialize Schema Registry: {e}")
            self.schema_registry_client = None

    def subscribe(self, topics: List[str]):
        """Subscribe to Kafka topics"""
        if not self.is_mock:
            self.consumer.subscribe(topics)

    def poll_messages(self, topic: str, timeout: float = 1.0, max_messages: int = 100) -> List[Dict[str, Any]]:
        """Poll messages from a subscribed topic"""
        if self.is_mock:
            return self.consumer.get_latest_batch(topic, max_messages)

        messages = []
        self.subscribe([topic])

        try:
            # Poll for messages
            while len(messages) < max_messages:
                msg = self.consumer.poll(timeout)
                if msg is None:
                    break
                if msg.error():
                    print(f"Consumer error: {msg.error()}")
                    continue

                # Deserialize message
                value = self._deserialize_message(topic, msg.value())
                if value:
                    messages.append(value)

        except Exception as e:
            print(f"Error polling messages: {e}")

        return messages

    def _deserialize_message(self, topic: str, raw_value: bytes) -> Optional[Dict[str, Any]]:
        """Deserialize message based on topic"""
        if not raw_value:
            return None

        try:
            from confluent_kafka.serialization import SerializationContext, MessageField

            # Try Avro deserialization first
            if self.schema_registry_client:
                if topic == 'raw_google_ads' and hasattr(self, 'raw_ads_deserializer'):
                    return self.raw_ads_deserializer(
                        raw_value,
                        SerializationContext(topic, MessageField.VALUE)
                    )
                elif topic == 'processed_metrics' and hasattr(self, 'processed_metrics_deserializer'):
                    return self.processed_metrics_deserializer(
                        raw_value,
                        SerializationContext(topic, MessageField.VALUE)
                    )

            # Fall back to JSON
            return json.loads(raw_value.decode('utf-8'))

        except Exception as e:
            print(f"Deserialization failed: {e}")
            # Try JSON as last resort
            try:
                return json.loads(raw_value.decode('utf-8'))
            except:
                return None

    def get_latest_batch(self, topic: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get the latest batch of messages from a topic (convenience method)"""
        if self.is_mock:
            return self.consumer.get_latest_batch(topic, limit)
        return self.poll_messages(topic, timeout=5.0, max_messages=limit)

    def consume_processed_metrics(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Consume processed metrics for dashboard generation"""
        return self.get_latest_batch('processed_metrics', limit)

    def close(self):
        """Close the consumer"""
        if not self.is_mock:
            self.consumer.close()


# Singleton instance
kafka_consumer = KafkaConsumerService()
