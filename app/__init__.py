"""
Kitchen Assistant AI - Flask Application Factory
Professional MVC Architecture with Authentication
"""
from flask import Flask
from flask_socketio import SocketIO
from flask_login import LoginManager
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize SocketIO (will be bound to app in create_app)
socketio = SocketIO()

# Initialize Flask-Login
login_manager = LoginManager()


def create_app(config_class):
    """
    Application factory pattern for creating Flask app
    
    Args:
        config_class: Configuration class (from app.config)
        
    Returns:
        Flask application instance
    """
    # Create Flask app
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config_class)
    
    # Initialize Flask-Login
    login_manager.init_app(app)
    login_manager.login_view = 'auth.welcome'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.login_message_category = 'info'
    
    # User loader for Flask-Login
    from app.models.user_model import User
    
    @login_manager.user_loader
    def load_user(user_id):
        """Load user by ID for Flask-Login"""
        return User.get_by_id(user_id)
    
    # Initialize SocketIO with app
    socketio.init_app(
        app,
        cors_allowed_origins=app.config['SOCKETIO_CORS_ALLOWED_ORIGINS'],
        logger=app.config['SOCKETIO_LOGGER'],
        engineio_logger=app.config['SOCKETIO_ENGINEIO_LOGGER'],
        async_mode=app.config['SOCKETIO_ASYNC_MODE']
    )
    
    # Set up timer manager with socketio
    from .models.timer_model import timer_manager
    timer_manager.set_socketio(socketio)
    
    # Register authentication blueprint
    from app.controllers.auth_controller import auth_bp
    app.register_blueprint(auth_bp)
    
    # Note: Main routes are initialized in run.py after AI model setup
    # This allows dependency injection for AI functions
    
    print("✅ Flask app created successfully")
    return app


# This will be imported by run.py
__all__ = ['create_app', 'socketio']
