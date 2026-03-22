"""
User Model for Flask-Login
Handles user authentication and session management
"""
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app.models.database import db


class User(UserMixin):
    """User class for Flask-Login"""
    
    def __init__(self, user_data):
        """Initialize user from database document"""
        self.id = str(user_data['_id'])
        self.username = user_data.get('username')
        self.email = user_data.get('email')
        self.full_name = user_data.get('full_name', '')
        self.password_hash = user_data.get('password_hash')
        self.created_at = user_data.get('created_at')
        self.last_login = user_data.get('last_login')
        self._is_active = user_data.get('is_active', True)  # Use private attribute
        self.preferences = user_data.get('preferences', {})
    
    def get_id(self):
        """Return user ID for Flask-Login"""
        return self.id
    
    
    @property
    def is_active(self):
        """Check if user is active (required by Flask-Login)"""
        return self._is_active
    
    
    @staticmethod
    def create(username, email, password, full_name=""):
        """Create a new user"""
        password_hash = generate_password_hash(password)
        user_id = db.create_user(username, email, password_hash, full_name)
        
        if user_id:
            user_data = db.get_user_by_id(user_id)
            return User(user_data)
        return None
    
    
    @staticmethod
    def get_by_email(email):
        """Get user by email"""
        user_data = db.get_user_by_email(email)
        if user_data:
            return User(user_data)
        return None
    
    
    @staticmethod
    def get_by_username(username):
        """Get user by username"""
        user_data = db.get_user_by_username(username)
        if user_data:
            return User(user_data)
        return None
    
    
    @staticmethod
    def get_by_id(user_id):
        """Get user by ID"""
        user_data = db.get_user_by_id(user_id)
        if user_data:
            return User(user_data)
        return None
    
    
    def check_password(self, password):
        """Check if password is correct"""
        return check_password_hash(self.password_hash, password)
    
    
    def update_last_login(self):
        """Update last login timestamp"""
        return db.update_last_login(self.id)
    
    
    def update_preferences(self, preferences):
        """Update user preferences"""
        self.preferences = preferences
        return db.update_user_preferences(self.id, preferences)
    
    
    def get_conversations(self, limit=50):
        """Get user's conversation history"""
        return db.get_user_conversations(self.id, limit)
    
    
    def get_sessions(self):
        """Get user's session history"""
        return db.get_user_sessions(self.id)
    
    
    def get_statistics(self):
        """Get user statistics for profile page"""
        try:
            # Get all conversations
            conversations = db.get_user_conversations(self.id, limit=1000)
            
            # Count messages
            total_messages = len(conversations)
            user_questions = sum(1 for conv in conversations if conv.get('type') == 'user')
            ai_responses = sum(1 for conv in conversations if conv.get('type') == 'assistant')
            
            # Calculate recipes cooked (conversations about cooking)
            recipes_keywords = ['recipe', 'cook', 'prepare', 'make', 'bake']
            recipe_conversations = [conv for conv in conversations 
                                  if conv.get('type') == 'user' and 
                                  any(keyword in conv.get('content', '').lower() for keyword in recipes_keywords)]
            recipes_cooked = len(recipe_conversations)
            
            # Calculate voice commands (if tracked)
            voice_commands = sum(1 for conv in conversations if conv.get('voice_enabled', False))
            
            # Calculate perfect scores (5-star ratings or successful completions)
            perfect_scores = 0  # Can be enhanced when rating system is implemented
            
            # Calculate streak (days of consecutive usage)
            from datetime import datetime, timedelta
            dates = []
            for conv in conversations:
                timestamp = conv.get('timestamp')
                if timestamp:
                    # Handle different timestamp formats
                    if isinstance(timestamp, str):
                        try:
                            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        except:
                            continue
                    if hasattr(timestamp, 'date'):
                        dates.append(timestamp.date())
            
            dates = sorted(set(dates))
            current_streak = 0
            if dates:
                current_date = datetime.now().date()
                # Check if user was active today or yesterday (to maintain streak)
                if dates and (current_date - dates[-1]).days <= 1:
                    current_streak = 1
                    # Count consecutive days backward
                    for i in range(len(dates) - 2, -1, -1):
                        if (dates[i + 1] - dates[i]).days == 1:
                            current_streak += 1
                        else:
                            break
            
            # Calculate total cooking hours (estimated from conversation length)
            cooking_hours = len(conversations) * 0.5  # Rough estimate: 30 min per conversation
            
            # Calculate current level based on activity
            total_xp = (recipes_cooked * 50) + (voice_commands * 10) + (perfect_scores * 100)
            current_level = min(9, max(1, total_xp // 100))
            max_xp_for_level = (current_level + 1) * 100
            current_xp = total_xp % 100
            
            # Extract cuisine distribution from conversations
            cuisine_distribution = self._extract_cuisine_distribution(conversations)
            
            # Get recent activity
            recent_activity = self._get_recent_activity(conversations[:10])
            
            # Get achievements with details
            achievements = self._get_achievement_details(recipes_cooked, voice_commands, perfect_scores, current_streak)
            
            return {
                'total_messages': total_messages,
                'user_questions': user_questions,
                'ai_responses': ai_responses,
                'recipes_cooked': max(recipes_cooked, 1),  # At least 1
                'voice_commands': voice_commands,
                'perfect_scores': perfect_scores,
                'current_streak': current_streak,
                'cooking_hours': int(cooking_hours),
                'current_level': current_level,
                'current_xp': current_xp,
                'max_xp': max_xp_for_level,
                'total_xp': total_xp,
                'achievements': achievements,
                'achievements_unlocked': len([a for a in achievements if a['unlocked']]),
                'achievements_total': len(achievements),
                'member_since_days': (datetime.now() - self.created_at).days if self.created_at else 0,
                'cuisine_distribution': cuisine_distribution,
                'recent_activity': recent_activity
            }
        except Exception as e:
            print(f"❌ Error getting user statistics: {e}")
            import traceback
            traceback.print_exc()
            # Return default values
            return {
                'total_messages': 0,
                'user_questions': 0,
                'ai_responses': 0,
                'recipes_cooked': 1,
                'voice_commands': 0,
                'perfect_scores': 0,
                'current_streak': 0,
                'cooking_hours': 0,
                'current_level': 1,
                'current_xp': 0,
                'max_xp': 100,
                'total_xp': 0,
                'achievements': [],
                'achievements_unlocked': 0,
                'achievements_total': 9,
                'member_since_days': 0,
                'cuisine_distribution': {},
                'recent_activity': []
            }
    
    
    def _extract_cuisine_distribution(self, conversations):
        """Extract cuisine types from conversation content"""
        cuisines = {
            'Italian': ['italian', 'pasta', 'pizza', 'risotto', 'lasagna', 'spaghetti'],
            'Indian': ['indian', 'curry', 'biryani', 'tandoori', 'masala', 'naan'],
            'Chinese': ['chinese', 'stir fry', 'wok', 'dumpling', 'fried rice', 'chow mein'],
            'Mexican': ['mexican', 'taco', 'burrito', 'quesadilla', 'enchilada', 'salsa'],
            'Japanese': ['japanese', 'sushi', 'ramen', 'tempura', 'teriyaki', 'miso'],
            'American': ['american', 'burger', 'bbq', 'steak', 'sandwich', 'pancake'],
            'French': ['french', 'croissant', 'souffle', 'quiche', 'crepe', 'baguette'],
            'Thai': ['thai', 'pad thai', 'curry', 'tom yum', 'spring roll'],
            'Mediterranean': ['mediterranean', 'hummus', 'falafel', 'greek', 'kebab', 'pita']
        }
        
        cuisine_counts = {}
        for conv in conversations:
            content = conv.get('content', '').lower()
            for cuisine, keywords in cuisines.items():
                if any(keyword in content for keyword in keywords):
                    cuisine_counts[cuisine] = cuisine_counts.get(cuisine, 0) + 1
        
        # Return sorted by count
        return dict(sorted(cuisine_counts.items(), key=lambda x: x[1], reverse=True))
    
    
    def _get_recent_activity(self, recent_conversations):
        """Get recent activity from conversations"""
        from datetime import datetime
        activities = []
        
        for conv in recent_conversations[:5]:  # Last 5 activities
            timestamp = conv.get('timestamp')
            content = conv.get('content', '')
            conv_type = conv.get('type', 'user')
            
            # Parse timestamp
            if isinstance(timestamp, str):
                try:
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except:
                    timestamp = datetime.now()
            
            # Determine activity type
            activity_type = 'message'
            icon = 'fa-comment'
            color = 'blue'
            description = content[:50] + '...' if len(content) > 50 else content
            
            if conv.get('voice_enabled'):
                activity_type = 'voice'
                icon = 'fa-microphone'
                color = 'orange'
                description = f"Used voice commands"
            elif any(keyword in content.lower() for keyword in ['recipe', 'cook', 'prepare', 'make']):
                activity_type = 'cooking'
                icon = 'fa-utensils'
                color = 'green'
                # Try to extract recipe name
                words = content.split()
                if len(words) > 2:
                    description = f"Cooked {' '.join(words[:3])}"
                else:
                    description = "Cooked a recipe"
            
            activities.append({
                'type': activity_type,
                'icon': icon,
                'color': color,
                'description': description,
                'timestamp': timestamp,
                'time_ago': self._time_ago(timestamp)
            })
        
        return activities
    
    
    def _time_ago(self, timestamp):
        """Convert timestamp to human-readable time ago"""
        from datetime import datetime
        
        if not timestamp:
            return "Unknown"
        
        now = datetime.now()
        if timestamp.tzinfo:
            from datetime import timezone
            now = datetime.now(timezone.utc)
        
        diff = now - timestamp
        
        if diff.days > 7:
            return f"{diff.days // 7} weeks ago"
        elif diff.days > 0:
            return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        else:
            return "Just now"
    
    
    def _get_achievement_details(self, recipes, voice_commands, perfect_scores, streak):
        """Get detailed achievement information with unlock status"""
        achievements = [
            {
                'id': 'master_chef',
                'name': 'Master Chef',
                'description': '100+ recipes',
                'emoji': '🏆',
                'unlocked': recipes >= 100,
                'progress': min(100, (recipes / 100) * 100),
                'threshold': 100,
                'current': recipes
            },
            {
                'id': 'voice_pro',
                'name': 'Voice Pro',
                'description': '500 voice commands',
                'emoji': '🎤',
                'unlocked': voice_commands >= 500,
                'progress': min(100, (voice_commands / 500) * 100),
                'threshold': 500,
                'current': voice_commands
            },
            {
                'id': 'time_master',
                'name': 'Time Master',
                'description': '50 perfect timings',
                'emoji': '⏱️',
                'unlocked': perfect_scores >= 50,
                'progress': min(100, (perfect_scores / 50) * 100),
                'threshold': 50,
                'current': perfect_scores
            },
            {
                'id': 'healthy_choice',
                'name': 'Healthy Choice',
                'description': '50 healthy meals',
                'emoji': '🥗',
                'unlocked': recipes >= 50,
                'progress': min(100, (recipes / 50) * 100),
                'threshold': 50,
                'current': recipes
            },
            {
                'id': 'global_cuisine',
                'name': 'Global Cuisine',
                'description': '20 different recipes',
                'emoji': '🌍',
                'unlocked': recipes >= 20,
                'progress': min(100, (recipes / 20) * 100),
                'threshold': 20,
                'current': recipes
            },
            {
                'id': 'streak_master',
                'name': 'Streak Master',
                'description': '30-day streak',
                'emoji': '🔥',
                'unlocked': streak >= 30,
                'progress': min(100, (streak / 30) * 100),
                'threshold': 30,
                'current': streak
            },
            {
                'id': 'pro_chef',
                'name': 'Pro Chef',
                'description': 'Cook 200 recipes',
                'emoji': '👨‍🍳',
                'unlocked': recipes >= 200,
                'progress': min(100, (recipes / 200) * 100),
                'threshold': 200,
                'current': recipes
            },
            {
                'id': 'elite_master',
                'name': 'Elite Master',
                'description': 'Reach Level 10',
                'emoji': '💎',
                'unlocked': False,  # Currently max level is 9
                'progress': 0,
                'threshold': 10,
                'current': 0
            },
            {
                'id': 'perfectionist',
                'name': 'Perfectionist',
                'description': '100 perfect scores',
                'emoji': '🌟',
                'unlocked': perfect_scores >= 100,
                'progress': min(100, (perfect_scores / 100) * 100),
                'threshold': 100,
                'current': perfect_scores
            }
        ]
        
        return achievements
    
    
    def _calculate_achievements(self, recipes, voice_commands, perfect_scores, streak):
        """Calculate number of unlocked achievements"""
        unlocked = 0
        
        # Achievement criteria
        if recipes >= 100: unlocked += 1  # Master Chef
        if voice_commands >= 500: unlocked += 1  # Voice Pro
        if perfect_scores >= 50: unlocked += 1  # Time Master
        if recipes >= 50: unlocked += 1  # Healthy Choice
        if recipes >= 20: unlocked += 1  # Global Cuisine
        if streak >= 30: unlocked += 1  # Streak Master
        
        return unlocked
    
    
    def to_dict(self):
        """Convert user to dictionary (for JSON)"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'preferences': self.preferences
        }
