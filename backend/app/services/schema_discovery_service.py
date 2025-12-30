"""
Schema Discovery Service
Connects to PostgreSQL databases and extracts schema metadata.
"""

import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime


class SchemaDiscoveryService:
    """Discovers database schema from PostgreSQL sources."""

    def __init__(self):
        self._db_session = None

    def _get_session(self):
        """Get database session"""
        from app.services.db_service import db_service
        return db_service._get_session()

    def discover(
        self,
        user_id: str,
        credential_id: str,
        schema_filter: str = "public",
        include_row_counts: bool = False,
        table_filter: List[str] = None
    ) -> Dict[str, Any]:
        """
        Discover schema from a PostgreSQL database

        Args:
            user_id: User ID
            credential_id: ID of stored credentials
            schema_filter: Database schema to discover (default 'public')
            include_row_counts: Whether to estimate row counts (slower)
            table_filter: List of table names to discover (None = all tables)

        Returns:
            Dictionary with discovered schema metadata and CDC eligibility
        """
        from app.services.credential_service import credential_service
        import psycopg2

        # Get decrypted credentials
        cred_data = credential_service.get_decrypted_credentials(user_id, credential_id)
        if not cred_data:
            raise ValueError(f"Credential {credential_id} not found")

        credentials = cred_data['credentials']

        # Connect to PostgreSQL
        try:
            conn = psycopg2.connect(
                host=credentials.get('host'),
                port=credentials.get('port', 5432),
                database=credentials.get('database'),
                user=credentials.get('username'),
                password=credentials.get('password'),
                connect_timeout=10
            )

            # Discover tables
            tables = self._discover_tables(conn, schema_filter, table_filter)

            # Discover detailed metadata for each table
            discovered_tables = []
            for table in tables:
                table_name = table['table_name']

                # Discover columns
                columns = self._discover_columns(conn, schema_filter, table_name)

                # Discover primary keys
                primary_keys = self._discover_primary_keys(conn, schema_filter, table_name)

                # Discover foreign keys
                foreign_keys = self._discover_foreign_keys(conn, schema_filter, table_name)

                # Get row count estimate if requested
                row_count = None
                if include_row_counts:
                    row_count = self._estimate_row_count(conn, schema_filter, table_name)

                # Get table size
                table_size = self._get_table_size(conn, schema_filter, table_name)

                # Check CDC eligibility
                has_primary_key = len(primary_keys) > 0
                cdc_eligible = has_primary_key
                cdc_issues = []

                if not has_primary_key:
                    cdc_issues.append("Missing primary key - required for CDC")

                # Check REPLICA IDENTITY (needed for proper CDC)
                replica_identity = self._check_replica_identity(conn, schema_filter, table_name)
                if replica_identity not in ['FULL', 'INDEX', 'DEFAULT']:
                    cdc_issues.append(f"REPLICA IDENTITY is {replica_identity} - consider setting to FULL or INDEX")

                discovered_table = {
                    'schema_name': schema_filter,
                    'table_name': table_name,
                    'columns': columns,
                    'primary_keys': primary_keys,
                    'foreign_keys': foreign_keys,
                    'row_count_estimate': row_count,
                    'table_size_bytes': table_size,
                    'has_primary_key': has_primary_key,
                    'cdc_eligible': cdc_eligible,
                    'cdc_issues': cdc_issues,
                    'replica_identity': replica_identity
                }

                discovered_tables.append(discovered_table)

                # Store in database
                self._store_discovered_schema(
                    user_id=user_id,
                    credential_id=credential_id,
                    table_data=discovered_table
                )

            conn.close()

            # Build relationship graph
            relationship_graph = self._build_relationship_graph(discovered_tables)

            print(f"[SCHEMA_DISCOVERY] Discovered {len(discovered_tables)} tables in schema '{schema_filter}'")

            return {
                'credential_id': credential_id,
                'schema_name': schema_filter,
                'tables': discovered_tables,
                'table_count': len(discovered_tables),
                'relationship_graph': relationship_graph,
                'discovered_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            raise Exception(f"Schema discovery failed: {str(e)}")

    def _discover_tables(self, conn, schema: str, table_filter: List[str] = None) -> List[Dict]:
        """Query information_schema.tables"""
        cursor = conn.cursor()

        query = """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type = 'BASE TABLE'
        """

        if table_filter:
            placeholders = ','.join(['%s'] * len(table_filter))
            query += f" AND table_name IN ({placeholders})"
            cursor.execute(query, [schema] + table_filter)
        else:
            cursor.execute(query, [schema])

        tables = [{'table_name': row[0]} for row in cursor.fetchall()]
        cursor.close()

        return tables

    def _discover_columns(self, conn, schema: str, table: str) -> List[Dict]:
        """Query information_schema.columns"""
        cursor = conn.cursor()

        query = """
            SELECT
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = %s
            ORDER BY ordinal_position
        """

        cursor.execute(query, [schema, table])

        columns = []
        for row in cursor.fetchall():
            columns.append({
                'column_name': row[0],
                'data_type': row[1],
                'is_nullable': row[2] == 'YES',
                'column_default': row[3],
                'character_maximum_length': row[4],
                'numeric_precision': row[5],
                'numeric_scale': row[6]
            })

        cursor.close()
        return columns

    def _discover_primary_keys(self, conn, schema: str, table: str) -> List[str]:
        """Query pg_index for primary keys"""
        cursor = conn.cursor()

        query = """
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid
                AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = (%s || '.' || %s)::regclass
              AND i.indisprimary
            ORDER BY a.attnum
        """

        cursor.execute(query, [schema, table])
        primary_keys = [row[0] for row in cursor.fetchall()]
        cursor.close()

        return primary_keys

    def _discover_foreign_keys(self, conn, schema: str, table: str) -> List[Dict]:
        """Query information_schema.table_constraints for foreign keys"""
        cursor = conn.cursor()

        query = """
            SELECT
                kcu.column_name,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = %s
              AND tc.table_name = %s
        """

        cursor.execute(query, [schema, table])

        foreign_keys = []
        for row in cursor.fetchall():
            foreign_keys.append({
                'column_name': row[0],
                'foreign_table_schema': row[1],
                'foreign_table_name': row[2],
                'foreign_column_name': row[3],
                'constraint_name': row[4]
            })

        cursor.close()
        return foreign_keys

    def _estimate_row_count(self, conn, schema: str, table: str) -> int:
        """Query pg_stat_user_tables for row estimate"""
        cursor = conn.cursor()

        query = """
            SELECT n_live_tup
            FROM pg_stat_user_tables
            WHERE schemaname = %s
              AND relname = %s
        """

        cursor.execute(query, [schema, table])
        result = cursor.fetchone()
        cursor.close()

        return result[0] if result and result[0] is not None else 0

    def _get_table_size(self, conn, schema: str, table: str) -> int:
        """Query pg_total_relation_size"""
        cursor = conn.cursor()

        query = """
            SELECT pg_total_relation_size(%s || '.' || %s)
        """

        cursor.execute(query, [schema, table])
        result = cursor.fetchone()
        cursor.close()

        return result[0] if result and result[0] is not None else 0

    def _check_replica_identity(self, conn, schema: str, table: str) -> str:
        """Check table's REPLICA IDENTITY setting"""
        cursor = conn.cursor()

        query = """
            SELECT relreplident
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = %s
              AND c.relname = %s
        """

        cursor.execute(query, [schema, table])
        result = cursor.fetchone()
        cursor.close()

        if result:
            replica_identity_map = {
                'd': 'DEFAULT',
                'n': 'NOTHING',
                'f': 'FULL',
                'i': 'INDEX'
            }
            return replica_identity_map.get(result[0], 'UNKNOWN')

        return 'UNKNOWN'

    def _build_relationship_graph(self, tables: List[Dict]) -> Dict:
        """Build nodes/edges graph from FK relationships"""
        nodes = []
        edges = []

        for table in tables:
            # Add node for each table
            nodes.append({
                'id': f"{table['schema_name']}.{table['table_name']}",
                'label': table['table_name'],
                'schema': table['schema_name'],
                'has_primary_key': table['has_primary_key'],
                'cdc_eligible': table['cdc_eligible']
            })

            # Add edges for foreign keys
            for fk in table.get('foreign_keys', []):
                edges.append({
                    'from': f"{table['schema_name']}.{table['table_name']}",
                    'to': f"{fk['foreign_table_schema']}.{fk['foreign_table_name']}",
                    'label': fk['column_name'],
                    'constraint': fk['constraint_name']
                })

        return {
            'nodes': nodes,
            'edges': edges
        }

    def _store_discovered_schema(
        self,
        user_id: str,
        credential_id: str,
        table_data: Dict[str, Any]
    ):
        """Save to DiscoveredSchema model in database"""
        from app.db.models import DiscoveredSchema

        session = self._get_session()
        try:
            # Check if already exists
            existing = session.query(DiscoveredSchema).filter(
                DiscoveredSchema.credential_id == credential_id,
                DiscoveredSchema.schema_name == table_data['schema_name'],
                DiscoveredSchema.table_name == table_data['table_name']
            ).first()

            if existing:
                # Update existing
                existing.columns = table_data['columns']
                existing.primary_keys = table_data['primary_keys']
                existing.foreign_keys = table_data['foreign_keys']
                existing.row_count_estimate = table_data.get('row_count_estimate')
                existing.has_primary_key = table_data['has_primary_key']
                existing.cdc_eligible = table_data['cdc_eligible']
                existing.cdc_issues = table_data.get('cdc_issues', [])
                existing.updated_at = datetime.utcnow()
            else:
                # Create new
                schema_id = str(uuid.uuid4())
                discovered_schema = DiscoveredSchema(
                    id=schema_id,
                    credential_id=credential_id,
                    user_id=user_id,
                    schema_name=table_data['schema_name'],
                    table_name=table_data['table_name'],
                    columns=table_data['columns'],
                    primary_keys=table_data['primary_keys'],
                    foreign_keys=table_data['foreign_keys'],
                    row_count_estimate=table_data.get('row_count_estimate'),
                    has_primary_key=table_data['has_primary_key'],
                    cdc_eligible=table_data['cdc_eligible'],
                    cdc_issues=table_data.get('cdc_issues', [])
                )
                session.add(discovered_schema)

            session.commit()

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def get_discovered_schemas(
        self,
        user_id: str,
        credential_id: str
    ) -> List[Dict[str, Any]]:
        """
        Retrieve previously discovered schemas from database

        Args:
            user_id: User ID
            credential_id: Credential ID

        Returns:
            List of discovered schemas
        """
        from app.db.models import DiscoveredSchema

        session = self._get_session()
        try:
            schemas = session.query(DiscoveredSchema).filter(
                DiscoveredSchema.credential_id == credential_id,
                DiscoveredSchema.user_id == user_id
            ).all()

            return [s.to_dict() for s in schemas]

        finally:
            session.close()


    def get_filter_preview(
        self,
        user_id: str,
        credential_id: str,
        schema_name: str,
        table_name: str,
        filter_sql: str,
        limit: int = 5
    ) -> Dict[str, Any]:
        """
        Get preview data for a filter - count matching rows and sample data.

        Args:
            user_id: User ID
            credential_id: ID of stored credentials
            schema_name: Database schema (e.g., 'public')
            table_name: Table name
            filter_sql: SQL WHERE clause (without 'WHERE' keyword)
            limit: Number of sample rows to return

        Returns:
            Dictionary with filtered_count and sample_data
        """
        from app.services.credential_service import credential_service
        import psycopg2
        import psycopg2.extras

        # Get decrypted credentials
        cred_data = credential_service.get_decrypted_credentials(user_id, credential_id)
        if not cred_data:
            raise ValueError(f"Credential {credential_id} not found")

        credentials = cred_data['credentials']

        try:
            conn = psycopg2.connect(
                host=credentials.get('host'),
                port=credentials.get('port', 5432),
                database=credentials.get('database'),
                user=credentials.get('username'),
                password=credentials.get('password'),
                connect_timeout=10
            )

            # Get filtered count
            count_query = f"""
                SELECT COUNT(*)
                FROM "{schema_name}"."{table_name}"
                WHERE {filter_sql}
            """
            cursor = conn.cursor()
            cursor.execute(count_query)
            filtered_count = cursor.fetchone()[0]
            cursor.close()

            # Get sample data (use RealDictCursor for dict results)
            sample_query = f"""
                SELECT *
                FROM "{schema_name}"."{table_name}"
                WHERE {filter_sql}
                LIMIT {limit}
            """
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute(sample_query)
            sample_data = [dict(row) for row in cursor.fetchall()]
            cursor.close()

            # Convert non-JSON-serializable types
            for row in sample_data:
                for key, value in row.items():
                    if hasattr(value, 'isoformat'):  # datetime objects
                        row[key] = value.isoformat()
                    elif isinstance(value, (bytes, bytearray)):
                        row[key] = value.decode('utf-8', errors='replace')

            conn.close()

            print(f"[FILTER_PREVIEW] Filter '{filter_sql}' matches {filtered_count} rows")

            return {
                'filtered_count': filtered_count,
                'sample_data': sample_data
            }

        except Exception as e:
            print(f"[FILTER_PREVIEW] Error: {str(e)}")
            # Return zeros on error but don't fail
            return {
                'filtered_count': 0,
                'sample_data': [],
                'error': str(e)
            }


# Singleton instance
schema_discovery_service = SchemaDiscoveryService()
