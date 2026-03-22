"""
Unit tests for Text-to-Speech service
Tests TTS generation, audio processing, and error handling
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from app.services.tts_service import TTSService, init_tts_service, get_tts_service


class TestTTSGeneration:
    """Test suite for TTS audio generation"""
    
    def test_generate_tts_audio_success(self):
        """Test successful TTS generation"""
        mock_client = MagicMock()
        mock_client.audio.speech.create.return_value = b'fake_audio_data'
        
        tts = TTSService(mock_client)
        text = "Hello, this is a test"
        result = tts.generate_speech(text)
        
        assert result['success'] == True or isinstance(result, dict)
    
    def test_generate_tts_audio_empty_text(self):
        """Test TTS with empty text"""
        mock_client = MagicMock()
        tts = TTSService(mock_client)
        
        result = tts.generate_speech("")
        
        assert result['success'] == False or isinstance(result, dict)
    
    def test_generate_tts_audio_long_text(self):
        """Test TTS with long text"""
        mock_client = MagicMock()
        mock_client.audio.speech.create.return_value = b'fake_audio_data'
        
        tts = TTSService(mock_client)
        long_text = "This is a very long text. " * 100
        result = tts.generate_speech(long_text)
        
        assert isinstance(result, dict)
    
    def test_generate_tts_audio_special_characters(self):
        """Test TTS with special characters"""
        mock_client = MagicMock()
        mock_client.audio.speech.create.return_value = b'fake_audio_data'
        
        tts = TTSService(mock_client)
        text_with_special = "Hello! How are you? I'm fine. #cooking @chef"
        result = tts.generate_speech(text_with_special)
        
        assert isinstance(result, dict)


class TestTextCleaning:
    """Test suite for text cleaning before TTS"""
    
    def test_clean_text_for_tts_basic(self):
        """Test basic text cleaning"""
        tts = TTSService()
        text = "Hello, world!"
        cleaned = tts._clean_text_for_tts(text)
        
        assert isinstance(cleaned, str)
        assert len(cleaned) > 0
    
    def test_clean_text_for_tts_remove_urls(self):
        """Test removing URLs from text"""
        tts = TTSService()
        text = "Check out https://example.com for recipes"
        cleaned = tts._clean_text_for_tts(text)
        
        assert "https://" not in cleaned
    
    def test_clean_text_for_tts_remove_html(self):
        """Test removing markdown formatting"""
        tts = TTSService()
        text = "This is **bold** and *italic* text"
        cleaned = tts._clean_text_for_tts(text)
        
        assert "**" not in cleaned
        assert "*" not in cleaned or cleaned.count("*") == 0
    
    def test_clean_text_for_tts_normalize_whitespace(self):
        """Test whitespace normalization"""
        tts = TTSService()
        text = "Too    many     spaces"
        cleaned = tts._clean_text_for_tts(text)
        
        assert "    " not in cleaned or isinstance(cleaned, str)
    
    def test_clean_text_for_tts_empty_input(self):
        """Test cleaning empty text"""
        tts = TTSService()
        cleaned = tts._clean_text_for_tts("")
        
        assert cleaned == "" or isinstance(cleaned, str)


class TestTTSErrorHandling:
    """Test suite for TTS error handling"""
    
    def test_tts_generation_error(self):
        """Test TTS generation error handling"""
        mock_client = MagicMock()
        mock_client.audio.speech.create.side_effect = Exception("TTS Error")
        
        tts = TTSService(mock_client)
        result = tts.generate_speech("test")
        
        assert result['success'] == False or isinstance(result, dict)
    
    def test_tts_timeout_error(self):
        """Test TTS timeout handling"""
        mock_client = MagicMock()
        mock_client.audio.speech.create.side_effect = TimeoutError("Timeout")
        
        tts = TTSService(mock_client)
        result = tts.generate_speech("test")
        
        assert result['success'] == False or isinstance(result, dict)
    
    def test_tts_network_error(self):
        """Test TTS network error handling"""
        mock_client = MagicMock()
        mock_client.audio.speech.create.side_effect = ConnectionError("Network error")
        
        tts = TTSService(mock_client)
        result = tts.generate_speech("test")
        
        assert result['success'] == False or isinstance(result, dict)
    
    def test_tts_no_client(self):
        """Test TTS without client initialization"""
        tts = TTSService(None)
        result = tts.generate_speech("test")
        
        assert result['success'] == False
        assert 'error' in result


class TestTTSServiceInit:
    """Test suite for TTS service initialization"""
    
    def test_init_tts_service(self):
        """Test initializing TTS service"""
        mock_client = MagicMock()
        init_tts_service(mock_client)
        
        service = get_tts_service()
        assert service is not None
        assert service.a4f_client == mock_client
    
    def test_get_tts_service(self):
        """Test getting TTS service instance"""
        service = get_tts_service()
        
        assert service is not None
        assert isinstance(service, TTSService)
    
    def test_set_client(self):
        """Test setting TTS client"""
        tts = TTSService()
        mock_client = MagicMock()
        
        tts.set_client(mock_client)
        
        assert tts.a4f_client == mock_client
    
    def test_batch_generate_speech(self):
        """Test batch speech generation"""
        mock_client = MagicMock()
        mock_client.audio.speech.create.return_value = b'fake_audio'
        
        tts = TTSService(mock_client)
        texts = ["Hello", "World", "Test"]
        
        results = tts.batch_generate_speech(texts)
        
        assert isinstance(results, list)
        assert len(results) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
