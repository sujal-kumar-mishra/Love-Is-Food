"""
Time-related services for Kitchen Assistant
"""
from datetime import datetime


def get_current_time():
    """Returns the current time in a human-readable format."""
    now = datetime.now()
    return {"time": now.strftime("%I:%M %p")}


def get_today_date():
    """Returns today's date in a human-readable format."""
    now = datetime.now()
    day = int(now.strftime("%d"))
    suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return {"date": now.strftime(f"%A, %B {day}{suffix}, %Y")}
