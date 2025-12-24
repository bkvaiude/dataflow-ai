"""
Kafka Producer Service with Schema Registry Support
Produces Avro-serialized messages to Kafka topics for real-time streaming.
"""

import json
import os
from typing import Dict, Any, Optional
from datetime import datetime
from app.config import settings


class MockKafkaProducer:
    """Mock Kafka producer for development"""

    def __init__(self):
        self.messages: list = []
        print("MockKafkaProducer initialized (development mode)")

    def produce(self, topic: str, message: Dict[str, Any], key: Optional[str] = None):
        """Mock produce - just logs the message"""
        self.messages.append({"topic": topic, "message": message, "key": key})
        print(f"[MOCK KAFKA] Produced to {topic}: {json.dumps(message)[:100]}...")

    def flush(self, timeout: float = 10.0):
        """Mock flush"""
        pass

    def poll(self, timeout: float = 0):
        """Mock poll"""
        pass


class KafkaProducerService:
    """
    Kafka Producer Service with Schema Registry support.
    Uses Confluent Kafka with Avro serialization in production, mock in development.
    """

    def __init__(self):
        self.is_mock = True
        self.producer = None
        self.avro_serializer = None
        self.schema_registry_client = None

        if settings.use_mock_kafka:
            self.producer = MockKafkaProducer()
        else:
            self._init_confluent_producer()

    def _init_confluent_producer(self):
        """Initialize real Confluent Kafka producer with Schema Registry"""
        try:
            from confluent_kafka import Producer
            from confluent_kafka.serialization import StringSerializer

            # Basic producer config
            producer_config = {
                'bootstrap.servers': settings.kafka_bootstrap_servers,
                'security.protocol': 'SASL_SSL',
                'sasl.mechanisms': 'PLAIN',
                'sasl.username': settings.kafka_api_key,
                'sasl.password': settings.kafka_api_secret,
                # Performance tuning
                'linger.ms': 5,
                'batch.num.messages': 100,
                'compression.type': 'snappy',
                # Reliability
                'acks': 'all',
                'retries': 3,
                'retry.backoff.ms': 100,
            }

            self.producer = Producer(producer_config)
            self.string_serializer = StringSerializer('utf_8')
            self.is_mock = False

            # Initialize Schema Registry if configured
            if settings.schema_registry_url:
                self._init_schema_registry()

            print("Confluent Kafka Producer initialized")

        except Exception as e:
            print(f"Failed to initialize Kafka producer: {e}")
            self.producer = MockKafkaProducer()
            self.is_mock = True

    def _init_schema_registry(self):
        """Initialize Schema Registry client and Avro serializers"""
        try:
            from confluent_kafka.schema_registry import SchemaRegistryClient
            from confluent_kafka.schema_registry.avro import AvroSerializer

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

            self.raw_ads_serializer = AvroSerializer(
                self.schema_registry_client,
                raw_ads_schema_str,
                to_dict=lambda obj, ctx: obj
            )

            # Processed metrics schema
            with open(os.path.join(schema_dir, 'processed_metrics.avsc'), 'r') as f:
                processed_schema_str = f.read()

            self.processed_metrics_serializer = AvroSerializer(
                self.schema_registry_client,
                processed_schema_str,
                to_dict=lambda obj, ctx: obj
            )

            print("Schema Registry initialized with Avro serializers")

        except Exception as e:
            print(f"Failed to initialize Schema Registry: {e}")
            self.schema_registry_client = None

    def _delivery_callback(self, err, msg):
        """Callback for message delivery confirmation"""
        if err:
            print(f"Message delivery failed: {err}")
        else:
            print(f"Message delivered to {msg.topic()} [{msg.partition()}] @ offset {msg.offset()}")

    def produce(self, topic: str, message: Dict[str, Any], key: Optional[str] = None):
        """Produce a message to a Kafka topic (JSON serialization)"""
        if self.is_mock:
            self.producer.produce(topic, message, key)
        else:
            self.producer.produce(
                topic,
                key=key.encode('utf-8') if key else None,
                value=json.dumps(message).encode('utf-8'),
                callback=self._delivery_callback
            )
            self.producer.poll(0)

    def produce_avro(self, topic: str, message: Dict[str, Any], key: Optional[str] = None):
        """Produce an Avro-serialized message to a Kafka topic"""
        if self.is_mock:
            self.producer.produce(topic, message, key)
            return

        if not self.schema_registry_client:
            # Fall back to JSON if Schema Registry not configured
            self.produce(topic, message, key)
            return

        try:
            from confluent_kafka.serialization import SerializationContext, MessageField

            # Select appropriate serializer based on topic
            if topic == 'raw_google_ads':
                serializer = self.raw_ads_serializer
            elif topic == 'processed_metrics':
                serializer = self.processed_metrics_serializer
            else:
                # Fall back to JSON for unknown topics
                self.produce(topic, message, key)
                return

            # Serialize and produce
            serialized_value = serializer(
                message,
                SerializationContext(topic, MessageField.VALUE)
            )

            self.producer.produce(
                topic,
                key=key.encode('utf-8') if key else None,
                value=serialized_value,
                callback=self._delivery_callback
            )
            self.producer.poll(0)

        except Exception as e:
            print(f"Avro serialization failed, falling back to JSON: {e}")
            self.produce(topic, message, key)

    def produce_google_ads_data(self, campaign_data: Dict[str, Any], user_id: str = "demo"):
        """Produce Google Ads campaign data to raw_google_ads topic"""
        message = {
            'campaign_id': str(campaign_data.get('campaign_id', '')),
            'campaign_name': str(campaign_data.get('name', campaign_data.get('campaign_name', ''))),
            'spend': float(campaign_data.get('spend', 0)),
            'clicks': int(campaign_data.get('clicks', 0)),
            'impressions': int(campaign_data.get('impressions', 0)),
            'conversions': float(campaign_data.get('conversions', 0)),
            'conversion_value': float(campaign_data.get('conversion_value', 0)),
            'user_id': user_id,
            'event_time': int(datetime.now().timestamp() * 1000)  # milliseconds
        }

        # Use Avro if Schema Registry is configured, otherwise JSON
        if self.schema_registry_client:
            self.produce_avro('raw_google_ads', message, key=message['campaign_id'])
        else:
            self.produce('raw_google_ads', message, key=message['campaign_id'])

    def flush(self, timeout: float = 10.0):
        """Flush all pending messages"""
        if not self.is_mock:
            remaining = self.producer.flush(timeout)
            if remaining > 0:
                print(f"Warning: {remaining} messages still pending after flush")
        else:
            self.producer.flush()

    def get_mock_messages(self) -> list:
        """Get all mock messages (for testing)"""
        if self.is_mock and isinstance(self.producer, MockKafkaProducer):
            return self.producer.messages
        return []


# Singleton instance
kafka_producer = KafkaProducerService()
