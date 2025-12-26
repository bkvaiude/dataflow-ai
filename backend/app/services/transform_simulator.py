"""
Transform Simulator Service
Executes REAL SQL transformations on the database for preview and validation.
"""

import re
from typing import Dict, Any, List, Optional
from datetime import datetime


class TransformSimulatorService:
    """Execute SQL transformations on PostgreSQL for preview."""

    def __init__(self):
        self._db_session = None

    def _get_session(self):
        """Get database session"""
        from app.services.db_service import db_service
        return db_service._get_session()

    def simulate_join(
        self,
        user_id: str,
        credential_id: str,
        left_table: str,
        right_table: str,
        join_type: str,
        left_key: str,
        right_key: str,
        schema: str = "public",
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Simulate a JOIN transformation

        Args:
            user_id: User ID
            credential_id: Credential ID
            left_table: Left table name
            right_table: Right table name
            join_type: JOIN type (INNER, LEFT, RIGHT, FULL)
            left_key: Column name in left table
            right_key: Column name in right table
            schema: Schema name (default 'public')
            limit: Row limit (default 100)

        Returns:
            Result data, generated SQL, and statistics
        """
        from app.services.credential_service import credential_service
        from app.services.sample_data_service import sample_data_service
        import psycopg2

        # Validate join type
        valid_join_types = ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS']
        join_type_upper = join_type.upper()
        if join_type_upper not in valid_join_types:
            raise ValueError(f"Invalid join type. Must be one of: {', '.join(valid_join_types)}")

        # Get decrypted credentials
        cred_data = credential_service.get_decrypted_credentials(user_id, credential_id)
        if not cred_data:
            raise ValueError(f"Credential {credential_id} not found")

        credentials = cred_data['credentials']

        # Build SQL query
        sql = f"""
            SELECT *
            FROM "{schema}"."{left_table}" AS l
            {join_type_upper} JOIN "{schema}"."{right_table}" AS r
            ON l."{left_key}" = r."{right_key}"
            LIMIT %s
        """

        try:
            conn = psycopg2.connect(
                host=credentials.get('host'),
                port=credentials.get('port', 5432),
                database=credentials.get('database'),
                user=credentials.get('username'),
                password=credentials.get('password'),
                connect_timeout=10
            )

            cursor = conn.cursor()
            cursor.execute(sql, (limit,))

            # Get column metadata
            columns = []
            for desc in cursor.description:
                columns.append({
                    'name': desc[0],
                    'type': sample_data_service._get_type_name(desc[1])
                })

            # Fetch and convert rows
            raw_rows = cursor.fetchall()
            rows = []
            for raw_row in raw_rows:
                converted_row = [sample_data_service._convert_value(val) for val in raw_row]
                rows.append(converted_row)

            # Calculate statistics
            stats = self._calculate_stats(rows, columns)

            cursor.close()
            conn.close()

            print(f"[TRANSFORM_SIMULATOR] Executed {join_type_upper} JOIN: {left_table} ⋈ {right_table}")

            return {
                'transformation_type': 'join',
                'join_type': join_type_upper,
                'left_table': left_table,
                'right_table': right_table,
                'columns': columns,
                'rows': rows,
                'row_count': len(rows),
                'sql': sql.strip(),
                'stats': stats,
                'executed_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            raise Exception(f"JOIN simulation failed: {str(e)}")

    def simulate_filter(
        self,
        user_id: str,
        credential_id: str,
        table_name: str,
        where_clause: str,
        schema: str = "public",
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Simulate a FILTER (WHERE) transformation

        Args:
            user_id: User ID
            credential_id: Credential ID
            table_name: Table name
            where_clause: WHERE clause (without 'WHERE' keyword)
            schema: Schema name (default 'public')
            limit: Row limit (default 100)

        Returns:
            Result data, generated SQL, and statistics
        """
        from app.services.credential_service import credential_service
        from app.services.sample_data_service import sample_data_service
        import psycopg2

        # Validate WHERE clause to prevent SQL injection
        if not self._is_safe_where_clause(where_clause):
            raise ValueError(
                "Invalid WHERE clause. Only simple conditions are allowed. "
                "Avoid semicolons, comments, and SQL keywords like DROP, DELETE, INSERT, UPDATE."
            )

        # Get decrypted credentials
        cred_data = credential_service.get_decrypted_credentials(user_id, credential_id)
        if not cred_data:
            raise ValueError(f"Credential {credential_id} not found")

        credentials = cred_data['credentials']

        # Build SQL query
        sql = f"""
            SELECT *
            FROM "{schema}"."{table_name}"
            WHERE {where_clause}
            LIMIT %s
        """

        try:
            conn = psycopg2.connect(
                host=credentials.get('host'),
                port=credentials.get('port', 5432),
                database=credentials.get('database'),
                user=credentials.get('username'),
                password=credentials.get('password'),
                connect_timeout=10
            )

            cursor = conn.cursor()
            cursor.execute(sql, (limit,))

            # Get column metadata
            columns = []
            for desc in cursor.description:
                columns.append({
                    'name': desc[0],
                    'type': sample_data_service._get_type_name(desc[1])
                })

            # Fetch and convert rows
            raw_rows = cursor.fetchall()
            rows = []
            for raw_row in raw_rows:
                converted_row = [sample_data_service._convert_value(val) for val in raw_row]
                rows.append(converted_row)

            # Calculate statistics
            stats = self._calculate_stats(rows, columns)

            cursor.close()
            conn.close()

            print(f"[TRANSFORM_SIMULATOR] Executed FILTER on {table_name}: {where_clause}")

            return {
                'transformation_type': 'filter',
                'table_name': table_name,
                'where_clause': where_clause,
                'columns': columns,
                'rows': rows,
                'row_count': len(rows),
                'sql': sql.strip(),
                'stats': stats,
                'executed_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            raise Exception(f"FILTER simulation failed: {str(e)}")

    def simulate_aggregation(
        self,
        user_id: str,
        credential_id: str,
        table_name: str,
        group_by: List[str],
        aggregations: List[Dict[str, str]],
        schema: str = "public",
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Simulate an AGGREGATION transformation

        Args:
            user_id: User ID
            credential_id: Credential ID
            table_name: Table name
            group_by: List of column names to group by
            aggregations: List of aggregation specs [{"column": "amount", "function": "SUM", "alias": "total"}]
            schema: Schema name (default 'public')
            limit: Row limit (default 100)

        Returns:
            Result data, generated SQL, and statistics
        """
        from app.services.credential_service import credential_service
        from app.services.sample_data_service import sample_data_service
        import psycopg2

        # Validate aggregation functions
        valid_functions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STDDEV', 'VARIANCE']
        for agg in aggregations:
            func = agg.get('function', '').upper()
            if func not in valid_functions:
                raise ValueError(f"Invalid aggregation function: {func}. Must be one of: {', '.join(valid_functions)}")

        # Get decrypted credentials
        cred_data = credential_service.get_decrypted_credentials(user_id, credential_id)
        if not cred_data:
            raise ValueError(f"Credential {credential_id} not found")

        credentials = cred_data['credentials']

        # Build SELECT clause
        select_parts = []

        # Add GROUP BY columns
        for col in group_by:
            select_parts.append(f'"{col}"')

        # Add aggregations
        for agg in aggregations:
            column = agg['column']
            function = agg['function'].upper()
            alias = agg.get('alias', f"{function.lower()}_{column}")

            select_parts.append(f'{function}("{column}") AS "{alias}"')

        select_clause = ", ".join(select_parts)

        # Build GROUP BY clause
        group_by_clause = ", ".join([f'"{col}"' for col in group_by])

        # Build SQL query
        sql = f"""
            SELECT {select_clause}
            FROM "{schema}"."{table_name}"
            GROUP BY {group_by_clause}
            LIMIT %s
        """

        try:
            conn = psycopg2.connect(
                host=credentials.get('host'),
                port=credentials.get('port', 5432),
                database=credentials.get('database'),
                user=credentials.get('username'),
                password=credentials.get('password'),
                connect_timeout=10
            )

            cursor = conn.cursor()
            cursor.execute(sql, (limit,))

            # Get column metadata
            columns = []
            for desc in cursor.description:
                columns.append({
                    'name': desc[0],
                    'type': sample_data_service._get_type_name(desc[1])
                })

            # Fetch and convert rows
            raw_rows = cursor.fetchall()
            rows = []
            for raw_row in raw_rows:
                converted_row = [sample_data_service._convert_value(val) for val in raw_row]
                rows.append(converted_row)

            # Calculate statistics
            stats = self._calculate_stats(rows, columns)

            cursor.close()
            conn.close()

            print(f"[TRANSFORM_SIMULATOR] Executed AGGREGATION on {table_name}")

            return {
                'transformation_type': 'aggregation',
                'table_name': table_name,
                'group_by': group_by,
                'aggregations': aggregations,
                'columns': columns,
                'rows': rows,
                'row_count': len(rows),
                'sql': sql.strip(),
                'stats': stats,
                'executed_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            raise Exception(f"AGGREGATION simulation failed: {str(e)}")

    def _is_safe_where_clause(self, where_clause: str) -> bool:
        """
        Validate WHERE clause to prevent SQL injection

        Args:
            where_clause: WHERE clause to validate

        Returns:
            True if safe, False otherwise
        """
        # Check for dangerous patterns
        dangerous_patterns = [
            r';',  # Command separator
            r'--',  # SQL comment
            r'/\*',  # Multi-line comment
            r'\*/',  # Multi-line comment end
            r'\bDROP\b',  # DROP statement
            r'\bDELETE\b',  # DELETE statement
            r'\bINSERT\b',  # INSERT statement
            r'\bUPDATE\b',  # UPDATE statement
            r'\bEXEC\b',  # EXEC statement
            r'\bEXECUTE\b',  # EXECUTE statement
            r'\bCREATE\b',  # CREATE statement
            r'\bALTER\b',  # ALTER statement
            r'\bTRUNCATE\b',  # TRUNCATE statement
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, where_clause, re.IGNORECASE):
                return False

        return True

    def _calculate_stats(self, rows: List[List[Any]], columns: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Calculate statistics for result data

        Args:
            rows: Result rows
            columns: Column metadata

        Returns:
            Statistics dictionary with null counts per column
        """
        if not rows:
            return {
                'output_rows': 0,
                'null_counts': {}
            }

        # Calculate null counts per column
        null_counts = {}
        for col_idx, col in enumerate(columns):
            null_count = sum(1 for row in rows if row[col_idx] is None)
            null_counts[col['name']] = null_count

        return {
            'output_rows': len(rows),
            'null_counts': null_counts
        }


# Singleton instance
transform_simulator = TransformSimulatorService()
