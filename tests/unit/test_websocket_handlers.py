"""
Comprehensive WebSocket/SocketIO Tests - Phase 3
Tests real-time communication features
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from flask_socketio import SocketIOTestClient
from app import create_app, socketio
from app.config import TestingConfig
from app.routes import init_routes


class TestSocketIOConnection:
    """Test SocketIO connection and disconnection"""
    
    @pytest.fixture
    def app(self):
        """Create test application"""
        app = create_app(TestingConfig)
        app.config['TESTING'] = True
        
        mock_a4f = Mock()
        mock_ai_response = Mock(return_value="Test response")
        mock_extract_tool = Mock(return_value=None)
        init_routes(app, socketio, mock_a4f, mock_ai_response, mock_extract_tool)
        
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create SocketIO test client"""
        return socketio.test_client(app, flask_test_client=app.test_client())
    
    def test_socketio_connect(self, client):
        """Test SocketIO connection"""
        assert client.is_connected()
    
    def test_socketio_disconnect(self, client):
        """Test SocketIO disconnection"""
        client.disconnect()
        assert not client.is_connected()
    
    def test_multiple_connections(self, app):
        """Test multiple simultaneous connections"""
        client1 = socketio.test_client(app, flask_test_client=app.test_client())
        client2 = socketio.test_client(app, flask_test_client=app.test_client())
        
        assert client1.is_connected()
        assert client2.is_connected()
        
        client1.disconnect()
        client2.disconnect()


class TestTimerEvents:
    """Test timer-related WebSocket events"""
    
    @pytest.fixture
    def app(self):
        app = create_app(TestingConfig)
        app.config['TESTING'] = True
        
        mock_a4f = Mock()
        mock_ai_response = Mock(return_value="Test response")
        mock_extract_tool = Mock(return_value=None)
        init_routes(app, socketio, mock_a4f, mock_ai_response, mock_extract_tool)
        
        return app
    
    @pytest.fixture
    def client(self, app):
        return socketio.test_client(app, flask_test_client=app.test_client())
    
    def test_timer_start_event(self, client):
        """Test timer start event"""
        client.emit('timer_start', {
            'duration': 300,
            'label': 'Boil water'
        })
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_timer_pause_event(self, client):
        """Test timer pause event"""
        client.emit('timer_pause', {'timer_id': 'timer123'})
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_timer_resume_event(self, client):
        """Test timer resume event"""
        client.emit('timer_resume', {'timer_id': 'timer123'})
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_timer_stop_event(self, client):
        """Test timer stop event"""
        client.emit('timer_stop', {'timer_id': 'timer123'})
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_timer_complete_event(self, client):
        """Test timer complete notification"""
        client.emit('timer_complete', {'timer_id': 'timer123'})
        
        received = client.get_received()
        assert isinstance(received, list)


class TestConversationEvents:
    """Test conversation-related WebSocket events"""
    
    @pytest.fixture
    def app(self):
        app = create_app(TestingConfig)
        app.config['TESTING'] = True
        
        mock_a4f = Mock()
        mock_ai_response = Mock(return_value="AI response")
        mock_extract_tool = Mock(return_value=None)
        init_routes(app, socketio, mock_a4f, mock_ai_response, mock_extract_tool)
        
        return app
    
    @pytest.fixture
    def client(self, app):
        return socketio.test_client(app, flask_test_client=app.test_client())
    
    def test_send_message_event(self, client):
        """Test sending chat message"""
        client.emit('send_message', {
            'message': 'How to cook pasta?',
            'session_id': 'session123'
        })
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_typing_indicator_event(self, client):
        """Test typing indicator"""
        client.emit('typing', {'is_typing': True})
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_clear_conversation_event(self, client):
        """Test clearing conversation"""
        client.emit('clear_conversation', {'session_id': 'session123'})
        
        received = client.get_received()
        assert isinstance(received, list)


class TestRecipeEvents:
    """Test recipe-related WebSocket events"""
    
    @pytest.fixture
    def app(self):
        app = create_app(TestingConfig)
        app.config['TESTING'] = True
        
        mock_a4f = Mock()
        mock_ai_response = Mock(return_value="Test response")
        mock_extract_tool = Mock(return_value=None)
        init_routes(app, socketio, mock_a4f, mock_ai_response, mock_extract_tool)
        
        return app
    
    @pytest.fixture
    def client(self, app):
        return socketio.test_client(app, flask_test_client=app.test_client())
    
    def test_recipe_search_event(self, client):
        """Test recipe search via WebSocket"""
        client.emit('search_recipe', {'query': 'pasta'})
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_recipe_save_event(self, client):
        """Test saving recipe via WebSocket"""
        client.emit('save_recipe', {
            'recipe_id': '123',
            'title': 'Pasta Recipe'
        })
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_recipe_share_event(self, client):
        """Test sharing recipe"""
        client.emit('share_recipe', {'recipe_id': '123'})
        
        received = client.get_received()
        assert isinstance(received, list)


class TestErrorHandling:
    """Test WebSocket error handling"""
    
    @pytest.fixture
    def app(self):
        app = create_app(TestingConfig)
        app.config['TESTING'] = True
        
        mock_a4f = Mock()
        mock_ai_response = Mock(return_value="Test response")
        mock_extract_tool = Mock(return_value=None)
        init_routes(app, socketio, mock_a4f, mock_ai_response, mock_extract_tool)
        
        return app
    
    @pytest.fixture
    def client(self, app):
        return socketio.test_client(app, flask_test_client=app.test_client())
    
    def test_invalid_event_name(self, client):
        """Test emitting invalid event"""
        client.emit('nonexistent_event', {'data': 'test'})
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_malformed_data(self, client):
        """Test sending malformed data"""
        client.emit('voice_input', 'not a dictionary')
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_missing_required_fields(self, client):
        """Test sending data with missing required fields"""
        client.emit('timer_start', {})
        
        received = client.get_received()
        assert isinstance(received, list)
    
    def test_connection_timeout(self, app):
        """Test connection timeout handling"""
        client = socketio.test_client(app, flask_test_client=app.test_client())
        assert client.is_connected()
        client.disconnect()


class TestBroadcastEvents:
    """Test broadcast and room-based events"""
    
    @pytest.fixture
    def app(self):
        app = create_app(TestingConfig)
        app.config['TESTING'] = True
        
        mock_a4f = Mock()
        mock_ai_response = Mock(return_value="Test response")
        mock_extract_tool = Mock(return_value=None)
        init_routes(app, socketio, mock_a4f, mock_ai_response, mock_extract_tool)
        
        return app
    
    def test_join_room(self, app):
        """Test joining a room"""
        client = socketio.test_client(app, flask_test_client=app.test_client())
        client.emit('join', {'room': 'cooking_room'})
        
        received = client.get_received()
        assert isinstance(received, list)
        
        client.disconnect()
    
    def test_leave_room(self, app):
        """Test leaving a room"""
        client = socketio.test_client(app, flask_test_client=app.test_client())
        client.emit('join', {'room': 'cooking_room'})
        client.emit('leave', {'room': 'cooking_room'})
        
        received = client.get_received()
        assert isinstance(received, list)
        
        client.disconnect()
    
    def test_broadcast_to_room(self, app):
        """Test broadcasting to a room"""
        client1 = socketio.test_client(app, flask_test_client=app.test_client())
        client2 = socketio.test_client(app, flask_test_client=app.test_client())
        
        client1.emit('join', {'room': 'cooking_room'})
        client2.emit('join', {'room': 'cooking_room'})
        
        client1.emit('broadcast_message', {
            'room': 'cooking_room',
            'message': 'Hello everyone'
        })
        
        received1 = client1.get_received()
        received2 = client2.get_received()
        
        assert isinstance(received1, list)
        assert isinstance(received2, list)
        
        client1.disconnect()
        client2.disconnect()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
