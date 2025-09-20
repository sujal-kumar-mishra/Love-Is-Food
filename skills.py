from datetime import datetime, timedelta
import wikipedia
import threading
import time
import requests
import os
from youtubesearchpython import VideosSearch # Import the new library

def get_current_time():
    """Returns the current time in a human-readable format."""
    now = datetime.now()
    return {"time": now.strftime("%I:%M %p")}

def search_wikipedia(query: str):
    """Searches Wikipedia for a given query and returns a short summary."""
    try:
        summary = wikipedia.summary(query, sentences=2)
        return {"summary": summary}
    except Exception as e:
        return {"error": f"Could not find information on Wikipedia for '{query}'."}

def get_today_date():
    """Returns today's date in a human-readable format."""
    now = datetime.now()
    day = int(now.strftime("%d"))
    suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return {"date": now.strftime(f"%A, %B {day}{suffix}, %Y")}

# Global timer storage
active_timers = {}
timer_counter = 0

def search_youtube(query: str):
    """
    Searches YouTube for videos with multiple fallback methods.
    Enhanced with robust error handling and alternative approaches.
    """
    try:
        # Add recipe-focused search terms if not already present
        if not any(term in query.lower() for term in ['recipe', 'cooking', 'how to make', 'how to cook']):
            query = f"{query} recipe"
        
        print(f"🔍 Searching YouTube for: {query}")
        
        # Method 1: Try the library without proxies parameter workaround
        try:
            # Import here to avoid initialization issues
            import youtubesearchpython
            
            # Monkey patch to remove proxies parameter if needed
            original_post = None
            try:
                import httpx
                original_post = httpx.post
                
                def patched_post(url, **kwargs):
                    # Remove proxies parameter that's causing issues
                    kwargs.pop('proxies', None)
                    return original_post(url, **kwargs)
                
                httpx.post = patched_post
                
                search = VideosSearch(query, limit=3)
                search_result = search.result()
                
                # Restore original post function
                if original_post:
                    httpx.post = original_post
                
                if search_result and 'result' in search_result and search_result['result']:
                    formatted_results = []
                    for i, video in enumerate(search_result['result'][:3]):
                        try:
                            formatted_results.append({
                                "result_number": i + 1,
                                "title": video.get('title', 'Unknown Title'),
                                "video_id": video.get('id', ''),
                                "thumbnail": video.get('thumbnails', [{}])[0].get('url', '') if video.get('thumbnails') else ''
                            })
                        except Exception as video_error:
                            print(f"Error processing video {i}: {video_error}")
                            continue
                    
                    if formatted_results:
                        print(f"✅ Found {len(formatted_results)} videos using patched library")
                        return {"videos": formatted_results}
                        
            except Exception as patch_error:
                print(f"Patched library method failed: {patch_error}")
                # Restore original if patching failed
                if original_post:
                    try:
                        httpx.post = original_post
                    except:
                        pass
        
        except Exception as lib_error:
            print(f"Library method failed completely: {lib_error}")
        
        # Method 2: Fallback with mock results that provide direct YouTube search
        print("⚠️ Using fallback method with direct YouTube search links")
        from urllib.parse import quote_plus
        
        # Create search results that redirect to YouTube
        search_url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
        
        fallback_results = [
            {
                "result_number": 1,
                "title": f"🔍 Search YouTube for: {query}",
                "video_id": "search_redirect",
                "thumbnail": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/YouTube_Logo_2017.svg/1280px-YouTube_Logo_2017.svg.png",
                "search_url": search_url,
                "note": "Click to search on YouTube"
            }
        ]
        
        print(f"✅ Providing YouTube search redirect for: {query}")
        return {
            "videos": fallback_results,
            "search_url": search_url,
            "fallback": True
        }
        
    except Exception as e:
        print(f"❌ All YouTube search methods failed: {e}")
        import traceback
        traceback.print_exc()
        return {"error": "YouTube search is currently unavailable. Please try again later."}

def set_timer(duration_minutes: int, timer_name: str = ""):
    """
    Sets a timer for the specified duration in minutes.
    Returns timer info and starts background countdown.
    """
    global timer_counter, active_timers
    timer_counter += 1
    timer_id = timer_counter
    
    if not timer_name:
        timer_name = f"Timer {timer_id}"
    
    end_time = datetime.now() + timedelta(minutes=duration_minutes)
    
    timer_info = {
        "id": timer_id,
        "name": timer_name,
        "duration_minutes": duration_minutes,
        "end_time": end_time,
        "created_at": datetime.now()
    }
    
    active_timers[timer_id] = timer_info
    
    # Start background timer with periodic updates
    def timer_thread():
        total_seconds = duration_minutes * 60
        while total_seconds > 0 and timer_id in active_timers:
            time.sleep(1)  # Update every second
            total_seconds -= 1
            
            # Import here to avoid circular imports
            try:
                from app import socketio
                # Broadcast timer update
                remaining_minutes = total_seconds // 60
                remaining_seconds = total_seconds % 60
                socketio.emit('timer_update', {
                    'timer_id': timer_id,
                    'name': timer_name,
                    'remaining_minutes': remaining_minutes,
                    'remaining_seconds': remaining_seconds,
                    'remaining_time': f"{remaining_minutes}:{remaining_seconds:02d}"
                })
            except ImportError:
                pass  # socketio not available
        
        # Timer finished
        if timer_id in active_timers:
            print(f"⏰ TIMER ALERT: {timer_name} ({duration_minutes} minutes) has finished!")
            try:
                from app import socketio
                socketio.emit('timer_finished', {
                    'timer_id': timer_id,
                    'name': timer_name,
                    'message': f"Timer '{timer_name}' has finished!"
                })
            except ImportError:
                pass
    
    threading.Thread(target=timer_thread, daemon=True).start()
    
    return {
        "message": f"Timer '{timer_name}' set for {duration_minutes} minutes",
        "timer": timer_info
    }

def delete_timer(timer_identifier):
    """
    Deletes a timer by ID or name.
    """
    global active_timers
    
    # Try to find timer by ID first
    if isinstance(timer_identifier, int) and timer_identifier in active_timers:
        timer_name = active_timers[timer_identifier]["name"]
        del active_timers[timer_identifier]
        return {"message": f"Timer '{timer_name}' deleted successfully"}
    
    # Try to find timer by name
    if isinstance(timer_identifier, str):
        for timer_id, timer_info in list(active_timers.items()):
            if timer_info["name"].lower() == timer_identifier.lower():
                del active_timers[timer_id]
                return {"message": f"Timer '{timer_identifier}' deleted successfully"}
    
    return {"error": f"Timer '{timer_identifier}' not found"}

def list_timers():
    """
    Lists all active timers with remaining time.
    """
    if not active_timers:
        return {"message": "No active timers"}
    
    current_time = datetime.now()
    timer_list = []
    
    for timer_id, timer_info in active_timers.items():
        remaining_time = timer_info["end_time"] - current_time
        if remaining_time.total_seconds() > 0:
            remaining_minutes = int(remaining_time.total_seconds() / 60)
            remaining_seconds = remaining_time.seconds % 60
            timer_list.append({
                "id": timer_id,
                "name": timer_info["name"],
                "remaining": f"{remaining_minutes}m {remaining_seconds}s"
            })
        else:
            # Timer has finished, remove it
            del active_timers[timer_id]
    
    return {"timers": timer_list}

def convert_units(amount: float, from_unit: str, to_unit: str):
    """
    Converts cooking measurements between different units.
    Supports common cooking conversions.
    """
    # Conversion table to milliliters (base unit)
    to_ml = {
        # Volume conversions
        "teaspoon": 4.929,
        "tsp": 4.929,
        "tablespoon": 14.787,
        "tbsp": 14.787,
        "fluid_ounce": 29.574,
        "fl_oz": 29.574,
        "cup": 236.588,
        "pint": 473.176,
        "quart": 946.353,
        "liter": 1000,
        "l": 1000,
        "milliliter": 1,
        "ml": 1,
        # Weight conversions (approximate for water/flour)
        "ounce": 28.35,  # grams
        "oz": 28.35,
        "pound": 453.592,  # grams
        "lb": 453.592,
        "gram": 1,
        "g": 1,
        "kilogram": 1000,
        "kg": 1000
    }
    
    from_unit_clean = from_unit.lower().replace(" ", "_")
    to_unit_clean = to_unit.lower().replace(" ", "_")
    
    if from_unit_clean not in to_ml or to_unit_clean not in to_ml:
        available_units = ", ".join(sorted(set([k.replace("_", " ") for k in to_ml.keys()])))
        return {"error": f"Unit not supported. Available units: {available_units}"}
    
    # Convert to base unit, then to target unit
    base_amount = amount * to_ml[from_unit_clean]
    result = base_amount / to_ml[to_unit_clean]
    
    return {
        "conversion": f"{amount} {from_unit} = {result:.2f} {to_unit}",
        "result": round(result, 2),
        "original_amount": amount,
        "original_unit": from_unit,
        "converted_unit": to_unit
    }

def recipe_substitution(ingredient: str, quantity: str = ""):
    """
    Provides recipe substitutions for common cooking ingredients.
    """
    substitutions = {
        "butter": [
            "Equal amount of vegetable oil or melted coconut oil",
            "3/4 the amount of applesauce (for baking)",
            "Equal amount of margarine"
        ],
        "eggs": [
            "1/4 cup applesauce per egg (for baking)",
            "1 tbsp ground flaxseed + 3 tbsp water per egg (let sit 5 mins)",
            "1/4 cup mashed banana per egg (adds sweetness)"
        ],
        "milk": [
            "Equal amount of plant-based milk (almond, soy, oat)",
            "Equal amount of water + 1 tbsp lemon juice or vinegar",
            "3/4 cup evaporated milk + 1/4 cup water"
        ],
        "flour": [
            "Equal amount of almond flour (for gluten-free)",
            "3/4 amount of oat flour",
            "1:1 gluten-free flour blend"
        ],
        "sugar": [
            "3/4 amount of honey (reduce liquid by 1/4 cup)",
            "3/4 amount of maple syrup (reduce liquid by 3 tbsp)",
            "Equal amount of stevia blend or monk fruit sweetener"
        ],
        "heavy cream": [
            "3/4 cup milk + 1/4 cup melted butter",
            "Equal amount of coconut cream",
            "Equal amount of Greek yogurt (for non-whipped uses)"
        ],
        "sour cream": [
            "Equal amount of Greek yogurt",
            "Equal amount of cottage cheese blended smooth",
            "1 cup milk + 1 tbsp lemon juice or vinegar"
        ],
        "onion": [
            "Equal amount of shallots",
            "1 tbsp onion powder per medium onion",
            "Equal amount of leeks (white and light green parts)"
        ],
        "garlic": [
            "1/8 tsp garlic powder per clove",
            "1/2 tsp garlic flakes per clove",
            "Equal amount of shallots (milder flavor)"
        ]
    }
    
    ingredient_clean = ingredient.lower().strip()
    
    # Find partial matches
    matches = []
    for key, subs in substitutions.items():
        if ingredient_clean in key or key in ingredient_clean:
            matches.append((key, subs))
    
    if matches:
        # Return the first (best) match with better structure
        ingredient_name, subs = matches[0]
        return {
            "ingredient": ingredient_name.title(),
            "substitutions": subs,
            "quantity": quantity if quantity else "as needed"
        }
    else:
        return {
            "error": f"No substitutions found for '{ingredient}'. Try common ingredients like butter, eggs, milk, flour, sugar, etc."
        }

def play_youtube_video(result_number: int):
    """Play a YouTube video from search results by number."""
    try:
        # This will be handled by the frontend - we just return the video info
        return {
            "video_play_request": True,
            "result_number": result_number,
            "message": f"Playing video {result_number} from search results."
        }
    except Exception as e:
        return {"error": f"Could not play video {result_number}. Error: {str(e)}"}

# TheMealDB API Configuration (Free - No API Key Required)
THEMEALDB_BASE_URL = "https://www.themealdb.com/api/json/v1/1"

def search_recipes(query: str, diet: str = "", cuisine: str = "", max_results: int = 6):
    """
    Search for recipes using TheMealDB API (completely free).
    """
    try:
        print(f"Searching TheMealDB for recipes: {query}")
        
        # TheMealDB search by name
        response = requests.get(f"{THEMEALDB_BASE_URL}/search.php?s={query}", timeout=10)
        response.raise_for_status()
        
        data = response.json()
        recipes = []
        
        if data.get("meals"):
            for i, meal in enumerate(data["meals"][:max_results]):
                # Extract ingredients and measurements
                ingredients = []
                for j in range(1, 21):  # TheMealDB has up to 20 ingredients
                    ingredient = meal.get(f"strIngredient{j}", "")
                    measure = meal.get(f"strMeasure{j}", "")
                    if ingredient and ingredient.strip():
                        ingredients.append({
                            "name": ingredient.strip(),
                            "amount": measure.strip() if measure else "",
                            "unit": "",
                            "original": f"{measure.strip() if measure else ''} {ingredient.strip()}".strip()
                        })
                
                # Parse cooking instructions into steps
                instructions_text = meal.get("strInstructions", "")
                instructions = []
                if instructions_text:
                    # Split by common step separators
                    steps = instructions_text.replace("\r\n", "\n").split("\n")
                    step_num = 1
                    for step in steps:
                        step = step.strip()
                        if step and len(step) > 10:  # Filter out very short lines
                            instructions.append({
                                "number": step_num,
                                "step": step
                            })
                            step_num += 1
                
                recipe_data = {
                    "id": meal.get("idMeal"),
                    "title": meal.get("strMeal", "Unknown Recipe"),
                    "image": meal.get("strMealThumb", ""),
                    "readyInMinutes": 30,  # Default cooking time (TheMealDB doesn't provide this)
                    "servings": 4,  # Default servings (TheMealDB doesn't provide this)
                    "sourceUrl": meal.get("strSource", ""),
                    "summary": f"Delicious {meal.get('strArea', '')} {meal.get('strCategory', '')} recipe".strip(),
                    "dishTypes": [meal.get("strCategory", "").lower()] if meal.get("strCategory") else [],
                    "diets": [],  # TheMealDB doesn't provide diet info directly
                    "cuisines": [meal.get("strArea", "").lower()] if meal.get("strArea") else [],
                    "nutrition": {
                        "calories": {"amount": 350, "unit": "kcal"},  # Estimated values
                        "protein": {"amount": 25, "unit": "g"},
                        "carbs": {"amount": 30, "unit": "g"}
                    },
                    "ingredients": ingredients,
                    "instructions": instructions,
                    "category": meal.get("strCategory", ""),
                    "area": meal.get("strArea", ""),
                    "youtube": meal.get("strYoutube", "")
                }
                
                # Filter by cuisine if specified
                if cuisine and cuisine.lower() not in meal.get("strArea", "").lower():
                    continue
                    
                recipes.append(recipe_data)
        
        print(f"Found {len(recipes)} recipes")
        return {
            "success": True,
            "recipes": recipes,
            "query": query,
            "total_results": len(recipes)
        }
        
    except requests.exceptions.RequestException as e:
        print(f"TheMealDB API error: {e}")
        return {"success": False, "error": f"Failed to search recipes: {str(e)}", "message": "Unable to connect to recipe database. Please try again later."}
    except Exception as e:
        print(f"Unexpected error: {e}")
        return {"success": False, "error": f"Recipe search failed: {str(e)}", "message": "Something went wrong while searching for recipes."}

def get_recipe_details(recipe_id: str):
    """
    Get detailed recipe information including instructions from TheMealDB.
    """
    try:
        print(f"Getting recipe details for ID: {recipe_id}")
        
        response = requests.get(f"{THEMEALDB_BASE_URL}/lookup.php?i={recipe_id}", timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if not data.get("meals") or not data["meals"][0]:
            return {"success": False, "error": "Recipe not found", "message": "Sorry, I couldn't find that recipe."}
        
        meal = data["meals"][0]
        
        # Extract ingredients and measurements
        ingredients = []
        for j in range(1, 21):  # TheMealDB has up to 20 ingredients
            ingredient = meal.get(f"strIngredient{j}", "")
            measure = meal.get(f"strMeasure{j}", "")
            if ingredient and ingredient.strip():
                ingredients.append({
                    "name": ingredient.strip(),
                    "amount": measure.strip() if measure else "",
                    "unit": "",
                    "original": f"{measure.strip() if measure else ''} {ingredient.strip()}".strip()
                })
        
        # Parse cooking instructions into steps
        instructions_text = meal.get("strInstructions", "")
        instructions = []
        if instructions_text:
            steps = instructions_text.replace("\r\n", "\n").split("\n")
            step_num = 1
            for step in steps:
                step = step.strip()
                if step and len(step) > 10:
                    instructions.append({
                        "number": step_num,
                        "step": step
                    })
                    step_num += 1
        
        return {
            "success": True,
            "recipe": {
                "id": meal.get("idMeal"),
                "title": meal.get("strMeal", ""),
                "image": meal.get("strMealThumb", ""),
                "readyInMinutes": 30,  # Default
                "servings": 4,  # Default
                "instructions": instructions,
                "ingredients": ingredients,
                "sourceUrl": meal.get("strSource", ""),
                "youtube": meal.get("strYoutube", ""),
                "category": meal.get("strCategory", ""),
                "area": meal.get("strArea", ""),
                "summary": f"Delicious {meal.get('strArea', '')} {meal.get('strCategory', '')} recipe".strip()
            }
        }
        
    except Exception as e:
        print(f"Error getting recipe details: {e}")
        return {"success": False, "error": f"Failed to get recipe details: {str(e)}", "message": "Sorry, I had trouble getting the recipe details."}

def recipe_by_ingredients(ingredients: str, max_results: int = 6):
    """
    Find recipes based on available ingredients using TheMealDB.
    Note: TheMealDB doesn't have direct ingredient search, so we search by each ingredient.
    """
    try:
        print(f"Finding recipes with ingredients: {ingredients}")
        
        # Split ingredients and search for each one
        ingredient_list = [ing.strip() for ing in ingredients.split(',')]
        all_recipes = []
        recipes_by_id = {}
        
        for ingredient in ingredient_list:
            if not ingredient:
                continue
                
            print(f"Searching for recipes with {ingredient}")
            response = requests.get(f"{THEMEALDB_BASE_URL}/filter.php?i={ingredient}", timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data.get("meals"):
                for meal in data["meals"]:
                    meal_id = meal.get("idMeal")
                    if meal_id not in recipes_by_id:
                        recipes_by_id[meal_id] = {
                            "id": meal_id,
                            "title": meal.get("strMeal", ""),
                            "image": meal.get("strMealThumb", ""),
                            "usedIngredients": [],
                            "missedIngredients": [],
                            "usedIngredientCount": 0,
                            "matchedIngredients": set()
                        }
                    
                    # Add this ingredient as used
                    if ingredient not in recipes_by_id[meal_id]["matchedIngredients"]:
                        recipes_by_id[meal_id]["usedIngredients"].append(ingredient)
                        recipes_by_id[meal_id]["matchedIngredients"].add(ingredient)
                        recipes_by_id[meal_id]["usedIngredientCount"] += 1
        
        # Convert to list and sort by most matched ingredients
        recipes = list(recipes_by_id.values())
        recipes.sort(key=lambda x: x["usedIngredientCount"], reverse=True)
        
        # Add missing ingredients info
        for recipe in recipes[:max_results]:
            recipe["missedIngredients"] = [ing for ing in ingredient_list if ing not in recipe["matchedIngredients"]]
            recipe["missedIngredientCount"] = len(recipe["missedIngredients"])
            # Clean up internal tracking
            del recipe["matchedIngredients"]
        
        final_recipes = recipes[:max_results]
        print(f"Found {len(final_recipes)} recipes using your ingredients")
        
        return {
            "success": True,
            "recipes": final_recipes,
            "ingredients_searched": ingredients,
            "total_results": len(final_recipes)
        }
        
    except Exception as e:
        print(f"Error finding recipes by ingredients: {e}")
        return {"success": False, "error": f"Failed to find recipes: {str(e)}", "message": "Sorry, I had trouble finding recipes with those ingredients."}