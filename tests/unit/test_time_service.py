"""
Unit tests for time service
"""
import pytest
from datetime import datetime
from app.services.time_service import get_current_time, get_today_date


class TestTimeService:
    """Test suite for time-related services"""
    
    def test_get_current_time(self):
        """Test current time format"""
        result = get_current_time()
        
        assert "time" in result
        assert isinstance(result["time"], str)
        # Format: "03:45 PM"
        assert ":" in result["time"]
        assert ("AM" in result["time"] or "PM" in result["time"])
    
    def test_get_today_date(self):
        """Test today's date format"""
        result = get_today_date()
        
        assert "date" in result
        assert isinstance(result["date"], str)
        
        # Should contain day of week
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        assert any(day in result["date"] for day in days)
        
        # Should contain month
        now = datetime.now()
        month = now.strftime("%B")
        assert month in result["date"]
        
        # Should have ordinal suffix (st, nd, rd, th)
        assert any(suffix in result["date"] for suffix in ["st", "nd", "rd", "th"])
    
    def test_time_format_consistency(self):
        """Test time format is consistent across calls"""
        result1 = get_current_time()
        result2 = get_current_time()
        
        # Both should have the same format (might differ by minute)
        assert len(result1["time"]) >= 7  # Minimum "1:00 AM"
        assert len(result2["time"]) >= 7
    
    def test_date_format_consistency(self):
        """Test date format is consistent"""
        result1 = get_today_date()
        result2 = get_today_date()
        
        # Same date should be returned
        assert result1["date"] == result2["date"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
