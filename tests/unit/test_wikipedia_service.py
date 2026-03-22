"""
Unit tests for Wikipedia service
Tests Wikipedia search and content retrieval
"""
import pytest
from unittest.mock import Mock, patch
from app.services.wikipedia_service import search_wikipedia


class TestWikipediaSearch:
    """Test suite for Wikipedia search"""
    
    @patch('app.services.wikipedia_service.wikipedia.summary')
    def test_search_wikipedia_success(self, mock_summary):
        """Test successful Wikipedia search"""
        mock_summary.return_value = "Test summary about cooking"
        
        result = search_wikipedia("cooking techniques")
        
        assert isinstance(result, dict)
        assert 'summary' in result
        assert len(result['summary']) > 0
    
    @patch('app.services.wikipedia_service.wikipedia.summary')
    def test_search_wikipedia_not_found(self, mock_summary):
        """Test Wikipedia search with no results"""
        mock_summary.side_effect = Exception("Page not found")
        
        result = search_wikipedia("nonexistentpagetopic12345xyz")
        
        assert isinstance(result, dict)
        assert 'error' in result
        assert "not found" in result['error'].lower() or "could not find" in result['error'].lower()
    
    @patch('app.services.wikipedia_service.wikipedia.summary')
    def test_search_wikipedia_disambiguation(self, mock_summary):
        """Test Wikipedia disambiguation handling"""
        from wikipedia.exceptions import DisambiguationError
        
        mock_summary.side_effect = DisambiguationError("test", ["option1", "option2"])
        
        result = search_wikipedia("mercury")  # Ambiguous term
        
        assert isinstance(result, dict)
        assert 'error' in result
    
    @patch('app.services.wikipedia_service.wikipedia.summary')
    def test_search_wikipedia_network_error(self, mock_summary):
        """Test Wikipedia network error handling"""
        mock_summary.side_effect = ConnectionError("Network error")
        
        result = search_wikipedia("test query")
        
        assert isinstance(result, dict)
        assert 'error' in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
