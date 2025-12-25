"""
CDC Readiness Service
Validates PostgreSQL configuration for logical replication.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime


PROVIDER_INSTRUCTIONS = {
    "aws_rds": {
        "name": "AWS RDS PostgreSQL",
        "wal_level": "Create a new parameter group with rds.logical_replication = 1, attach to instance, and reboot",
        "replication_privilege": "Grant rds_replication role: GRANT rds_replication TO your_user;",
        "docs_url": "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html#PostgreSQL.Concepts.General.FeatureSupport.LogicalReplication"
    },
    "supabase": {
        "name": "Supabase PostgreSQL",
        "wal_level": "Logical replication is enabled by default on Supabase",
        "replication_privilege": "Use dashboard to grant replication privileges or contact support",
        "docs_url": "https://supabase.com/docs/guides/database/replication"
    },
    "cloud_sql": {
        "name": "Google Cloud SQL PostgreSQL",
        "wal_level": "Set cloudsql.logical_decoding = on in instance flags and restart",
        "replication_privilege": "ALTER USER your_user REPLICATION;",
        "docs_url": "https://cloud.google.com/sql/docs/postgres/replication/configure-logical-replication"
    },
    "azure_database": {
        "name": "Azure Database for PostgreSQL",
        "wal_level": "Set azure.replication_support = logical in server parameters and restart",
        "replication_privilege": "GRANT pg_read_all_settings TO your_user; ALTER USER your_user REPLICATION;",
        "docs_url": "https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-logical"
    },
    "self_hosted": {
        "name": "Self-Hosted PostgreSQL",
        "wal_level": "Set wal_level = logical in postgresql.conf and restart",
        "replication_privilege": "ALTER USER your_user REPLICATION;",
        "docs_url": "https://www.postgresql.org/docs/current/logical-replication.html"
    }
}


class CDCReadinessService:
    """Validates PostgreSQL database is ready for CDC"""

    def check_readiness(
        self,
        user_id: str,
        credential_id: str,
        tables: List[str] = None
    ) -> Dict[str, Any]:
        """
        Main method - returns comprehensive readiness report

        Args:
            user_id: User ID
            credential_id: ID of stored credentials
            tables: List of fully qualified table names (e.g., ['public.users', 'public.orders'])

        Returns:
            Dictionary with readiness status, checks, and recommendations
        """
        from app.services.credential_service import credential_service
        import psycopg2

        # Get decrypted credentials
        cred_data = credential_service.get_decrypted_credentials(user_id, credential_id)
        if not cred_data:
            raise ValueError(f"Credential {credential_id} not found")

        credentials = cred_data['credentials']
        username = credentials.get('username')

        # Connect to PostgreSQL
        try:
            conn = psycopg2.connect(
                host=credentials.get('host'),
                port=credentials.get('port', 5432),
                database=credentials.get('database'),
                user=username,
                password=credentials.get('password'),
                connect_timeout=10
            )

            # Detect provider
            provider = self._detect_provider(conn)

            # Get PostgreSQL version
            server_version = self._get_server_version(conn)

            # Run all checks
            checks = {
                'wal_level': self._check_wal_level(conn, provider),
                'replication_privilege': self._check_replication_privilege(conn, username),
                'replication_slots': self._check_replication_slots(conn),
                'wal_senders': self._check_wal_senders(conn),
                'server_version': {
                    'passed': True,
                    'value': server_version,
                    'message': f"PostgreSQL {server_version}"
                }
            }

            # Check individual tables if specified
            table_checks = []
            if tables:
                for table_name in tables:
                    # Parse schema.table
                    if '.' in table_name:
                        schema, table = table_name.split('.', 1)
                    else:
                        schema = 'public'
                        table = table_name

                    table_check = self._check_table_readiness(conn, schema, table)
                    table_check['table_name'] = f"{schema}.{table}"
                    table_checks.append(table_check)

            conn.close()

            # Determine overall readiness
            critical_checks = [
                checks['wal_level']['passed'],
                checks['replication_privilege']['passed']
            ]
            overall_ready = all(critical_checks)

            # Build recommendations
            recommendations = self._build_recommendations(checks, provider, table_checks)

            result = {
                'overall_ready': overall_ready,
                'provider': provider,
                'provider_name': PROVIDER_INSTRUCTIONS[provider]['name'],
                'server_version': server_version,
                'checks': checks,
                'table_checks': table_checks,
                'recommendations': recommendations,
                'checked_at': datetime.utcnow().isoformat()
            }

            print(f"[CDC_READINESS] Checked readiness for credential {credential_id}: {'READY' if overall_ready else 'NOT READY'}")

            return result

        except Exception as e:
            raise Exception(f"CDC readiness check failed: {str(e)}")

    def _detect_provider(self, conn) -> str:
        """Detect AWS RDS, Supabase, Cloud SQL, Azure, or self-hosted"""
        cursor = conn.cursor()

        # Check for provider-specific settings or extensions
        cursor.execute("SELECT version()")
        version_string = cursor.fetchone()[0].lower()

        # Check for RDS
        cursor.execute("""
            SELECT COUNT(*) FROM pg_settings
            WHERE name LIKE 'rds.%'
        """)
        has_rds_settings = cursor.fetchone()[0] > 0

        # Check for Cloud SQL
        cursor.execute("""
            SELECT COUNT(*) FROM pg_settings
            WHERE name LIKE 'cloudsql.%'
        """)
        has_cloudsql_settings = cursor.fetchone()[0] > 0

        # Check for Azure
        cursor.execute("""
            SELECT COUNT(*) FROM pg_settings
            WHERE name LIKE 'azure.%'
        """)
        has_azure_settings = cursor.fetchone()[0] > 0

        cursor.close()

        # Detect provider
        if has_rds_settings:
            # Check if it's Supabase (which uses RDS)
            if 'supabase' in version_string:
                return 'supabase'
            return 'aws_rds'
        elif has_cloudsql_settings:
            return 'cloud_sql'
        elif has_azure_settings:
            return 'azure_database'
        else:
            return 'self_hosted'

    def _get_server_version(self, conn) -> str:
        """Get PostgreSQL version"""
        cursor = conn.cursor()
        cursor.execute("SHOW server_version")
        version = cursor.fetchone()[0]
        cursor.close()
        return version

    def _check_wal_level(self, conn, provider: str) -> Dict[str, Any]:
        """Check SHOW wal_level - must be 'logical'"""
        cursor = conn.cursor()
        cursor.execute("SHOW wal_level")
        wal_level = cursor.fetchone()[0]
        cursor.close()

        passed = wal_level == 'logical'

        result = {
            'passed': passed,
            'value': wal_level,
            'required': 'logical',
            'message': f"WAL level is '{wal_level}'" + (" ✓" if passed else " - needs to be 'logical'")
        }

        if not passed:
            result['fix_instruction'] = PROVIDER_INSTRUCTIONS[provider]['wal_level']
            result['docs_url'] = PROVIDER_INSTRUCTIONS[provider]['docs_url']

        return result

    def _check_replication_privilege(self, conn, username: str) -> Dict[str, Any]:
        """Check pg_roles.rolreplication"""
        cursor = conn.cursor()

        cursor.execute("""
            SELECT rolreplication
            FROM pg_roles
            WHERE rolname = %s
        """, [username])

        result_row = cursor.fetchone()
        cursor.close()

        has_privilege = result_row and result_row[0]

        result = {
            'passed': has_privilege,
            'value': has_privilege,
            'message': f"User '{username}' {'has' if has_privilege else 'does not have'} replication privilege"
        }

        if not has_privilege:
            # Detect provider to give correct instructions
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM pg_settings WHERE name LIKE 'rds.%'")
            is_rds = cursor.fetchone()[0] > 0
            cursor.close()

            provider = 'aws_rds' if is_rds else 'self_hosted'
            result['fix_instruction'] = PROVIDER_INSTRUCTIONS[provider]['replication_privilege']

        return result

    def _check_replication_slots(self, conn) -> Dict[str, Any]:
        """Check max_replication_slots and available slots"""
        cursor = conn.cursor()

        # Get max replication slots
        cursor.execute("SHOW max_replication_slots")
        max_slots = int(cursor.fetchone()[0])

        # Get current slots in use
        cursor.execute("SELECT COUNT(*) FROM pg_replication_slots")
        used_slots = cursor.fetchone()[0]

        cursor.close()

        available_slots = max_slots - used_slots
        passed = available_slots > 0

        result = {
            'passed': passed,
            'max_slots': max_slots,
            'used_slots': used_slots,
            'available_slots': available_slots,
            'message': f"{available_slots} replication slots available (out of {max_slots})"
        }

        if not passed:
            result['fix_instruction'] = "Increase max_replication_slots in PostgreSQL configuration or remove unused replication slots"

        return result

    def _check_wal_senders(self, conn) -> Dict[str, Any]:
        """Check max_wal_senders"""
        cursor = conn.cursor()

        cursor.execute("SHOW max_wal_senders")
        max_wal_senders = int(cursor.fetchone()[0])

        # Get current WAL senders
        cursor.execute("SELECT COUNT(*) FROM pg_stat_replication")
        active_senders = cursor.fetchone()[0]

        cursor.close()

        available_senders = max_wal_senders - active_senders
        passed = available_senders > 0

        result = {
            'passed': passed,
            'max_senders': max_wal_senders,
            'active_senders': active_senders,
            'available_senders': available_senders,
            'message': f"{available_senders} WAL senders available (out of {max_wal_senders})"
        }

        if not passed:
            result['fix_instruction'] = "Increase max_wal_senders in PostgreSQL configuration"

        return result

    def _check_table_readiness(self, conn, schema: str, table: str) -> Dict[str, Any]:
        """Check REPLICA IDENTITY setting for table"""
        cursor = conn.cursor()

        # Check if table exists
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name = %s
        """, [schema, table])

        table_exists = cursor.fetchone()[0] > 0

        if not table_exists:
            cursor.close()
            return {
                'passed': False,
                'exists': False,
                'message': f"Table {schema}.{table} not found"
            }

        # Check for primary key
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.table_constraints
            WHERE table_schema = %s
              AND table_name = %s
              AND constraint_type = 'PRIMARY KEY'
        """, [schema, table])

        has_primary_key = cursor.fetchone()[0] > 0

        # Check replica identity
        cursor.execute("""
            SELECT relreplident
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = %s
              AND c.relname = %s
        """, [schema, table])

        result_row = cursor.fetchone()
        cursor.close()

        replica_identity_map = {
            'd': 'DEFAULT',
            'n': 'NOTHING',
            'f': 'FULL',
            'i': 'INDEX'
        }

        replica_identity = 'UNKNOWN'
        if result_row:
            replica_identity = replica_identity_map.get(result_row[0], 'UNKNOWN')

        # Determine if table is ready
        issues = []
        if not has_primary_key:
            issues.append("Table has no primary key")

        if replica_identity == 'NOTHING':
            issues.append("REPLICA IDENTITY is set to NOTHING - CDC will not capture changes")
        elif replica_identity == 'DEFAULT' and not has_primary_key:
            issues.append("REPLICA IDENTITY is DEFAULT but no primary key exists")

        passed = len(issues) == 0

        result = {
            'passed': passed,
            'exists': True,
            'has_primary_key': has_primary_key,
            'replica_identity': replica_identity,
            'issues': issues,
            'message': f"Table {schema}.{table}: " + (
                "Ready for CDC" if passed else f"{len(issues)} issue(s) found"
            )
        }

        if not passed:
            fix_instructions = []
            if not has_primary_key:
                fix_instructions.append(f"Add a primary key: ALTER TABLE {schema}.{table} ADD PRIMARY KEY (column_name);")
            if replica_identity in ['NOTHING', 'DEFAULT']:
                fix_instructions.append(f"Set REPLICA IDENTITY to FULL: ALTER TABLE {schema}.{table} REPLICA IDENTITY FULL;")

            result['fix_instruction'] = " OR ".join(fix_instructions)

        return result

    def _build_recommendations(
        self,
        checks: Dict[str, Any],
        provider: str,
        table_checks: List[Dict[str, Any]] = None
    ) -> List[Dict]:
        """Build prioritized list of recommended actions"""
        recommendations = []

        # Critical: WAL level
        if not checks['wal_level']['passed']:
            recommendations.append({
                'priority': 'critical',
                'title': 'Enable Logical Replication',
                'description': checks['wal_level']['fix_instruction'],
                'docs_url': PROVIDER_INSTRUCTIONS[provider]['docs_url']
            })

        # Critical: Replication privilege
        if not checks['replication_privilege']['passed']:
            recommendations.append({
                'priority': 'critical',
                'title': 'Grant Replication Privilege',
                'description': checks['replication_privilege']['fix_instruction'],
                'sql': checks['replication_privilege'].get('fix_instruction', '')
            })

        # Warning: Replication slots
        if not checks['replication_slots']['passed']:
            recommendations.append({
                'priority': 'warning',
                'title': 'Increase Replication Slots',
                'description': checks['replication_slots']['fix_instruction']
            })

        # Warning: WAL senders
        if not checks['wal_senders']['passed']:
            recommendations.append({
                'priority': 'warning',
                'title': 'Increase WAL Senders',
                'description': checks['wal_senders']['fix_instruction']
            })

        # Table-specific recommendations
        if table_checks:
            for table_check in table_checks:
                if not table_check['passed'] and table_check.get('exists'):
                    recommendations.append({
                        'priority': 'high',
                        'title': f"Fix Table: {table_check.get('table_name', 'unknown')}",
                        'description': table_check.get('fix_instruction', ''),
                        'issues': table_check.get('issues', [])
                    })

        # If all checks passed
        if not recommendations:
            recommendations.append({
                'priority': 'info',
                'title': 'Database is Ready for CDC',
                'description': 'All prerequisites are met. You can proceed with setting up CDC pipelines.'
            })

        return recommendations


# Singleton instance
cdc_readiness_service = CDCReadinessService()
