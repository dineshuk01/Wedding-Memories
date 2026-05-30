from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = ""
    frontend_origin: str = "http://localhost:5173"
    presigned_url_expires_seconds: int = 3600

    # Gallery login credentials (kept server-side, never sent to the browser)
    app_username: str = "admin"
    app_password: str = "changeme"
    
    # Optional CloudFront CDN configurations for signed URL delivery
    cloudfront_domain: str = ""
    cloudfront_key_id: str = ""
    cloudfront_private_key_path: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
