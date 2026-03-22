"""
Pytest configuration and fixtures for Kitchen Assistant AI tests
"""
import pytest
import os
import sys
from unittest.mock import Mock

# Add the parent directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, socketio
from app.config import TestingConfig
from app.models.database import db


@pytest.fixture(scope='session')
def app():
    """Create application for testing"""
    # Use test database
    os.environ['MONGODB_URI'] = 'mongodb://localhost:27017/kitchen_test'
    os.environ['FLASK_ENV'] = 'testing'
    
    app = create_app(TestingConfig)
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    
    # Initialize routes with mock dependencies (this also registers main_bp)
    from app.routes import init_routes
    
    # Create mock dependencies for testing
    mock_a4f = Mock()
    mock_ai_response = Mock(return_value="Test response")
    mock_extract_tool = Mock(return_value=None)
    
    # Initialize routes with mocks (this registers the blueprint too)
    init_routes(app, socketio, mock_a4f, mock_ai_response, mock_extract_tool)
    
    return app


@pytest.fixture(scope='function')
def client(app):
    """Test client for HTTP requests"""
    return app.test_client()


@pytest.fixture(scope='function')
def clean_db():
    """Clean database before each test"""
    # Clean test collections
    if db.client:
        try:
            db.users.delete_many({})
            db.conversations.delete_many({})
            db.sessions.delete_many({})
        except Exception as e:
            print(f"Warning: Could not clean database: {e}")
    
    yield
    
    # Cleanup after test
    if db.client:
        try:
            db.users.delete_many({})
            db.conversations.delete_many({})
            db.sessions.delete_many({})
        except Exception as e:
            print(f"Warning: Could not clean database: {e}")


@pytest.fixture
def mock_groq_client():
    """Mock Groq API client"""
    mock = Mock()
    mock.chat.completions.create.return_value.choices = [
        Mock(message=Mock(content='{"tool_name": "test", "parameters": {}}'))
    ]
    return mock


@pytest.fixture
def sample_user_data():
    """Sample user data for testing"""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "SecurePass123!",
        "full_name": "Test User"
    }
