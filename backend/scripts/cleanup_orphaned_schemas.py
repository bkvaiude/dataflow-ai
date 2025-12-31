#!/usr/bin/env python3
"""
Cleanup Orphaned Schema Registry Subjects

This script finds and deletes schema subjects that are no longer associated
with any active pipeline. This happens when:
- Pipeline was deleted but cleanup failed
- Topic prefix mismatch left orphaned schemas
- ksqlDB created schemas that weren't cleaned up

Usage:
    python cleanup_orphaned_schemas.py          # Dry run (shows what would be deleted)
    python cleanup_orphaned_schemas.py --execute  # Actually delete orphaned schemas
"""

import os
import sys
import argparse
import requests
from requests.auth import HTTPBasicAuth

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))


class SchemaRegistryClient:
    def __init__(self):
        self.url = os.getenv('SCHEMA_REGISTRY_URL')
        self.key = os.getenv('SCHEMA_REGISTRY_API_KEY')
        self.secret = os.getenv('SCHEMA_REGISTRY_API_SECRET')

        if not all([self.url, self.key, self.secret]):
            raise ValueError("Missing Schema Registry credentials in .env")

        self.auth = HTTPBasicAuth(self.key, self.secret)

    def list_subjects(self) -> list:
        """List all schema subjects"""
        response = requests.get(f"{self.url}/subjects", auth=self.auth)
        response.raise_for_status()
        return response.json()

    def delete_subject(self, subject: str, permanent: bool = True) -> bool:
        """Delete a schema subject (soft delete, then hard delete if permanent)"""
        try:
            # Soft delete first
            response = requests.delete(f"{self.url}/subjects/{subject}", auth=self.auth)
            response.raise_for_status()

            if permanent:
                # Hard delete
                response = requests.delete(
                    f"{self.url}/subjects/{subject}?permanent=true",
                    auth=self.auth
                )
                response.raise_for_status()

            return True
        except Exception as e:
            print(f"  Error deleting {subject}: {e}")
            return False


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
            # Get all active pipeline IDs
            result = conn.execute(text("""
                SELECT id FROM pipelines
                WHERE deleted_at IS NULL
            """))

            prefixes = set()
            for row in result:
                pipeline_id = str(row[0])
                # Generate both possible prefix formats for compatibility
                unique_id = pipeline_id.replace("-", "")
                prefixes.add(f"dataflow_{unique_id}")  # Full UUID (current format)
                prefixes.add(f"dataflow_{pipeline_id[:8]}")  # Short format (legacy)

            return prefixes


def find_orphaned_subjects(all_subjects: list, active_prefixes: set) -> list:
    """Find subjects that don't belong to any active pipeline"""
    orphaned = []

    for subject in all_subjects:
        # Only check dataflow-related subjects
        if not subject.startswith("dataflow_"):
            continue

        # Check if this subject belongs to any active pipeline
        is_active = False
        for prefix in active_prefixes:
            if subject.startswith(prefix):
                is_active = True
                break

        if not is_active:
            orphaned.append(subject)

    return orphaned


def main():
    parser = argparse.ArgumentParser(description="Cleanup orphaned Schema Registry subjects")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete orphaned schemas (default is dry-run)"
    )
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="Skip database check, delete ALL dataflow_* subjects"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Schema Registry Orphaned Subject Cleanup")
    print("=" * 60)

    # Initialize Schema Registry client
    try:
        sr_client = SchemaRegistryClient()
        print(f"✓ Connected to Schema Registry: {sr_client.url}")
    except Exception as e:
        print(f"✗ Failed to connect to Schema Registry: {e}")
        sys.exit(1)

    # Get all subjects
    try:
        all_subjects = sr_client.list_subjects()
        dataflow_subjects = [s for s in all_subjects if s.startswith("dataflow_")]
        print(f"✓ Found {len(all_subjects)} total subjects, {len(dataflow_subjects)} dataflow-related")
    except Exception as e:
        print(f"✗ Failed to list subjects: {e}")
        sys.exit(1)

    if args.skip_db:
        # Delete ALL dataflow subjects (nuclear option)
        orphaned = dataflow_subjects
        print(f"\n⚠ SKIP-DB mode: Will delete ALL {len(orphaned)} dataflow subjects")
    else:
        # Get active pipeline prefixes from database
        try:
            db = PipelineDatabase()
            active_prefixes = db.get_active_pipeline_prefixes()
            print(f"✓ Found {len(active_prefixes)} active pipeline prefixes")
        except Exception as e:
            print(f"✗ Failed to connect to database: {e}")
            print("  Use --skip-db to delete ALL dataflow subjects without database check")
            sys.exit(1)

        # Find orphaned subjects
        orphaned = find_orphaned_subjects(all_subjects, active_prefixes)

    if not orphaned:
        print("\n✓ No orphaned subjects found. Everything is clean!")
        return

    print(f"\n{'!' * 60}")
    print(f"Found {len(orphaned)} orphaned subjects:")
    print(f"{'!' * 60}")

    # Group by pipeline prefix for readability
    grouped = {}
    for subject in orphaned:
        # Extract prefix (e.g., dataflow_abc123...)
        parts = subject.split(".")
        prefix = parts[0] if parts else subject
        if prefix not in grouped:
            grouped[prefix] = []
        grouped[prefix].append(subject)

    for prefix, subjects in sorted(grouped.items()):
        print(f"\n  {prefix}:")
        for s in subjects:
            print(f"    - {s}")

    if not args.execute:
        print(f"\n{'=' * 60}")
        print("DRY RUN - No changes made")
        print("Run with --execute to delete these subjects")
        print(f"{'=' * 60}")
        return

    # Execute deletion
    print(f"\n{'=' * 60}")
    print("EXECUTING DELETION...")
    print(f"{'=' * 60}")

    success = 0
    failed = 0

    for subject in orphaned:
        print(f"  Deleting: {subject}...", end=" ")
        if sr_client.delete_subject(subject):
            print("✓")
            success += 1
        else:
            print("✗")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {success} deleted, {failed} failed")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
