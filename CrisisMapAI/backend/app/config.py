
from dotenv import load_dotenv
load_dotenv()
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # PostgreSQL Configuration
    postgres_url: str = "postgresql://crisismap:crisismap@localhost:5433/crisismap"

    # Neo4j Configuration
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    # Redis Configuration (optional)
    redis_url: Optional[str] = "redis://localhost:6379"

    # OpenAI Configuration
    openai_api_key: Optional[str] = None

    # ElevenLabs Speech-to-Text Configuration
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_stt_model_id: str = "scribe_v1"
    elevenlabs_stt_mode: str = "cloud"

    # Twilio Configuration (optional)
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_phone_number: Optional[str] = None

    # Rocketride Configuration (optional)
    rocketride_uri: Optional[str] = None
    rocketride_apikey: Optional[str] = None

    # Application Settings
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "your-secret-key-change-in-production"

    # WebSocket Settings
    ws_host: str = "localhost"
    ws_port: int = 8000

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
    }

settings = Settings()
