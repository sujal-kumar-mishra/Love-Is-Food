"""Voice Recognition Testing Suite - Tests AI voice processing"""
import pytest
from unittest.mock import Mock, patch
from app.models.ai_model import extract_tool_call, get_ai_response_text


class TestVoiceInputProcessing:
    """Test suite for voice input processing with AI"""
    
    @patch('app.models.ai_model.Groq')
    def test_simple_recipe_request(self, mock_groq):
        """Test processing simple recipe requests"""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content='{"tool_name": "search_recipes", "parameters": {"query": "chicken"}}'))]
        mock_client.chat.completions.create.return_value = mock_response
        
        response = get_ai_response_text("show me chicken recipe", [], mock_client)
        
        assert response is not None
        assert isinstance(response, str)


class TestToolCallExtraction:
    """Test suite for extracting tool calls from AI responses"""
    
    def test_extract_valid_json_tool_call(self):
        """Test extracting valid JSON tool call"""
        ai_response = '{"tool_name": "search_recipes", "parameters": {"query": "chicken"}}'
        result = extract_tool_call(ai_response)
        
        assert result is not None
        assert result["tool_name"] == "search_recipes"
        assert "parameters" in result
    
    def test_extract_tool_call_with_code_fence(self):
        """Test extracting tool call wrapped in code fence"""
        ai_response = '```json\n{"tool_name": "set_timer", "parameters": {"duration": 5}}\n```'
        result = extract_tool_call(ai_response)
        
        assert result is not None
        assert result["tool_name"] == "set_timer"
    
    def test_extract_no_tool_call(self):
        """Test when response has no tool call"""
        ai_response = "I'm not sure what you mean. Could you clarify?"
        result = extract_tool_call(ai_response)
        
        assert result is None
    
    def test_extract_empty_response(self):
        """Test handling empty response"""
        result = extract_tool_call("")
        assert result is None
