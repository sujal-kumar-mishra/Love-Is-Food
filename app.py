import os
import json
import re
import base64
from flask import Flask, render_template
from flask_socketio import SocketIO
from dotenv import load_dotenv
from groq import Groq
from skills import (
    get_current_time, search_wikipedia, get_today_date, search_youtube,
    set_timer, delete_timer, list_timers, convert_units, recipe_substitution,
    play_youtube_video, search_recipes, get_recipe_details, recipe_by_ingredients
)
from a4f_local import A4F

# --- CONFIGURATION ---
load_dotenv()
app = Flask(__name__)

# Production-ready configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here-change-me')
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'

# Configure SocketIO for production
socketio = SocketIO(
    app, 
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
    async_mode='threading'
)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
a4f_client = A4F()

# --- SERVER-SIDE SESSION STORAGE ---
conversation_history = {}  # sid -> conversation history
youtube_results = {}       # sid -> current YouTube results

# --- BRAIN (AI LOGIC) ---
available_skills = {
    "get_current_time": get_current_time,
    "search_wikipedia": search_wikipedia,
    "get_today_date": get_today_date,
    "search_youtube": search_youtube,
    "set_timer": set_timer,
    "delete_timer": delete_timer,
    "list_timers": list_timers,
    "convert_units": convert_units,
    "recipe_substitution": recipe_substitution,
    "play_youtube_video": play_youtube_video,
    "search_recipes": search_recipes,
    "get_recipe_details": get_recipe_details,
    "recipe_by_ingredients": recipe_by_ingredients,
}

def extract_tool_call(raw_response: str):
    """Extract and validate tool calls from AI response."""
    if not raw_response:
        return None
    
    # Remove code fences if present
    cleaned = re.sub(r'```(?:json)?\s*(.*?)\s*```', r'\1', raw_response, flags=re.DOTALL)
    
    try:
        # Try to parse as JSON
        parsed = json.loads(cleaned.strip())
        if isinstance(parsed, dict) and "tool_name" in parsed:
            return parsed
    except json.JSONDecodeError:
        pass
    
    # Try to find JSON object in text with better pattern
    json_match = re.search(r'\{.*?"tool_name".*?\}', raw_response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
    
    # Try even more flexible approach - find any JSON with tool_name
    lines = raw_response.split('\n')
    for line in lines:
        line = line.strip()
        if line.startswith('{') and '"tool_name"' in line:
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    
    # Fallback: Check if response contains delete timer keywords and force extraction
    if re.search(r'\b(delete|remove|cancel|stop|clear)\s+timer\s+(\d+|\w+)', raw_response.lower()):
        # Extract timer identifier from the command
        match = re.search(r'\b(delete|remove|cancel|stop|clear)\s+timer\s+(\d+|\w+)', raw_response.lower())
        if match:
            timer_id = match.group(2)
            # Try to convert to int if it's numeric
            try:
                timer_id = int(timer_id)
            except ValueError:
                pass  # Keep as string for named timers
            
            return {
                "tool_name": "delete_timer",
                "parameters": {"timer_identifier": timer_id}
            }
    
    # Fallback: Check if response contains conversion keywords and force extraction
    conversion_pattern = r'\b(convert\s+)?(\d+(?:\.\d+)?)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)\s+(?:to|in|into)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)'
    if re.search(conversion_pattern, raw_response.lower()):
        match = re.search(conversion_pattern, raw_response.lower())
        if match:
            amount = float(match.group(2))
            from_unit = match.group(3).strip().lower()
            to_unit = match.group(4).strip().lower()
            
            # Normalize unit names to match convert_units function
            unit_map = {
                'cups': 'cup', 'cup': 'cup',
                'tablespoons': 'tablespoon', 'tablespoon': 'tablespoon',
                'teaspoons': 'teaspoon', 'teaspoon': 'teaspoon',
                'ml': 'ml', 'milliliters': 'milliliter', 'milliliter': 'milliliter',
                'liters': 'liter', 'liter': 'liter',
                'gallons': 'gallon', 'gallon': 'gallon',
                'fl oz': 'fl_oz', 'ounces': 'fl oz', 'ounce': 'fl oz'
            }
            
            from_unit = unit_map.get(from_unit, from_unit)
            to_unit = unit_map.get(to_unit, to_unit)
            
            return {
                "tool_name": "convert_units",
                "parameters": {
                    "amount": amount,
                    "from_unit": from_unit,
                    "to_unit": to_unit
                }
            }
    
    # Fallback: Check for video play commands
    # Pattern 1: Numeric result numbers
    video_play_pattern = r'\b(?:play|start)\s+(?:a\s+)?(?:result|video)\s*(\d+)'
    if re.search(video_play_pattern, raw_response.lower()):
        match = re.search(video_play_pattern, raw_response.lower())
        if match:
            result_number = int(match.group(1))
            return {
                "tool_name": "play_youtube_video",
                "parameters": {"result_number": result_number}
            }
    
    # Pattern 2: Word-based result numbers  
    video_word_pattern = r'\b(?:play|start)\s+(?:a\s+)?(?:result|video)\s+(one|two|three|four|five|six|seven|eight|nine|ten)'
    if re.search(video_word_pattern, raw_response.lower()):
        match = re.search(video_word_pattern, raw_response.lower())
        if match:
            word_to_num = {
                'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
            }
            result_number = word_to_num.get(match.group(1).lower(), 1)
            return {
                "tool_name": "play_youtube_video",
                "parameters": {"result_number": result_number}
            }
    
    # Pattern 3: Mixed format - handles "result 3" and "the result 3 of"
    video_mixed_pattern = r'\b(?:play|start).*?(?:result|video)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)'
    if re.search(video_mixed_pattern, raw_response.lower()):
        match = re.search(video_mixed_pattern, raw_response.lower())
        if match:
            result_str = match.group(1).lower()
            if result_str.isdigit():
                result_number = int(result_str)
            else:
                word_to_num = {
                    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                }
                result_number = word_to_num.get(result_str, 1)
            return {
                "tool_name": "play_youtube_video",
                "parameters": {"result_number": result_number}
            }
    
    # Fallback: Check for date/time requests
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
    
    # Fallback: Check for additional conversion patterns
    # Pattern 1: Word-based numbers with units  
    word_conversion_pattern = r'\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)\s+(?:to|in|into)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)'
    if re.search(word_conversion_pattern, raw_response.lower()):
        match = re.search(word_conversion_pattern, raw_response.lower())
        if match:
            # Convert word numbers to digits
            word_to_num = {
                'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
            }
            amount = word_to_num.get(match.group(1).lower(), 1)
            from_unit = match.group(2).strip().lower()
            to_unit = match.group(3).strip().lower()
            
            # Unit normalization
            unit_map = {
                'cups': 'cup', 'cup': 'cup',
                'tablespoons': 'tablespoon', 'tablespoon': 'tablespoon',
                'teaspoons': 'teaspoon', 'teaspoon': 'teaspoon',
                'ml': 'ml', 'milliliters': 'milliliter', 'milliliter': 'milliliter',
                'liters': 'liter', 'liter': 'liter',
                'gallons': 'gallon', 'gallon': 'gallon',
                'fl oz': 'fl_oz', 'ounces': 'fl oz', 'ounce': 'fl oz'
            }
            
            from_unit = unit_map.get(from_unit, from_unit)
            to_unit = unit_map.get(to_unit, to_unit)
            
            return {
                "tool_name": "convert_units",
                "parameters": {
                    "amount": amount,
                    "from_unit": from_unit,
                    "to_unit": to_unit
                }
            }
    
    # Pattern 2: "How many X in Y" format
    how_many_pattern = r'\bhow\s+many\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)\s+(?:in|are\s+in)\s+(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)'
    if re.search(how_many_pattern, raw_response.lower()):
        match = re.search(how_many_pattern, raw_response.lower())
        if match:
            to_unit = match.group(1).strip().lower()
            amount_str = match.group(2).lower()
            from_unit = match.group(3).strip().lower()
            
            # Handle both numeric and word amounts
            if amount_str.isdigit() or '.' in amount_str:
                amount = float(amount_str)
            else:
                word_to_num = {
                    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                }
                amount = word_to_num.get(amount_str, 1)
                
            # Unit normalization
            unit_map = {
                'cups': 'cup', 'cup': 'cup',
                'tablespoons': 'tablespoon', 'tablespoon': 'tablespoon',
                'teaspoons': 'teaspoon', 'teaspoon': 'teaspoon',
                'ml': 'ml', 'milliliters': 'milliliter', 'milliliter': 'milliliter',
                'liters': 'liter', 'liter': 'liter',
                'gallons': 'gallon', 'gallon': 'gallon',
                'fl oz': 'fl_oz', 'ounces': 'fl oz', 'ounce': 'fl oz'
            }
            
            from_unit = unit_map.get(from_unit, from_unit)
            to_unit = unit_map.get(to_unit, to_unit)
            
            return {
                "tool_name": "convert_units",
                "parameters": {
                    "amount": amount,
                    "from_unit": from_unit,
                    "to_unit": to_unit
                }
            }
    
    # Pattern 3: Standard conversion format (with both numeric and word numbers)
    simple_conversion_pattern = r'\b(?:how\s+many|convert)\s+.*?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)\s+(?:to|in|into|=|equals?)\s+(cups?|cup|tablespoons?|tablespoon|teaspoons?|teaspoon|ml|milliliters?|liters?|liter|gallons?|gallon|fl\s*oz|ounces?)'
    if re.search(simple_conversion_pattern, raw_response.lower()):
        match = re.search(simple_conversion_pattern, raw_response.lower())
        if match:
            amount_str = match.group(1).lower()
            # Handle both numeric and word amounts
            if amount_str.isdigit() or '.' in amount_str:
                amount = float(amount_str)
            else:
                word_to_num = {
                    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                }
                amount = word_to_num.get(amount_str, 1)
                
            from_unit = match.group(2).strip().lower()
            to_unit = match.group(3).strip().lower()
            
            # Same unit normalization as before
            unit_map = {
                'cups': 'cup', 'cup': 'cup',
                'tablespoons': 'tablespoon', 'tablespoon': 'tablespoon',
                'teaspoons': 'teaspoon', 'teaspoon': 'teaspoon',
                'ml': 'ml', 'milliliters': 'milliliter', 'milliliter': 'milliliter',
                'liters': 'liter', 'liter': 'liter',
                'gallons': 'gallon', 'gallon': 'gallon',
                'fl oz': 'fl_oz', 'ounces': 'fl oz', 'ounce': 'fl oz'
            }
            
            from_unit = unit_map.get(from_unit, from_unit)
            to_unit = unit_map.get(to_unit, to_unit)
            
            return {
                "tool_name": "convert_units",
                "parameters": {
                    "amount": amount,
                    "from_unit": from_unit,
                    "to_unit": to_unit
                }
            }
    
    return None

def get_ai_response_text(command, chat_history):
    system_prompt = """
You are a friendly kitchen assistant AI. You help with cooking, recipes, timers, conversions, and substitutions.

IMPORTANT: When you need to use a tool, respond ONLY with a JSON object. No extra text, explanations, or markdown.

Available tools and when to use them:
- search_youtube: When user wants to find recipes, cooking videos, or cooking techniques
  Format: {"tool_name": "search_youtube", "parameters": {"query": "search term"}}

- set_timer: When user wants to set a cooking timer
  Format: {"tool_name": "set_timer", "parameters": {"duration_minutes": 15, "timer_name": "pasta"}}

- delete_timer: When user wants to cancel/delete/remove a timer by ID or name
  CRITICAL: Extract this tool for ANY deletion request!
  Examples: "delete timer 1", "remove timer 2", "cancel pasta timer", "delete egg timer", "stop timer 3"
  Keywords to watch for: delete, remove, cancel, stop, clear + timer
  Format: {"tool_name": "delete_timer", "parameters": {"timer_identifier": 1}} or {"timer_identifier": "pasta"}

- list_timers: When user wants to see active timers
  Format: {"tool_name": "list_timers", "parameters": {}}

- convert_units: When user needs ANY cooking conversions (cups, tablespoons, ml, etc.)
  CRITICAL: Extract this tool for ANY conversion request!
  Examples: "convert 2 cups to tablespoons", "2 cup to tablespoon", "how many ml in 1 cup"
  Keywords to watch for: convert, cup, tablespoon, teaspoon, ml, liter, gallon, fl oz + numbers
  Format: {"tool_name": "convert_units", "parameters": {"amount": 2, "from_unit": "cup", "to_unit": "tablespoon"}}
  NEVER calculate conversions manually - ALWAYS use this tool!

- recipe_substitution: When user needs ingredient substitutions
  CRITICAL: Extract this tool for ANY substitution request!
  Examples: "substitute butter", "replace eggs", "instead of milk", "alternative to flour", "what can I use instead of sugar"
  Keywords to watch for: substitute/replace/instead/alternative + ingredient name
  Format: {"tool_name": "recipe_substitution", "parameters": {"ingredient": "butter", "quantity": "1 cup"}}

- search_recipes: When user wants to find recipes from the recipe database
  CRITICAL: Extract this tool for ANY recipe search request!
  Examples: "find chicken recipes", "show me pasta recipes", "vegetarian recipes", "keto desserts"
  Keywords to watch for: find/search/show + recipe/recipes, cooking instructions
  Format: {"tool_name": "search_recipes", "parameters": {"query": "chicken", "diet": "vegetarian", "cuisine": "italian"}}

- recipe_by_ingredients: When user wants recipes based on available ingredients
  CRITICAL: Extract this tool for ingredient-based recipe searches!
  Examples: "recipes with chicken and rice", "what can I make with tomatoes", "recipes using ingredients I have"
  Keywords to watch for: recipes with/using + ingredients, what can I make with
  Format: {"tool_name": "recipe_by_ingredients", "parameters": {"ingredients": "chicken,rice,onion"}}

- play_youtube_video: When user wants to play a specific video from search results
  CRITICAL: Extract this tool for ANY video play request!
  Examples: "play result 2", "play video 1", "play the second video", "play result number 3"
  Keywords to watch for: play + result/video + number
  Format: {"tool_name": "play_youtube_video", "parameters": {"result_number": 2}}

- get_current_time: When user asks for the time
  CRITICAL: Extract this tool for ANY time request!
  Examples: "what time is it", "current time", "what's the time"
  Format: {"tool_name": "get_current_time", "parameters": {}}

- get_today_date: When user asks for the date
  CRITICAL: Extract this tool for ANY date request!
  Examples: "what's the date", "current date", "what's today's date", "today is"
  Format: {"tool_name": "get_today_date", "parameters": {}}

For general conversation (not requiring tools), respond naturally in plain text.
"""
    
    messages = [{"role": "system", "content": system_prompt}]
    if chat_history:
        messages.extend(chat_history)
    messages.append({"role": "user", "content": command})
    
    try:
        completion = groq_client.chat.completions.create(
            messages=messages, 
            model="gemma2-9b-it", 
            temperature=0.1,
            max_tokens=500
        )
        return completion.choices[0].message.content
    except Exception as e:
        print(f"🔥 Error getting AI response: {e}")
        return "Sorry, I'm having trouble thinking right now."

# --- WEBSOCKETS & ROUTES ---
@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    import uuid
    session_id = str(uuid.uuid4())[:8]  # Short unique ID
    socketio.emit('session_id', {'session_id': session_id})
    conversation_history[session_id] = []
    youtube_results[session_id] = []
    print(f'🔗 Client connected: {session_id}')

@socketio.on('disconnect')
def handle_disconnect():
    # Clean up all sessions that might belong to this connection
    # In production, you'd want better session tracking
    print(f'❌ Client disconnected')

@socketio.on('get_timers')
def handle_get_timers():
    """Send current active timers to the client"""
    try:
        from skills import active_timers
        from datetime import datetime
        
        active_timers_list = []
        for timer_id, timer_info in list(active_timers.items()):
            remaining_time = timer_info['end_time'] - datetime.now()
            if remaining_time.total_seconds() > 0:
                remaining_minutes = int(remaining_time.total_seconds() / 60)
                remaining_seconds = int(remaining_time.total_seconds() % 60)
                active_timers_list.append({
                    'id': timer_id,
                    'name': timer_info['name'],
                    'duration_minutes': timer_info['duration_minutes'],
                    'remaining': f"{remaining_minutes:02d}:{remaining_seconds:02d}"
                })
            else:
                # Timer finished, remove it
                del active_timers[timer_id]
        
        print(f"📱 Sending timers list: {active_timers_list}")
        socketio.emit('timers_list', {'timers': active_timers_list})
    except Exception as e:
        print(f"Error getting timers: {e}")
        socketio.emit('timers_list', {'timers': []})

@socketio.on('get_recipe_details')
def handle_get_recipe_details(data):
    """Get full recipe details for the modal display"""
    try:
        recipe_id = data.get('recipe_id')
        if not recipe_id:
            socketio.emit('recipe_details', {'success': False, 'error': 'No recipe ID provided'})
            return
        
        print(f"Getting full recipe details for ID: {recipe_id}")
        result = get_recipe_details(recipe_id)
        
        if result.get("success"):
            socketio.emit('recipe_details', result)
        else:
            socketio.emit('recipe_details', {
                'success': False, 
                'error': result.get('error', 'Failed to get recipe details'),
                'message': result.get('message', 'Could not fetch recipe details')
            })
    except Exception as e:
        print(f"Error getting recipe details: {e}")
        socketio.emit('recipe_details', {'success': False, 'error': str(e)})

@socketio.on('user_command')
def handle_user_command(data):
    command = data.get('command', '')
    session_id = data.get('session_id', 'default')  # Custom session ID for conversation tracking
    
    # Initialize session if not exists
    if session_id not in conversation_history:
        conversation_history[session_id] = []
    if session_id not in youtube_results:
        youtube_results[session_id] = []
    
    print(f"🎤 User ({session_id[:8]}): {command}")
    
    # Get conversation history for this session
    chat_history = conversation_history.get(session_id, [])
    
    # Get AI response
    raw_response = get_ai_response_text(command, chat_history)
    print(f"🤖 AI Raw Response: {raw_response}")
    
    final_text_for_speech = ""
    tool_call = extract_tool_call(raw_response or "")
    print(f"🔍 Extracted tool call: {tool_call}")
    
    if tool_call:
        tool_name = tool_call.get("tool_name")
        parameters = tool_call.get("parameters", {}) or {}
        print(f"🛠️  Tool Call: {tool_name} with params: {parameters}")
        
        # Initialize response message
        tool_response_message = ""
        
        if tool_name == "search_youtube":
            search_query = parameters.get("query") or ""
            print(f"🔍 Executing YouTube search for: {search_query}")
            result = search_youtube(search_query)
            videos = result.get('videos', [])
            youtube_results[session_id] = videos
            
            socketio.emit('youtube_results', {'videos': videos})
            final_text_for_speech = (
                f"Here are the top recipe results I found for {search_query}."
                if videos else "Sorry, I couldn't find any recipe videos for that query."
            )
            
        elif tool_name == "play_youtube_video":
            result_num = parameters.get("result_number")
            videos = youtube_results.get(session_id, [])
            if isinstance(result_num, int) and 1 <= result_num <= len(videos):
                video_to_play = videos[result_num - 1]
                socketio.emit('play_video', {'video_id': video_to_play['video_id']})
                final_text_for_speech = f"Playing recipe video number {result_num}."
            else:
                final_text_for_speech = "Sorry, I can't find that video number. Please search for recipes first."
                
        elif tool_name == "set_timer":
            duration = parameters.get("duration_minutes", 5)
            timer_name = parameters.get("timer_name", "")
            result = set_timer(duration, timer_name)
            timer_info = result.get("timer")
            
            # Convert datetime objects to strings for JSON serialization
            if timer_info:
                timer_info_serializable = {
                    "id": timer_info["id"],
                    "name": timer_info["name"],
                    "duration_minutes": timer_info["duration_minutes"],
                    "end_time": timer_info["end_time"].strftime("%H:%M:%S") if timer_info.get("end_time") else "",
                    "created_at": timer_info["created_at"].strftime("%H:%M:%S") if timer_info.get("created_at") else "",
                    "remaining_time": f"{duration} minutes"
                }
            else:
                timer_info_serializable = None
            
            print(f"📡 Emitting timer_set event: {timer_info_serializable}")
            socketio.emit('timer_set', {
                'timer': timer_info_serializable,
                'message': result.get("message")
            })
            
            # Also emit the updated timers list
            updated_timers = list_timers()
            print(f"📡 Timers from list_timers(): {updated_timers}")
            
            if updated_timers.get("timers"):
                from skills import active_timers
                serializable_timers = []
                for timer in updated_timers["timers"]:
                    timer_info_data = active_timers.get(timer["id"], {})
                    serializable_timer = {
                        "id": timer["id"],
                        "name": timer["name"],
                        "remaining": timer["remaining"],
                        "duration_minutes": timer_info_data.get("duration_minutes", 0),
                        "end_time": timer_info_data.get("end_time").strftime("%H:%M:%S") if timer_info_data.get("end_time") else "",
                        "created_at": timer_info_data.get("created_at").strftime("%H:%M:%S") if timer_info_data.get("created_at") else ""
                    }
                    serializable_timers.append(serializable_timer)
                updated_timers["timers"] = serializable_timers
            
            print(f"📡 Emitting timers_list event: {updated_timers}")
            socketio.emit('timers_list', updated_timers)
            
            # Create a more conversational response
            if timer_name:
                final_text_for_speech = f"Perfect! I've set a **{timer_name} timer** for **{duration} minutes**. I'll let you know when it's done!"
            else:
                final_text_for_speech = f"Timer set for **{duration} minutes**. I'll alert you when the time is up!"
            
        elif tool_name == "delete_timer":
            timer_id = parameters.get("timer_identifier")
            result = delete_timer(timer_id)
            socketio.emit('timer_deleted', result)
            
            # Send updated timers list after deletion
            from skills import active_timers
            updated_timers = list_timers()
            if updated_timers.get("timers"):
                # Convert datetime objects to strings for JSON serialization
                serializable_timers = []
                for timer in updated_timers["timers"]:
                    timer_info_data = active_timers.get(timer["id"], {})
                    serializable_timers.append({
                        "id": timer["id"],
                        "name": timer["name"],
                        "remaining": timer["remaining"],
                        "duration_minutes": timer_info_data.get("duration_minutes", 0),
                        "end_time": timer_info_data.get("end_time", "").strftime("%H:%M:%S") if timer_info_data.get("end_time") else "",
                        "created_at": timer_info_data.get("created_at", "").strftime("%H:%M:%S") if timer_info_data.get("created_at") else ""
                    })
                updated_timers["timers"] = serializable_timers
            
            socketio.emit('timers_list', updated_timers)
            final_text_for_speech = result.get("message", result.get("error", "Timer operation completed"))
            
        elif tool_name == "list_timers":
            result = list_timers()
            
            # Convert any datetime objects in timer list to strings
            if result.get("timers"):
                from skills import active_timers
                serializable_timers = []
                for timer in result["timers"]:
                    # Get additional info from active_timers
                    timer_info = active_timers.get(timer["id"], {})
                    serializable_timer = {
                        "id": timer["id"],
                        "name": timer["name"],
                        "remaining": timer["remaining"],
                        "duration_minutes": timer_info.get("duration_minutes", 0),
                        "end_time": timer_info.get("end_time").strftime("%H:%M:%S") if timer_info.get("end_time") else "",
                        "created_at": timer_info.get("created_at").strftime("%H:%M:%S") if timer_info.get("created_at") else ""
                    }
                    serializable_timers.append(serializable_timer)
                
                result["timers"] = serializable_timers
            
            socketio.emit('timers_list', result)
            if result.get("timers"):
                timer_count = len(result["timers"])
                timer_names = [timer["name"] for timer in result["timers"]]
                final_text_for_speech = f"You have {timer_count} active timer{'s' if timer_count != 1 else ''}: {', '.join(timer_names)}"
            else:
                final_text_for_speech = result.get("message", "No active timers")
                
        elif tool_name == "convert_units":
            amount = parameters.get("amount", 1)
            from_unit = parameters.get("from_unit", "")
            to_unit = parameters.get("to_unit", "")
            
            # Normalize unit names to match convert_units function expectations
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
            
            # Normalize units (case insensitive)
            from_unit_normalized = unit_map.get(from_unit.lower(), from_unit.lower()) if from_unit else ""
            to_unit_normalized = unit_map.get(to_unit.lower(), to_unit.lower()) if to_unit else ""
            
            result = convert_units(amount, from_unit_normalized, to_unit_normalized)
            
            # Format data for frontend display
            display_data = {
                "result": result.get("conversion", ""),
                "amount": amount,
                "from_unit": from_unit,
                "to_unit": to_unit,
                "error": result.get("error")
            }
            
            print(f"📡 Emitting conversion_result: {display_data}")
            socketio.emit('conversion_result', display_data)
            if result.get("conversion"):
                final_text_for_speech = f"**{amount} {from_unit}** converts to **{result['conversion']}**. Perfect for your recipe!"
            else:
                final_text_for_speech = result.get("error", "I had trouble with that conversion. Could you try rephrasing it?")
                
        elif tool_name == "recipe_substitution":
            ingredient = parameters.get("ingredient", "")
            quantity = parameters.get("quantity", "")
            result = recipe_substitution(ingredient, quantity)
            
            socketio.emit('substitution_result', result)
            if result.get("substitutions"):
                substitutions = result["substitutions"]
                if len(substitutions) == 1:
                    final_text_for_speech = f"Great news! You can substitute **{ingredient}** with **{substitutions[0]}**. That should work perfectly in your recipe!"
                else:
                    final_text_for_speech = f"I found **{len(substitutions)} substitution options** for **{ingredient}**: {', '.join(substitutions[:3])}{'...' if len(substitutions) > 3 else ''}. Any of these should work!"
            else:
                final_text_for_speech = result.get("error", f"I couldn't find any substitutions for **{ingredient}** right now. You might want to check a cooking website or ask me about a different ingredient.")
                
        elif tool_name == "play_youtube_video":
            try:
                result = play_youtube_video(**parameters)
                if "video_play_request" in result:
                    # Get current YouTube results for this session
                    session_results = youtube_results.get(session_id, [])
                    result_number = int(result.get("result_number", 1))
                    
                    if session_results and 1 <= result_number <= len(session_results):
                        video_info = session_results[result_number - 1]
                        # Emit video play event to frontend
                        socketio.emit('play_video', {
                            'video_id': video_info.get('video_id'),
                            'title': video_info.get('title'),
                            'result_number': result_number
                        })
                        final_text_for_speech = f"Playing video {result_number}: {video_info.get('title', 'Video')}"
                    else:
                        final_text_for_speech = f"Sorry, I couldn't find video {result_number}. Please search for videos first."
                else:
                    final_text_for_speech = result.get("error", "Failed to play video")
            except Exception as e:
                print(f"❌ Error playing video: {e}")
                final_text_for_speech = "Sorry, I had trouble playing that video"
                
        elif tool_name == "search_recipes":
            query = parameters.get("query", "")
            diet = parameters.get("diet", "")
            cuisine = parameters.get("cuisine", "")
            
            try:
                result = search_recipes(query=query, diet=diet, cuisine=cuisine)
                if result.get("success") and result.get("recipes"):
                    recipes = result["recipes"]
                    print(f"📡 Emitting recipe_results: {len(recipes)} recipes found")
                    socketio.emit('recipe_results', {'recipes': recipes})
                    final_text_for_speech = f"I found {len(recipes)} recipes for you. Check the recipe section below!"
                else:
                    final_text_for_speech = result.get("message", "Sorry, I couldn't find any recipes matching your request.")
            except Exception as e:
                print(f"❌ Error searching recipes: {e}")
                final_text_for_speech = "Sorry, I had trouble searching for recipes."
                
        elif tool_name == "recipe_by_ingredients":
            ingredients = parameters.get("ingredients", "")
            
            try:
                result = recipe_by_ingredients(ingredients=ingredients)
                if result.get("success") and result.get("recipes"):
                    recipes = result["recipes"]
                    print(f"📡 Emitting recipe_results: {len(recipes)} recipes found with ingredients")
                    socketio.emit('recipe_results', {'recipes': recipes})
                    final_text_for_speech = f"I found {len(recipes)} recipes you can make with those ingredients. Check the recipe section!"
                else:
                    final_text_for_speech = result.get("message", "Sorry, I couldn't find any recipes with those ingredients.")
            except Exception as e:
                print(f"❌ Error finding recipes by ingredients: {e}")
                final_text_for_speech = "Sorry, I had trouble finding recipes with those ingredients."
                
        elif tool_name == "get_recipe_details":
            recipe_id = parameters.get("recipe_id", "")
            
            try:
                result = get_recipe_details(recipe_id=recipe_id)
                if result.get("success") and result.get("recipe"):
                    recipe = result["recipe"]
                    # You could emit detailed recipe info here if needed
                    recipe_title = recipe.get('title', 'this recipe') if isinstance(recipe, dict) else 'this recipe'
                    final_text_for_speech = f"Here are the details for {recipe_title}."
                else:
                    final_text_for_speech = result.get("message", "Sorry, I couldn't get the recipe details.")
            except Exception as e:
                print(f"❌ Error getting recipe details: {e}")
                final_text_for_speech = "Sorry, I had trouble getting the recipe details."
                
        elif tool_name in available_skills:
            # Handle other tools dynamically
            skill_function = available_skills[tool_name]
            try:
                result = skill_function(**parameters)
                final_text_for_speech = str(list(result.values())[0]) if result else "Task completed"
            except Exception as e:
                print(f"❌ Error executing {tool_name}: {e}")
                final_text_for_speech = "Sorry, I had trouble with that request"
        else:
            final_text_for_speech = "Sorry, I'm not sure how to help with that"
            
        # Send response to conversation section
        socketio.emit('final_text', {'text': final_text_for_speech})
        
    else:
        # Conversational reply - no tool needed
        final_text_for_speech = raw_response
        socketio.emit('final_text', {'text': final_text_for_speech})
    
    # Update conversation history
    if session_id not in conversation_history:
        conversation_history[session_id] = []
    conversation_history[session_id].append({"role": "user", "content": command})
    conversation_history[session_id].append({"role": "assistant", "content": final_text_for_speech})
    
    # Keep only last 10 exchanges to prevent memory issues
    if len(conversation_history[session_id]) > 20:
        conversation_history[session_id] = conversation_history[session_id][-20:]
    
    # Generate and send TTS audio
    if final_text_for_speech and isinstance(final_text_for_speech, str):
        try:
            audio_bytes = a4f_client.audio.speech.create(
                model="tts-1", input=final_text_for_speech, voice="nova"
            )
            # Convert to base64 for JSON transmission
            if isinstance(audio_bytes, (bytes, bytearray)):
                audio_b64 = base64.b64encode(audio_bytes).decode('ascii')
                socketio.emit('ai_audio_base64', {
                    'audio_b64': audio_b64,
                    'mime': 'audio/mpeg'
                })
            else:
                socketio.emit('ai_audio_chunk', {'audio': audio_bytes})
        except Exception as e:
            print(f"❌ Error during TTS generation: {e}")
            socketio.emit('error', {'message': 'Failed to generate speech'})

if __name__ == '__main__':
    # Create data directories if they don't exist
    os.makedirs('data', exist_ok=True)
    os.makedirs('data/timers', exist_ok=True)
    
    # Get port from environment variable (for Render deployment)
    port = int(os.getenv('PORT', 5000))
    
    # Run the Flask app with SocketIO
    if os.getenv('FLASK_ENV') == 'production':
        # Production mode - Gunicorn will handle this
        pass
    else:
        # Development mode
        socketio.run(app, debug=True, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)