from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    environment: str = "development"

    # Database
    database_url: str = "postgresql://dataflow:dataflow@localhost:5432/dataflow"

    # Gemini AI
    gemini_api_key: str = ""

    # Confluent Kafka
    kafka_bootstrap_servers: str = ""
    kafka_api_key: str = ""
    kafka_api_secret: str = ""

    # Schema Registry
    schema_registry_url: str = ""
    schema_registry_api_key: str = ""
    schema_registry_api_secret: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/oauth/google-ads/callback"
    google_auth_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"

    # Google Ads
    google_ads_developer_token: str = ""

    # Google Sheets
    google_sheets_credentials_path: str = ""

    # Credential Encryption
    credential_encryption_key: str = ""

    # Confluent Cloud API (for managed connectors)
    confluent_cloud_api_key: str = ""
    confluent_cloud_api_secret: str = ""
    confluent_environment_id: str = ""
    confluent_cluster_id: str = ""

    # Local Kafka Connect (for local PostgreSQL CDC)
    kafka_connect_url: str = ""

    # ClickHouse
    clickhouse_host: str = "localhost"
    clickhouse_port: int = 8123
    clickhouse_user: str = "default"
    clickhouse_password: str = ""
    clickhouse_database: str = "dataflow"

    # ksqlDB
    ksqldb_url: str = "http://localhost:8088"

    # SMTP (Mailhog for development)
    smtp_host: str = "mailhog"
    smtp_port: int = 1025
    smtp_use_tls: bool = False
    alert_from_email: str = "alerts@dataflow-ai.local"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    # Credential-based checks (use real services when credentials exist)
    @property
    def has_gemini_api_key(self) -> bool:
        return bool(self.gemini_api_key and self.gemini_api_key.strip())

    @property
    def has_kafka_credentials(self) -> bool:
        return bool(self.kafka_bootstrap_servers and self.kafka_api_key and self.kafka_api_secret)

    @property
    def has_schema_registry_credentials(self) -> bool:
        return bool(self.schema_registry_url and self.schema_registry_api_key)

    @property
    def has_kafka_connect_url(self) -> bool:
        return bool(self.kafka_connect_url and self.kafka_connect_url.strip())

    @property
    def has_confluent_cloud_api(self) -> bool:
        return bool(
            self.confluent_cloud_api_key and
            self.confluent_cloud_api_secret and
            self.confluent_environment_id and
            self.confluent_cluster_id
        )

    @property
    def has_google_ads_developer_token(self) -> bool:
        return bool(self.google_ads_developer_token and self.google_ads_developer_token.strip())

    # Service mock flags (based on credentials, NOT environment)
    @property
    def use_mock_gemini(self) -> bool:
        return not self.has_gemini_api_key

    @property
    def use_mock_kafka(self) -> bool:
        return not self.has_kafka_credentials

    @property
    def use_mock_google_ads(self) -> bool:
        return not self.has_google_ads_developer_token  # Always mock until we have developer token

    @property
    def has_google_oauth_credentials(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def use_mock_oauth(self) -> bool:
        return not self.has_google_oauth_credentials

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
