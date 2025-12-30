"""
DataFlow AI Modules Package

This package provides the plug-and-play module system for sources, destinations,
and transformations. New modules can be added by simply dropping YAML configuration
files in the configs directory - no code changes required.

Directory Structure:
    modules/
    ├── __init__.py          # This file
    ├── loader.py            # Module configuration loader
    ├── executor.py          # Module operation executor
    └── configs/
        ├── sources/         # Source module configs (postgresql.yaml, mysql.yaml, etc.)
        ├── destinations/    # Destination module configs (clickhouse.yaml, s3.yaml, etc.)
        └── transforms/      # Transform configs (filter.yaml, aggregate.yaml, join.yaml)

Usage:
    from app.modules import module_loader, module_executor

    # List available sources
    sources = module_loader.list_sources()  # ['postgresql', 'mysql']

    # Get source configuration
    pg_config = module_loader.get_source('postgresql')

    # Render connector configuration
    connector_config = module_loader.render_connector_config('postgresql', {
        'credentials': {...},
        'pipeline': {'id': 'abc123'},
        'tables': ['public.users']
    })

    # Discover schema
    schema = await module_executor.discover_schema('postgresql', connection_params)

    # Check CDC readiness
    readiness = await module_executor.check_cdc_readiness('postgresql', connection_params)

Adding a New Source (No Code Changes Required):
    1. Create: backend/app/modules/configs/sources/newdb.yaml
    2. Define: module info, capabilities, credentials, connector_template
    3. Optionally add: schema_discovery query, cdc_readiness_check queries
    4. Restart the application - done!

Adding a New Destination (No Code Changes Required):
    1. Create: backend/app/modules/configs/destinations/newdest.yaml
    2. Define: module info, capabilities, credentials, connector_template
    3. Add: type_mapping (source -> destination types)
    4. Add: table_template (CREATE TABLE statement)
    5. Restart the application - done!
"""

from app.modules.loader import module_loader, ModuleLoader, ModuleConfig
from app.modules.executor import module_executor, ModuleExecutor

__all__ = [
    'module_loader',
    'module_executor',
    'ModuleLoader',
    'ModuleExecutor',
    'ModuleConfig'
]
