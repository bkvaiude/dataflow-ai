"""
Module Executor

Executes operations defined in module configurations.
This includes schema discovery, CDC readiness checks, and table creation.

Usage:
    from app.modules.executor import module_executor

    # Discover schema from a source
    schema = await module_executor.discover_schema("postgresql", connection_params)

    # Check CDC readiness
    readiness = await module_executor.check_cdc_readiness("postgresql", connection_params)

    # Create destination table
    await module_executor.create_destination_table("clickhouse", table_config)
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from app.modules.loader import module_loader, ModuleConfig

logger = logging.getLogger(__name__)


@dataclass
class SchemaColumn:
    """Column definition from schema discovery"""
    name: str
    data_type: str
    is_nullable: bool
    table_schema: str
    table_name: str
    ordinal_position: int = 0
    is_primary_key: bool = False


@dataclass
class TableSchema:
    """Complete table schema"""
    schema_name: str
    table_name: str
    columns: List[SchemaColumn]
    primary_keys: List[str]
    estimated_row_count: int = 0


@dataclass
class CDCReadinessResult:
    """Result of CDC readiness check"""
    is_ready: bool
    checks: List[Dict[str, Any]]
    missing_requirements: List[str]
    recommendations: List[str]


class ModuleExecutor:
    """
    Executes operations defined in module configurations.

    Operations:
    - Schema discovery (for sources)
    - CDC readiness checks (for sources)
    - Table creation (for destinations)
    - Type mapping (for destinations)
    """

    def __init__(self):
        self._db_connections: Dict[str, Any] = {}

    async def discover_schema(
        self,
        module_name: str,
        connection_params: Dict[str, Any],
        include_tables: Optional[List[str]] = None
    ) -> List[TableSchema]:
        """
        Discover schema from a source database.

        Args:
            module_name: Name of the source module (e.g., 'postgresql', 'mysql')
            connection_params: Database connection parameters
            include_tables: Optional list of tables to include (filters results)

        Returns:
            List of TableSchema objects
        """
        module = module_loader.get_source(module_name)
        if not module:
            raise ValueError(f"Source module not found: {module_name}")

        query = module_loader.get_schema_discovery_query(module_name)
        if not query:
            raise ValueError(f"No schema discovery query for module: {module_name}")

        logger.info(f"[MODULE_EXECUTOR] Discovering schema for {module_name}")

        # Execute the discovery query based on module type
        if module_name == 'postgresql':
            return await self._discover_postgresql_schema(connection_params, query, include_tables)
        elif module_name == 'mysql':
            return await self._discover_mysql_schema(connection_params, query, include_tables)
        else:
            # Generic approach using async database libraries
            logger.warning(f"[MODULE_EXECUTOR] No specific handler for {module_name}, using generic")
            return []

    async def _discover_postgresql_schema(
        self,
        connection_params: Dict[str, Any],
        query: str,
        include_tables: Optional[List[str]] = None
    ) -> List[TableSchema]:
        """Discover PostgreSQL schema"""
        try:
            import asyncpg

            conn = await asyncpg.connect(
                host=connection_params.get('host', 'localhost'),
                port=connection_params.get('port', 5432),
                database=connection_params.get('database'),
                user=connection_params.get('username'),
                password=connection_params.get('password'),
                ssl=connection_params.get('ssl_mode', 'prefer')
            )

            try:
                rows = await conn.fetch(query)

                # Group by table
                tables: Dict[str, TableSchema] = {}
                for row in rows:
                    table_key = f"{row['table_schema']}.{row['table_name']}"

                    # Filter if include_tables specified
                    if include_tables and table_key not in include_tables:
                        continue

                    if table_key not in tables:
                        tables[table_key] = TableSchema(
                            schema_name=row['table_schema'],
                            table_name=row['table_name'],
                            columns=[],
                            primary_keys=[]
                        )

                    tables[table_key].columns.append(SchemaColumn(
                        name=row['column_name'],
                        data_type=row['data_type'],
                        is_nullable=row['is_nullable'] == 'YES',
                        table_schema=row['table_schema'],
                        table_name=row['table_name']
                    ))

                # Get primary keys
                pk_query = """
                    SELECT tc.table_schema, tc.table_name, kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                """
                pk_rows = await conn.fetch(pk_query)

                for row in pk_rows:
                    table_key = f"{row['table_schema']}.{row['table_name']}"
                    if table_key in tables:
                        tables[table_key].primary_keys.append(row['column_name'])
                        # Mark column as primary key
                        for col in tables[table_key].columns:
                            if col.name == row['column_name']:
                                col.is_primary_key = True

                return list(tables.values())

            finally:
                await conn.close()

        except ImportError:
            logger.error("[MODULE_EXECUTOR] asyncpg not installed")
            return []
        except Exception as e:
            logger.error(f"[MODULE_EXECUTOR] PostgreSQL schema discovery failed: {e}")
            raise

    async def _discover_mysql_schema(
        self,
        connection_params: Dict[str, Any],
        query: str,
        include_tables: Optional[List[str]] = None
    ) -> List[TableSchema]:
        """Discover MySQL schema"""
        try:
            import aiomysql

            conn = await aiomysql.connect(
                host=connection_params.get('host', 'localhost'),
                port=connection_params.get('port', 3306),
                db=connection_params.get('database'),
                user=connection_params.get('username'),
                password=connection_params.get('password')
            )

            try:
                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(query)
                    rows = await cursor.fetchall()

                    # Group by table
                    tables: Dict[str, TableSchema] = {}
                    for row in rows:
                        table_key = f"{row['TABLE_SCHEMA']}.{row['TABLE_NAME']}"

                        if include_tables and table_key not in include_tables:
                            continue

                        if table_key not in tables:
                            tables[table_key] = TableSchema(
                                schema_name=row['TABLE_SCHEMA'],
                                table_name=row['TABLE_NAME'],
                                columns=[],
                                primary_keys=[]
                            )

                        tables[table_key].columns.append(SchemaColumn(
                            name=row['COLUMN_NAME'],
                            data_type=row['DATA_TYPE'],
                            is_nullable=row['IS_NULLABLE'] == 'YES',
                            table_schema=row['TABLE_SCHEMA'],
                            table_name=row['TABLE_NAME']
                        ))

                    return list(tables.values())

            finally:
                conn.close()

        except ImportError:
            logger.error("[MODULE_EXECUTOR] aiomysql not installed")
            return []
        except Exception as e:
            logger.error(f"[MODULE_EXECUTOR] MySQL schema discovery failed: {e}")
            raise

    async def check_cdc_readiness(
        self,
        module_name: str,
        connection_params: Dict[str, Any]
    ) -> CDCReadinessResult:
        """
        Check if a source database is ready for CDC.

        Args:
            module_name: Name of the source module
            connection_params: Database connection parameters

        Returns:
            CDCReadinessResult with check results and recommendations
        """
        checks = module_loader.get_cdc_readiness_checks(module_name)
        if not checks:
            return CDCReadinessResult(
                is_ready=True,
                checks=[],
                missing_requirements=[],
                recommendations=[]
            )

        logger.info(f"[MODULE_EXECUTOR] Checking CDC readiness for {module_name}")

        results = []
        missing = []
        recommendations = []

        if module_name == 'postgresql':
            results, missing, recommendations = await self._check_postgresql_cdc(
                connection_params, checks
            )
        elif module_name == 'mysql':
            results, missing, recommendations = await self._check_mysql_cdc(
                connection_params, checks
            )

        return CDCReadinessResult(
            is_ready=len(missing) == 0,
            checks=results,
            missing_requirements=missing,
            recommendations=recommendations
        )

    async def _check_postgresql_cdc(
        self,
        connection_params: Dict[str, Any],
        checks: List[Dict[str, Any]]
    ) -> tuple:
        """Check PostgreSQL CDC readiness"""
        results = []
        missing = []
        recommendations = []

        try:
            import asyncpg

            conn = await asyncpg.connect(
                host=connection_params.get('host', 'localhost'),
                port=connection_params.get('port', 5432),
                database=connection_params.get('database'),
                user=connection_params.get('username'),
                password=connection_params.get('password')
            )

            try:
                for check in checks:
                    name = check.get('name', 'Unknown')
                    query = check.get('query', '')
                    expected = check.get('expected')

                    try:
                        if query.upper().startswith('SHOW'):
                            # SHOW commands return differently
                            row = await conn.fetchrow(query)
                            actual = list(row.values())[0] if row else None
                        else:
                            row = await conn.fetchrow(query)
                            actual = list(row.values())[0] if row else None

                        passed = str(actual).lower() == str(expected).lower()

                        results.append({
                            'name': name,
                            'passed': passed,
                            'expected': expected,
                            'actual': actual
                        })

                        if not passed:
                            missing.append(f"{name}: expected {expected}, got {actual}")

                    except Exception as e:
                        results.append({
                            'name': name,
                            'passed': False,
                            'error': str(e)
                        })
                        missing.append(f"{name}: check failed - {e}")

                # Add recommendations based on failures
                if any(r['name'] == 'WAL Level' and not r['passed'] for r in results):
                    recommendations.append(
                        "Set wal_level = 'logical' in postgresql.conf and restart PostgreSQL"
                    )
                if any(r['name'] == 'Replication Permission' and not r['passed'] for r in results):
                    recommendations.append(
                        "Grant REPLICATION privilege: ALTER USER username REPLICATION;"
                    )

            finally:
                await conn.close()

        except ImportError:
            missing.append("asyncpg library not installed")
        except Exception as e:
            missing.append(f"Connection failed: {e}")

        return results, missing, recommendations

    async def _check_mysql_cdc(
        self,
        connection_params: Dict[str, Any],
        checks: List[Dict[str, Any]]
    ) -> tuple:
        """Check MySQL CDC readiness"""
        results = []
        missing = []
        recommendations = []

        try:
            import aiomysql

            conn = await aiomysql.connect(
                host=connection_params.get('host', 'localhost'),
                port=connection_params.get('port', 3306),
                db=connection_params.get('database'),
                user=connection_params.get('username'),
                password=connection_params.get('password')
            )

            try:
                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    for check in checks:
                        name = check.get('name', 'Unknown')
                        query = check.get('query', '')
                        expected = check.get('expected')

                        try:
                            await cursor.execute(query)
                            row = await cursor.fetchone()
                            actual = list(row.values())[0] if row else None

                            passed = str(actual).lower() == str(expected).lower()

                            results.append({
                                'name': name,
                                'passed': passed,
                                'expected': expected,
                                'actual': actual
                            })

                            if not passed:
                                missing.append(f"{name}: expected {expected}, got {actual}")

                        except Exception as e:
                            results.append({
                                'name': name,
                                'passed': False,
                                'error': str(e)
                            })
                            missing.append(f"{name}: check failed - {e}")

                # Add recommendations
                if any(r['name'] == 'Binary Log' and not r['passed'] for r in results):
                    recommendations.append(
                        "Enable binary logging: SET GLOBAL log_bin = ON; (requires restart)"
                    )
                if any(r['name'] == 'Binary Log Format' and not r['passed'] for r in results):
                    recommendations.append(
                        "Set binlog format: SET GLOBAL binlog_format = 'ROW';"
                    )

            finally:
                conn.close()

        except ImportError:
            missing.append("aiomysql library not installed")
        except Exception as e:
            missing.append(f"Connection failed: {e}")

        return results, missing, recommendations

    async def create_destination_table(
        self,
        module_name: str,
        connection_params: Dict[str, Any],
        table_config: Dict[str, Any]
    ) -> bool:
        """
        Create a table in the destination.

        Args:
            module_name: Name of the destination module
            connection_params: Destination connection parameters
            table_config: Table configuration including:
                - database: Database name
                - table_name: Table name
                - columns: List of column definitions
                - primary_keys: List of primary key columns

        Returns:
            True if table was created successfully
        """
        module = module_loader.get_destination(module_name)
        if not module or not module.table_template:
            raise ValueError(f"Destination module or table template not found: {module_name}")

        # Map source types to destination types
        columns = []
        for col in table_config.get('columns', []):
            dest_type = module_loader.map_type(module_name, col.get('type', 'string'))
            columns.append({
                'name': col.get('name'),
                'clickhouse_type': dest_type,  # Generic key for template
                'source_type': col.get('type')
            })

        # Render the CREATE TABLE statement
        context = {
            'database': table_config.get('database'),
            'table_name': table_config.get('table_name'),
            'columns': columns,
            'primary_keys': table_config.get('primary_keys', [])
        }

        create_sql = module_loader.render_table_template(module_name, context)

        logger.info(f"[MODULE_EXECUTOR] Creating table: {table_config.get('table_name')}")

        if module_name == 'clickhouse':
            return await self._create_clickhouse_table(connection_params, create_sql)

        return False

    async def _create_clickhouse_table(
        self,
        connection_params: Dict[str, Any],
        create_sql: str
    ) -> bool:
        """Create a ClickHouse table"""
        try:
            import httpx

            host = connection_params.get('host', 'localhost')
            port = connection_params.get('port', 8123)
            username = connection_params.get('username', 'default')
            password = connection_params.get('password', '')
            database = connection_params.get('database', 'default')

            url = f"https://{host}:{port}/"

            async with httpx.AsyncClient(verify=False) as client:
                response = await client.post(
                    url,
                    content=create_sql,
                    params={'database': database},
                    auth=(username, password) if username else None,
                    headers={'Content-Type': 'text/plain'}
                )

                if response.status_code == 200:
                    logger.info("[MODULE_EXECUTOR] ClickHouse table created successfully")
                    return True
                else:
                    logger.error(f"[MODULE_EXECUTOR] ClickHouse error: {response.text}")
                    return False

        except ImportError:
            logger.error("[MODULE_EXECUTOR] httpx not installed")
            return False
        except Exception as e:
            logger.error(f"[MODULE_EXECUTOR] ClickHouse table creation failed: {e}")
            raise

    def get_connector_config(
        self,
        module_name: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get rendered connector configuration.

        Args:
            module_name: Name of the source or destination module
            context: Template context variables

        Returns:
            Ready-to-use connector configuration
        """
        return module_loader.render_connector_config(module_name, context)


# Singleton instance
module_executor = ModuleExecutor()
