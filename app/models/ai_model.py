"""
AI Model - Groq Client and Tool Extraction Logic
Handles all AI-related operations for the Kitchen Assistant
"""

import os
import json
import re
from groq import Groq
from a4f_local import A4F


def create_ai_clients():
    """
    Initialize AI clients for chat and text-to-speech
    
    Returns:
        tuple: (groq_client, a4f_client)
    """
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    a4f_client = A4F()
    
    print("✅ AI clients initialized successfully")
    return groq_client, a4f_client


def extract_tool_call(raw_response: str):
    """
    Extract and validate tool calls from AI response.
    Handles JSON format and fallback pattern matching for robust tool detection.
    
    Args:
        raw_response: Raw text response from AI
        
    Returns:
        dict or None: Tool call dictionary with tool_name and parameters, or None
    """
    if not raw_response:
        return None
    
    # Remove code fences if present
    cleaned = re.sub(r'```(?:json)?\s*(.*?)\s*```', r'\1', raw_response, flags=re.DOTALL)
    
    # Try to parse as JSON
    try:
        parsed = json.loads(cleaned.strip())
        if isinstance(parsed, dict) and "tool_name" in parsed:
            return parsed
    except json.JSONDecodeError:
        pass
    
    # Try to find JSON object in text (handle cases with text before JSON)
    json_match = re.search(r'\{[^}]*"tool_name"[^}]*"parameters"[^}]*\{[^}]*\}[^}]*\}', raw_response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
    
    # Fallback: simpler pattern for flat JSON
    json_match = re.search(r'\{[^}]*"tool_name"[^}]*\}', raw_response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
    
    # Try line-by-line JSON parsing
    lines = raw_response.split('\n')
    for line in lines:
        line = line.strip()
        if line.startswith('{') and '"tool_name"' in line:
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    
    # === FALLBACK PATTERN MATCHING ===
    # These patterns catch cases where AI doesn't return proper JSON
    
    # 1. DELETE TIMER
    if re.search(r'\b(delete|remove|cancel|stop|clear)\s+timer\s+(\d+|\w+)', raw_response.lower()):
        match = re.search(r'\b(delete|remove|cancel|stop|clear)\s+timer\s+(\d+|\w+)', raw_response.lower())
        if match:
            timer_id = match.group(2)
            try:
                timer_id = int(timer_id)
            except ValueError:
                pass  # Keep as string for named timers
            
            return {
                "tool_name": "delete_timer",
                "parameters": {"timer_identifier": timer_id}
            }
    
    # 2. UNIT CONVERSION - Multiple patterns
    # Pattern 2a: Standard "X unit to Y unit"
    conversion_pattern = r'\b(convert\s+)?(\d+(?:\.\d+)?)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)\s+(?:to|in|into)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)'
    if re.search(conversion_pattern, raw_response.lower()):
        match = re.search(conversion_pattern, raw_response.lower())
        if match:
            amount = float(match.group(2))
            from_unit = match.group(3).strip().lower()
            to_unit = match.group(4).strip().lower()
            
            from_unit = _normalize_unit(from_unit)
            to_unit = _normalize_unit(to_unit)
            
            return {
                "tool_name": "convert_units",
                "parameters": {
                    "amount": amount,
                    "from_unit": from_unit,
                    "to_unit": to_unit
                }
            }
    
    # Pattern 2b: Word-based numbers
    word_conversion_pattern = r'\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)\s+(?:to|in|into)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)'
    if re.search(word_conversion_pattern, raw_response.lower()):
        match = re.search(word_conversion_pattern, raw_response.lower())
        if match:
            amount = _word_to_number(match.group(1))
            from_unit = _normalize_unit(match.group(2).strip().lower())
            to_unit = _normalize_unit(match.group(3).strip().lower())
            
            return {
                "tool_name": "convert_units",
                "parameters": {
                    "amount": amount,
                    "from_unit": from_unit,
                    "to_unit": to_unit
                }
            }
    
    # Pattern 2c: "How many X in Y"
    how_many_pattern = r'\bhow\s+many\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)\s+(?:in|are\s+in)\s+(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)'
    if re.search(how_many_pattern, raw_response.lower()):
        match = re.search(how_many_pattern, raw_response.lower())
        if match:
            to_unit = _normalize_unit(match.group(1).strip().lower())
            amount_str = match.group(2).lower()
            from_unit = _normalize_unit(match.group(3).strip().lower())
            
            amount = _parse_amount(amount_str)
            
            return {
                "tool_name": "convert_units",
                "parameters": {
                    "amount": amount,
                    "from_unit": from_unit,
                    "to_unit": to_unit
                }
            }
    
    # Pattern 2d: Generic conversion with optional words
    simple_conversion_pattern = r'\b(?:how\s+many|convert)\s+.*?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)\s+(?:to|in|into|=|equals?)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)'
    if re.search(simple_conversion_pattern, raw_response.lower()):
        match = re.search(simple_conversion_pattern, raw_response.lower())
        if match:
            amount = _parse_amount(match.group(1).lower())
            from_unit = _normalize_unit(match.group(2).strip().lower())
            to_unit = _normalize_unit(match.group(3).strip().lower())
            
            return {
                "tool_name": "convert_units",
                "parameters": {
                    "amount": amount,
                    "from_unit": from_unit,
                    "to_unit": to_unit
                }
            }
    
    # 3. PLAY YOUTUBE VIDEO
    # Pattern 3a: Numeric result numbers
    video_play_pattern = r'\b(?:play|start)\s+(?:a\s+)?(?:result|video)\s*(\d+)'
    if re.search(video_play_pattern, raw_response.lower()):
        match = re.search(video_play_pattern, raw_response.lower())
        if match:
            result_number = int(match.group(1))
            return {
                "tool_name": "play_youtube_video",
                "parameters": {"result_number": result_number}
            }
    
    # Pattern 3b: Word-based result numbers
    video_word_pattern = r'\b(?:play|start)\s+(?:a\s+)?(?:result|video)\s+(one|two|three|four|five|six|seven|eight|nine|ten)'
    if re.search(video_word_pattern, raw_response.lower()):
        match = re.search(video_word_pattern, raw_response.lower())
        if match:
            result_number = _word_to_number(match.group(1).lower())
            return {
                "tool_name": "play_youtube_video",
                "parameters": {"result_number": result_number}
            }
    
    # Pattern 3c: Mixed format - handles "result 3" and "the result 3 of"
    video_mixed_pattern = r'\b(?:play|start).*?(?:result|video)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)'
    if re.search(video_mixed_pattern, raw_response.lower()):
        match = re.search(video_mixed_pattern, raw_response.lower())
        if match:
            result_str = match.group(1).lower()
            if result_str.isdigit():
                result_number = int(result_str)
            else:
                result_number = _word_to_number(result_str)
            return {
                "tool_name": "play_youtube_video",
                "parameters": {"result_number": result_number}
            }
    
    # 4. DATE/TIME REQUESTS
    if re.search(r'\b(what\'?s?\s+(?:the\s+)?(?:current\s+)?(?:date|today)|today\s+is|current\s+date)', raw_response.lower()):
        return {
            "tool_name": "get_today_date",
            "parameters": {}
        }
    
    if re.search(r'\b(what\'?s?\s+(?:the\s+)?(?:current\s+)?time|current\s+time|time\s+is)', raw_response.lower()):
        return {
            "tool_name": "get_current_time",
            "parameters": {}
        }
    
    return None


def get_ai_response_text(command: str, chat_history: list, groq_client: Groq):
    """
    Get AI response from Groq API with tool calling support
    
    Args:
        command: User's command/question
        chat_history: List of previous messages
        groq_client: Initialized Groq client
        
    Returns:
        str: AI response text or error message
    """
    system_prompt = """
You are a friendly, intelligent kitchen assistant AI. You help with cooking, recipes, timers, conversions, and substitutions.

PERSONALITY & RESPONSE RULES:
1. Keep responses SHORT and CONCISE (max 1-2 sentences)
2. Be conversational and ask clarifying questions when needed
3. Don't assume - if unclear, ask the user
4. **CRITICAL**: When you use a tool, respond ONLY with JSON (no extra text before or after)

**TOOL CALL FORMAT - STRICT RULES:**
- When calling a tool, return ONLY the JSON object
- DO NOT add conversational text before the JSON
- DO NOT add conversational text after the JSON
- WRONG: "I'll open the recipe for you. {"tool_name": "open_recipe", ...}"
- CORRECT: {"tool_name": "open_recipe", "parameters": {"recipe_name": "butter chicken"}}

CONVERSATIONAL INTELLIGENCE:
- If user says "recipe", ask: "Would you like written recipe or video?"
- If user asks about substitution, understand the context
- If query is ambiguous, ask for clarification before calling tools
- Remember conversation context from chat history

RECIPE vs VIDEO DETECTION:
- Keywords for VIDEO: "video", "show me", "watch", "play", "YouTube"
- Keywords for WRITTEN RECIPE: "recipe", "ingredients", "instructions", "how to make"
- If user says "recipe" WITHOUT "video", they want WRITTEN recipe (use search_recipes)
- If user says "recipe video" or "video recipe", they want VIDEO (use search_youtube)

NAVIGATION vs SEARCH:
- Keywords for OPENING/NAVIGATING: "open", "go to", "show me the", "let's make", "cook the"
- Keywords for SEARCHING: "find", "search", "show me recipes", "what recipes"
- If user says "open [recipe name]" → use open_recipe (navigates to recipe page)
- If user says "find recipes" → use search_recipes (shows list of results)
- If user says "let's make butter chicken" → use open_recipe (they want to cook it now)
- If user says "what recipes have chicken" → use search_recipes (they're browsing)

SUBSTITUTION HANDLING - IMPORTANT:
**ALWAYS use recipe_substitution tool when user asks about substitutes/alternatives**

Substitution keywords to detect:
- "substitute", "substitution", "instead of", "replace", "alternative", "swap"
- "what can I use", "what to use", "dairy-free", "vegan option", "gluten-free"

When you detect ANY of these patterns, IMMEDIATELY call recipe_substitution tool:
- "substitute for X" → Call tool with ingredient="X"
- "what can I use instead of X" → Call tool with ingredient="X"
- "X alternative" → Call tool with ingredient="X"
- "dairy-free X" → Call tool with ingredient="X"
- "replace X" → Call tool with ingredient="X"

Examples:
User: "substitute for butter"
You: {"tool_name": "recipe_substitution", "parameters": {"ingredient": "butter", "quantity": "1 cup"}}

User: "what can I use instead of eggs"
You: {"tool_name": "recipe_substitution", "parameters": {"ingredient": "eggs", "quantity": "1"}}

User: "dairy-free milk alternative"
You: {"tool_name": "recipe_substitution", "parameters": {"ingredient": "milk", "quantity": "1 cup"}}

User: "replace oil in tandoori chicken"
You: {"tool_name": "recipe_substitution", "parameters": {"ingredient": "oil", "quantity": "2 tbsp"}}

DO NOT answer substitution questions directly - ALWAYS use the tool to provide comprehensive options!

Available tools:
- search_youtube: Find recipe VIDEOS on YouTube
  Use when: User wants to WATCH/SEE a video
  Format: {"tool_name": "search_youtube", "parameters": {"query": "tandoori chicken recipe"}}

- search_recipes: Find WRITTEN recipes from database
  Use when: User wants recipe instructions/ingredients (NOT video)
  Format: {"tool_name": "search_recipes", "parameters": {"query": "pasta", "diet": "vegetarian", "cuisine": "italian"}}

- open_recipe: Open a specific recipe page directly
  Use when: User says "open [recipe name]", "go to [recipe]", "show me the [recipe] page"
  Format: {"tool_name": "open_recipe", "parameters": {"recipe_name": "butter chicken"}}

- recipe_by_ingredients: Find recipes using specific ingredients
  Use when: "recipes with X", "what can I make with X"
  Format: {"tool_name": "recipe_by_ingredients", "parameters": {"ingredients": "chicken,rice,tomato"}}

- recipe_substitution: Get ingredient substitutions from database
  **USE THIS for ALL substitution queries - no exceptions!**
  Format: {"tool_name": "recipe_substitution", "parameters": {"ingredient": "butter", "quantity": "1 cup"}}

- set_timer: Set cooking timer
  Format: {"tool_name": "set_timer", "parameters": {"duration_minutes": 15, "timer_name": "pasta"}}

- delete_timer: Delete a timer
  Format: {"tool_name": "delete_timer", "parameters": {"timer_identifier": 1}}

- list_timers: Show active timers
  Format: {"tool_name": "list_timers", "parameters": {}}

- convert_units: Convert cooking measurements
  Use when: User asks for conversions
  Format: {"tool_name": "convert_units", "parameters": {"amount": 2, "from_unit": "cup", "to_unit": "tablespoon"}}

- play_youtube_video: Play specific video from search results
  Format: {"tool_name": "play_youtube_video", "parameters": {"result_number": 2}}

- get_current_time: Get current time
  Format: {"tool_name": "get_current_time", "parameters": {}}

- get_today_date: Get today's date
  Format: {"tool_name": "get_today_date", "parameters": {}}

EXAMPLES OF SMART RESPONSES:

**WRONG - Never add text with JSON:**
User: "open butter chicken"
You: "I'll open the butter chicken recipe for you. {"tool_name": "open_recipe", "parameters": {"recipe_name": "butter chicken"}}"  ❌

**CORRECT - JSON only when calling tools:**
User: "open butter chicken"
You: {"tool_name": "open_recipe", "parameters": {"recipe_name": "butter chicken"}}  ✅

User: "recipe for pasta"
You: "Would you like a written recipe with ingredients, or a video to watch?"

User: "show me pasta recipe"
You: {"tool_name": "search_youtube", "parameters": {"query": "pasta recipe"}}

User: "find pasta recipe"
You: {"tool_name": "search_recipes", "parameters": {"query": "pasta"}}

User: "open butter chicken recipe"
You: {"tool_name": "open_recipe", "parameters": {"recipe_name": "butter chicken"}}

User: "go to the biryani recipe page"
You: {"tool_name": "open_recipe", "parameters": {"recipe_name": "biryani"}}

User: "let's make some tandoori chicken"
You: {"tool_name": "open_recipe", "parameters": {"recipe_name": "tandoori chicken"}}

User: "substitute for butter"
You: {"tool_name": "recipe_substitution", "parameters": {"ingredient": "butter", "quantity": "1 cup"}}

User: "dairy-free milk alternative"
You: {"tool_name": "recipe_substitution", "parameters": {"ingredient": "milk", "quantity": "1 cup"}}

For general conversation, respond naturally in 1-2 sentences.
"""
    
    messages = [{"role": "system", "content": system_prompt}]
    
    # Only include recent history to prevent token overflow
    if chat_history:
        # Take only last 10 messages to prevent API errors
        recent_history = chat_history[-10:] if len(chat_history) > 10 else chat_history
        messages.extend(recent_history)
    
    messages.append({"role": "user", "content": command})
    
    try:
        completion = groq_client.chat.completions.create(
            messages=messages, 
            model="llama-3.3-70b-versatile",  # Upgraded model for better reasoning
            temperature=0.1,
            max_tokens=150,  # Reduced from 500 to force concise responses
            timeout=30.0  # Timeout to prevent hanging
        )
        response = completion.choices[0].message.content
        
        # If response is too long and not a tool call, truncate it
        if response and not response.strip().startswith('{'):
            # Limit to first 2 sentences max
            sentences = response.split('. ')
            if len(sentences) > 2:
                response = '. '.join(sentences[:2]) + '.'
        
        return response
    except Exception as e:
        print(f"🔥 Error getting AI response: {e}")
        return "I'm having trouble processing that right now. Could you try rephrasing?"


# === HELPER FUNCTIONS ===

def _normalize_unit(unit: str) -> str:
    """Normalize unit names to match conversion service expectations"""
    unit_map = {
        'cups': 'cup', 'cup': 'cup',
        'tablespoons': 'tablespoon', 'tablespoon': 'tablespoon',
        'teaspoons': 'teaspoon', 'teaspoon': 'teaspoon',
        'ml': 'ml', 'milliliters': 'milliliter', 'milliliter': 'milliliter',
        'liters': 'liter', 'liter': 'liter',
        'gallons': 'gallon', 'gallon': 'gallon',
        'fl oz': 'fl_oz', 'ounces': 'fl oz', 'ounce': 'fl oz',
        'fluid_ounce': 'fluid_ounce', 'fluid ounce': 'fluid_ounce',
        'pint': 'pint', 'pints': 'pint',
        'quart': 'quart', 'quarts': 'quart',
        'tsp': 'tsp', 'tbsp': 'tbsp',
        'g': 'g', 'gram': 'gram', 'grams': 'gram',
        'kg': 'kg', 'kilogram': 'kilogram', 'kilograms': 'kilogram',
        'oz': 'oz', 'pound': 'pound', 'lb': 'lb', 'pounds': 'pound'
    }
    return unit_map.get(unit, unit)


def _word_to_number(word: str) -> int:
    """Convert word numbers to integers"""
    word_to_num = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    }
    return word_to_num.get(word, 1)


def _parse_amount(amount_str: str) -> float:
    """Parse amount string (numeric or word) to float"""
    if amount_str.replace('.', '', 1).isdigit():
        return float(amount_str)
    else:
        return float(_word_to_number(amount_str))
