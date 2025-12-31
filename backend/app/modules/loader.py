"""
Module Loader

Loads source/destination/transform modules from YAML configuration files.
This enables the plug-and-play architecture where new sources/destinations
can be added without code changes - just drop a YAML config file.

Usage:
    from app.modules.loader import module_loader

    # Get a source module config
    pg_config = module_loader.get_source("postgresql")

    # Render connector configuration with actual values
    connector_config = module_loader.render_connector_config("postgresql", {
        "credentials": {"host": "localhost", "port": 5432, ...},
        "pipeline": {"id": "abc123"},
        "tables": ["public.users", "public.orders"]
    })
"""

import yaml
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from jinja2 import Template, Environment, BaseLoader

logger = logging.getLogger(__name__)


@dataclass
class ModuleInfo:
    """Basic module information"""
    type: str              # source, destination, transform
    name: str              # postgresql, clickhouse, filter
    display_name: str      # PostgreSQL, ClickHouse, Row Filter
    icon: str              # lucide icon name
    version: str           # 1.0.0


@dataclass
class CredentialField:
    """A credential field definition"""
    name: str
    type: str              # string, integer, password, select
    label: str
    required: bool = True
    default: Any = None
    placeholder: str = ""
    encrypted: bool = False
    options: List[str] = field(default_factory=list)


@dataclass
class ModuleCapabilities:
    """What a module can do"""
    supports_cdc: bool = False
    supports_full_load: bool = False
    supports_incremental: bool = False
    supports_upsert: bool = False
    supports_delete: bool = False
    supports_schema_evolution: bool = False
    supported_formats: List[str] = field(default_factory=list)


@dataclass
class ModuleConfig:
    """Complete module configuration"""
    info: ModuleInfo
    capabilities: ModuleCapabilities
    required_credentials: List[CredentialField]
    optional_credentials: List[CredentialField]
    connector_template: Dict[str, Any]
    type_mapping: Dict[str, str] = field(default_factory=dict)
    table_template: str = ""
    schema_discovery: Dict[str, Any] = field(default_factory=dict)
    cdc_readiness_check: Dict[str, Any] = field(default_factory=dict)
    cost_factors: Dict[str, float] = field(default_factory=dict)
    raw_config: Dict[str, Any] = field(default_factory=dict)


class ModuleLoader:
    """
    Loads source/destination/transform modules from YAML config files.

    This enables plug-and-play architecture:
    - Add new source: create backend/app/modules/configs/sources/newdb.yaml
    - Add new destination: create backend/app/modules/configs/destinations/newdest.yaml
    - No code changes required!
    """

    def __init__(self, config_dir: Optional[str] = None):
        if config_dir is None:
            # Default to the configs directory relative to this file
            config_dir = Path(__file__).parent / "configs"
        self.config_dir = Path(config_dir)

        self._sources: Dict[str, ModuleConfig] = {}
        self._destinations: Dict[str, ModuleConfig] = {}
        self._transforms: Dict[str, Dict[str, Any]] = {}

        # Jinja2 environment for template rendering
        self._jinja_env = Environment(loader=BaseLoader())
        self._jinja_env.filters['join'] = lambda x, sep=',': sep.join(x) if isinstance(x, list) else x

        self._load_all_modules()

    def _load_all_modules(self):
        """Load all module configs at startup"""
        sources_dir = self.config_dir / "sources"
        destinations_dir = self.config_dir / "destinations"
        transforms_dir = self.config_dir / "transforms"

        # Load sources
        if sources_dir.exists():
            for config_file in sources_dir.glob("*.yaml"):
                try:
                    config = self._load_source_config(config_file)
                    if config:
                        self._sources[config.info.name] = config
                        logger.info(f"[MODULE_LOADER] Loaded source: {config.info.name}")
                except Exception as e:
                    logger.error(f"[MODULE_LOADER] Failed to load source {config_file}: {e}")

        # Load destinations
        if destinations_dir.exists():
            for config_file in destinations_dir.glob("*.yaml"):
                try:
                    config = self._load_destination_config(config_file)
                    if config:
                        self._destinations[config.info.name] = config
                        logger.info(f"[MODULE_LOADER] Loaded destination: {config.info.name}")
                except Exception as e:
                    logger.error(f"[MODULE_LOADER] Failed to load destination {config_file}: {e}")

        # Load transforms
        if transforms_dir.exists():
            for config_file in transforms_dir.glob("*.yaml"):
                try:
                    with open(config_file) as f:
                        config = yaml.safe_load(f)
                    if config and 'transform' in config:
                        name = config['transform']['name']
                        self._transforms[name] = config
                        logger.info(f"[MODULE_LOADER] Loaded transform: {name}")
                except Exception as e:
                    logger.error(f"[MODULE_LOADER] Failed to load transform {config_file}: {e}")

        logger.info(
            f"[MODULE_LOADER] Loaded {len(self._sources)} sources, "
            f"{len(self._destinations)} destinations, "
            f"{len(self._transforms)} transforms"
        )

    def _load_yaml(self, path: Path) -> Dict:
        """Load and parse YAML config"""
        with open(path) as f:
            return yaml.safe_load(f)

    def _parse_credentials(self, creds_config: List[Dict]) -> List[CredentialField]:
        """Parse credential field definitions"""
        fields = []
        for cred in creds_config:
            fields.append(CredentialField(
                name=cred.get('name', ''),
                type=cred.get('type', 'string'),
                label=cred.get('label', cred.get('name', '')),
                required=True,
                default=cred.get('default'),
                placeholder=cred.get('placeholder', ''),
                encrypted=cred.get('encrypted', False),
                options=cred.get('options', [])
            ))
        return fields

    def _load_source_config(self, path: Path) -> Optional[ModuleConfig]:
        """Load a source module configuration"""
        raw = self._load_yaml(path)
        if not raw or 'module' not in raw:
            return None

        module = raw['module']
        capabilities_raw = raw.get('capabilities', {})
        credentials_raw = raw.get('credentials', {})

        info = ModuleInfo(
            type='source',
            name=module.get('name', path.stem),
            display_name=module.get('display_name', module.get('name', path.stem)),
            icon=module.get('icon', 'database'),
            version=module.get('version', '1.0.0')
        )

        capabilities = ModuleCapabilities(
            supports_cdc=capabilities_raw.get('supports_cdc', False),
            supports_full_load=capabilities_raw.get('supports_full_load', False),
            supports_incremental=capabilities_raw.get('supports_incremental', False),
            supported_formats=capabilities_raw.get('supported_formats', ['avro', 'json'])
        )

        return ModuleConfig(
            info=info,
            capabilities=capabilities,
            required_credentials=self._parse_credentials(credentials_raw.get('required', [])),
            optional_credentials=self._parse_credentials(credentials_raw.get('optional', [])),
            connector_template=raw.get('connector_template', {}),
            schema_discovery=raw.get('schema_discovery', {}),
            cdc_readiness_check=raw.get('cdc_readiness_check', {}),
            cost_factors=raw.get('cost_factors', {}),
            raw_config=raw
        )

    def _load_destination_config(self, path: Path) -> Optional[ModuleConfig]:
        """Load a destination module configuration"""
        raw = self._load_yaml(path)
        if not raw or 'module' not in raw:
            return None

        module = raw['module']
        capabilities_raw = raw.get('capabilities', {})
        credentials_raw = raw.get('credentials', {})

        info = ModuleInfo(
            type='destination',
            name=module.get('name', path.stem),
            display_name=module.get('display_name', module.get('name', path.stem)),
            icon=module.get('icon', 'database'),
            version=module.get('version', '1.0.0')
        )

        capabilities = ModuleCapabilities(
            supports_upsert=capabilities_raw.get('supports_upsert', False),
            supports_delete=capabilities_raw.get('supports_delete', False),
            supports_schema_evolution=capabilities_raw.get('supports_schema_evolution', False),
            supported_formats=capabilities_raw.get('supported_formats', ['avro', 'json'])
        )

        return ModuleConfig(
            info=info,
            capabilities=capabilities,
            required_credentials=self._parse_credentials(credentials_raw.get('required', [])),
            optional_credentials=self._parse_credentials(credentials_raw.get('optional', [])),
            connector_template=raw.get('connector_template', {}),
            type_mapping=raw.get('type_mapping', {}),
            table_template=raw.get('table_template', ''),
            cost_factors=raw.get('cost_factors', {}),
            raw_config=raw
        )

    def get_source(self, name: str) -> Optional[ModuleConfig]:
        """Get a source module configuration by name"""
        return self._sources.get(name)

    def get_destination(self, name: str) -> Optional[ModuleConfig]:
        """Get a destination module configuration by name"""
        return self._destinations.get(name)

    def get_transform(self, name: str) -> Optional[Dict[str, Any]]:
        """Get a transform configuration by name"""
        return self._transforms.get(name)

    def list_sources(self) -> List[str]:
        """List all available source module names"""
        return list(self._sources.keys())

    def list_destinations(self) -> List[str]:
        """List all available destination module names"""
        return list(self._destinations.keys())

    def list_transforms(self) -> List[str]:
        """List all available transform names"""
        return list(self._transforms.keys())

    def get_source_info(self) -> List[Dict[str, Any]]:
        """Get display info for all sources"""
        return [
            {
                'name': config.info.name,
                'display_name': config.info.display_name,
                'icon': config.info.icon,
                'supports_cdc': config.capabilities.supports_cdc,
                'supports_full_load': config.capabilities.supports_full_load
            }
            for config in self._sources.values()
        ]

    def get_destination_info(self) -> List[Dict[str, Any]]:
        """Get display info for all destinations"""
        return [
            {
                'name': config.info.name,
                'display_name': config.info.display_name,
                'icon': config.info.icon,
                'supports_upsert': config.capabilities.supports_upsert
            }
            for config in self._destinations.values()
        ]

    def render_connector_config(
        self,
        module_name: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Render connector template with actual values.

        Args:
            module_name: Name of the source or destination module
            context: Dictionary with template variables:
                - credentials: Credential values
                - pipeline: Pipeline info (id, name, etc.)
                - tables: List of table names
                - topics: List of topic names (for sinks)

        Returns:
            Rendered connector configuration ready for Kafka Connect
        """
        module = self._sources.get(module_name) or self._destinations.get(module_name)
        if not module:
            raise ValueError(f"Module not found: {module_name}")

        connector_template = module.connector_template
        if 'config' not in connector_template:
            return {}

        # Convert template config to YAML string for Jinja2 rendering
        template_str = yaml.dump(connector_template['config'])

        # Render with Jinja2
        template = self._jinja_env.from_string(template_str)
        rendered_str = template.render(**context)

        # Parse back to dictionary
        rendered_config = yaml.safe_load(rendered_str)

        # Add the connector class
        if 'class' in connector_template:
            rendered_config['connector.class'] = connector_template['class']

        return rendered_config

    def render_table_template(
        self,
        module_name: str,
        context: Dict[str, Any]
    ) -> str:
        """
        Render table creation template (for destinations).

        Args:
            module_name: Name of the destination module
            context: Dictionary with template variables:
                - database: Database name
                - table_name: Table name
                - columns: List of column definitions
                - primary_keys: List of primary key columns

        Returns:
            SQL CREATE TABLE statement
        """
        module = self._destinations.get(module_name)
        if not module or not module.table_template:
            raise ValueError(f"Destination module or table template not found: {module_name}")

        template = self._jinja_env.from_string(module.table_template)
        return template.render(**context)

    def map_type(
        self,
        module_name: str,
        source_type: str
    ) -> str:
        """
        Map a source data type to destination type.

        Args:
            module_name: Name of the destination module
            source_type: Source database type (e.g., 'varchar', 'integer')

        Returns:
            Destination type (e.g., 'String', 'Int32')
        """
        module = self._destinations.get(module_name)
        if not module:
            return source_type

        # Try exact match first
        source_lower = source_type.lower()
        if source_lower in module.type_mapping:
            return module.type_mapping[source_lower]

        # Try partial match
        for key, value in module.type_mapping.items():
            if key in source_lower:
                return value

        # Default to String if no mapping found
        return module.type_mapping.get('default', 'String')

    def get_schema_discovery_query(self, module_name: str) -> Optional[str]:
        """Get the schema discovery SQL query for a source module"""
        module = self._sources.get(module_name)
        if module and module.schema_discovery:
            return module.schema_discovery.get('query')
        return None

    def get_cdc_readiness_checks(self, module_name: str) -> List[Dict[str, Any]]:
        """Get CDC readiness check queries for a source module"""
        module = self._sources.get(module_name)
        if module and module.cdc_readiness_check:
            return module.cdc_readiness_check.get('queries', [])
        return []

    def get_cost_factors(self, module_name: str) -> Dict[str, float]:
        """Get cost factors for a module"""
        module = self._sources.get(module_name) or self._destinations.get(module_name)
        if module:
            return module.cost_factors
        return {}

    def reload(self):
        """Reload all module configurations"""
        self._sources.clear()
        self._destinations.clear()
        self._transforms.clear()
        self._load_all_modules()


# Singleton instance
module_loader = ModuleLoader()
