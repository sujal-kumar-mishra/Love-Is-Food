"""
Flask and SocketIO Routes
Handles all HTTP and WebSocket events for the Kitchen Assistant AI
"""

import base64
import uuid
from datetime import datetime
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_socketio import emit
from flask_login import login_required, current_user

# Import services
from app.services.time_service import get_current_time, get_today_date
from app.services.conversion_service import convert_units
from app.services.wikipedia_service import search_wikipedia
from app.services.youtube_service import search_youtube, play_youtube_video
from app.services.recipe_service import (
    search_recipes, 
    get_recipe_details, 
    recipe_by_ingredients, 
    recipe_substitution
)
from app.services.tts_service import init_tts_service, get_tts_service

# Import models
from app.models.timer_model import timer_manager

# Global state (will be moved to proper session management later)
conversation_history = {}
youtube_results = {}

# Blueprint for HTTP routes
main_bp = Blueprint('main', __name__)


@main_bp.route('/')
@login_required  # Require login to access the app
def index():
    """Render the main application page"""
    return render_template('index.html')


@main_bp.route('/recipe/<recipe_id>')
@login_required
def recipe_detail(recipe_id):
    """Render the recipe detail page with advanced features"""
    # Get recipe details from Spoonacular API or AI recipes
    from app.services.recipe_service import get_recipe_details
    
    # Try to convert to int for TheMealDB recipes, keep as string for AI recipes
    try:
        recipe_id_param = int(recipe_id)
    except (ValueError, TypeError):
        recipe_id_param = recipe_id  # Keep as string for AI recipes like "ai_samosa"
    
    result = get_recipe_details(recipe_id_param)
    
    if result.get('success') and result.get('recipe'):
        recipe = result['recipe']
        return render_template('recipe_detail.html', recipe=recipe)
    else:
        flash('Recipe not found', 'error')
        return redirect(url_for('main.index'))


@main_bp.route('/video/<video_id>')
@login_required
def video_detail(video_id):
    """Render the YouTube video detail page with ingredients and summary"""
    # Get video details from YouTube service
    from app.services.youtube_service import get_video_details
    
    result = get_video_details(video_id)
    
    if result.get('success') and result.get('video'):
        video = result['video']
        return render_template('video_detail.html', video=video)
    else:
        flash('Video not found', 'error')
        return redirect(url_for('main.index'))


@main_bp.route('/profile')
@login_required
def profile():
    """Render the user profile page with gamification features"""
    return render_template('profile.html')


def init_routes(app, socketio, a4f_client, get_ai_response_text, extract_tool_call):
    """
    Initialize all routes with required dependencies
    
    Args:
        app: Flask application instance
        socketio: SocketIO instance
        a4f_client: A4F TTS client
        get_ai_response_text: Function to get AI response
        extract_tool_call: Function to extract tool calls from AI response
    """
    
    # Store dependencies for route handlers
    app.a4f_client = a4f_client
    app.get_ai_response_text = get_ai_response_text
    app.extract_tool_call = extract_tool_call
    
    
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection - create new session"""
        session_id = str(uuid.uuid4())[:8]  # Short unique ID
        emit('session_id', {'session_id': session_id})
        
        # Initialize session if it doesn't exist
        if session_id not in conversation_history:
            conversation_history[session_id] = []
        if session_id not in youtube_results:
            youtube_results[session_id] = []
        
        # Create MongoDB session if user is logged in
        try:
            from flask_login import current_user
            from app.models.database import db
            
            if current_user.is_authenticated:
                db.create_session(user_id=current_user.id, session_id=session_id)
                print(f'🔗 Authenticated user connected: {current_user.username} ({session_id})')
            else:
                print(f'🔗 Guest client connected: {session_id}')
        except Exception as e:
            print(f'⚠️ Session creation warning: {e}')
            print(f'🔗 Client connected: {session_id}')
    
    
    @socketio.on('restore_session')
    def handle_restore_session(data):
        """Handle session restoration from client"""
        session_id = data.get('session_id')
        
        if not session_id:
            print('⚠️ No session ID provided for restoration')
            return
        
        print(f'♻️ Restoring session: {session_id}')
        
        # Initialize session if it doesn't exist
        if session_id not in conversation_history:
            conversation_history[session_id] = []
            print(f'📝 Created new conversation history for session: {session_id}')
        else:
            print(f'✅ Found existing conversation with {len(conversation_history[session_id])} messages')
        
        if session_id not in youtube_results:
            youtube_results[session_id] = []
        
        # Send confirmation
        emit('session_restored', {
            'session_id': session_id,
            'message_count': len(conversation_history[session_id])
        })
    
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        # Note: We keep session data in memory for session persistence
        # In production, implement proper cleanup after timeout
        print(f'❌ Client disconnected (session data retained)')
    
    
    @socketio.on('generate_tts')
    def handle_generate_tts(data):
        """
        Generate TTS audio from text using centralized TTS service
        
        Args:
            data: Dictionary containing text to convert
        """
        text = data.get('text', '')
        
        if not text:
            print('⚠️ No text provided for TTS')
            return
        
        print(f"🔊 TTS Request: '{text[:50]}...'")
        
        try:
            # Use centralized TTS service
            tts_service = get_tts_service()
            result = tts_service.generate_speech(
                text=text,
                return_format='base64'
            )
            
            if result['success']:
                audio_b64 = result['audio_base64']
                print(f"✅ TTS generated, sending to client")
                emit('ai_audio_base64', {
                    'audio_b64': audio_b64,
                    'mime': result['mime_type']
                })
            else:
                print(f"❌ TTS generation failed: {result.get('error')}")
                emit('error', {'message': f"TTS Error: {result.get('error')}"})
                
        except Exception as e:
            print(f"❌ Error in TTS handler: {e}")
            import traceback
            traceback.print_exc()
            emit('error', {'message': 'Failed to generate speech'})
    
    
    @socketio.on('get_timers')
    def handle_get_timers():
        """Send current active timers to the client"""
        try:
            active_timers_list = []
            for timer_id, timer_info in list(timer_manager.active_timers.items()):
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
                    timer_manager.delete_timer(timer_id)
            
            print(f"📱 Sending timers list: {active_timers_list}")
            emit('timers_list', {'timers': active_timers_list})
        except Exception as e:
            print(f"Error getting timers: {e}")
            emit('timers_list', {'timers': []})
    
    
    @socketio.on('delete_timer')
    def handle_delete_timer_socket(data):
        """Handle timer deletion via socket event"""
        try:
            timer_id = data.get('timer_id')
            if timer_id is None:
                print("❌ No timer_id provided")
                emit('timer_deleted', {'success': False, 'error': 'No timer ID provided'})
                return
            
            print(f"🗑️ Deleting timer via socket: {timer_id}")
            result = timer_manager.delete_timer(timer_id)
            
            if 'error' in result:
                print(f"❌ Delete failed: {result['error']}")
                emit('timer_deleted', {'success': False, 'error': result['error']})
            else:
                print(f"✅ Timer deleted successfully: {result.get('message')}")
                emit('timer_deleted', {'success': True, 'message': result.get('message')})
                
                # Send updated timers list to all clients
                handle_get_timers()
                
        except Exception as e:
            print(f"❌ Error deleting timer: {e}")
            emit('timer_deleted', {'success': False, 'error': str(e)})
    
    
    @socketio.on('get_recipe_details')
    def handle_get_recipe_details(data):
        """Get full recipe details for the modal display"""
        try:
            recipe_id = data.get('recipe_id')
            if not recipe_id:
                emit('recipe_details', {'success': False, 'error': 'No recipe ID provided'})
                return
            
            print(f"Getting full recipe details for ID: {recipe_id}")
            result = get_recipe_details(recipe_id)
            
            if result.get("success"):
                emit('recipe_details', result)
            else:
                emit('recipe_details', {
                    'success': False, 
                    'error': result.get('error', 'Failed to get recipe details'),
                    'message': result.get('message', 'Could not fetch recipe details')
                })
        except Exception as e:
            print(f"Error getting recipe details: {e}")
            emit('recipe_details', {'success': False, 'error': str(e)})
    
    
    @socketio.on('user_command')
    def handle_user_command(data):
        """
        Main command handler - processes user input and executes AI tools
        
        Args:
            data: Dictionary containing command and session_id
        """
        command = data.get('command', '')
        session_id = data.get('session_id', 'default')
        
        # Initialize session if not exists
        if session_id not in conversation_history:
            conversation_history[session_id] = []
        if session_id not in youtube_results:
            youtube_results[session_id] = []
        
        print(f"🎤 User ({session_id[:8]}): {command}")
        
        # Get conversation history for this session
        chat_history = conversation_history.get(session_id, [])
        
        # Get AI response
        raw_response = app.get_ai_response_text(command, chat_history)
        print(f"🤖 AI Raw Response: {raw_response}")
        
        final_text_for_speech = ""
        tool_call = app.extract_tool_call(raw_response or "")
        print(f"🔍 Extracted tool call: {tool_call}")
        
        if tool_call:
            final_text_for_speech = handle_tool_call(
                tool_call, 
                session_id, 
                youtube_results, 
                socketio
            )
        else:
            # Conversational reply - no tool needed
            final_text_for_speech = raw_response
            emit('final_text', {'text': final_text_for_speech})
        
        # Update conversation history
        conversation_history[session_id].append({"role": "user", "content": command})
        conversation_history[session_id].append({"role": "assistant", "content": final_text_for_speech})
        
        # Save conversation to MongoDB if user is logged in
        try:
            from flask_login import current_user
            from app.models.database import db
            
            if current_user.is_authenticated:
                # Save user message
                db.save_conversation(
                    user_id=current_user.id,
                    session_id=session_id,
                    message={"role": "user", "content": command}
                )
                
                # Save assistant response
                db.save_conversation(
                    user_id=current_user.id,
                    session_id=session_id,
                    message={"role": "assistant", "content": final_text_for_speech}
                )
                
                # Update session activity
                db.update_session_activity(session_id)
        except Exception as e:
            print(f"⚠️ Failed to save conversation to MongoDB: {e}")
        
        # Keep only last 6 exchanges (12 messages) to prevent context overflow
        if len(conversation_history[session_id]) > 12:
            conversation_history[session_id] = conversation_history[session_id][-12:]
        
        # Generate and send TTS audio
        generate_tts_audio(final_text_for_speech, app.a4f_client, socketio)
    
    
    def handle_tool_call(tool_call, session_id, youtube_results, socketio):
        """
        Execute the appropriate tool based on AI's tool call
        
        Args:
            tool_call: Dictionary with tool_name and parameters
            session_id: Current session identifier
            youtube_results: Dictionary storing YouTube search results per session
            socketio: SocketIO instance for emitting events
            
        Returns:
            str: Response text for speech synthesis
        """
        tool_name = tool_call.get("tool_name")
        parameters = tool_call.get("parameters", {}) or {}
        print(f"🛠️  Tool Call: {tool_name} with params: {parameters}")
        
        final_text = ""
        
        # YouTube Search
        if tool_name == "search_youtube":
            search_query = parameters.get("query") or ""
            print(f"🔍 Executing YouTube search for: {search_query}")
            result = search_youtube(search_query)
            videos = result.get('videos', [])
            youtube_results[session_id] = videos
            
            emit('youtube_results', {'videos': videos})
            final_text = (
                f"Here are the top recipe results I found for {search_query}."
                if videos else "Sorry, I couldn't find any recipe videos for that query."
            )
        
        # Play YouTube Video
        elif tool_name == "play_youtube_video":
            result_num = parameters.get("result_number")
            videos = youtube_results.get(session_id, [])
            print(f"📹 Videos in session: {len(videos)}, Requested: {result_num}")
            
            if isinstance(result_num, int) and 1 <= result_num <= len(videos):
                video_to_play = videos[result_num - 1]
                print(f"▶️ Playing video: {video_to_play.get('title', 'Unknown')} (ID: {video_to_play['video_id']})")
                
                # Emit play_video event with video details
                emit('play_video', {
                    'video_id': video_to_play['video_id'],
                    'title': video_to_play.get('title', 'Recipe Video')
                })
                
                final_text = f"Playing {video_to_play.get('title', 'recipe video number ' + str(result_num))}."
            else:
                final_text = "Sorry, I can't find that video number. Please search for recipes first."
        
        # Timer Management
        elif tool_name == "set_timer":
            final_text = handle_set_timer(parameters, socketio)
        
        elif tool_name == "delete_timer":
            final_text = handle_delete_timer(parameters, socketio)
        
        elif tool_name == "list_timers":
            final_text = handle_list_timers(socketio)
        
        # Unit Conversion
        elif tool_name == "convert_units":
            final_text = handle_convert_units(parameters, socketio)
        
        # Recipe Substitution
        elif tool_name == "recipe_substitution":
            final_text = handle_recipe_substitution(parameters, socketio)
        
        # Recipe Search
        elif tool_name == "search_recipes":
            final_text = handle_search_recipes(parameters, socketio)
        
        # Open Recipe (Navigate to recipe page)
        elif tool_name == "open_recipe":
            final_text = handle_open_recipe(parameters, socketio)
        
        # Recipe by Ingredients
        elif tool_name == "recipe_by_ingredients":
            final_text = handle_recipe_by_ingredients(parameters, socketio)
        
        # Get Recipe Details
        elif tool_name == "get_recipe_details":
            final_text = handle_get_recipe_details_tool(parameters, socketio)
        
        # Time and Date
        elif tool_name == "get_current_time":
            result = get_current_time()
            final_text = result.get("time", "I couldn't get the time right now.")
        
        elif tool_name == "get_today_date":
            result = get_today_date()
            final_text = result.get("date", "I couldn't get the date right now.")
        
        # Wikipedia Search
        elif tool_name == "search_wikipedia":
            query = parameters.get("query", "")
            result = search_wikipedia(query)
            final_text = result.get("summary", "I couldn't find information about that.")
        
        else:
            final_text = "Sorry, I'm not sure how to help with that"
        
        # Send response to conversation section
        emit('final_text', {'text': final_text})
        return final_text
    
    
    def handle_set_timer(parameters, socketio):
        """Handle timer creation"""
        duration = parameters.get("duration_minutes", 5)
        timer_name = parameters.get("timer_name", "")
        result = timer_manager.create_timer(duration, timer_name)
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
        emit('timer_set', {
            'timer': timer_info_serializable,
            'message': result.get("message")
        })
        
        # Also emit the updated timers list
        emit_updated_timers_list(socketio)
        
        # Create a more conversational response
        if timer_name:
            return f"Perfect! I've set a **{timer_name} timer** for **{duration} minutes**. I'll let you know when it's done!"
        else:
            return f"Timer set for **{duration} minutes**. I'll alert you when the time is up!"
    
    
    def handle_delete_timer(parameters, socketio):
        """Handle timer deletion"""
        timer_id = parameters.get("timer_identifier")
        result = timer_manager.delete_timer(timer_id)
        emit('timer_deleted', result)
        
        # Send updated timers list after deletion
        emit_updated_timers_list(socketio)
        return result.get("message", result.get("error", "Timer operation completed"))
    
    
    def handle_list_timers(socketio):
        """Handle listing all timers"""
        result = timer_manager.list_timers()
        
        # Convert datetime objects to strings
        if result.get("timers"):
            serializable_timers = []
            for timer in result["timers"]:
                timer_info = timer_manager.active_timers.get(timer["id"], {})
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
        
        emit('timers_list', result)
        if result.get("timers"):
            timer_count = len(result["timers"])
            timer_names = [timer["name"] for timer in result["timers"]]
            return f"You have {timer_count} active timer{'s' if timer_count != 1 else ''}: {', '.join(timer_names)}"
        else:
            return result.get("message", "No active timers")
    
    
    def emit_updated_timers_list(socketio):
        """Helper function to emit updated timers list"""
        updated_timers = timer_manager.list_timers()
        if updated_timers.get("timers"):
            serializable_timers = []
            for timer in updated_timers["timers"]:
                timer_info_data = timer_manager.active_timers.get(timer["id"], {})
                serializable_timers.append({
                    "id": timer["id"],
                    "name": timer["name"],
                    "remaining": timer["remaining"],
                    "duration_minutes": timer_info_data.get("duration_minutes", 0),
                    "end_time": timer_info_data.get("end_time", "").strftime("%H:%M:%S") if timer_info_data.get("end_time") else "",
                    "created_at": timer_info_data.get("created_at", "").strftime("%H:%M:%S") if timer_info_data.get("created_at") else ""
                })
            updated_timers["timers"] = serializable_timers
        
        print(f"📡 Emitting timers_list event: {updated_timers}")
        emit('timers_list', updated_timers)
    
    
    def handle_convert_units(parameters, socketio):
        """Handle unit conversion"""
        amount = parameters.get("amount", 1)
        from_unit = parameters.get("from_unit", "")
        to_unit = parameters.get("to_unit", "")
        
        # Normalize unit names
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
        
        from_unit_normalized = unit_map.get(from_unit.lower(), from_unit.lower()) if from_unit else ""
        to_unit_normalized = unit_map.get(to_unit.lower(), to_unit.lower()) if to_unit else ""
        
        result = convert_units(amount, from_unit_normalized, to_unit_normalized)
        
        display_data = {
            "result": result.get("result", ""),
            "amount": amount,
            "from_unit": from_unit,
            "to_unit": to_unit,
            "error": result.get("error")
        }
        
        print(f"📡 Emitting conversion_result: {display_data}")
        emit('conversion_result', display_data)
        
        if result.get("result"):
            return f"**{amount} {from_unit}** converts to **{result['result']} {to_unit}**. Perfect for your recipe!"
        else:
            return result.get("error", "I had trouble with that conversion. Could you try rephrasing it?")
    
    
    def handle_recipe_substitution(parameters, socketio):
        """Handle recipe ingredient substitution"""
        ingredient = parameters.get("ingredient", "")
        quantity = parameters.get("quantity", "")
        result = recipe_substitution(ingredient, quantity)
        
        emit('substitution_result', result)
        
        if result.get("substitutions"):
            substitutions = result["substitutions"]
            source = result.get("source", "database")
            
            # Different message based on source
            if source == "ai":
                ai_note = " (AI-generated suggestions)"
            else:
                ai_note = ""
            
            if len(substitutions) == 1:
                return f"Great news! You can substitute **{ingredient}** with **{substitutions[0]}**{ai_note}. That should work perfectly in your recipe!"
            else:
                return f"I found **{len(substitutions)} substitution options** for **{ingredient}**{ai_note}: {', '.join(substitutions[:2])}{'...' if len(substitutions) > 2 else ''}. Check the substitutions section for details!"
        else:
            return result.get("error", f"I couldn't find any substitutions for **{ingredient}** right now. You might want to check a cooking website or ask me about a different ingredient.")
    
    
    def handle_search_recipes(parameters, socketio):
        """Handle recipe search"""
        query = parameters.get("query", "")
        diet = parameters.get("diet", "")
        cuisine = parameters.get("cuisine", "")
        
        try:
            result = search_recipes(query=query, diet=diet, cuisine=cuisine)
            if result.get("success") and result.get("recipes"):
                recipes = result["recipes"]
                print(f"📡 Emitting recipe_results: {len(recipes)} recipes found")
                emit('recipe_results', {'recipes': recipes})
                return f"I found {len(recipes)} recipes for you. Check the recipe section below!"
            else:
                return result.get("message", "Sorry, I couldn't find any recipes matching your request.")
        except Exception as e:
            print(f"❌ Error searching recipes: {e}")
            return "Sorry, I had trouble searching for recipes."
    
    
    def handle_open_recipe(parameters, socketio):
        """Handle opening a specific recipe page"""
        recipe_name = parameters.get("recipe_name", "")
        
        try:
            # First, search for the recipe to get its ID
            result = search_recipes(query=recipe_name, diet="", cuisine="")
            if result.get("success") and result.get("recipes"):
                recipes = result["recipes"]
                if len(recipes) > 0:
                    # Get the first (best) match
                    recipe = recipes[0]
                    recipe_id = recipe.get('id')
                    recipe_title = recipe.get('title', recipe_name)
                    
                    print(f"📡 Navigating to recipe: {recipe_title} (ID: {recipe_id})")
                    # Emit navigation event
                    emit('navigate_to_recipe', {
                        'recipe_id': recipe_id,
                        'title': recipe_title
                    })
                    print(f"✅ navigate_to_recipe event emitted successfully")
                    return f"Opening {recipe_title} recipe page now."
                else:
                    return f"Sorry, I couldn't find a recipe for {recipe_name}."
            else:
                return f"Sorry, I couldn't find the {recipe_name} recipe."
        except Exception as e:
            print(f"❌ Error opening recipe: {e}")
            return f"Sorry, I had trouble opening the {recipe_name} recipe."
    
    
    def handle_recipe_by_ingredients(parameters, socketio):
        """Handle recipe search by ingredients"""
        ingredients = parameters.get("ingredients", "")
        
        try:
            result = recipe_by_ingredients(ingredients=ingredients)
            if result.get("success") and result.get("recipes"):
                recipes = result["recipes"]
                print(f"📡 Emitting recipe_results: {len(recipes)} recipes found with ingredients")
                emit('recipe_results', {'recipes': recipes})
                return f"I found {len(recipes)} recipes you can make with those ingredients. Check the recipe section!"
            else:
                return result.get("message", "Sorry, I couldn't find any recipes with those ingredients.")
        except Exception as e:
            print(f"❌ Error finding recipes by ingredients: {e}")
            return "Sorry, I had trouble finding recipes with those ingredients."
    
    
    def handle_get_recipe_details_tool(parameters, socketio):
        """Handle getting recipe details"""
        recipe_id = parameters.get("recipe_id", "")
        
        try:
            result = get_recipe_details(recipe_id=recipe_id)
            if result.get("success") and result.get("recipe"):
                recipe = result["recipe"]
                recipe_title = recipe.get('title', 'this recipe') if isinstance(recipe, dict) else 'this recipe'
                return f"Here are the details for {recipe_title}."
            else:
                return result.get("message", "Sorry, I couldn't get the recipe details.")
        except Exception as e:
            print(f"❌ Error getting recipe details: {e}")
            return "Sorry, I had trouble getting the recipe details."
    
    
    def generate_tts_audio(text, a4f_client, socketio):
        """
        Generate TTS audio using centralized TTS service
        
        Args:
            text: Text to convert to speech
            a4f_client: A4F TTS client instance (for compatibility)
            socketio: SocketIO instance for emitting audio
        """
        print(f"🔊 TTS Request: '{text[:50]}...' (length: {len(text) if text else 0})")
        
        if text and isinstance(text, str) and len(text.strip()) > 0:
            try:
                print(f"🎙️ Generating TTS audio using centralized service...")
                
                # Use centralized TTS service
                tts_service = get_tts_service()
                result = tts_service.generate_speech(
                    text=text,
                    return_format='base64'
                )
                
                if result['success']:
                    audio_b64 = result['audio_base64']
                    print(f"✅ TTS generated, size: {len(audio_b64)} bytes (base64)")
                    emit('ai_audio_base64', {
                        'audio_b64': audio_b64,
                        'mime': result['mime_type']
                    })
                    print(f"📤 TTS audio sent to client")
                else:
                    print(f"❌ TTS generation failed: {result.get('error')}")
                    emit('error', {'message': 'Failed to generate speech'})
                    
            except Exception as e:
                print(f"❌ Error during TTS generation: {e}")
                emit('error', {'message': 'Failed to generate speech'})
        else:
            print(f"⚠️ Skipping TTS - empty or invalid text")
    
    
    # Register blueprint (for future HTTP routes)
    app.register_blueprint(main_bp)
    
    print("✅ Routes initialized successfully")


# API Routes for Video Details Page

@main_bp.route('/api/favorites/video', methods=['POST'])
@login_required
def save_favorite_video():
    """Save a video to user's favorites"""
    from flask import current_app
    from flask_login import current_user
    
    try:
        data = request.json
        video_id = data.get('video_id')
        title = data.get('title')
        channel = data.get('channel')
        thumbnail = data.get('thumbnail')
        
        if not video_id:
            return jsonify({"success": False, "error": "Video ID is required"}), 400
        
        # Get MongoDB collection
        db = current_app.config['MONGO_CLIENT']['kitchen_assistant']
        favorites_collection = db['favorites']
        
        # Check if already favorited
        existing = favorites_collection.find_one({
            'user_id': current_user.id,
            'video_id': video_id,
            'type': 'video'
        })
        
        if existing:
            return jsonify({"success": True, "message": "Already in favorites"}), 200
        
        # Add to favorites
        favorite_doc = {
            'user_id': current_user.id,
            'video_id': video_id,
            'title': title,
            'channel': channel,
            'thumbnail': thumbnail,
            'type': 'video',
            'created_at': datetime.now()
        }
        
        favorites_collection.insert_one(favorite_doc)
        
        return jsonify({"success": True, "message": "Video saved to favorites"}), 200
        
    except Exception as e:
        print(f"Error saving favorite video: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@main_bp.route('/api/video/notes', methods=['POST'])
@login_required
def save_video_notes():
    """Save notes for a video"""
    from app.models.database import db
    from flask_login import current_user
    
    try:
        data = request.json
        video_id = data.get('video_id')
        title = data.get('title')
        notes = data.get('notes')
        watch_url = data.get('watch_url')
        
        if not video_id or not notes:
            return jsonify({"success": False, "error": "Video ID and notes are required"}), 400
        
        # Get MongoDB collection
        notes_collection = db.db['video_notes']
        
        # Update or insert notes
        update_doc = {
            '$set': {
                'title': title,
                'notes': notes,
                'updated_at': datetime.now()
            },
            '$setOnInsert': {
                'created_at': datetime.now()
            }
        }

        # Save the original YouTube/watch URL when available so links can be preserved
        if watch_url:
            update_doc['$set']['watch_url'] = watch_url

        notes_collection.update_one(
            {'user_id': current_user.id, 'video_id': video_id},
            update_doc,
            upsert=True
        )
        
        return jsonify({"success": True, "message": "Notes saved successfully"}), 200
        
    except Exception as e:
        print(f"Error saving video notes: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@main_bp.route('/api/video/notes/<video_id>', methods=['GET'])
@login_required
def get_video_notes(video_id):
    """Get saved notes for a video"""
    from app.models.database import db
    from flask_login import current_user
    
    try:
        # Get MongoDB collection
        notes_collection = db.db['video_notes']
        
        # Find notes
        note_doc = notes_collection.find_one({
            'user_id': current_user.id,
            'video_id': video_id
        })
        
        if note_doc:
            return jsonify({
                "success": True,
                "notes": note_doc.get('notes', ''),
                "title": note_doc.get('title', ''),
                "watch_url": note_doc.get('watch_url', ''),
                "updated_at": note_doc.get('updated_at', '').isoformat() if note_doc.get('updated_at') else ''
            }), 200
        else:
            return jsonify({"success": False, "message": "No notes found"}), 404
        
    except Exception as e:
        print(f"Error getting video notes: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@main_bp.route('/api/video/notes/all', methods=['GET'])
@login_required
def get_all_user_notes():
    """Get all video notes for the current user"""
    from app.models.database import db
    from flask_login import current_user
    
    try:
        # Get MongoDB collection
        notes_collection = db.db['video_notes']
        
        # Find all notes for user
        notes_cursor = notes_collection.find({'user_id': current_user.id}).sort('updated_at', -1)
        
        notes_list = []
        for note in notes_cursor:
            notes_list.append({
                'video_id': note.get('video_id'),
                'title': note.get('title', 'Untitled Recipe'),
                'notes': note.get('notes', ''),
                'watch_url': note.get('watch_url', ''),
                'created_at': note.get('created_at', '').isoformat() if note.get('created_at') else '',
                'updated_at': note.get('updated_at', '').isoformat() if note.get('updated_at') else ''
            })
        
        return jsonify({"success": True, "notes": notes_list, "count": len(notes_list)}), 200
        
    except Exception as e:
        print(f"Error getting all notes: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@main_bp.route('/api/video/notes/<video_id>', methods=['DELETE'])
@login_required
def delete_video_notes(video_id):
    """Delete notes for a video"""
    from app.models.database import db
    from flask_login import current_user
    
    try:
        # Get MongoDB collection
        notes_collection = db.db['video_notes']
        
        # Delete notes
        result = notes_collection.delete_one({
            'user_id': current_user.id,
            'video_id': video_id
        })
        
        if result.deleted_count > 0:
            return jsonify({"success": True, "message": "Note deleted successfully"}), 200
        else:
            return jsonify({"success": False, "message": "No note found to delete"}), 404
        
    except Exception as e:
        print(f"Error deleting video notes: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# =====================================================================
# FAVORITES ROUTES
# =====================================================================

@main_bp.route('/api/favorites/recipe', methods=['POST'])
@login_required
def add_favorite_recipe():
    """Add a recipe to user's favorites"""
    from app.models.database import db
    from flask_login import current_user
    
    try:
        data = request.json
        recipe_id = data.get('recipe_id')
        recipe_title = data.get('recipe_title')
        recipe_image = data.get('recipe_image')
        recipe_source = data.get('recipe_source', 'spoonacular')  # spoonacular, themealdb, ai, youtube
        recipe_watch_url = data.get('recipe_watch_url', '')
        
        if not recipe_id or not recipe_title:
            return jsonify({"success": False, "error": "Recipe ID and title are required"}), 400
        
        # Get MongoDB collection
        favorites_collection = db.db['favorites']
        
        # Check if already favorited
        existing = favorites_collection.find_one({
            'user_id': current_user.id,
            'recipe_id': str(recipe_id)
        })
        
        if existing:
            return jsonify({"success": False, "message": "Recipe already in favorites"}), 409
        
        # Add to favorites
        favorites_collection.insert_one({
            'user_id': current_user.id,
            'recipe_id': str(recipe_id),
            'recipe_title': recipe_title,
            'recipe_image': recipe_image,
            'recipe_source': recipe_source,
            'recipe_watch_url': recipe_watch_url,
            'created_at': datetime.now()
        })
        
        return jsonify({"success": True, "message": "Recipe added to favorites"}), 200
        
    except Exception as e:
        print(f"Error adding favorite recipe: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@main_bp.route('/api/favorites', methods=['GET'])
@login_required
def get_favorite_recipes():
    """Get all favorite recipes for the current user"""
    from app.models.database import db
    from flask_login import current_user
    
    try:
        # Get MongoDB collection
        favorites_collection = db.db['favorites']
        
        # Debug: Print current user ID
        print(f"🔍 GET Favorites - Current User ID: {current_user.id}")
        print(f"🔍 GET Favorites - Current Username: {current_user.username}")
        
        # Get all favorites for user
        favorites = list(favorites_collection.find(
            {'user_id': current_user.id}
        ).sort('created_at', -1))
        
        print(f"🔍 GET Favorites - Found {len(favorites)} favorites for this user")
        
        # Convert ObjectId to string for JSON serialization
        for fav in favorites:
            fav['_id'] = str(fav['_id'])
            if 'created_at' in fav:
                fav['created_at'] = fav['created_at'].isoformat()
            print(f"   - {fav.get('recipe_title')} (ID: {fav.get('recipe_id')})")
        
        return jsonify({"success": True, "favorites": favorites}), 200
        
    except Exception as e:
        print(f"Error getting favorite recipes: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@main_bp.route('/api/favorites/<recipe_id>', methods=['DELETE'])
@login_required
def remove_favorite_recipe(recipe_id):
    """Remove a recipe from user's favorites"""
    from app.models.database import db
    from flask_login import current_user
    
    try:
        # Get MongoDB collection
        favorites_collection = db.db['favorites']
        
        # Delete favorite
        result = favorites_collection.delete_one({
            'user_id': current_user.id,
            'recipe_id': recipe_id
        })
        
        if result.deleted_count > 0:
            return jsonify({"success": True, "message": "Recipe removed from favorites"}), 200
        else:
            return jsonify({"success": False, "message": "Recipe not found in favorites"}), 404
        
    except Exception as e:
        print(f"Error removing favorite recipe: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@main_bp.route('/api/favorites/check/<recipe_id>', methods=['GET'])
@login_required
def check_favorite_status(recipe_id):
    """Check if a recipe is favorited by the current user"""
    from app.models.database import db
    from flask_login import current_user
    
    try:
        # Get MongoDB collection
        favorites_collection = db.db['favorites']
        
        # Check if favorited
        favorite = favorites_collection.find_one({
            'user_id': current_user.id,
            'recipe_id': recipe_id
        })
        
        return jsonify({"success": True, "is_favorited": favorite is not None}), 200
        
    except Exception as e:
        print(f"Error checking favorite status: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@main_bp.route('/api/favorites/clear-all', methods=['DELETE'])
@login_required
def clear_all_favorites():
    """Clear ALL favorites for the current user (for debugging/cleanup)"""
    from app.models.database import db
    from flask_login import current_user
    
    try:
        # Get MongoDB collection
        favorites_collection = db.db['favorites']
        
        # Delete all favorites for current user
        result = favorites_collection.delete_many({
            'user_id': current_user.id
        })
        
        print(f"🗑️ Cleared {result.deleted_count} favorites for user {current_user.username}")
        
        return jsonify({
            "success": True, 
            "message": f"Cleared {result.deleted_count} favorites",
            "deleted_count": result.deleted_count
        }), 200
        
    except Exception as e:
        print(f"Error clearing favorites: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


