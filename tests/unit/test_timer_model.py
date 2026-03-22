"""
Unit tests for timer model
"""
import pytest
import time
from app.models.timer_model import TimerManager


@pytest.fixture
def timer_manager():
    """Fresh timer manager for each test"""
    manager = TimerManager()
    yield manager
    # Cleanup
    manager.active_timers.clear()


class TestTimerManager:
    """Test suite for timer management"""
    
    def test_create_timer(self, timer_manager):
        """Test timer creation"""
        result = timer_manager.create_timer(5, "pasta")
        
        assert "message" in result
        assert "timer" in result
        assert result["timer"]["name"] == "pasta"
        assert result["timer"]["duration_minutes"] == 5
        assert result["timer"]["id"] in timer_manager.active_timers
    
    def test_create_timer_without_name(self, timer_manager):
        """Test timer creation without custom name"""
        result = timer_manager.create_timer(10)
        
        assert result["timer"]["name"].startswith("Timer")
        assert result["timer"]["duration_minutes"] == 10
    
    def test_list_empty_timers(self, timer_manager):
        """Test listing when no timers exist"""
        result = timer_manager.list_timers()
        
        assert "message" in result
        assert result["message"] == "No active timers"
    
    def test_list_active_timers(self, timer_manager):
        """Test listing active timers"""
        timer_manager.create_timer(10, "sauce")
        timer_manager.create_timer(5, "garlic")
        
        result = timer_manager.list_timers()
        
        assert "timers" in result
        assert len(result["timers"]) == 2
    
    def test_delete_timer_by_id(self, timer_manager):
        """Test timer deletion by ID"""
        create_result = timer_manager.create_timer(10, "test")
        timer_id = create_result["timer"]["id"]
        
        delete_result = timer_manager.delete_timer(timer_id)
        
        assert "message" in delete_result
        assert "deleted successfully" in delete_result["message"]
        assert timer_id not in timer_manager.active_timers
    
    def test_delete_timer_by_name(self, timer_manager):
        """Test timer deletion by name"""
        timer_manager.create_timer(10, "pasta")
        
        result = timer_manager.delete_timer("pasta")
        
        assert "message" in result
        assert "deleted successfully" in result["message"]
    
    def test_delete_nonexistent_timer(self, timer_manager):
        """Test deletion of timer that doesn't exist"""
        result = timer_manager.delete_timer(999)
        
        assert "error" in result
        assert "not found" in result["error"]
    
    def test_multiple_timers(self, timer_manager):
        """Test managing multiple timers"""
        timer_manager.create_timer(5, "timer1")
        timer_manager.create_timer(10, "timer2")
        timer_manager.create_timer(15, "timer3")
        
        result = timer_manager.list_timers()
        
        assert len(result["timers"]) == 3
    
    def test_timer_id_increment(self, timer_manager):
        """Test timer ID increments correctly"""
        result1 = timer_manager.create_timer(5, "first")
        result2 = timer_manager.create_timer(5, "second")
        
        assert result2["timer"]["id"] > result1["timer"]["id"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
