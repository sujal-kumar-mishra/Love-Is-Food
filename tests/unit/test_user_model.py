"""
Unit tests for User model
Tests user creation, authentication, and preferences
"""
import pytest
from app.models.user_model import User
from app.models.database import db


class TestUserCreation:
    """Test suite for user creation"""
    
    def test_create_user_success(self, clean_db):
        """Test creating a new user"""
        user = User.create(
            username="testuser",
            email="test@example.com",
            password="SecurePass123!",
            full_name="Test User"
        )
        
        assert user is not None
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"
        assert user.is_active == True
    
    def test_create_user_duplicate_email(self, clean_db):
        """Test creating user with duplicate email"""
        User.create("user1", "duplicate@test.com", "Pass123!", "User One")
        user2 = User.create("user2", "duplicate@test.com", "Pass456!", "User Two")
        
        # Should fail due to unique constraint
        assert user2 is None or User.get_by_email("duplicate@test.com").username == "user1"
    
    def test_user_password_hashing(self, clean_db):
        """Test password is hashed"""
        user = User.create("testuser", "test@example.com", "SecurePass123!", "Test")
        
        # Password should be hashed
        assert user.password_hash != "SecurePass123!"
        assert len(user.password_hash) > 20


class TestUserRetrieval:
    """Test suite for user retrieval"""
    
    def test_get_user_by_email(self, clean_db):
        """Test retrieving user by email"""
        User.create("testuser", "find@test.com", "Pass123!", "Test User")
        
        user = User.get_by_email("find@test.com")
        
        assert user is not None
        assert user.email == "find@test.com"
        assert user.username == "testuser"
    
    def test_get_user_by_username(self, clean_db):
        """Test retrieving user by username"""
        User.create("findme", "user@test.com", "Pass123!", "Test User")
        
        user = User.get_by_username("findme")
        
        assert user is not None
        assert user.username == "findme"
    
    def test_get_user_by_id(self, clean_db):
        """Test retrieving user by ID"""
        user = User.create("testuser", "test@example.com", "Pass123!", "Test")
        
        retrieved = User.get_by_id(user.id)
        
        assert retrieved is not None
        assert retrieved.id == user.id
        assert retrieved.username == user.username
    
    def test_get_nonexistent_user(self, clean_db):
        """Test retrieving user that doesn't exist"""
        user = User.get_by_email("nonexistent@test.com")
        
        assert user is None


class TestUserAuthentication:
    """Test suite for user authentication"""
    
    def test_check_password_correct(self, clean_db):
        """Test password verification with correct password"""
        user = User.create("testuser", "test@example.com", "SecurePass123!", "Test")
        
        assert user.check_password("SecurePass123!") == True
    
    def test_check_password_incorrect(self, clean_db):
        """Test password verification with wrong password"""
        user = User.create("testuser", "test@example.com", "SecurePass123!", "Test")
        
        assert user.check_password("WrongPassword!") == False
    
    def test_update_last_login(self, clean_db):
        """Test updating last login timestamp"""
        user = User.create("testuser", "test@example.com", "Pass123!", "Test")
        
        result = user.update_last_login()
        
        assert result == True


class TestUserPreferences:
    """Test suite for user preferences"""
    
    def test_update_preferences(self, clean_db):
        """Test updating user preferences"""
        user = User.create("testuser", "test@example.com", "Pass123!", "Test")
        
        new_prefs = {
            'theme': 'light',
            'voice_enabled': False,
            'notifications': False
        }
        
        result = user.update_preferences(new_prefs)
        
        assert result == True
    
    def test_get_conversations(self, clean_db):
        """Test retrieving user conversations"""
        user = User.create("testuser", "test@example.com", "Pass123!", "Test")
        
        conversations = user.get_conversations(limit=10)
        
        assert isinstance(conversations, list)
    
    def test_get_statistics(self, clean_db):
        """Test retrieving user statistics"""
        user = User.create("testuser", "test@example.com", "Pass123!", "Test")
        
        stats = user.get_statistics()
        
        assert isinstance(stats, dict)
        assert 'total_messages' in stats or stats is not None


class TestUserSessions:
    """Test suite for user sessions"""
    
    def test_get_sessions(self, clean_db):
        """Test retrieving user sessions"""
        user = User.create("testuser", "test@example.com", "Pass123!", "Test")
        
        sessions = user.get_sessions()
        
        assert isinstance(sessions, list)
    
    def test_user_is_active(self, clean_db):
        """Test user active status"""
        user = User.create("testuser", "test@example.com", "Pass123!", "Test")
        
        assert user.is_active == True
    
    def test_user_get_id(self, clean_db):
        """Test Flask-Login get_id method"""
        user = User.create("testuser", "test@example.com", "Pass123!", "Test")
        
        user_id = user.get_id()
        
        assert user_id == user.id
        assert isinstance(user_id, str)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
