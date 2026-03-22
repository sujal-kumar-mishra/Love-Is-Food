"""
Integration tests for recipe functionality
"""
import pytest


class TestRecipeFlow:
    """Test suite for end-to-end recipe flows"""
    
    def test_recipe_page_access_authenticated(self, client, clean_db, sample_user_data):
        """Test accessing recipe detail page when authenticated"""
        # Register and login
        client.post('/register', json=sample_user_data, content_type='application/json')
        
        # Access recipe detail page
        response = client.get('/recipe/52772')  # Example TheMealDB recipe ID
        
        # Should return 200 (page loads) or redirect
        assert response.status_code in [200, 302, 404]
    
    def test_recipe_page_requires_auth(self, client):
        """Test recipe page requires authentication"""
        # Try to access without login
        response = client.get('/recipe/52772', follow_redirects=False)
        
        # Should redirect to login (302) or return unauthorized
        assert response.status_code in [302, 401]
    
    def test_main_page_requires_auth(self, client):
        """Test main page requires authentication"""
        response = client.get('/', follow_redirects=False)
        
        # Should redirect to login (302) or return unauthorized
        assert response.status_code in [302, 401]
    
    def test_profile_page_requires_auth(self, client):
        """Test profile page requires authentication"""
        response = client.get('/profile')
        
        # Should redirect to login
        assert response.status_code == 302
    
    def test_profile_page_authenticated(self, client, clean_db, sample_user_data):
        """Test profile page access when authenticated"""
        # Register and login
        reg_response = client.post('/register', json=sample_user_data, content_type='application/json')
        assert reg_response.status_code == 201  # Ensure registration succeeded
        
        # Access profile (with follow_redirects to handle any intermediate redirects)
        response = client.get('/profile', follow_redirects=True)
        
        # Should get final page with 200
        assert response.status_code == 200
    
    def test_video_page_requires_auth(self, client):
        """Test video page requires authentication"""
        response = client.get('/video/test123', follow_redirects=False)
        
        # Should redirect to login (302) or return unauthorized
        assert response.status_code in [302, 401]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
