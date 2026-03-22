"""
YouTube search service for Kitchen Assistant
"""
from youtubesearchpython import VideosSearch
from urllib.parse import quote_plus


def search_youtube(query: str):
    """
    Searches YouTube for videos with multiple fallback methods.
    Enhanced with robust error handling and alternative approaches.
    """
    try:
        # Don't automatically add "recipe" - let user's query be specific
        print(f"🔍 Searching YouTube for: {query}")
        
        # Method 1: Try the library without proxies parameter workaround
        try:
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


def play_youtube_video(result_number: int):
    """
    Indicates a request to play a specific YouTube video from search results.
    """
    return {
        "video_play_request": True,
        "result_number": result_number
    }


def get_video_details(video_id: str):
    """
    Fetch comprehensive details for a YouTube video.
    Returns video information including title, description, channel, and extracted ingredients.
    """
    try:
        from youtubesearchpython import Video
        import re
        
        print(f"🎥 Fetching details for video ID: {video_id}")
        
        # Get video details
        video_info = Video.getInfo(video_id)
        
        if not video_info:
            print("❌ No video information found")
            return {"success": False, "error": "Video not found"}
        
        # Extract relevant information
        title = video_info.get('title', 'Unknown Title')
        description = video_info.get('description', '')
        channel_name = video_info.get('channel', {}).get('name', 'Unknown Channel')
        channel_id = video_info.get('channel', {}).get('id', '')
        thumbnails = video_info.get('thumbnails', [])
        thumbnail = thumbnails[-1].get('url', '') if thumbnails else ''
        duration = video_info.get('duration', {}).get('label', 'Unknown')
        view_count = video_info.get('viewCount', {}).get('text', '0 views')
        publish_date = video_info.get('publishDate', 'Unknown')
        
        # Extract ingredients from description
        ingredients = _extract_ingredients_from_description(description)
        
        # Extract recipe steps from description
        steps = _extract_steps_from_description(description)
        
        # Create summary (first 300 characters of description)
        summary = description[:300] + "..." if len(description) > 300 else description
        
        # Get related videos
        related_videos = _get_related_videos(title)
        
        video_data = {
            "success": True,
            "video": {
                "video_id": video_id,
                "title": title,
                "description": description,
                "summary": summary,
                "channel_name": channel_name,
                "channel_id": channel_id,
                "thumbnail": thumbnail,
                "duration": duration,
                "view_count": view_count,
                "publish_date": publish_date,
                "ingredients": ingredients,
                "steps": steps,
                "related_videos": related_videos,
                "embed_url": f"https://www.youtube.com/embed/{video_id}",
                "watch_url": f"https://www.youtube.com/watch?v={video_id}"
            }
        }
        
        print(f"✅ Successfully fetched details for: {title}")
        return video_data
        
    except Exception as e:
        print(f"❌ Error fetching video details: {e}")
        import traceback
        traceback.print_exc()
        
        # Return fallback data
        return {
            "success": True,
            "video": {
                "video_id": video_id,
                "title": "YouTube Video",
                "description": "Watch this video on YouTube to see the full recipe and instructions.",
                "summary": "Video details are currently unavailable. Please watch on YouTube for the full content.",
                "channel_name": "YouTube Creator",
                "channel_id": "",
                "thumbnail": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/YouTube_Logo_2017.svg/1280px-YouTube_Logo_2017.svg.png",
                "duration": "N/A",
                "view_count": "N/A",
                "publish_date": "N/A",
                "ingredients": [],
                "steps": [],
                "related_videos": [],
                "embed_url": f"https://www.youtube.com/embed/{video_id}",
                "watch_url": f"https://www.youtube.com/watch?v={video_id}"
            }
        }


def _extract_ingredients_from_description(description: str):
    """Extract ingredients list from video description"""
    import re
    
    ingredients = []
    
    # Look for ingredients section
    ingredients_section = re.search(
        r'(?:ingredients?|what you(?:\'ll|\s+will)\s+need)[:\s]*\n(.*?)(?:\n\n|instructions?|directions?|method|steps?|preparation|$)',
        description,
        re.IGNORECASE | re.DOTALL
    )
    
    if ingredients_section:
        lines = ingredients_section.group(1).strip().split('\n')
        for line in lines:
            line = line.strip()
            # Skip empty lines and section headers
            if not line or len(line) < 3:
                continue
            # Remove common list markers
            line = re.sub(r'^[-•*●▪▫○►▻→⇒✓✔✗✘]\s*', '', line)
            line = re.sub(r'^\d+[\.)]\s*', '', line)
            if line:
                ingredients.append(line)
    
    # If no ingredients found, look for lines with measurements
    if not ingredients:
        measurement_pattern = r'\d+\s*(?:cup|tbsp|tsp|oz|lb|kg|g|ml|liter|piece|clove|pinch)'
        lines = description.split('\n')
        for line in lines:
            if re.search(measurement_pattern, line, re.IGNORECASE):
                line = line.strip()
                line = re.sub(r'^[-•*●▪▫○►▻→⇒✓✔✗✘]\s*', '', line)
                line = re.sub(r'^\d+[\.)]\s*', '', line)
                if line and len(line) > 5:
                    ingredients.append(line)
    
    return ingredients[:15]  # Limit to 15 ingredients


def _extract_steps_from_description(description: str):
    """Extract recipe steps from video description"""
    import re
    
    steps = []
    
    # Look for instructions/steps section
    steps_section = re.search(
        r'(?:instructions?|directions?|method|steps?|preparation|how to)[:\s]*\n(.*?)(?:\n\n|ingredients?|notes?|tips?|$)',
        description,
        re.IGNORECASE | re.DOTALL
    )
    
    if steps_section:
        lines = steps_section.group(1).strip().split('\n')
        step_num = 1
        for line in lines:
            line = line.strip()
            if not line or len(line) < 10:
                continue
            # Remove list markers
            line = re.sub(r'^[-•*●▪▫○►▻→⇒✓✔✗✘]\s*', '', line)
            line = re.sub(r'^\d+[\.)]\s*', '', line)
            if line:
                steps.append({
                    "step_number": step_num,
                    "instruction": line
                })
                step_num += 1
    
    return steps[:12]  # Limit to 12 steps


def _get_related_videos(query: str):
    """Get related videos based on the current video title"""
    try:
        # Search for related videos
        result = search_youtube(query)
        if result and 'videos' in result and not result.get('fallback'):
            return result['videos'][:4]  # Return top 4 related videos
    except:
        pass
    
    return []
