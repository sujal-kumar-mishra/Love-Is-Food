"""
Unit tests for AI model and tool extraction
"""
import pytest
from app.models.ai_model import extract_tool_call, _normalize_unit, _word_to_number, _parse_amount


class TestToolExtraction:
    """Test suite for tool call extraction"""
    
    def test_extract_tool_call_valid_json(self):
        """Test extraction of valid JSON tool calls"""
        response = '{"tool_name": "search_youtube", "parameters": {"query": "pasta"}}'
        result = extract_tool_call(response)
        
        assert result is not None
        assert result["tool_name"] == "search_youtube"
        assert result["parameters"]["query"] == "pasta"
    
    def test_extract_tool_call_with_markdown(self):
        """Test JSON extraction from markdown code blocks"""
        response = '```json\n{"tool_name": "set_timer", "parameters": {"duration_minutes": 10}}\n```'
        result = extract_tool_call(response)
        
        assert result is not None
        assert result["tool_name"] == "set_timer"
        assert result["parameters"]["duration_minutes"] == 10
    
    def test_extract_tool_call_conversion_pattern(self):
        """Test fallback regex for unit conversion"""
        response = "2 cups to ml"
        result = extract_tool_call(response)
        
        assert result is not None
        assert result["tool_name"] == "convert_units"
        assert result["parameters"]["amount"] == 2
        assert "cup" in result["parameters"]["from_unit"]
        assert "ml" in result["parameters"]["to_unit"]
    
    def test_extract_tool_call_play_video_numeric(self):
        """Test video play pattern extraction with number"""
        response = "play result 3"
        result = extract_tool_call(response)
        
        assert result is not None
        assert result["tool_name"] == "play_youtube_video"
        assert result["parameters"]["result_number"] == 3
    
    def test_extract_tool_call_play_video_word(self):
        """Test video play pattern extraction with word"""
        response = "play result two"
        result = extract_tool_call(response)
        
        assert result is not None
        assert result["tool_name"] == "play_youtube_video"
        assert result["parameters"]["result_number"] == 2
    
    def test_extract_tool_call_no_tool(self):
        """Test conversational response without tool"""
        response = "Hello! How can I help you today?"
        result = extract_tool_call(response)
        
        assert result is None
    
    def test_extract_tool_call_delete_timer(self):
        """Test delete timer pattern"""
        response = "delete timer 1"
        result = extract_tool_call(response)
        
        assert result is not None
        assert result["tool_name"] == "delete_timer"
    
    def test_extract_tool_call_get_time(self):
        """Test get current time pattern"""
        response = "what's the current time"
        result = extract_tool_call(response)
        
        assert result is not None
        assert result["tool_name"] == "get_current_time"
    
    def test_extract_tool_call_get_date(self):
        """Test get today's date pattern"""
        response = "what's today's date"
        result = extract_tool_call(response)
        
        assert result is not None
        assert result["tool_name"] == "get_today_date"


class TestHelperFunctions:
    """Test suite for helper functions"""
    
    def test_normalize_unit_cups(self):
        """Test unit normalization for cups"""
        assert _normalize_unit("cups") == "cup"
        assert _normalize_unit("cup") == "cup"
    
    def test_normalize_unit_tablespoons(self):
        """Test unit normalization for tablespoons"""
        assert _normalize_unit("tablespoons") == "tablespoon"
        assert _normalize_unit("tablespoon") == "tablespoon"
    
    def test_word_to_number(self):
        """Test word to number conversion"""
        assert _word_to_number("one") == 1
        assert _word_to_number("five") == 5
        assert _word_to_number("ten") == 10
    
    def test_parse_amount_numeric(self):
        """Test parsing numeric amounts"""
        assert _parse_amount("2") == 2.0
        assert _parse_amount("3.5") == 3.5
    
    def test_parse_amount_word(self):
        """Test parsing word amounts"""
        assert _parse_amount("two") == 2.0
        assert _parse_amount("three") == 3.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
