"""
Unit tests for recipe service
"""
import pytest
from unittest.mock import Mock, patch
from app.services.recipe_service import recipe_substitution


class TestRecipeSubstitution:
    """Test suite for ingredient substitution"""
    
    def test_butter_substitution(self):
        """Test known ingredient substitution"""
        result = recipe_substitution("butter", "1 cup")
        
        assert "ingredient" in result
        assert result["ingredient"] == "Butter"
        assert "substitutions" in result
        assert len(result["substitutions"]) > 0
        assert result["source"] == "database"
    
    def test_egg_substitution(self):
        """Test egg substitution options"""
        result = recipe_substitution("egg")
        
        assert "substitutions" in result
        substitutions_text = str(result["substitutions"]).lower()
        assert "flaxseed" in substitutions_text or "applesauce" in substitutions_text
    
    def test_milk_substitution(self):
        """Test milk substitution"""
        result = recipe_substitution("milk", "1 cup")
        
        assert result["ingredient"] == "Milk"
        assert len(result["substitutions"]) > 0
        assert result["source"] == "database"
    
    def test_case_insensitive_substitution(self):
        """Test case-insensitive ingredient matching"""
        result1 = recipe_substitution("BUTTER")
        result2 = recipe_substitution("butter")
        
        assert result1["ingredient"] == result2["ingredient"]
        assert result1["substitutions"] == result2["substitutions"]
    
    def test_partial_match_substitution(self):
        """Test partial ingredient name matching"""
        result = recipe_substitution("heavy cream", "1 cup")
        
        assert "substitutions" in result
        assert len(result["substitutions"]) > 0
    
    def test_unknown_ingredient_without_ai(self):
        """Test unknown ingredient when AI is not available"""
        with patch('app.services.recipe_service.get_groq_client') as mock_groq:
            mock_groq.return_value = None  # Simulate no API key
            result = recipe_substitution("unicorn_tears")
            
            assert "error" in result
    
    def test_flour_substitution(self):
        """Test flour substitution"""
        result = recipe_substitution("flour", "2 cups")
        
        assert result["ingredient"] == "Flour"
        assert "substitutions" in result
        assert result["source"] == "database"
    
    def test_sugar_substitution(self):
        """Test sugar substitution"""
        result = recipe_substitution("sugar", "1 cup")
        
        assert result["ingredient"] == "Sugar"
        assert len(result["substitutions"]) > 0
        assert any("honey" in sub.lower() for sub in result["substitutions"])


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
