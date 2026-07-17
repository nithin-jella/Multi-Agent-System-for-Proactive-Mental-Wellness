from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database Configuration
    database_url: str = Field(..., alias="DATABASE_URL")
    
    # Advanced Settings (with defaults)
    debug_sql: bool = Field(False, alias="DEBUG_SQL")
    k_anon: int = Field(15, alias="K_ANON")
    followup_cooldown_hours: int = Field(24, alias="FOLLOWUP_COOLDOWN_HOURS")
    sda_sla_minutes: int = Field(15, alias="SDA_SLA_MINUTES")
    policy_deny_experiments_on_crisis: bool = Field(True, alias="POLICY_DENY_EXPERIMENTS_ON_CRISIS")
    
    # PII Redaction Settings
    pii_redaction_enabled: bool = Field(True, alias="PII_REDACTION_ENABLED")
    pii_nlp_redaction_enabled: bool = Field(False, alias="PII_NLP_REDACTION_ENABLED")
    pii_nlp_entities: str = Field("PERSON,GPE,LOC", alias="PII_REDACTION_ENTITIES")
    
    # Email Encryption
    email_encryption_key: str = Field(..., alias="EMAIL_ENCRYPTION_KEY")
    
    # API Keys
    google_genai_api_key: Optional[str] = Field(None, alias="GOOGLE_GENAI_API_KEY")
    azure_openai_endpoint: Optional[str] = Field(None, alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_api_key: Optional[str] = Field(None, alias="AZURE_OPENAI_API_KEY")
    azure_openai_deployment: Optional[str] = Field(None, alias="AZURE_OPENAI_DEPLOYMENT")
    together_api_key: Optional[str] = Field(None, alias="TOGETHER_API_KEY")
    
    # Twitter API
    twitter_api_key: Optional[str] = Field(None, alias="TWITTER_API_KEY")
    twitter_api_secret: Optional[str] = Field(None, alias="TWITTER_API_SECRET")
    twitter_access_token: Optional[str] = Field(None, alias="TWITTER_ACCESS_TOKEN")
    twitter_access_token_secret: Optional[str] = Field(None, alias="TWITTER_ACCESS_TOKEN_SECRET")
    twitter_bearer_token: Optional[str] = Field(None, alias="TWITTER_BEARER_TOKEN")
    
    # Redis Configuration
    redis_host: Optional[str] = Field(None, alias="REDIS_HOST")
    redis_db: int = Field(0, alias="REDIS_DB")
    redis_port: int = Field(6379, alias="REDIS_PORT")
    redis_username: Optional[str] = Field(None, alias="REDIS_USERNAME")
    redis_password: Optional[str] = Field(None, alias="REDIS_PASSWORD")
    
    # Rate Limiting Configuration
    rate_limit_enabled: bool = Field(True, alias="RATE_LIMIT_ENABLED")
    rate_limit_bypass_admin: bool = Field(True, alias="RATE_LIMIT_BYPASS_ADMIN")
    
    # Rate limits for students
    rate_limit_chat_per_minute_student: int = Field(10, alias="RATE_LIMIT_CHAT_PER_MINUTE_STUDENT")
    rate_limit_chat_per_hour_student: int = Field(100, alias="RATE_LIMIT_CHAT_PER_HOUR_STUDENT")
    rate_limit_chat_per_day_student: int = Field(500, alias="RATE_LIMIT_CHAT_PER_DAY_STUDENT")
    
    # Rate limits for counsellors
    rate_limit_chat_per_minute_counsellor: int = Field(30, alias="RATE_LIMIT_CHAT_PER_MINUTE_COUNSELLOR")
    rate_limit_chat_per_hour_counsellor: int = Field(300, alias="RATE_LIMIT_CHAT_PER_HOUR_COUNSELLOR")
    rate_limit_chat_per_day_counsellor: int = Field(2000, alias="RATE_LIMIT_CHAT_PER_DAY_COUNSELLOR")
    
    # Rate limits for analytics endpoints
    rate_limit_analytics_per_minute_student: int = Field(5, alias="RATE_LIMIT_ANALYTICS_PER_MINUTE_STUDENT")
    rate_limit_analytics_per_hour_student: int = Field(30, alias="RATE_LIMIT_ANALYTICS_PER_HOUR_STUDENT")
    rate_limit_analytics_per_day_student: int = Field(100, alias="RATE_LIMIT_ANALYTICS_PER_DAY_STUDENT")
    
    # Caching Configuration
    cache_enabled: bool = Field(True, alias="CACHE_ENABLED")
    cache_default_ttl: int = Field(3600, alias="CACHE_DEFAULT_TTL")  # 1 hour
    cache_user_summary_ttl: int = Field(1800, alias="CACHE_USER_SUMMARY_TTL")  # 30 minutes
    cache_journal_ttl: int = Field(900, alias="CACHE_JOURNAL_TTL")  # 15 minutes
    cache_resource_ttl: int = Field(86400, alias="CACHE_RESOURCE_TTL")  # 24 hours
    cache_cbt_module_ttl: int = Field(86400, alias="CACHE_CBT_MODULE_TTL")  # 24 hours
    cache_user_profile_ttl: int = Field(3600, alias="CACHE_USER_PROFILE_TTL")  # 1 hour
    
    # Celery Configuration
    celery_broker_url: Optional[str] = Field(None, alias="CELERY_BROKER_URL")
    celery_result_backend: Optional[str] = Field(None, alias="CELERY_RESULT_BACKEND")
    celery_store_results: bool = Field(False, alias="CELERY_STORE_RESULTS")
    
    # Email Configuration
    email_username: Optional[str] = Field(None, alias="EMAIL_USERNAME")
    email_password: Optional[str] = Field(None, alias="EMAIL_PASSWORD")
    email_smtp_server: str = Field("smtp.gmail.com", alias="EMAIL_SMTP_SERVER")
    email_smtp_port: int = Field(587, alias="EMAIL_SMTP_PORT")
    
    # Application Settings
    app_env: str = Field("development", alias="APP_ENV")
    port: int = Field(22001, alias="PORT")
    frontend_url: str = Field("http://localhost:4000", alias="FRONTEND_URL")
    backend_url: str = Field("http://localhost:22001", alias="BACKEND_URL")
    
    # JWT Configuration
    jwt_secret_key: str = Field(..., alias="JWT_SECRET_KEY")
    jwt_expiration_time: int = Field(3600, alias="JWT_EXPIRATION_TIME")
    
    # Internal API
    internal_api_key: Optional[str] = Field(None, alias="INTERNAL_API_KEY")
    
    # CORS
    allowed_origins: str = Field("http://localhost:4000", alias="ALLOWED_ORIGINS")
    
    # Logging
    log_level: str = Field("INFO", alias="LOG_LEVEL")
    
    # Web3 / Blockchain
    nft_contract_address: Optional[str] = Field(None, alias="NFT_CONTRACT_ADDRESS")
    edu_testnet_rpc_url: Optional[str] = Field(None, alias="EDU_TESTNET_RPC_URL")
    edu_chain_testnet_chain_id: Optional[str] = Field(None, alias="EDU_CHAIN_TESTNET_CHAIN_ID")
    backend_minter_private_key: Optional[str] = Field(None, alias="BACKEND_MINTER_PRIVATE_KEY")
    lisk_testnet_rpc_url: Optional[str] = Field(None, alias="LISK_TESTNET_RPC_URL")
    lisk_testnet_chain_id: Optional[str] = Field(None, alias="LISK_TESTNET_CHAIN_ID")
    lisk_payment_contract_address: Optional[str] = Field(None, alias="LISK_PAYMENT_CONTRACT_ADDRESS")
    
    # MinIO Configuration
    minio_endpoint: str = Field("minio:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field("minioadmin", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field("minioadmin", alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field("content-resources", alias="MINIO_BUCKET")
    minio_secure: bool = Field(False, alias="MINIO_SECURE")
    
    # n8n Integration
    n8n_webhook_url: Optional[str] = Field(None, alias="N8N_WEBHOOK_URL")
    n8n_intervention_webhook_url: Optional[str] = Field(None, alias="N8N_INTERVENTION_WEBHOOK_URL")
    n8n_api_key: Optional[str] = Field(None, alias="N8N_API_KEY")
    intervention_default_cta_url: Optional[str] = Field(None, alias="INTERVENTION_DEFAULT_CTA_URL")
    
    # Admin Credentials
    admin_email: Optional[str] = Field(None, alias="ADMIN_EMAIL")
    admin_password: Optional[str] = Field(None, alias="ADMIN_PASSWORD")
    
    # Development
    allow_dev_credentials: bool = Field(False, alias="ALLOW_DEV_CREDENTIALS")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        # Allow extra fields to be ignored instead of raising validation errors
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]


settings = get_settings()
