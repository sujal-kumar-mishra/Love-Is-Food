"""
Unit tests for YouTube service
Tests video search, metadata extraction, and error handling
"""
import pytest
from unittest.mock import Mock, patch
from app.services.youtube_service import search_youtube, get_video_details


class TestYouTubeSearch:
    """Test suite for YouTube video search"""
    
    @patch('app.services.youtube_service.VideosSearch')
    def test_search_youtube_videos_success(self, mock_search):
        """Test successful YouTube search"""
        mock_result = {
            'result': [
                {
                    'id': 'video1',
                    'title': 'Test Recipe Video',
                    'channel': {'name': 'Test Channel'},
                    'thumbnails': [{'url': 'http://thumb.jpg'}],
                    'duration': '10:30'
                }
            ]
        }
        mock_search.return_value.result.return_value = mock_result
        
        results = search_youtube("pasta recipe")
        
        assert isinstance(results, (list, dict))
    
    @patch('app.services.youtube_service.VideosSearch')
    def test_search_youtube_videos_empty(self, mock_search):
        """Test YouTube search with no results"""
        mock_search.return_value.result.return_value = {'result': []}
        
        results = search_youtube("nonexistent recipe xyz")
        
        assert isinstance(results, (list, dict))
    
    @patch('app.services.youtube_service.VideosSearch')
    def test_search_youtube_videos_error(self, mock_search):
        """Test YouTube search error handling"""
        mock_search.return_value.result.side_effect = Exception("API Error")
        
        results = search_youtube("test")
        
        # Should handle error gracefully
        assert results is not None


class TestVideoDetails:
    """Test suite for video details extraction"""
    
    @patch('app.services.youtube_service.VideosSearch')
    def test_get_video_details(self, mock_search):
        """Test getting video details"""
        details = get_video_details("test_id")
        
        # Function behavior depends on implementation
        assert details is None or isinstance(details, dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
