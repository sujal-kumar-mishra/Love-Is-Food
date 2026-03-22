"""
Kitchen Assistant AI - Main Application Entry Point
MVC Architecture with Flask and SocketIO
"""
import os
from app import create_app, socketio
from app.config import get_config
from app.models.ai_model import create_ai_clients, get_ai_response_text, extract_tool_call
from app.routes import init_routes
from app.services.tts_service import init_tts_service

# Get configuration based on environment
config_name = os.getenv('FLASK_ENV', 'development')
config = get_config(config_name)

# Create Flask application
app = create_app(config)

# Initialize AI clients
groq_client, a4f_client = create_ai_clients()

# Initialize TTS service with Coqui TTS
init_tts_service(config.COQUI_TTS_URL)
print(f"✅ TTS Service initialized with Coqui TTS at {config.COQUI_TTS_URL}")

# Create wrapper functions for routes (inject groq_client dependency)
def ai_response_wrapper(command, chat_history):
    """Wrapper to inject groq_client into get_ai_response_text"""
    return get_ai_response_text(command, chat_history, groq_client)

# Initialize routes with AI dependencies
init_routes(app, socketio, a4f_client, ai_response_wrapper, extract_tool_call)

if __name__ == '__main__':
    # Create data directories if they don't exist
    os.makedirs(config.DATA_DIR, exist_ok=True)
    os.makedirs(config.TIMERS_DIR, exist_ok=True)
    
    # Get port from environment variable (for Render deployment)
    port = config.PORT
    
    # Run the Flask app with SocketIO
    if config_name == 'production':
        # Production mode - Gunicorn will handle this
        print(f"🚀 Production server ready on port {port}")
    else:
        # Development mode
        print(f"🚀 Starting Kitchen Assistant AI on http://{config.HOST}:{port}")
        print(f"📊 Environment: {config_name}")
        print(f"🤖 AI Model: {config.AI_MODEL}")
        print(f"🔧 Debug Mode: {config.DEBUG}")
        
        socketio.run(
            app,
            debug=config.DEBUG,
            host=config.HOST,
            port=port,
            allow_unsafe_werkzeug=True
        )
