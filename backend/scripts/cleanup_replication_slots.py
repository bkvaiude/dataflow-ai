#!/usr/bin/env python3
"""
Cleanup Orphaned PostgreSQL Replication Slots

This script finds and drops replication slots that are no longer associated
with any active pipeline. Replication slots that aren't cleaned up prevent
new Debezium connectors from being created.

Usage:
    python cleanup_replication_slots.py              # Dry run
    python cleanup_replication_slots.py --execute    # Actually drop slots
"""

import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))


def get_active_slot_prefixes() -> set:
    """Get slot prefixes for active pipelines"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("Missing DATABASE_URL in .env")

    engine = create_engine(db_url)
    prefixes = set()

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id FROM pipelines WHERE deleted_at IS NULL
        """))

        for row in result:
            pipeline_id = str(row[0])
            unique_id = pipeline_id.replace("-", "")
            # Add possible slot name patterns
            prefixes.add(f"dataflow_{unique_id[:16]}")
            prefixes.add(f"dataflow_{pipeline_id[:8]}")

    return prefixes


def get_replication_slots() -> list:
    """Get all dataflow replication slots from PostgreSQL"""
    db_url = os.getenv('DATABASE_URL')
    engine = create_engine(db_url)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT slot_name, active, restart_lsn, confirmed_flush_lsn
            FROM pg_replication_slots
            WHERE slot_name LIKE 'dataflow_%'
            ORDER BY slot_name
        """))

        return [
            {
                'name': row[0],
                'active': row[1],
                'restart_lsn': row[2],
                'confirmed_flush_lsn': row[3]
            }
            for row in result
        ]


def drop_slot(slot_name: str) -> bool:
    """Drop a replication slot"""
    db_url = os.getenv('DATABASE_URL')
    engine = create_engine(db_url)

    try:
        with engine.connect() as conn:
            conn.execute(text(f"SELECT pg_drop_replication_slot('{slot_name}')"))
            conn.commit()
        return True
    except Exception as e:
        print(f"  Error dropping {slot_name}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Cleanup orphaned PostgreSQL replication slots")
    parser.add_argument("--execute", action="store_true", help="Actually drop slots")
    parser.add_argument("--force", action="store_true", help="Drop ALL inactive dataflow slots")
    args = parser.parse_args()

    print("=" * 60)
    print("PostgreSQL Replication Slot Cleanup")
    print("=" * 60)

    # Get all replication slots
    try:
        slots = get_replication_slots()
        print(f"✓ Found {len(slots)} dataflow replication slots")
    except Exception as e:
        print(f"✗ Failed to get replication slots: {e}")
        sys.exit(1)

    if not slots:
        print("\n✓ No dataflow replication slots found. Everything is clean!")
        return

    # Show current slots
    print("\nCurrent slots:")
    for slot in slots:
        status = "ACTIVE" if slot['active'] else "inactive"
        print(f"  [{status:8}] {slot['name']}")

    if args.force:
        # Drop all inactive slots
        orphaned = [s for s in slots if not s['active']]
        print(f"\n⚠ FORCE mode: Will drop ALL {len(orphaned)} inactive slots")
    else:
        # Get active pipeline prefixes
        try:
            active_prefixes = get_active_slot_prefixes()
            print(f"✓ Found {len(active_prefixes)} active pipeline prefixes")
        except Exception as e:
            print(f"✗ Failed to get active pipelines: {e}")
            print("  Use --force to drop ALL inactive slots")
            sys.exit(1)

        # Find orphaned slots
        orphaned = []
        for slot in slots:
            if slot['active']:
                continue  # Never drop active slots

            is_active = False
            for prefix in active_prefixes:
                if slot['name'].startswith(prefix):
                    is_active = True
                    break

            if not is_active:
                orphaned.append(slot)

    if not orphaned:
        print("\n✓ No orphaned slots found. Everything is clean!")
        return

    print(f"\n{'!' * 60}")
    print(f"Found {len(orphaned)} orphaned slots:")
    print(f"{'!' * 60}")
    for slot in orphaned:
        print(f"  - {slot['name']}")

    if not args.execute:
        print(f"\n{'=' * 60}")
        print("DRY RUN - No changes made")
        print("Run with --execute to drop these slots")
        print(f"{'=' * 60}")
        return

    # Execute deletion
    print(f"\n{'=' * 60}")
    print("EXECUTING DELETION...")
    print(f"{'=' * 60}")

    success = 0
    failed = 0

    for slot in orphaned:
        print(f"  Dropping: {slot['name']}...", end=" ")
        if drop_slot(slot['name']):
            print("✓")
            success += 1
        else:
            print("✗")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {success} dropped, {failed} failed")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
