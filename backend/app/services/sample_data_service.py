"""
Sample Data Service
Fetches sample data from database tables for preview and validation.
"""

import base64
from typing import Dict, Any, List, Optional
from datetime import datetime
from decimal import Decimal


class SampleDataService:
    """Fetch and format sample data from PostgreSQL sources."""

    def __init__(self):
        self._db_session = None

    def _get_session(self):
        """Get database session"""
        from app.services.db_service import db_service
        return db_service._get_session()

    def fetch_sample(
        self,
        user_id: str,
        credential_id: str,
        table_name: str,
        schema_name: str = "public",
        limit: int = 100,
        columns: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Fetch sample data from a PostgreSQL table

        Args:
            user_id: User ID
            credential_id: ID of stored credentials
            table_name: Table name to sample
            schema_name: Schema name (default 'public')
            limit: Maximum rows to fetch (default 100)
            columns: List of specific columns to fetch (None = all columns)

        Returns:
            Dictionary with table metadata, column info, and sample rows
        """
        from app.services.credential_service import credential_service
        import psycopg2
        import psycopg2.extras

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

            # Build SELECT query
            column_list = "*"
            if columns:
                # Quote column names to handle special characters
                quoted_columns = [f'"{col}"' for col in columns]
                column_list = ", ".join(quoted_columns)

            query = f'SELECT {column_list} FROM "{schema_name}"."{table_name}" LIMIT %s'

            cursor = conn.cursor()
            cursor.execute(query, (limit,))

            # Get column metadata from cursor description
            column_metadata = []
            for desc in cursor.description:
                column_metadata.append({
                    'name': desc[0],
                    'type': self._get_type_name(desc[1]),
                    'nullable': True  # PostgreSQL cursor doesn't provide nullable info
                })

            # Fetch rows
            raw_rows = cursor.fetchall()
            row_count = len(raw_rows)

            # Convert rows to JSON-serializable format
            rows = []
            for raw_row in raw_rows:
                converted_row = [self._convert_value(val) for val in raw_row]
                rows.append(converted_row)

            # Get total row count estimate
            cursor.execute(f'SELECT COUNT(*) FROM "{schema_name}"."{table_name}"')
            total_rows_estimate = cursor.fetchone()[0]

            cursor.close()
            conn.close()

            print(f"[SAMPLE_DATA] Fetched {row_count} rows from {schema_name}.{table_name}")

            return {
                'table_name': table_name,
                'schema_name': schema_name,
                'columns': column_metadata,
                'rows': rows,
                'row_count': row_count,
                'total_rows_estimate': total_rows_estimate,
                'fetched_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            raise Exception(f"Failed to fetch sample data: {str(e)}")

    def _get_type_name(self, type_code: int) -> str:
        """Convert PostgreSQL type code to readable type name"""
        import psycopg2.extensions

        # Common PostgreSQL type codes
        type_map = {
            16: 'boolean',
            20: 'bigint',
            21: 'smallint',
            23: 'integer',
            25: 'text',
            700: 'real',
            701: 'double precision',
            1043: 'varchar',
            1082: 'date',
            1083: 'time',
            1114: 'timestamp',
            1184: 'timestamptz',
            1700: 'numeric',
            2950: 'uuid',
            3802: 'jsonb',
            114: 'json'
        }

        return type_map.get(type_code, f'unknown({type_code})')

    def _convert_value(self, value: Any) -> Any:
        """
        Convert Python types to JSON-serializable format

        Args:
            value: Value to convert

        Returns:
            JSON-serializable value
        """
        if value is None:
            return None

        # datetime objects → ISO string
        if isinstance(value, datetime):
            return value.isoformat()

        # date objects → ISO string
        if hasattr(value, 'isoformat'):
            return value.isoformat()

        # Decimal → float
        if isinstance(value, Decimal):
            return float(value)

        # bytes → base64 string (for binary data)
        if isinstance(value, bytes):
            # Truncate large binary data
            if len(value) > 1000:
                return f"<binary data {len(value)} bytes>"
            return base64.b64encode(value).decode('utf-8')

        # dict and list are already JSON-serializable
        if isinstance(value, (dict, list)):
            return value

        # Convert other types to string
        return str(value)


# Singleton instance
sample_data_service = SampleDataService()
