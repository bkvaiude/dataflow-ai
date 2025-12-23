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

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
