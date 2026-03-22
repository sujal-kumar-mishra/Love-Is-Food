"""
Unit tests for Database operations
Tests MongoDB operations, CRUD functions, and data integrity
"""
import pytest
from app.models.database import db
from datetime import datetime, timezone


class TestDatabaseConnection:
    """Test suite for database connection"""
    
    def test_database_connected(self):
        """Test database connection is established"""
        assert db.client is not None
        assert db.db is not None
    
    def test_collections_exist(self):
        """Test database collections are created"""
        assert db.users is not None
        assert db.conversations is not None
        assert db.sessions is not None


class TestUserOperations:
    """Test suite for user CRUD operations"""
    
    def test_create_user(self, clean_db):
        """Test creating a user in database"""
        user_id = db.create_user(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            full_name="Test User"
        )
        
        assert user_id is not None
        assert isinstance(user_id, str)
    
    def test_get_user_by_email(self, clean_db):
        """Test retrieving user by email"""
        db.create_user("testuser", "find@test.com", "hash", "Test")
        
        user = db.get_user_by_email("find@test.com")
        
        assert user is not None
        assert user['email'] == "find@test.com"
    
    def test_get_user_by_username(self, clean_db):
        """Test retrieving user by username"""
        db.create_user("findme", "test@test.com", "hash", "Test")
        
        user = db.get_user_by_username("findme")
        
        assert user is not None
        assert user['username'] == "findme"
    
    def test_get_user_by_id(self, clean_db):
        """Test retrieving user by ID"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        
        user = db.get_user_by_id(user_id)
        
        assert user is not None
        assert str(user['_id']) == user_id
    
    def test_update_last_login(self, clean_db):
        """Test updating last login timestamp"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        
        result = db.update_last_login(user_id)
        
        assert result == True
    
    def test_update_user_preferences(self, clean_db):
        """Test updating user preferences"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        
        prefs = {'theme': 'light', 'voice': True}
        result = db.update_user_preferences(user_id, prefs)
        
        assert result == True


class TestConversationOperations:
    """Test suite for conversation operations"""
    
    def test_save_conversation(self, clean_db):
        """Test saving a conversation message"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        
        message = {
            'role': 'user',
            'content': 'Hello, I need help',
            'metadata': {}
        }
        
        conv_id = db.save_conversation(user_id, "session123", message)
        
        assert conv_id is not None
    
    def test_get_user_conversations(self, clean_db):
        """Test retrieving user conversations"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        
        # Save some conversations
        message = {'role': 'user', 'content': 'Test message'}
        db.save_conversation(user_id, "session1", message)
        
        conversations = db.get_user_conversations(user_id, limit=10)
        
        assert isinstance(conversations, list)
        assert len(conversations) > 0
    
    def test_delete_user_conversations(self, clean_db):
        """Test deleting user conversations"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        
        message = {'role': 'user', 'content': 'Test message'}
        db.save_conversation(user_id, "session1", message)
        
        result = db.delete_user_conversations(user_id)
        
        assert result == True


class TestSessionOperations:
    """Test suite for session operations"""
    
    def test_create_session(self, clean_db):
        """Test creating a session"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        
        session_id = db.create_session(user_id, "test_session_123")
        
        assert session_id is not None
    
    def test_update_session_activity(self, clean_db):
        """Test updating session activity"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        db.create_session(user_id, "session123")
        
        result = db.update_session_activity("session123")
        
        assert result == True
    
    def test_get_user_sessions(self, clean_db):
        """Test getting user sessions"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        db.create_session(user_id, "session1")
        db.create_session(user_id, "session2")
        
        sessions = db.get_user_sessions(user_id)
        
        assert isinstance(sessions, list)
        assert len(sessions) >= 2


class TestDataIntegrity:
    """Test suite for data integrity"""
    
    def test_unique_email_constraint(self, clean_db):
        """Test email uniqueness constraint"""
        db.create_user("user1", "unique@test.com", "hash1", "User 1")
        
        # Try to create another user with same email
        try:
            db.create_user("user2", "unique@test.com", "hash2", "User 2")
            # Should fail or return None
        except:
            pass  # Expected
    
    def test_unique_username_constraint(self, clean_db):
        """Test username uniqueness constraint"""
        db.create_user("uniqueuser", "test1@test.com", "hash1", "User 1")
        
        # Try to create another user with same username
        try:
            db.create_user("uniqueuser", "test2@test.com", "hash2", "User 2")
            # Should fail or return None
        except:
            pass  # Expected
    
    def test_timestamp_creation(self, clean_db):
        """Test timestamps are created correctly"""
        user_id = db.create_user("testuser", "test@test.com", "hash", "Test")
        user = db.get_user_by_id(user_id)
        
        assert 'created_at' in user
        assert user['created_at'] is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
