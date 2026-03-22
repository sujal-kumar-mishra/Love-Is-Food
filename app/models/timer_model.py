"""
Timer model and management for Kitchen Assistant
"""
from datetime import datetime, timedelta
import threading
import time


class TimerManager:
    """Manages all active timers"""
    
    def __init__(self):
        self.active_timers = {}
        self.timer_counter = 0
        self.socketio = None
    
    def set_socketio(self, socketio_instance):
        """Set SocketIO instance for broadcasting timer updates"""
        self.socketio = socketio_instance
    
    def create_timer(self, duration_minutes: int, timer_name: str = ""):
        """
        Creates and starts a new timer
        
        Args:
            duration_minutes: Timer duration in minutes
            timer_name: Optional name for the timer
            
        Returns:
            dict: Timer information
        """
        self.timer_counter += 1
        timer_id = self.timer_counter
        
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
        
        self.active_timers[timer_id] = timer_info
        
        # Start background timer thread
        threading.Thread(
            target=self._timer_countdown,
            args=(timer_id, timer_name, duration_minutes),
            daemon=True
        ).start()
        
        return {
            "message": f"Timer '{timer_name}' set for {duration_minutes} minutes",
            "timer": timer_info
        }
    
    def _timer_countdown(self, timer_id, timer_name, duration_minutes):
        """Background countdown for a timer"""
        total_seconds = duration_minutes * 60
        
        while total_seconds > 0 and timer_id in self.active_timers:
            time.sleep(1)
            total_seconds -= 1
            
            # Broadcast timer update if socketio is available
            if self.socketio:
                remaining_minutes = total_seconds // 60
                remaining_seconds = total_seconds % 60
                self.socketio.emit('timer_update', {
                    'timer_id': timer_id,
                    'name': timer_name,
                    'remaining_minutes': remaining_minutes,
                    'remaining_seconds': remaining_seconds,
                    'remaining_time': f"{remaining_minutes:02d}:{remaining_seconds:02d}"
                })
        
        # Timer finished
        if timer_id in self.active_timers:
            print(f"⏰ TIMER ALERT: {timer_name} ({duration_minutes} minutes) has finished!")
            
            if self.socketio:
                # Emit timer finished event
                self.socketio.emit('timer_finished', {
                    'timer_id': timer_id,
                    'name': timer_name,
                    'message': f"Timer '{timer_name}' has finished!"
                })
                
                # Emit TTS speech for voice alert
                speech_message = f"Your {timer_name} timer has finished!"
                print(f"🔊 Sending TTS alert: {speech_message}")
                self.socketio.emit('final_text', {
                    'text': speech_message
                })
    
    def delete_timer(self, timer_identifier):
        """
        Deletes a timer by ID or name
        
        Args:
            timer_identifier: Timer ID (int) or name (str)
            
        Returns:
            dict: Result message
        """
        # Try to find timer by ID first
        if isinstance(timer_identifier, int) and timer_identifier in self.active_timers:
            timer_name = self.active_timers[timer_identifier]["name"]
            del self.active_timers[timer_identifier]
            return {"message": f"Timer '{timer_name}' deleted successfully"}
        
        # Try to find timer by name
        if isinstance(timer_identifier, str):
            for timer_id, timer_info in list(self.active_timers.items()):
                if timer_info["name"].lower() == timer_identifier.lower():
                    del self.active_timers[timer_id]
                    return {"message": f"Timer '{timer_identifier}' deleted successfully"}
        
        return {"error": f"Timer '{timer_identifier}' not found"}
    
    def list_timers(self):
        """
        Lists all active timers with remaining time
        
        Returns:
            dict: List of active timers
        """
        if not self.active_timers:
            return {"message": "No active timers"}
        
        current_time = datetime.now()
        timer_list = []
        
        for timer_id, timer_info in list(self.active_timers.items()):
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
                del self.active_timers[timer_id]
        
        return {"timers": timer_list}
    
    def get_active_timers_dict(self):
        """Returns the active timers dictionary"""
        return self.active_timers


# Global timer manager instance
timer_manager = TimerManager()
