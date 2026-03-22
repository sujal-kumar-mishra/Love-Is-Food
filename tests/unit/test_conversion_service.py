"""
Unit tests for conversion service
"""
import pytest
from app.services.conversion_service import convert_units


class TestUnitConversion:
    """Test suite for unit conversion"""
    
    def test_cups_to_ml(self):
        """Test cup to milliliter conversion"""
        result = convert_units(2, "cup", "ml")
        
        assert "result" in result
        assert result["result"] == 473.18
        assert result["amount"] == 2
        assert result["from_unit"] == "cup"
        assert result["to_unit"] == "ml"
    
    def test_tablespoon_to_teaspoon(self):
        """Test tablespoon to teaspoon conversion"""
        result = convert_units(1, "tablespoon", "teaspoon")
        
        assert result["result"] == 3.0
    
    def test_ml_to_liter(self):
        """Test milliliter to liter conversion"""
        result = convert_units(1000, "ml", "liter")
        
        assert result["result"] == 1.0
    
    def test_decimal_amounts(self):
        """Test decimal quantity conversion"""
        result = convert_units(0.5, "cup", "tablespoon")
        
        assert result["result"] > 0
        assert "result" in result
    
    def test_unsupported_unit_from(self):
        """Test error handling for invalid source unit"""
        result = convert_units(1, "invalid_unit", "cup")
        
        assert "error" in result
        assert "invalid_unit" in result["error"]
    
    def test_unsupported_unit_to(self):
        """Test error handling for invalid target unit"""
        result = convert_units(1, "cup", "invalid_unit")
        
        assert "error" in result
        assert "invalid_unit" in result["error"]
    
    def test_case_insensitive_units(self):
        """Test unit normalization (uppercase/lowercase)"""
        result1 = convert_units(1, "CUP", "ML")
        result2 = convert_units(1, "cup", "ml")
        
        assert result1["result"] == result2["result"]
    
    def test_same_unit_conversion(self):
        """Test conversion from unit to itself"""
        result = convert_units(5, "cup", "cup")
        
        assert result["result"] == 5.0
    
    def test_gallon_to_ml(self):
        """Test gallon to milliliter conversion"""
        result = convert_units(1, "gallon", "ml")
        
        assert result["result"] == 3785.41
    
    def test_teaspoon_to_ml(self):
        """Test teaspoon to milliliter conversion"""
        result = convert_units(1, "teaspoon", "ml")
        
        assert result["result"] == 4.93


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
