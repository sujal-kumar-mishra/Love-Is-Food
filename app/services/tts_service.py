"""
Text-to-Speech Service
Provides centralized TTS functionality using Coqui TTS
Replaces browser speechSynthesis with server-side TTS
"""

import base64
import logging
import requests
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class TTSService:
    """
    Centralized Text-to-Speech Service
    Handles all TTS generation using Coqui TTS Docker container
    """
    
    def __init__(self, coqui_url: str = "http://localhost:5002"):
        """
        Initialize TTS Service
        
        Args:
            coqui_url: URL of Coqui TTS Docker container
        """
        self.coqui_url = coqui_url.rstrip('/')
        self.default_speaker_id = "p300"  # Coqui TTS speaker ID
        self.timeout = 30  # Request timeout in seconds
        
    def set_url(self, coqui_url: str):
        """Set or update the Coqui TTS URL"""
        self.coqui_url = coqui_url.rstrip('/')
        
    def generate_speech(
        self, 
        text: str, 
        voice: Optional[str] = None,
        model: Optional[str] = None,
        return_format: str = 'base64'
    ) -> Dict[str, Any]:
        """
        Generate speech audio from text using Coqui TTS
        
        Args:
            text: Text to convert to speech
            voice: Speaker ID (optional, for Coqui TTS)
            model: Model name (optional, for compatibility)
            return_format: Format to return ('base64', 'bytes', 'both')
            
        Returns:
            Dictionary containing audio data and metadata
        """
        if not text or not isinstance(text, str):
            return {
                'success': False,
                'error': 'Invalid text provided'
            }
        
        # Use default speaker if not specified
        speaker_id = voice or self.default_speaker_id
        
        try:
            # Clean text for better TTS
            clean_text = self._clean_text_for_tts(text)
            
            if not clean_text:
                return {
                    'success': False,
                    'error': 'No valid text after cleaning'
                }
            
            logger.info(f"Generating TTS for: {clean_text[:50]}...")
            
            # Make request to Coqui TTS with fallback endpoints
            audio_bytes = self._fetch_audio(clean_text, speaker_id)
            
            if not audio_bytes:
                return {
                    'success': False,
                    'error': 'No audio data generated'
                }
            
            # Prepare response based on format
            result = {
                'success': True,
                'text': clean_text,
                'voice': speaker_id,
                'model': 'coqui-tts',
                'mime_type': 'audio/wav'
            }
            
            if return_format in ['base64', 'both']:
                result['audio_base64'] = base64.b64encode(audio_bytes).decode('ascii')
                    
            if return_format in ['bytes', 'both']:
                result['audio_bytes'] = audio_bytes
                
            logger.info("TTS generation successful")
            return result
            
        except requests.exceptions.ConnectionError as e:
            logger.error(f"TTS connection error: {e}")
            return {
                'success': False,
                'error': f'Cannot connect to Coqui TTS server at {self.coqui_url}. Please ensure Docker container is running.'
            }
        except requests.exceptions.Timeout as e:
            logger.error(f"TTS timeout error: {e}")
            return {
                'success': False,
                'error': 'TTS request timed out'
            }
        except Exception as e:
            logger.error(f"TTS generation error: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _fetch_audio(self, text: str, speaker_id: Optional[str]) -> bytes:
        """Attempt Coqui TTS endpoints with graceful fallbacks."""
        # Use speaker_id if provided, otherwise use default
        speaker = speaker_id if speaker_id else self.default_speaker_id
        
        attempts = [
            ("GET", f"{self.coqui_url}/api/tts", {"params": {"text": text, "speaker_id": speaker}}),
            ("POST", f"{self.coqui_url}/api/tts", {"data": {"text": text, "speaker_id": speaker}}),
            ("GET", f"{self.coqui_url}/tts", {"params": {"text": text, "speaker_id": speaker}}),
        ]

        last_error = None
        for method, url, kwargs in attempts:
            try:
                response = requests.request(method, url, timeout=self.timeout, **kwargs)
                if response.status_code == 404:
                    logger.warning("Coqui endpoint %s returned 404, trying fallback", url)
                    last_error = f"404 from {url}"
                    continue
                response.raise_for_status()
                if response.content:
                    return response.content
                last_error = f"Empty audio response from {url}"
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
                # Propagate to caller for dedicated handling
                raise
            except Exception as e:
                last_error = str(e)
                logger.warning("Coqui request %s %s failed: %s", method, url, e)
                continue

        raise Exception(last_error or "Unable to fetch audio from Coqui TTS")
    
    def _clean_text_for_tts(self, text: str) -> str:
        """
        Clean text for better TTS output
        
        Args:
            text: Raw text to clean
            
        Returns:
            Cleaned text suitable for TTS
        """
        import re
        
        # Remove emojis
        clean = re.sub(r'[🎤🤖✅❌🛠️🔗💡🎯🔊🎙️⚡🎬🍳👨‍🍳🎉]', '', text)
        
        # Remove JSON tool calls
        clean = re.sub(r'\{"tool_name":[^}]+\}', '', clean)
        
        # Remove markdown formatting
        clean = re.sub(r'\*\*(.*?)\*\*', r'\1', clean)  # Bold
        clean = re.sub(r'\*(.*?)\*', r'\1', clean)      # Italic
        clean = re.sub(r'`(.*?)`', r'\1', clean)        # Code
        clean = re.sub(r'#{1,6}\s?', '', clean)         # Headings
        
        # Replace newlines with periods
        clean = re.sub(r'\n+', '. ', clean)
        
        # Replace multiple spaces with single space
        clean = re.sub(r'\s+', ' ', clean)
        
        # Remove URLs
        clean = re.sub(r'http[s]?://\S+', '', clean)
        
        # Remove special characters but keep punctuation
        clean = re.sub(r'[^\w\s.,!?;:()-]', '', clean)
        
        # Trim whitespace
        clean = clean.strip()
        
        return clean
    
    def batch_generate_speech(self, texts: list, voice: Optional[str] = None) -> list:
        """
        Generate speech for multiple texts
        
        Args:
            texts: List of texts to convert
            voice: Voice to use for all texts
            
        Returns:
            List of result dictionaries
        """
        results = []
        for text in texts:
            result = self.generate_speech(text, voice=voice)
            results.append(result)
        return results


# Global TTS service instance (will be initialized in app initialization)
tts_service = None


def get_tts_service() -> TTSService:
    """Get the global TTS service instance"""
    global tts_service
    if tts_service is None:
        # Initialize with default URL if not already initialized
        tts_service = TTSService()
    return tts_service


def init_tts_service(coqui_url: str = "http://localhost:5000"):
    """
    Initialize the TTS service with Coqui TTS URL
    
    Args:
        coqui_url: URL of Coqui TTS Docker container
    """
    global tts_service
    tts_service = TTSService(coqui_url)
    logger.info(f"TTS Service initialized with Coqui TTS at {coqui_url}")
