"""
Configuration settings for Kitchen Assistant AI
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Base configuration class"""
    
    # Flask Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here-change-me')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    # Flask-Login Configuration
    REMEMBER_COOKIE_DURATION = 604800  # 7 days in seconds
    SESSION_COOKIE_SECURE = True  # Use HTTPS only in production
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # MongoDB Configuration
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
    MONGODB_DB_NAME = 'kitchen_assistant'
    
    # SocketIO Configuration
    SOCKETIO_CORS_ALLOWED_ORIGINS = "*"
    SOCKETIO_LOGGER = False
    SOCKETIO_ENGINEIO_LOGGER = False
    SOCKETIO_ASYNC_MODE = 'threading'
    
    # AI Model Configuration
    GROQ_API_KEY = os.getenv('GROQ_API_KEY')
    AI_MODEL = "llama-3.3-70b-versatile"
    AI_TEMPERATURE = 0.1
    AI_MAX_TOKENS = 500
    AI_TIMEOUT = 10.0
    
    # Coqui TTS Configuration
    COQUI_TTS_URL = os.getenv('COQUI_TTS_URL', 'http://localhost:5002')
    
    # Conversation Settings
    MAX_CONVERSATION_HISTORY = 12  # Maximum messages to keep
    MAX_HISTORY_FOR_AI = 10        # Maximum messages to send to AI
    
    # Data Directories
    DATA_DIR = 'data'
    TIMERS_DIR = 'data/timers'
    
    # Server Configuration
    HOST = '0.0.0.0'
    PORT = int(os.getenv('PORT', 5000))
    
    # Static and Template Folders
    STATIC_FOLDER = 'static'
    TEMPLATE_FOLDER = 'templates'


class DevelopmentConfig(Config):
    """Development environment configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production environment configuration"""
    DEBUG = False


class TestingConfig(Config):
    """Testing environment configuration"""
    TESTING = True
    DEBUG = True


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config(config_name='default'):
    """Get configuration by name"""
    return config.get(config_name, config['default'])
