"""
Performance Testing Suite
Evaluates speed, responsiveness, and stability under various conditions
"""
import pytest
import time
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock
from flask import session
from app import create_app
from app.config import TestingConfig
from app.models.database import Database


class TestResponseTime:
    """Test suite for API response time performance"""
    
    # Use shared app fixture from conftest.py instead of creating new one
    
    def test_homepage_response_time(self, client):
        """Test homepage loads within acceptable time (using shared fixtures)"""
        start_time = time.time()
        response = client.get('/', follow_redirects=True)
        end_time = time.time()
        
        response_time = end_time - start_time
        
        # Accept both 200 (if logged in) or successful redirect to login
        assert response.status_code in [200, 302]
        assert response_time < 2.0, f"Homepage took {response_time:.2f}s (should be < 2s)"
    
    
    def test_login_page_response_time(self, client):
        """Test login page loads within acceptable time"""
        start_time = time.time()
        response = client.get('/login', follow_redirects=True)
        end_time = time.time()
        
        response_time = end_time - start_time
        
        assert response.status_code == 200
        assert response_time < 2.0, f"Login page took {response_time:.2f}s (should be < 2s)"
    
    def test_register_page_response_time(self, client):
        """Test registration page loads within acceptable time"""
        start_time = time.time()
        response = client.get('/register', follow_redirects=True)
        end_time = time.time()
        
        response_time = end_time - start_time
        
        assert response.status_code == 200
        assert response_time < 2.0, f"Register page took {response_time:.2f}s (should be < 2s)"


class TestWebSocketPerformance:
    """Test suite for real-time WebSocket performance"""
    
    def test_websocket_connection_time(self, app):
        """Test WebSocket connection establishes quickly"""
        from flask_socketio import SocketIOTestClient
        
        start_time = time.time()
        client = SocketIOTestClient(app, app.extensions['socketio'])
        end_time = time.time()
        
        connection_time = end_time - start_time
        
        assert connection_time < 1.0, f"WebSocket connection took {connection_time:.2f}s (should be < 1s)"
    
    def test_websocket_multiple_clients(self, app):
        """Test WebSocket handles multiple concurrent connections"""
        from flask_socketio import SocketIOTestClient
        
        start_time = time.time()
        clients = [SocketIOTestClient(app, app.extensions['socketio']) for _ in range(5)]
        end_time = time.time()
        
        total_time = end_time - start_time
        
        assert len(clients) == 5
        assert total_time < 5.0, f"Multiple connections took {total_time:.2f}s (should be < 5s)"


class TestTimerAccuracy:
    """Test suite for timer manager performance"""
    
    def test_timer_creation_performance(self):
        """Test timer creation performance"""
        from app.models.timer_model import timer_manager
        
        start_time = time.time()
        
        timers = []
        for i in range(50):
            result = timer_manager.create_timer(
                duration_minutes=1,
                timer_name=f"Test Timer {i}"
            )
            timers.append(result['timer']['id'])
        
        end_time = time.time()
        total_time = end_time - start_time
        
        assert len(timers) == 50
        assert total_time < 5.0, f"Creating 50 timers took {total_time:.2f}s (should be < 5s)"
        
        # Cleanup
        for timer_id in timers:
            timer_manager.delete_timer(timer_id)
    
    def test_timer_retrieval_performance(self):
        """Test timer retrieval speed"""
        from app.models.timer_model import timer_manager
        
        # Create test timers
        timer_ids = []
        for i in range(20):
            result = timer_manager.create_timer(
                duration_minutes=1,
                timer_name=f"Test Timer {i}"
            )
            timer_ids.append(result['timer']['id'])
        
        start_time = time.time()
        result = timer_manager.list_timers()
        end_time = time.time()
        
        retrieval_time = end_time - start_time
        
        assert 'timers' in result
        assert len(result['timers']) >= 20
        assert retrieval_time < 1.0, f"Retrieving timers took {retrieval_time:.2f}s (should be < 1s)"
        
        # Cleanup
        for timer_id in timer_ids:
            timer_manager.delete_timer(timer_id)
    
    def test_timer_update_performance(self):
        """Test timer list operations performance"""
        from app.models.timer_model import timer_manager
        
        # Create test timers
        timer_ids = []
        for i in range(10):
            result = timer_manager.create_timer(
                duration_minutes=1,
                timer_name=f"Update Test {i}"
            )
            timer_ids.append(result['timer']['id'])
        
        start_time = time.time()
        
        # List timers multiple times
        for i in range(10):
            timer_manager.list_timers()
        
        end_time = time.time()
        total_time = end_time - start_time
        
        assert total_time < 2.0, f"10 timer list operations took {total_time:.2f}s (should be < 2s)"
        
        # Cleanup
        for timer_id in timer_ids:
            timer_manager.delete_timer(timer_id)


class TestConversionPerformance:
    """Test suite for unit conversion performance"""
    
    def test_single_conversion_speed(self):
        """Test single conversion operation speed"""
        from app.services.conversion_service import convert_units
        
        start_time = time.time()
        result = convert_units(1, 'cup', 'ml')
        end_time = time.time()
        
        conversion_time = end_time - start_time
        
        assert 'result' in result
        assert conversion_time < 0.1, f"Conversion took {conversion_time:.4f}s (should be < 0.1s)"
    
    def test_batch_conversion_performance(self):
        """Test batch conversion operations"""
        from app.services.conversion_service import convert_units
        
        conversions = [
            (1, 'cup', 'ml'),
            (2, 'tablespoon', 'ml'),
            (1, 'liter', 'gallon'),
            (100, 'teaspoon', 'cup'),
            (5, 'gallon', 'liter')
        ]
        
        start_time = time.time()
        
        results = []
        for value, from_unit, to_unit in conversions:
            result = convert_units(value, from_unit, to_unit)
            results.append(result)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        assert len(results) == 5
        assert total_time < 1.0, f"Batch conversions took {total_time:.4f}s (should be < 1s)"


class TestDatabasePerformance:
    """Test suite for database operation performance"""
    
    @pytest.fixture
    def db(self):
        """Create database instance"""
        return Database()
    
    def test_user_creation_speed(self, db):
        """Test user creation performance"""
        start_time = time.time()
        
        user_id = db.create_user(
            username=f"perf_user_{time.time()}",
            email=f"perf_{time.time()}@test.com",
            password_hash="hashed_password"
        )
        
        end_time = time.time()
        creation_time = end_time - start_time
        
        assert user_id is not None
        assert creation_time < 1.0, f"User creation took {creation_time:.2f}s (should be < 1s)"
    
    def test_user_retrieval_speed(self, db):
        """Test user retrieval performance"""
        # Create test user
        username = f"retrieve_user_{time.time()}"
        db.create_user(username, f"{username}@test.com", "password_hash")
        
        start_time = time.time()
        user = db.get_user_by_username(username)
        end_time = time.time()
        
        retrieval_time = end_time - start_time
        
        assert user is not None
        assert retrieval_time < 0.5, f"User retrieval took {retrieval_time:.2f}s (should be < 0.5s)"
    
    def test_conversation_save_performance(self, db):
        """Test conversation saving performance"""
        user_id = "perf_test_user"
        session_id = "test_session_123"
        
        start_time = time.time()
        
        for i in range(10):
            db.save_conversation(
                user_id=user_id,
                session_id=session_id,
                message={
                    'role': 'user',
                    'content': f'Test message {i}',
                    'timestamp': datetime.now().isoformat()
                }
            )
        
        end_time = time.time()
        total_time = end_time - start_time
        
        assert total_time < 5.0, f"Saving 10 conversations took {total_time:.2f}s (should be < 5s)"


class TestAPIIntegrationPerformance:
    """Test suite for external API integration performance"""
    
    def test_youtube_search_performance(self):
        """Test YouTube search function performance"""
        from app.services.youtube_service import search_youtube
        
        start_time = time.time()
        results = search_youtube('chicken recipe')
        end_time = time.time()
        
        search_time = end_time - start_time
        
        assert results is not None
        assert search_time < 5.0, f"YouTube search took {search_time:.2f}s (should be < 5s)"
    
    @patch('app.services.wikipedia_service.wikipedia')
    def test_wikipedia_search_performance(self, mock_wiki):
        """Test Wikipedia search API response time"""
        from app.services.wikipedia_service import search_wikipedia
        
        # Mock Wikipedia API response
        mock_wiki.summary.return_value = "Test summary"
        
        start_time = time.time()
        result = search_wikipedia('chicken')
        end_time = time.time()
        
        search_time = end_time - start_time
        
        assert result is not None
        assert search_time < 2.0, f"Wikipedia search took {search_time:.2f}s (should be < 2s)"


class TestConcurrentRequests:
    """Test suite for concurrent request handling"""

    def test_concurrent_page_loads(self, app):
        """Test handling multiple concurrent page requests using independent clients per thread"""
        import threading

        results = []
        lock = threading.Lock()

        def load_page():
            # Each thread must create its own test client (Flask test client is not thread-safe)
            with app.test_client() as c:
                start = time.time()
                response = c.get('/login', follow_redirects=True)
                duration = time.time() - start
                with lock:
                    results.append((response.status_code, duration))

        threads = [threading.Thread(target=load_page) for _ in range(10)]

        start_time = time.time()
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        end_time = time.time()

        total_time = end_time - start_time

        assert len(results) == 10
        # Allow a few failures under load; require most to succeed
        successful = sum(1 for status, _ in results if status == 200)
        assert successful >= 8, f"Only {successful}/10 requests succeeded (expected at least 8)"
        assert total_time < 12.0, f"10 concurrent requests took {total_time:.2f}s (should be < 12s)"

