#!/usr/bin/env python3
"""
Cleanup Orphaned Kafka Topics

This script finds and deletes Kafka topics that are no longer associated
with any active pipeline. This happens when:
- Pipeline was deleted but cleanup failed
- Topic prefix mismatch left orphaned topics
- ksqlDB created topics that weren't cleaned up

Usage:
    python cleanup_orphaned_topics.py              # Dry run (shows what would be deleted)
    python cleanup_orphaned_topics.py --execute    # Actually delete orphaned topics
    python cleanup_orphaned_topics.py --skip-db    # Delete ALL dataflow_* topics (nuclear)
"""

import os
import sys
import argparse
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from confluent_kafka.admin import AdminClient, NewTopic

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))


class KafkaClient:
    def __init__(self):
        self.bootstrap_servers = os.getenv('KAFKA_BOOTSTRAP_SERVERS')
        self.api_key = os.getenv('KAFKA_API_KEY')
        self.api_secret = os.getenv('KAFKA_API_SECRET')

        if not all([self.bootstrap_servers, self.api_key, self.api_secret]):
            raise ValueError("Missing Kafka credentials (KAFKA_BOOTSTRAP_SERVERS, KAFKA_API_KEY, KAFKA_API_SECRET) in .env")

        self.admin = AdminClient({
            'bootstrap.servers': self.bootstrap_servers,
            'security.protocol': 'SASL_SSL',
            'sasl.mechanisms': 'PLAIN',
            'sasl.username': self.api_key,
            'sasl.password': self.api_secret,
        })

    def list_topics(self) -> list:
        """List all Kafka topics"""
        metadata = self.admin.list_topics(timeout=30)
        return list(metadata.topics.keys())

    def delete_topics(self, topics: list) -> dict:
        """Delete multiple topics, returns {topic: success/error}"""
        if not topics:
            return {}

        results = {}
        futures = self.admin.delete_topics(topics, operation_timeout=30)

        for topic, future in futures.items():
            try:
                future.result()  # Wait for completion
                results[topic] = True
            except Exception as e:
                results[topic] = str(e)

        return results


class PipelineDatabase:
    def __init__(self):
        self.database_url = os.getenv('DATABASE_URL')
        if not self.database_url:
            raise ValueError("Missing DATABASE_URL in .env")

    def get_active_pipeline_prefixes(self) -> set:
        """Get all topic prefixes for active (non-deleted) pipelines"""
        from sqlalchemy import create_engine, text

        engine = create_engine(self.database_url)

        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT id FROM pipelines
                WHERE deleted_at IS NULL
            """))

            prefixes = set()
            for row in result:
                pipeline_id = str(row[0])
                unique_id = pipeline_id.replace("-", "")
                # Add both formats for compatibility
                prefixes.add(f"dataflow_{unique_id}")      # Full UUID (current)
                prefixes.add(f"dataflow_{pipeline_id[:8]}")  # Short (legacy)

            return prefixes


def categorize_topic(topic: str) -> dict:
    """Categorize a topic by type and extract metadata"""
    info = {
        'name': topic,
        'type': 'unknown',
        'prefix': None,
        'is_dataflow': False,
        'is_system': False,
    }

    # System topics
    if topic.startswith('_') or topic in ['__consumer_offsets', '__transaction_state']:
        info['type'] = 'system'
        info['is_system'] = True
        return info

    # Connect internal topics
    if topic.startswith('connect-') or topic.startswith('dataflow-connect'):
        info['type'] = 'connect-internal'
        info['is_system'] = True
        return info

    # ksqlDB internal topics
    if topic.startswith('_confluent-ksql-'):
        info['type'] = 'ksqldb-internal'
        info['is_system'] = True
        return info

    # Dataflow pipeline topics
    if topic.startswith('dataflow_'):
        info['is_dataflow'] = True

        # Extract prefix (e.g., dataflow_abc123def456...)
        match = re.match(r'(dataflow_[a-f0-9]+)', topic)
        if match:
            info['prefix'] = match.group(1)

        # Determine type
        if '.schema-history' in topic:
            info['type'] = 'schema-history'
        elif '_filtered' in topic:
            info['type'] = 'filtered-stream'
        elif '_enriched' in topic or topic.startswith('enriched_'):
            info['type'] = 'enriched'
        else:
            info['type'] = 'cdc-raw'

        return info

    # Enriched topics (legacy format)
    if topic.startswith('enriched_'):
        info['is_dataflow'] = True
        info['type'] = 'enriched'
        match = re.match(r'(enriched_[a-f0-9]+)', topic)
        if match:
            info['prefix'] = match.group(1)
        return info

    return info


def find_orphaned_topics(all_topics: list, active_prefixes: set) -> list:
    """Find dataflow topics that don't belong to any active pipeline"""
    orphaned = []

    for topic in all_topics:
        info = categorize_topic(topic)

        # Skip system topics
        if info['is_system']:
            continue

        # Only check dataflow-related topics
        if not info['is_dataflow']:
            continue

        # Check if this topic belongs to any active pipeline
        is_active = False
        if info['prefix']:
            for prefix in active_prefixes:
                if info['prefix'] == prefix or info['prefix'].startswith(prefix):
                    is_active = True
                    break

        if not is_active:
            orphaned.append(info)

    return orphaned


def main():
    parser = argparse.ArgumentParser(description="Cleanup orphaned Kafka topics")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete orphaned topics (default is dry-run)"
    )
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="Skip database check, delete ALL dataflow_* topics"
    )
    parser.add_argument(
        "--include-system",
        action="store_true",
        help="Also show system/internal topics (not deleted)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Kafka Orphaned Topic Cleanup")
    print("=" * 60)

    # Initialize Kafka client
    try:
        kafka = KafkaClient()
        print(f"✓ Connected to Kafka: {kafka.bootstrap_servers}")
    except Exception as e:
        print(f"✗ Failed to connect to Kafka: {e}")
        sys.exit(1)

    # Get all topics
    try:
        all_topics = kafka.list_topics()
        print(f"✓ Found {len(all_topics)} total topics")
    except Exception as e:
        print(f"✗ Failed to list topics: {e}")
        sys.exit(1)

    # Categorize topics
    categorized = [categorize_topic(t) for t in all_topics]
    dataflow_topics = [t for t in categorized if t['is_dataflow']]
    system_topics = [t for t in categorized if t['is_system']]

    print(f"  - {len(dataflow_topics)} dataflow-related topics")
    print(f"  - {len(system_topics)} system/internal topics")

    if args.include_system:
        print("\nSystem topics (not deleted):")
        for t in system_topics:
            print(f"  [{t['type']}] {t['name']}")

    if args.skip_db:
        orphaned = dataflow_topics
        print(f"\n⚠ SKIP-DB mode: Will delete ALL {len(orphaned)} dataflow topics")
    else:
        # Get active pipeline prefixes from database
        try:
            db = PipelineDatabase()
            active_prefixes = db.get_active_pipeline_prefixes()
            print(f"✓ Found {len(active_prefixes)} active pipeline prefixes")
        except Exception as e:
            print(f"✗ Failed to connect to database: {e}")
            print("  Use --skip-db to delete ALL dataflow topics without database check")
            sys.exit(1)

        # Find orphaned topics
        orphaned = find_orphaned_topics(all_topics, active_prefixes)

    if not orphaned:
        print("\n✓ No orphaned topics found. Everything is clean!")
        return

    print(f"\n{'!' * 60}")
    print(f"Found {len(orphaned)} orphaned topics:")
    print(f"{'!' * 60}")

    # Group by prefix for readability
    grouped = {}
    for topic in orphaned:
        prefix = topic['prefix'] or 'unknown'
        if prefix not in grouped:
            grouped[prefix] = []
        grouped[prefix].append(topic)

    for prefix, topics in sorted(grouped.items()):
        print(f"\n  {prefix}:")
        for t in topics:
            print(f"    [{t['type']:15}] {t['name']}")

    if not args.execute:
        print(f"\n{'=' * 60}")
        print("DRY RUN - No changes made")
        print("Run with --execute to delete these topics")
        print(f"{'=' * 60}")
        return

    # Execute deletion
    print(f"\n{'=' * 60}")
    print("EXECUTING DELETION...")
    print(f"{'=' * 60}")

    topic_names = [t['name'] for t in orphaned]
    results = kafka.delete_topics(topic_names)

    success = 0
    failed = 0

    for topic, result in results.items():
        if result is True:
            print(f"  ✓ Deleted: {topic}")
            success += 1
        else:
            print(f"  ✗ Failed: {topic} - {result}")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {success} deleted, {failed} failed")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
