"""
Wikipedia search service
"""
import wikipedia


def search_wikipedia(query: str):
    """Searches Wikipedia for a given query and returns a short summary."""
    try:
        summary = wikipedia.summary(query, sentences=2)
        return {"summary": summary}
    except Exception as e:
        return {"error": f"Could not find information on Wikipedia for '{query}'."}
