"""
Metrics Processor Service
Consumes raw campaign data from Kafka, calculates ROAS/CPC/CTR, and produces processed metrics.
This is a Python-based alternative to Apache Flink for simpler deployments.
"""

import json
import os
import threading
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.config import settings


class MetricsProcessor:
    """
    Real-time metrics processor that:
    1. Consumes from raw_google_ads topic
    2. Calculates ROAS, CPC, CTR
    3. Produces to processed_metrics topic
    """

    def __init__(self):
        self.is_running = False
        self.consumer = None
        self.producer = None
        self.avro_deserializer = None
        self.processed_count = 0
        self.last_processed_at: Optional[str] = None
        self.recent_metrics: List[Dict[str, Any]] = []
        self._thread: Optional[threading.Thread] = None

        if settings.use_mock_kafka:
            print("MetricsProcessor: Mock mode (no Kafka credentials)")
        else:
            self._init_kafka()

    def _init_kafka(self):
        """Initialize Kafka consumer and producer with Avro support"""
        try:
            from confluent_kafka import Consumer, Producer

            # Consumer config
            consumer_config = {
                'bootstrap.servers': settings.kafka_bootstrap_servers,
                'security.protocol': 'SASL_SSL',
                'sasl.mechanisms': 'PLAIN',
                'sasl.username': settings.kafka_api_key,
                'sasl.password': settings.kafka_api_secret,
                'group.id': 'metrics-processor',
                'auto.offset.reset': 'earliest',
                'enable.auto.commit': True,
            }

            # Producer config
            producer_config = {
                'bootstrap.servers': settings.kafka_bootstrap_servers,
                'security.protocol': 'SASL_SSL',
                'sasl.mechanisms': 'PLAIN',
                'sasl.username': settings.kafka_api_key,
                'sasl.password': settings.kafka_api_secret,
                'acks': 'all',
            }

            self.consumer = Consumer(consumer_config)
            self.producer = Producer(producer_config)

            # Initialize Avro deserializer if Schema Registry is configured
            if settings.has_schema_registry_credentials:
                self._init_avro_deserializer()

            print("MetricsProcessor: Kafka initialized")

        except Exception as e:
            print(f"MetricsProcessor: Failed to initialize Kafka: {e}")
            self.consumer = None
            self.producer = None

    def _init_avro_deserializer(self):
        """Initialize Avro deserializer for raw_google_ads topic"""
        try:
            from confluent_kafka.schema_registry import SchemaRegistryClient
            from confluent_kafka.schema_registry.avro import AvroDeserializer

            sr_config = {
                'url': settings.schema_registry_url,
                'basic.auth.user.info': f'{settings.schema_registry_api_key}:{settings.schema_registry_api_secret}'
            }

            schema_registry_client = SchemaRegistryClient(sr_config)

            # Load schema
            schema_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'schemas')
            with open(os.path.join(schema_dir, 'raw_google_ads.avsc'), 'r') as f:
                schema_str = f.read()

            self.avro_deserializer = AvroDeserializer(
                schema_registry_client,
                schema_str,
                from_dict=lambda obj, ctx: obj
            )
            print("MetricsProcessor: Avro deserializer initialized")

        except Exception as e:
            print(f"MetricsProcessor: Failed to initialize Avro deserializer: {e}")
            self.avro_deserializer = None

    def calculate_metrics(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate ROAS, CPC, CTR from raw campaign data"""
        spend = float(raw_data.get('spend', 0))
        clicks = int(raw_data.get('clicks', 0))
        impressions = int(raw_data.get('impressions', 0))
        conversions = float(raw_data.get('conversions', 0))
        conversion_value = float(raw_data.get('conversion_value', 0))

        # Calculate metrics
        roas = round(conversion_value / spend, 2) if spend > 0 else 0
        cpc = round(spend / clicks, 2) if clicks > 0 else 0
        ctr = round((clicks / impressions) * 100, 2) if impressions > 0 else 0

        return {
            'campaign_id': raw_data.get('campaign_id', ''),
            'campaign_name': raw_data.get('campaign_name', raw_data.get('name', '')),
            'window_start': int(datetime.now().timestamp() * 1000),
            'window_end': int(datetime.now().timestamp() * 1000),
            'total_spend': spend,
            'total_clicks': clicks,
            'total_impressions': impressions,
            'total_conversions': conversions,
            'total_revenue': conversion_value,
            'roas': roas,
            'cpc': cpc,
            'ctr': ctr,
            'user_id': raw_data.get('user_id', 'unknown'),
            'processed_at': datetime.now().isoformat(),
        }

    def process_message(self, raw_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process a single message and produce to output topic"""
        try:
            metrics = self.calculate_metrics(raw_data)

            if self.producer:
                self.producer.produce(
                    'processed_metrics',
                    key=metrics['campaign_id'].encode('utf-8'),
                    value=json.dumps(metrics).encode('utf-8'),
                )
                self.producer.poll(0)

            # Track for visibility
            self.processed_count += 1
            self.last_processed_at = datetime.now().isoformat()
            self.recent_metrics.append(metrics)
            self.recent_metrics = self.recent_metrics[-50:]  # Keep last 50

            print(f"[PROCESSOR] Processed campaign {metrics['campaign_name']}: ROAS={metrics['roas']}x")
            return metrics

        except Exception as e:
            print(f"[PROCESSOR] Error processing message: {e}")
            return None

    def _deserialize_message(self, msg_value: bytes) -> Optional[Dict[str, Any]]:
        """Deserialize message value (Avro or JSON)"""
        if not msg_value:
            return None

        # Try Avro deserialization first if available
        if self.avro_deserializer:
            try:
                from confluent_kafka.serialization import SerializationContext, MessageField
                return self.avro_deserializer(
                    msg_value,
                    SerializationContext('raw_google_ads', MessageField.VALUE)
                )
            except Exception as e:
                print(f"[PROCESSOR] Avro deserialize failed, trying JSON: {e}")

        # Fall back to JSON
        try:
            return json.loads(msg_value.decode('utf-8'))
        except Exception as e:
            print(f"[PROCESSOR] JSON deserialize failed: {e}")
            return None

    def _run_loop(self):
        """Main processing loop"""
        if not self.consumer:
            print("[PROCESSOR] No consumer, cannot start loop")
            return

        self.consumer.subscribe(['raw_google_ads'])
        print("[PROCESSOR] Started consuming from raw_google_ads")

        while self.is_running:
            try:
                msg = self.consumer.poll(1.0)
                if msg is None:
                    continue
                if msg.error():
                    print(f"[PROCESSOR] Consumer error: {msg.error()}")
                    continue

                # Deserialize and process
                raw_data = self._deserialize_message(msg.value())
                if raw_data:
                    self.process_message(raw_data)

            except Exception as e:
                print(f"[PROCESSOR] Loop error: {e}")
                time.sleep(1)

        self.consumer.close()
        print("[PROCESSOR] Stopped")

    def start(self):
        """Start the processor in a background thread"""
        if self.is_running:
            return

        if not self.consumer:
            print("[PROCESSOR] Cannot start - no Kafka consumer")
            return

        self.is_running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print("[PROCESSOR] Background processor started")

    def stop(self):
        """Stop the processor"""
        self.is_running = False
        if self._thread:
            self._thread.join(timeout=5)
        print("[PROCESSOR] Stopped")

    def get_status(self) -> Dict[str, Any]:
        """Get processor status for visibility"""
        return {
            'running': self.is_running,
            'kafka_connected': self.consumer is not None,
            'processed_count': self.processed_count,
            'last_processed_at': self.last_processed_at,
            'recent_metrics_count': len(self.recent_metrics),
            'mode': 'mock' if settings.use_mock_kafka else 'real',
        }

    def get_recent_metrics(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recently processed metrics"""
        return self.recent_metrics[-limit:]


# Singleton instance
metrics_processor = MetricsProcessor()
