"""
Recipe services for Kitchen Assistant
Includes recipe search, substitutions, and TheMealDB integration
"""
import requests
import os
from groq import Groq
import json
import re


# TheMealDB API Configuration (Free - No API Key Required)
THEMEALDB_BASE_URL = "https://www.themealdb.com/api/json/v1/1"

# AI Recipe Cache - Store AI-generated recipes for later retrieval
ai_recipe_cache = {}


# Initialize Groq client for AI-powered recipe generation
def get_groq_client():
    """Get or create Groq client for AI recipe generation"""
    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        return Groq(api_key=api_key)
    return None


def recipe_substitution(ingredient: str, quantity: str = ""):
    """
    Provides recipe substitutions for common cooking ingredients.
    
    Args:
        ingredient: The ingredient to find substitutions for
        quantity: Optional quantity of the ingredient
        
    Returns:
        dict: Substitution suggestions
    """
    substitutions = {
        "butter": [
            "Equal amount of margarine",
            "Equal amount of coconut oil (for baking)",
            "3/4 amount of olive oil (for savory dishes)",
            "1/2 amount of Greek yogurt (for baking, reduces calories)"
        ],
        "egg": [
            "1 tbsp ground flaxseed + 3 tbsp water (let sit 5 min)",
            "1/4 cup applesauce (for sweet baked goods)",
            "1/4 cup mashed banana (adds banana flavor)",
            "1 tbsp chia seeds + 3 tbsp water (wait 10 min)"
        ],
        "eggs": [
            "1 tbsp ground flaxseed + 3 tbsp water per egg (let sit 5 min)",
            "1/4 cup applesauce per egg (for sweet baked goods)",
            "1/4 cup mashed banana per egg (adds banana flavor)",
            "1 tbsp chia seeds + 3 tbsp water per egg (wait 10 min)"
        ],
        "milk": [
            "Equal amount of almond milk (dairy-free, slightly nutty)",
            "Equal amount of soy milk (highest protein)",
            "Equal amount of coconut milk (rich and creamy)",
            "Equal amount of oat milk (creamy, great for coffee)"
        ],
        "flour": [
            "Equal amount of whole wheat flour (nuttier flavor, denser)",
            "Equal amount of almond flour (gluten-free, best for cookies)",
            "1/4 amount of coconut flour + extra liquid (very absorbent)",
            "1.3x amount of oat flour (gluten-free, use more)"
        ],
        "sugar": [
            "3/4 amount of honey (reduce liquid by 1/4 cup)",
            "3/4 amount of maple syrup (reduce liquid slightly)",
            "Equal amount of coconut sugar (lower glycemic index)",
            "1/4 tsp stevia per 1 cup sugar (very sweet, use less)"
        ],
        "cream": [
            "Equal amount of Greek yogurt (lower fat, tangy)",
            "Equal amount of coconut cream (dairy-free)",
            "Blend soaked cashews with water (rich and creamy)",
            "Equal amount of evaporated milk (lower fat)"
        ],
        "heavy cream": [
            "Equal amount of coconut cream (dairy-free)",
            "3/4 cup milk + 1/4 cup melted butter",
            "Equal amount of Greek yogurt (for sauces and dips)",
            "Equal amount of cashew cream (blend soaked cashews)"
        ],
        "sour cream": [
            "Equal amount of Greek yogurt (same tangy flavor)",
            "Equal amount of plain yogurt (slightly thinner)",
            "Equal amount of cottage cheese (blend until smooth)",
            "Equal amount of cream cheese + milk (richer flavor)"
        ],
        "buttermilk": [
            "1 cup milk + 1 tbsp vinegar (let sit 5 minutes)",
            "1 cup milk + 1 tbsp lemon juice (wait 5 minutes)",
            "Equal amount of plain yogurt (thin with milk)",
            "Equal amount of kefir (similar tang and texture)"
        ],
        "oil": [
            "Equal amount of melted butter (adds rich flavor)",
            "Equal amount of applesauce (for baking, reduces fat)",
            "Equal amount of Greek yogurt (for baking, higher protein)",
            "Equal amount of mashed avocado (healthy fats)"
        ],
        "breadcrumb": [
            "Equal amount of crushed crackers (saltine or Ritz)",
            "Equal amount of panko (lighter, crispier)",
            "Equal amount of oats (pulse in blender, gluten-free)",
            "Equal amount of crushed cornflakes (extra crispy)"
        ],
        "breadcrumbs": [
            "Equal amount of crushed crackers (saltine or Ritz)",
            "Equal amount of panko (lighter, crispier)",
            "Equal amount of oats (pulse in blender, gluten-free)",
            "Equal amount of crushed cornflakes (extra crispy)"
        ],
        "onion": [
            "Equal amount of shallots (milder, sweeter)",
            "1 tbsp onion powder per medium onion",
            "Equal amount of leeks (white and light green parts)",
            "Equal amount of green onions/scallions (milder)"
        ],
        "garlic": [
            "1/8 tsp garlic powder per clove",
            "1/2 tsp garlic flakes per clove",
            "Equal amount of shallots (milder flavor)",
            "1/4 tsp garlic salt per clove (reduce salt in recipe)"
        ],
        "yogurt": [
            "Equal amount of sour cream",
            "Equal amount of cottage cheese (blend smooth)",
            "Equal amount of silken tofu (blend smooth, vegan)",
            "Equal amount of mashed banana (for smoothies/baking)"
        ],
        "honey": [
            "Equal amount of maple syrup",
            "Equal amount of agave nectar",
            "1.25x amount of sugar + 1/4 cup liquid",
            "Equal amount of date syrup (healthier option)"
        ],
        "cheese": [
            "Nutritional yeast (for cheesy flavor, vegan)",
            "Cashew cheese (blend soaked cashews, vegan)",
            "Cottage cheese (lower fat option)",
            "Equal amount of different cheese variety"
        ],
        "chocolate": [
            "3 tbsp cocoa powder + 1 tbsp butter per oz chocolate",
            "Equal amount of carob chips (caffeine-free)",
            "Cacao nibs (intense chocolate flavor, healthier)",
            "Equal amount of different chocolate type"
        ],
        "vanilla extract": [
            "Equal amount of vanilla bean paste",
            "1 vanilla bean = 3 tsp extract",
            "Equal amount of almond extract (different flavor)",
            "Equal amount of maple extract (different flavor)"
        ],
        "baking powder": [
            "1/4 tsp baking soda + 1/2 tsp cream of tartar per 1 tsp",
            "1/4 tsp baking soda + 1/2 cup buttermilk (reduce liquid)",
            "Self-rising flour (already contains baking powder)"
        ],
        "baking soda": [
            "3x amount of baking powder (less effective)",
            "Omit if recipe has no acid ingredient"
        ]
    }
    
    ingredient_clean = ingredient.lower().strip()
    
    # Find partial matches in database
    matches = []
    for key, subs in substitutions.items():
        if ingredient_clean in key or key in ingredient_clean:
            matches.append((key, subs))
    
    if matches:
        # Return the first (best) match from database
        ingredient_name, subs = matches[0]
        return {
            "ingredient": ingredient_name.title(),
            "substitutions": subs,
            "quantity": quantity if quantity else "as needed",
            "source": "database"
        }
    else:
        # No match in database - use AI as fallback
        print(f"🤖 No database match for '{ingredient}', calling AI for substitution suggestions...")
        ai_result = generate_ai_substitutions(ingredient, quantity)
        
        if ai_result and "substitutions" in ai_result:
            return ai_result
        else:
            return {
                "error": f"No substitutions found for '{ingredient}'. Try common ingredients like butter, eggs, milk, flour, sugar, etc."
            }


def generate_ai_substitutions(ingredient: str, quantity: str = ""):
    """
    Generate ingredient substitutions using AI when not found in database.
    
    Args:
        ingredient: The ingredient to find substitutions for
        quantity: Optional quantity of the ingredient
        
    Returns:
        dict: AI-generated substitution suggestions
    """
    groq_client = get_groq_client()
    
    if not groq_client:
        print("⚠️ Groq API key not available for AI substitution generation")
        return None
    
    try:
        prompt = f"""Provide 4 practical cooking substitutions for: {ingredient}

Please respond in this EXACT JSON format (must be valid JSON):
{{
    "substitutions": [
        "Option 1 with ratio/instructions",
        "Option 2 with ratio/instructions", 
        "Option 3 with ratio/instructions",
        "Option 4 with ratio/instructions"
    ]
}}

Requirements:
1. Each substitution should include the substitute name and ratio/instructions
2. Be practical and commonly available
3. Include specific measurements when relevant (e.g., "1/4 cup per egg")
4. Consider different use cases (baking, cooking, dietary restrictions)
5. Return ONLY valid JSON, no markdown, no extra text

Example format:
- "Equal amount of almond milk (dairy-free, slightly nutty)"
- "1 tbsp ground flaxseed + 3 tbsp water per egg (let sit 5 min)"
- "3/4 amount of honey (reduce liquid by 1/4 cup)"
"""
        
        print(f"🤖 Generating AI substitutions for: {ingredient}")
        
        completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional chef and culinary expert who provides accurate ingredient substitutions. Always return valid JSON only, no markdown formatting."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,  # Lower temperature for more consistent substitutions
            max_tokens=500,
            timeout=15.0
        )
        
        response = completion.choices[0].message.content.strip()
        print(f"🤖 AI substitution response: {response[:200]}...")
        
        # Clean up response - remove markdown code blocks if present
        if response.startswith('```'):
            response = response.split('```')[1]
            if response.startswith('json'):
                response = response[4:]
            response = response.strip()
        
        # Parse JSON response
        try:
            ai_data = json.loads(response)
            
            if "substitutions" in ai_data and isinstance(ai_data["substitutions"], list):
                return {
                    "ingredient": ingredient.title(),
                    "substitutions": ai_data["substitutions"],
                    "quantity": quantity if quantity else "as needed",
                    "source": "ai"
                }
            else:
                print(f"⚠️ AI response missing 'substitutions' field")
                return None
                
        except json.JSONDecodeError as e:
            print(f"⚠️ Failed to parse AI substitution response as JSON: {e}")
            print(f"Raw response: {response}")
            return None
            
    except Exception as e:
        print(f"🔥 Error generating AI substitutions: {e}")
        return None


def generate_ai_recipe(query: str, diet: str = "", cuisine: str = ""):
    """
    Generate a recipe using AI when MealDB has no results.
    Returns recipe in the same format as TheMealDB API.
    
    Args:
        query: Recipe search query
        diet: Optional diet filter
        cuisine: Optional cuisine filter
        
    Returns:
        dict: AI-generated recipe in MealDB format
    """
    groq_client = get_groq_client()
    
    if not groq_client:
        print("⚠️ Groq API key not available for AI recipe generation")
        return None
    
    try:
        # Build the prompt for AI
        prompt = f"""Generate a detailed recipe for: {query}"""
        
        if diet:
            prompt += f"\nDiet requirement: {diet}"
        if cuisine:
            prompt += f"\nCuisine style: {cuisine}"
            
        prompt += """

Please provide the recipe in the following JSON format (this is critical - must be valid JSON):
{
    "strMeal": "Recipe Name",
    "strCategory": "Main Course/Dessert/Appetizer/etc",
    "strArea": "Italian/Indian/American/etc",
    "strInstructions": "Step 1: Do this.\\nStep 2: Do that.\\nStep 3: Continue...",
    "strMealThumb": "https://via.placeholder.com/300x300.png?text=Recipe+Image",
    "strYoutube": "",
    "strIngredient1": "ingredient name",
    "strMeasure1": "1 cup",
    "strIngredient2": "ingredient name",
    "strMeasure2": "2 tablespoons",
    ... (continue for all ingredients, up to 20)
}

IMPORTANT:
1. Return ONLY valid JSON, no markdown, no extra text
2. Include detailed cooking instructions with clear steps
3. List all ingredients with accurate measurements
4. Make it a realistic, cookable recipe
5. Use proper recipe categories (Main Course, Dessert, Side Dish, Appetizer, Breakfast, etc.)
6. For strArea, use common cuisines (Italian, Chinese, Indian, American, Mexican, Thai, French, etc.)
"""
        
        print(f"🤖 Generating AI recipe for: {query}")
        
        completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert chef who creates detailed, accurate recipes in TheMealDB JSON format. Always return valid JSON only, no markdown formatting."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,  # More creative for recipe generation
            max_tokens=2000,  # More tokens for detailed recipes
            timeout=30.0
        )
        
        ai_response = completion.choices[0].message.content.strip()
        
        # Remove markdown code blocks if present
        ai_response = re.sub(r'```json\s*', '', ai_response)
        ai_response = re.sub(r'```\s*', '', ai_response)
        ai_response = ai_response.strip()
        
        # Parse JSON response
        try:
            recipe_data = json.loads(ai_response)
            print(f"✅ AI recipe generated successfully: {recipe_data.get('strMeal', 'Unknown')}")
            return recipe_data
        except json.JSONDecodeError as je:
            print(f"❌ Failed to parse AI response as JSON: {je}")
            print(f"AI Response: {ai_response[:500]}")
            return None
            
    except Exception as e:
        print(f"❌ Error generating AI recipe: {e}")
        return None


def search_recipes(query: str, diet: str = "", cuisine: str = "", max_results: int = 6):
    """
    Search for recipes using TheMealDB API (completely free).
    
    Args:
        query: Recipe search query
        diet: Optional diet filter
        cuisine: Optional cuisine filter
        max_results: Maximum number of results
        
    Returns:
        dict: Recipe search results
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
                
                recipe_data = {
                    "id": meal.get("idMeal"),
                    "title": meal.get("strMeal", "Unknown Recipe"),
                    "image": meal.get("strMealThumb", ""),
                    "readyInMinutes": 30,
                    "servings": 4,
                    "sourceUrl": meal.get("strSource", ""),
                    "summary": f"Delicious {meal.get('strArea', '')} {meal.get('strCategory', '')} recipe".strip(),
                    "dishTypes": [meal.get("strCategory", "").lower()] if meal.get("strCategory") else [],
                    "diets": [],
                    "cuisines": [meal.get("strArea", "").lower()] if meal.get("strArea") else [],
                    "nutrition": {
                        "calories": {"amount": 350, "unit": "kcal"},
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
        
        # If no recipes found in MealDB, try AI generation
        if not recipes:
            print(f"⚠️ No recipes found in MealDB for '{query}', trying AI generation...")
            ai_recipe = generate_ai_recipe(query, diet, cuisine)
            
            if ai_recipe:
                # Convert AI recipe to our format
                ingredients = []
                for j in range(1, 21):
                    ingredient = ai_recipe.get(f"strIngredient{j}", "")
                    measure = ai_recipe.get(f"strMeasure{j}", "")
                    if ingredient and ingredient.strip():
                        ingredients.append({
                            "name": ingredient.strip(),
                            "amount": measure.strip() if measure else "",
                            "unit": "",
                            "original": f"{measure.strip() if measure else ''} {ingredient.strip()}".strip()
                        })
                
                # Parse cooking instructions into steps
                instructions_text = ai_recipe.get("strInstructions", "")
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
                
                recipe_data = {
                    "id": f"ai_{query.replace(' ', '_')}",  # AI-generated ID
                    "title": ai_recipe.get("strMeal", query.title()),
                    "image": ai_recipe.get("strMealThumb", "https://via.placeholder.com/300x300.png?text=AI+Recipe"),
                    "readyInMinutes": 45,
                    "servings": 4,
                    "sourceUrl": "",
                    "summary": f"AI-generated {ai_recipe.get('strArea', '')} {ai_recipe.get('strCategory', '')} recipe".strip(),
                    "dishTypes": [ai_recipe.get("strCategory", "").lower()] if ai_recipe.get("strCategory") else [],
                    "diets": [diet.lower()] if diet else [],
                    "cuisines": [ai_recipe.get("strArea", "").lower()] if ai_recipe.get("strArea") else [],
                    "nutrition": {
                        "calories": {"amount": 350, "unit": "kcal"},
                        "protein": {"amount": 25, "unit": "g"},
                        "carbs": {"amount": 30, "unit": "g"}
                    },
                    "ingredients": ingredients,
                    "instructions": instructions,
                    "category": ai_recipe.get("strCategory", ""),
                    "area": ai_recipe.get("strArea", ""),
                    "youtube": ai_recipe.get("strYoutube", ""),
                    "ai_generated": True  # Flag to indicate AI-generated recipe
                }
                
                # Cache the AI recipe for later retrieval (when clicking "View Full Recipe")
                ai_recipe_cache[recipe_data["id"]] = recipe_data
                
                recipes.append(recipe_data)
                print(f"✅ AI-generated recipe added: {recipe_data['title']}")
        
        print(f"Found {len(recipes)} recipes (including AI-generated)")
        return {
            "success": True,
            "recipes": recipes,
            "query": query,
            "total_results": len(recipes)
        }
        
    except requests.exceptions.RequestException as e:
        print(f"TheMealDB API error: {e}")
        return {
            "success": False,
            "error": f"Failed to search recipes: {str(e)}",
            "message": "Unable to connect to recipe database. Please try again later."
        }
    except Exception as e:
        print(f"Unexpected error: {e}")
        return {
            "success": False,
            "error": f"Recipe search failed: {str(e)}",
            "message": "Something went wrong while searching for recipes."
        }


def enrich_recipe_with_ai(meal_data):
    """
    Enrich MealDB recipe with AI-generated detailed information for the recipe detail page.
    
    Args:
        meal_data: Raw recipe data from TheMealDB
        
    Returns:
        dict: Enhanced recipe data with AI-generated details
    """
    groq_client = get_groq_client()
    
    if not groq_client:
        print("⚠️ Groq API not available, returning basic recipe data")
        return None
    
    try:
        recipe_name = meal_data.get("strMeal", "")
        category = meal_data.get("strCategory", "")
        area = meal_data.get("strArea", "")
        
        # Extract existing ingredients for context
        ingredients_list = []
        for j in range(1, 21):
            ingredient = meal_data.get(f"strIngredient{j}", "")
            measure = meal_data.get(f"strMeasure{j}", "")
            if ingredient and ingredient.strip():
                ingredients_list.append(f"{measure} {ingredient}".strip())
        
        ingredients_text = "\n".join(ingredients_list)
        
        prompt = f"""You are a professional chef analyzing the recipe: "{recipe_name}" ({area} {category}).

Here are the ingredients from the recipe:
{ingredients_text}

Please provide detailed information for this recipe in JSON format with the following fields:

{{
    "servings": <number of servings this recipe makes (integer, e.g., 4)>,
    "prepTime": <preparation time in minutes (integer)>,
    "cookTime": <cooking time in minutes (integer)>,
    "totalTime": <total time in minutes (integer)>,
    "difficulty": "<Easy/Medium/Hard>",
    "scalingFormula": "<explanation of how to scale ingredients up or down>",
    "cookingTips": [
        "<tip 1>",
        "<tip 2>",
        "<tip 3>"
    ],
    "nutritionInfo": {{
        "calories": <calories per serving (integer)>,
        "protein": <protein in grams per serving (integer)>,
        "carbs": <carbohydrates in grams per serving (integer)>,
        "fat": <fat in grams per serving (integer)>,
        "fiber": <fiber in grams per serving (integer)>,
        "sodium": <sodium in mg per serving (integer)>
    }},
    "detailedInstructions": [
        {{
            "step": 1,
            "instruction": "<detailed step-by-step instruction>",
            "time": <estimated time for this step in minutes>,
            "tips": "<helpful tip for this step>"
        }}
    ],
    "equipmentNeeded": [
        "<equipment 1>",
        "<equipment 2>"
    ],
    "storageInstructions": "<how to store leftovers>",
    "reheatingInstructions": "<how to reheat if applicable>",
    "pairedWith": [
        "<dish or drink that pairs well>",
        "<another pairing>"
    ]
}}

IMPORTANT:
1. Return ONLY valid JSON, no markdown, no extra text
2. Be accurate and realistic with nutrition information
3. Provide practical scaling advice
4. Make instructions clear and detailed
5. Base servings on the ingredients provided
"""
        
        print(f"🤖 Enriching recipe with AI: {recipe_name}")
        
        completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert chef and nutritionist who provides detailed, accurate recipe information in JSON format. Always return valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.5,
            max_tokens=2000,
            timeout=30.0
        )
        
        ai_response = completion.choices[0].message.content.strip()
        
        # Remove markdown code blocks if present
        ai_response = re.sub(r'```json\s*', '', ai_response)
        ai_response = re.sub(r'```\s*', '', ai_response)
        ai_response = ai_response.strip()
        
        # Parse JSON response
        try:
            enriched_data = json.loads(ai_response)
            print(f"✅ Recipe enriched successfully with AI data")
            return enriched_data
        except json.JSONDecodeError as je:
            print(f"❌ Failed to parse AI enrichment response: {je}")
            print(f"AI Response: {ai_response[:500]}")
            return None
            
    except Exception as e:
        print(f"❌ Error enriching recipe with AI: {e}")
        return None


def get_recipe_details(recipe_id):
    """
    Get detailed recipe information including instructions from TheMealDB or AI cache.
    Now enhanced with AI-generated detailed information for better recipe detail page.
    
    Args:
        recipe_id: TheMealDB recipe ID (int) or AI recipe ID (str, starts with "ai_")
        
    Returns:
        dict: Detailed recipe information with AI enrichment
    """
    try:
        # Convert to string for consistent handling
        recipe_id_str = str(recipe_id)
        print(f"Getting recipe details for ID: {recipe_id_str}")
        
        # Check if this is an AI-generated recipe
        if recipe_id_str.startswith("ai_"):
            print(f"📦 Retrieving AI-generated recipe from cache: {recipe_id_str}")
            
            # Try to get from cache
            if recipe_id_str in ai_recipe_cache:
                cached_recipe = ai_recipe_cache[recipe_id_str]
                return {
                    "success": True,
                    "recipe": cached_recipe
                }
            else:
                print(f"⚠️ AI recipe not found in cache: {recipe_id_str}")
                return {
                    "success": False,
                    "error": "AI-generated recipe not found in cache",
                    "message": "This AI-generated recipe is no longer available. Please search again."
                }
        
        # Regular MealDB recipe lookup
        response = requests.get(f"{THEMEALDB_BASE_URL}/lookup.php?i={recipe_id_str}", timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if not data.get("meals") or not data["meals"][0]:
            return {
                "success": False,
                "error": "Recipe not found",
                "message": "Sorry, I couldn't find that recipe."
            }
        
        meal = data["meals"][0]
        
        # Extract ingredients and measurements
        ingredients = []
        for j in range(1, 21):
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
        
        # 🚀 NEW: Enrich recipe with AI-generated detailed information
        ai_enrichment = enrich_recipe_with_ai(meal)
        
        # Build base recipe data
        recipe_data = {
            "id": meal.get("idMeal"),
            "title": meal.get("strMeal", ""),
            "image": meal.get("strMealThumb", ""),
            "readyInMinutes": 30,  # Default fallback
            "servings": 4,  # Default fallback
            "instructions": instructions,
            "ingredients": ingredients,
            "sourceUrl": meal.get("strSource", ""),
            "youtube": meal.get("strYoutube", ""),
            "category": meal.get("strCategory", ""),
            "area": meal.get("strArea", ""),
            "summary": f"Delicious {meal.get('strArea', '')} {meal.get('strCategory', '')} recipe".strip()
        }
        
        # 🎯 Merge AI enrichment data if available
        if ai_enrichment:
            # Use AI detailed instructions if available, otherwise fall back to basic MealDB instructions
            enhanced_instructions = ai_enrichment.get("detailedInstructions", instructions)
            # If AI returned detailed instructions, use them; otherwise keep MealDB instructions
            if enhanced_instructions and len(enhanced_instructions) > 0 and isinstance(enhanced_instructions[0], dict):
                if 'instruction' in enhanced_instructions[0]:
                    # Convert AI format to template format
                    formatted_instructions = []
                    for idx, ai_step in enumerate(enhanced_instructions, 1):
                        formatted_instructions.append({
                            "number": idx,
                            "step": ai_step.get("instruction", ai_step.get("step", "")),
                            "time": ai_step.get("time"),
                            "tips": ai_step.get("tips", "")
                        })
                    recipe_data["instructions"] = formatted_instructions
                else:
                    recipe_data["instructions"] = enhanced_instructions
            
            recipe_data.update({
                "servings": ai_enrichment.get("servings", recipe_data["servings"]),
                "prepTime": ai_enrichment.get("prepTime", 15),
                "cookTime": ai_enrichment.get("cookTime", 15),
                "readyInMinutes": ai_enrichment.get("totalTime", recipe_data["readyInMinutes"]),
                "difficulty": ai_enrichment.get("difficulty", "Medium"),
                "scalingFormula": ai_enrichment.get("scalingFormula", "Multiply all ingredient quantities by the ratio of new servings to original servings."),
                "cookingTips": ai_enrichment.get("cookingTips", []),
                "nutrition": {
                    "calories": {"amount": ai_enrichment.get("nutritionInfo", {}).get("calories", 350), "unit": "kcal"},
                    "protein": {"amount": ai_enrichment.get("nutritionInfo", {}).get("protein", 25), "unit": "g"},
                    "carbs": {"amount": ai_enrichment.get("nutritionInfo", {}).get("carbs", 30), "unit": "g"},
                    "fat": {"amount": ai_enrichment.get("nutritionInfo", {}).get("fat", 15), "unit": "g"},
                    "fiber": {"amount": ai_enrichment.get("nutritionInfo", {}).get("fiber", 5), "unit": "g"},
                    "sodium": {"amount": ai_enrichment.get("nutritionInfo", {}).get("sodium", 400), "unit": "mg"}
                },
                "equipmentNeeded": ai_enrichment.get("equipmentNeeded", []),
                "storageInstructions": ai_enrichment.get("storageInstructions", ""),
                "reheatingInstructions": ai_enrichment.get("reheatingInstructions", ""),
                "pairedWith": ai_enrichment.get("pairedWith", [])
            })
            print(f"✅ Recipe enriched with AI: servings={recipe_data['servings']}, time={recipe_data['readyInMinutes']}min, instructions={len(recipe_data['instructions'])} steps")
        else:
            # Fallback nutrition data if AI enrichment failed
            recipe_data["nutrition"] = {
                "calories": {"amount": 350, "unit": "kcal"},
                "protein": {"amount": 25, "unit": "g"},
                "carbs": {"amount": 30, "unit": "g"}
            }
            print("⚠️ Using fallback recipe data (AI enrichment unavailable)")
        
        return {
            "success": True,
            "recipe": recipe_data
        }
        
    except Exception as e:
        print(f"Error getting recipe details: {e}")
        return {
            "success": False,
            "error": f"Failed to get recipe details: {str(e)}",
            "message": "Sorry, I had trouble getting the recipe details."
        }


def recipe_by_ingredients(ingredients: str, max_results: int = 6):
    """
    Find recipes based on available ingredients using TheMealDB.
    
    Args:
        ingredients: Comma-separated list of ingredients
        max_results: Maximum number of results
        
    Returns:
        dict: Recipes matching the ingredients
    """
    try:
        print(f"Finding recipes with ingredients: {ingredients}")
        
        # Split ingredients and search for each one
        ingredient_list = [ing.strip() for ing in ingredients.split(',')]
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
        return {
            "success": False,
            "error": f"Failed to find recipes: {str(e)}",
            "message": "Sorry, I had trouble finding recipes with those ingredients."
        }
