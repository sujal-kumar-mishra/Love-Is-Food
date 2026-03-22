"""
Integration tests for authentication flow
"""
import pytest
from app.models.user_model import User


class TestAuthenticationFlow:
    """Test suite for complete authentication flows"""
    
    def test_register_new_user(self, client, clean_db):
        """Test user registration"""
        register_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User"
        }
        
        response = client.post('/register', 
                             json=register_data,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['success'] == True
        assert 'user' in data
    
    def test_register_duplicate_email(self, client, clean_db):
        """Test registration with duplicate email"""
        # First registration
        register_data = {
            "username": "user1",
            "email": "duplicate@example.com",
            "password": "SecurePass123!",
            "full_name": "User One"
        }
        client.post('/register', json=register_data, content_type='application/json')
        
        # Try to register again with same email
        register_data2 = {
            "username": "user2",
            "email": "duplicate@example.com",
            "password": "SecurePass456!",
            "full_name": "User Two"
        }
        response = client.post('/register', json=register_data2, content_type='application/json')
        
        assert response.status_code == 409  # Conflict
        data = response.get_json()
        assert data['success'] == False
    
    def test_register_duplicate_username(self, client, clean_db):
        """Test registration with duplicate username"""
        # First registration
        register_data = {
            "username": "sameuser",
            "email": "user1@example.com",
            "password": "SecurePass123!",
            "full_name": "User One"
        }
        client.post('/register', json=register_data, content_type='application/json')
        
        # Try to register again with same username
        register_data2 = {
            "username": "sameuser",
            "email": "user2@example.com",
            "password": "SecurePass456!",
            "full_name": "User Two"
        }
        response = client.post('/register', json=register_data2, content_type='application/json')
        
        assert response.status_code == 409  # Conflict
    
    def test_login_success(self, client, clean_db):
        """Test successful login"""
        # Register first
        register_data = {
            "username": "loginuser",
            "email": "login@example.com",
            "password": "SecurePass123!",
            "full_name": "Login User"
        }
        client.post('/register', json=register_data, content_type='application/json')
        
        # Logout
        client.post('/logout')
        
        # Login
        login_data = {
            "email": "login@example.com",
            "password": "SecurePass123!"
        }
        response = client.post('/login', json=login_data, content_type='application/json')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] == True
    
    def test_login_invalid_credentials(self, client, clean_db):
        """Test login with invalid credentials"""
        login_data = {
            "email": "wrong@example.com",
            "password": "wrongpass"
        }
        response = client.post('/login', json=login_data, content_type='application/json')
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['success'] == False
    
    def test_login_missing_fields(self, client, clean_db):
        """Test login with missing fields"""
        login_data = {
            "email": "test@example.com"
            # Missing password
        }
        response = client.post('/login', json=login_data, content_type='application/json')
        
        assert response.status_code == 400
    
    def test_register_weak_password(self, client, clean_db):
        """Test registration with weak password"""
        register_data = {
            "username": "weakuser",
            "email": "weak@example.com",
            "password": "123",  # Too short
            "full_name": "Weak User"
        }
        response = client.post('/register', json=register_data, content_type='application/json')
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] == False
    
    def test_complete_auth_flow(self, client, clean_db):
        """Test complete flow: register → login → logout"""
        # Register
        register_data = {
            "username": "flowuser",
            "email": "flow@example.com",
            "password": "SecurePass123!",
            "full_name": "Flow User"
        }
        reg_response = client.post('/register', json=register_data, content_type='application/json')
        assert reg_response.status_code == 201
        
        # Logout
        client.post('/logout')
        
        # Login
        login_data = {
            "email": "flow@example.com",
            "password": "SecurePass123!"
        }
        login_response = client.post('/login', json=login_data, content_type='application/json')
        assert login_response.status_code == 200
        
        # Logout (returns 302 redirect or 200 JSON)
        logout_response = client.post('/logout')
        assert logout_response.status_code in [200, 302]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
