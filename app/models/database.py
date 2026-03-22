"""
MongoDB Database Configuration
Handles all database operations for user management and conversation storage
"""
from pymongo import MongoClient
from datetime import datetime, timezone
import os
from bson.objectid import ObjectId


class Database:
    """MongoDB Database Handler"""
    
    def __init__(self):
        """Initialize MongoDB connection"""
        # Get MongoDB URI from environment or use local default
        mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
         
        try:
            self.client = MongoClient(mongo_uri)
            self.db = self.client['kitchen_assistant']
            
            # Collections
            self.users = self.db['users']
            self.conversations = self.db['conversations']
            self.sessions = self.db['sessions']
            
            # Create indexes for better performance
            self._create_indexes()
            
            print("✅ MongoDB connected successfully")
        except Exception as e:
            print(f"❌ MongoDB connection error: {e}")
            self.client = None
            self.db = None
    
    
    def _create_indexes(self):
        """Create database indexes for optimization"""
        try:
            # User indexes
            self.users.create_index('email', unique=True)
            self.users.create_index('username', unique=True)
            
            # Conversation indexes
            self.conversations.create_index('user_id')
            self.conversations.create_index('created_at')
            
            # Session indexes
            self.sessions.create_index('session_id', unique=True)
            self.sessions.create_index('user_id')
            self.sessions.create_index('created_at')
            
            print("✅ Database indexes created")
        except Exception as e:
            print(f"⚠️ Index creation warning: {e}")
    
    
    # ===== USER MANAGEMENT =====
    
    def create_user(self, username: str, email: str, password_hash: str, full_name: str = ""):
        """Create a new user"""
        try:
            user_data = {
                'username': username.lower(),
                'email': email.lower(),
                'password_hash': password_hash,
                'full_name': full_name,
                'created_at': datetime.now(timezone.utc),
                'last_login': None,
                'is_active': True,
                'preferences': {
                    'theme': 'dark',
                    'voice_enabled': True,
                    'notifications': True
                }
            }
            
            result = self.users.insert_one(user_data)
            print(f"✅ User created: {username}")
            return str(result.inserted_id)
        except Exception as e:
            print(f"❌ Error creating user: {e}")
            return None
    
    
    def get_user_by_email(self, email: str):
        """Get user by email"""
        try:
            user = self.users.find_one({'email': email.lower()})
            return user
        except Exception as e:
            print(f"❌ Error finding user by email: {e}")
            return None
    
    
    def get_user_by_username(self, username: str):
        """Get user by username"""
        try:
            user = self.users.find_one({'username': username.lower()})
            return user
        except Exception as e:
            print(f"❌ Error finding user by username: {e}")
            return None
    
    
    def get_user_by_id(self, user_id: str):
        """Get user by ID"""
        try:
            user = self.users.find_one({'_id': ObjectId(user_id)})
            return user
        except Exception as e:
            print(f"❌ Error finding user by ID: {e}")
            return None
    
    
    def update_last_login(self, user_id: str):
        """Update user's last login timestamp"""
        try:
            self.users.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {'last_login': datetime.now(timezone.utc)}}
            )
            return True
        except Exception as e:
            print(f"❌ Error updating last login: {e}")
            return False
    
    
    def update_user_preferences(self, user_id: str, preferences: dict):
        """Update user preferences"""
        try:
            self.users.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {'preferences': preferences}}
            )
            return True
        except Exception as e:
            print(f"❌ Error updating preferences: {e}")
            return False
    
    
    # ===== CONVERSATION MANAGEMENT =====
    
    def save_conversation(self, user_id: str, session_id: str, message: dict):
        """Save a single conversation message"""
        try:
            conversation_data = {
                'user_id': user_id,
                'session_id': session_id,
                'role': message.get('role'),
                'content': message.get('content'),
                'timestamp': datetime.now(timezone.utc),
                'metadata': message.get('metadata', {})
            }
            
            result = self.conversations.insert_one(conversation_data)
            return str(result.inserted_id)
        except Exception as e:
            print(f"❌ Error saving conversation: {e}")
            return None
    
    
    def get_user_conversations(self, user_id: str, limit: int = 50):
        """Get user's conversation history"""
        try:
            conversations = self.conversations.find(
                {'user_id': user_id}
            ).sort('timestamp', -1).limit(limit)
            
            return list(conversations)
        except Exception as e:
            print(f"❌ Error getting conversations: {e}")
            return []
    
    
    def get_session_conversations(self, session_id: str):
        """Get conversations for a specific session"""
        try:
            conversations = self.conversations.find(
                {'session_id': session_id}
            ).sort('timestamp', 1)
            
            return list(conversations)
        except Exception as e:
            print(f"❌ Error getting session conversations: {e}")
            return []
    
    
    def delete_user_conversations(self, user_id: str):
        """Delete all conversations for a user"""
        try:
            result = self.conversations.delete_many({'user_id': user_id})
            deleted_count = result.deleted_count
            print(f"✅ Deleted {deleted_count} conversations for user {user_id}")
            return deleted_count
        except Exception as e:
            print(f"❌ Error deleting conversations: {e}")
            return 0
    
    
    # ===== SESSION MANAGEMENT =====
    
    def create_session(self, user_id: str, session_id: str):
        """Create a new session"""
        try:
            session_data = {
                'session_id': session_id,
                'user_id': user_id,
                'created_at': datetime.now(timezone.utc),
                'last_activity': datetime.now(timezone.utc),
                'is_active': True
            }
            
            result = self.sessions.insert_one(session_data)
            return str(result.inserted_id)
        except Exception as e:
            print(f"❌ Error creating session: {e}")
            return None
    
    
    def update_session_activity(self, session_id: str):
        """Update session's last activity"""
        try:
            self.sessions.update_one(
                {'session_id': session_id},
                {'$set': {'last_activity': datetime.now(timezone.utc)}}
            )
            return True
        except Exception as e:
            print(f"❌ Error updating session activity: {e}")
            return False
    
    
    def end_session(self, session_id: str):
        """End a session"""
        try:
            self.sessions.update_one(
                {'session_id': session_id},
                {'$set': {'is_active': False}}
            )
            return True
        except Exception as e:
            print(f"❌ Error ending session: {e}")
            return False
    
    
    def get_user_sessions(self, user_id: str):
        """Get all sessions for a user"""
        try:
            sessions = self.sessions.find(
                {'user_id': user_id}
            ).sort('created_at', -1)
            
            return list(sessions)
        except Exception as e:
            print(f"❌ Error getting user sessions: {e}")
            return []


# Global database instance
db = Database()
