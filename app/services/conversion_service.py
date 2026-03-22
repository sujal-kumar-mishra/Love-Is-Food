"""
Unit conversion services for cooking measurements
"""


def convert_units(amount: float, from_unit: str, to_unit: str):
    """
    Converts cooking measurements between different units.
    Supports: cups, tablespoons, teaspoons, ml, liters, gallons, fl oz
    """
    # Conversion table (everything to ml first)
    to_ml = {
        'cup': 236.588,
        'tablespoon': 14.7868,
        'teaspoon': 4.92892,
        'ml': 1,
        'milliliter': 1,
        'liter': 1000,
        'gallon': 3785.41,
        'fl_oz': 29.5735,
        'fl oz': 29.5735
    }
    
    # Normalize unit names
    from_unit = from_unit.lower().strip()
    to_unit = to_unit.lower().strip()
    
    # Check if units are supported
    if from_unit not in to_ml:
        return {"error": f"Unsupported unit: {from_unit}"}
    if to_unit not in to_ml:
        return {"error": f"Unsupported unit: {to_unit}"}
    
    # Convert to ml, then to target unit
    ml_amount = amount * to_ml[from_unit]
    result = ml_amount / to_ml[to_unit]
    
    return {
        "amount": amount,
        "from_unit": from_unit,
        "to_unit": to_unit,
        "result": round(result, 2)
    }
