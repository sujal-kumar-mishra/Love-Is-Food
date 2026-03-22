"""
Authentication Routes
Handles user login, registration, and session management
"""
from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from app.models.user_model import User
from app.models.database import db
import secrets
import re
from datetime import datetime, timedelta


auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/welcome')
def welcome():
    """Render welcome page - entry point for unauthenticated users"""
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    return render_template('auth/welcome.html')


def validate_password(password):
    """
    Validate password meets security requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"
    
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', password):
        return False, "Password must contain at least one special character (!@#$%^&* etc.)"
    
    return True, "Password is valid"


@auth_bp.route('/login', methods=['GET'])
def login_page():
    """Render login page - direct access from welcome page"""
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    return render_template('auth/login.html')


@auth_bp.route('/register', methods=['GET'])
def register_page():
    """Render registration page - direct access from welcome page"""
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    return render_template('auth/register.html')


@auth_bp.route('/login', methods=['POST'])
def login():
    """Handle login POST request"""
    try:
        data = request.get_json() if request.is_json else request.form
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        remember = data.get('remember', False)
        
        if not email or not password:
            return jsonify({
                'success': False,
                'message': 'Email and password are required'
            }), 400
        
        # Get user from database
        user = User.get_by_email(email)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401
        
        # Check password
        if not user.check_password(password):
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401
        
        # Check if user is active
        if not user.is_active:
            return jsonify({
                'success': False,
                'message': 'Account is inactive. Please contact support.'
            }), 403
        
        # Log user in
        login_user(user, remember=remember)
        user.update_last_login()
        
        print(f"✅ User logged in: {user.username}")
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': user.to_dict(),
            'redirect': url_for('main.index')
        }), 200
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred during login'
        }), 500


@auth_bp.route('/register', methods=['POST'])
def register():
    """Handle registration POST request"""
    try:
        data = request.get_json() if request.is_json else request.form
        
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        full_name = data.get('full_name', '').strip()
        
        # Validation
        if not username or not email or not password:
            return jsonify({
                'success': False,
                'message': 'Username, email, and password are required'
            }), 400
        
        # Validate password strength
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
        # Check if user already exists
        if User.get_by_email(email):
            return jsonify({
                'success': False,
                'message': 'Email already registered'
            }), 409
        
        if User.get_by_username(username):
            return jsonify({
                'success': False,
                'message': 'Username already taken'
            }), 409
        
        # Create user
        user = User.create(username, email, password, full_name)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'Failed to create account. Please try again.'
            }), 500
        
        # Auto-login after registration
        login_user(user)
        user.update_last_login()
        
        print(f"✅ New user registered: {user.username}")
        
        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'user': user.to_dict(),
            'redirect': url_for('main.index')
        }), 201
        
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred during registration'
        }), 500


@auth_bp.route('/logout', methods=['GET', 'POST'])
@login_required
def logout():
    """Handle logout"""
    try:
        username = current_user.username
        logout_user()
        print(f"✅ User logged out: {username}")
        
        if request.is_json:
            return jsonify({
                'success': True,
                'message': 'Logout successful',
                'redirect': url_for('auth.login_page')
            }), 200
        else:
            flash('You have been logged out successfully.', 'success')
            return redirect(url_for('auth.login_page'))
            
    except Exception as e:
        print(f"❌ Logout error: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred during logout'
        }), 500


@auth_bp.route('/profile')
@login_required
def profile():
    """User profile page with enhanced gamification features"""
    stats = current_user.get_statistics()
    return render_template('profile.html', user=current_user, stats=stats)


@auth_bp.route('/api/user/preferences', methods=['GET', 'POST'])
@login_required
def user_preferences():
    """Get or update user preferences"""
    try:
        if request.method == 'GET':
            return jsonify({
                'success': True,
                'preferences': current_user.preferences
            }), 200
        
        elif request.method == 'POST':
            data = request.get_json()
            preferences = data.get('preferences', {})
            
            if current_user.update_preferences(preferences):
                return jsonify({
                    'success': True,
                    'message': 'Preferences updated',
                    'preferences': preferences
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'message': 'Failed to update preferences'
                }), 500
                
    except Exception as e:
        print(f"❌ Preferences error: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred'
        }), 500


@auth_bp.route('/api/user/conversations', methods=['GET', 'DELETE'])
@login_required
def user_conversations():
    """Get or delete user's conversation history"""
    try:
        # Handle DELETE request - clear all conversations
        if request.method == 'DELETE':
            from app.models.database import db
            result = db.delete_user_conversations(current_user.id)
            
            return jsonify({
                'success': True,
                'message': 'All conversations deleted successfully',
                'deleted_count': result
            }), 200
        
        # Handle GET request - fetch conversations
        limit = request.args.get('limit', 50, type=int)
        conversations = current_user.get_conversations(limit)
        
        # Convert MongoDB documents to JSON-serializable format
        conversations_list = []
        for conv in conversations:
            conv['_id'] = str(conv['_id'])
            conv['timestamp'] = conv['timestamp'].isoformat()
            conversations_list.append(conv)
        
        return jsonify({
            'success': True,
            'conversations': conversations_list,
            'count': len(conversations_list)
        }), 200
        
    except Exception as e:
        print(f"❌ Conversations error: {e}")
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve conversations'
        }), 500


@auth_bp.route('/forgot-password', methods=['GET'])
def forgot_password_page():
    """Render forgot password page"""
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    return render_template('auth/forgot_password.html')


@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """Verify if email exists in database"""
    try:
        data = request.get_json() if request.is_json else request.form
        email = data.get('email', '').strip()
        
        if not email:
            return jsonify({
                'success': False,
                'message': 'Email address is required'
            }), 400
        
        user = User.get_by_email(email)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'No account found with this email address'
            }), 404
        
        return jsonify({
            'success': True,
            'message': 'Email verified. Please enter your new password.'
        }), 200
        
    except Exception as e:
        print(f"❌ Email verification error: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred. Please try again.'
        }), 500


@auth_bp.route('/reset-password-direct', methods=['POST'])
def reset_password_direct():
    """Reset password directly after email verification"""
    try:
        data = request.get_json() if request.is_json else request.form
        email = data.get('email', '').strip()
        new_password = data.get('password', '')
        
        if not email or not new_password:
            return jsonify({
                'success': False,
                'message': 'Email and new password are required'
            }), 400
        
        # Validate password strength
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
        # Verify user exists
        user = User.get_by_email(email)
        if not user:
            return jsonify({
                'success': False,
                'message': 'Invalid request'
            }), 400
        
        # Update password
        from werkzeug.security import generate_password_hash
        
        db.users.update_one(
            {'email': email},
            {
                '$set': {
                    'password_hash': generate_password_hash(new_password),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        print(f"✅ Password reset successful for: {email}")
        
        return jsonify({
            'success': True,
            'message': 'Password reset successful! You can now log in with your new password.'
        }), 200
        
    except Exception as e:
        print(f"❌ Reset password error: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred. Please try again.'
        }), 500


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Handle forgot password request - generate reset token (DEPRECATED - keeping for compatibility)"""
    try:
        data = request.get_json() if request.is_json else request.form
        email = data.get('email', '').strip()
        
        if not email:
            return jsonify({
                'success': False,
                'message': 'Email address is required'
            }), 400
        
        user = User.get_by_email(email)
        
        # Always return success to prevent email enumeration
        # (don't reveal if email exists or not for security)
        if not user:
            return jsonify({
                'success': True,
                'message': 'If an account with that email exists, we\'ve sent password reset instructions.'
            }), 200
        
        # Generate secure reset token
        reset_token = secrets.token_urlsafe(32)
        token_expiry = datetime.utcnow() + timedelta(hours=1)  # Token valid for 1 hour
        
        # Store token in database
        db.users.update_one(
            {'_id': user.id},
            {
                '$set': {
                    'reset_token': reset_token,
                    'reset_token_expiry': token_expiry
                }
            }
        )
        
        # In production, send email with reset link
        # For development, log to console
        reset_url = f"{request.url_root}reset-password?token={reset_token}"
        print(f"\n{'='*60}")
        print(f"🔑 PASSWORD RESET LINK FOR {email}")
        print(f"{'='*60}")
        print(f"Reset URL: {reset_url}")
        print(f"Token expires at: {token_expiry}")
        print(f"{'='*60}\n")
        
        return jsonify({
            'success': True,
            'message': 'If an account with that email exists, we\'ve sent password reset instructions.',
            'dev_reset_url': reset_url  # Only for development
        }), 200
        
    except Exception as e:
        print(f"❌ Forgot password error: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred. Please try again.'
        }), 500


@auth_bp.route('/reset-password', methods=['GET'])
def reset_password_page():
    """Render reset password page"""
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    
    token = request.args.get('token')
    if not token:
        flash('Invalid or missing reset token', 'error')
        return redirect(url_for('auth.login_page'))
    
    return render_template('auth/reset_password.html')


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Handle password reset with token"""
    try:
        data = request.get_json() if request.is_json else request.form
        token = data.get('token', '').strip()
        new_password = data.get('password', '')
        
        if not token or not new_password:
            return jsonify({
                'success': False,
                'message': 'Token and new password are required'
            }), 400
        
        # Validate password strength
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
        # Find user with valid token
        user_doc = db.users.find_one({
            'reset_token': token,
            'reset_token_expiry': {'$gt': datetime.utcnow()}
        })
        
        if not user_doc:
            return jsonify({
                'success': False,
                'message': 'Invalid or expired reset token'
            }), 400
        
        # Update password and clear reset token
        from werkzeug.security import generate_password_hash
        
        db.users.update_one(
            {'_id': user_doc['_id']},
            {
                '$set': {
                    'password': generate_password_hash(new_password),
                    'updated_at': datetime.utcnow()
                },
                '$unset': {
                    'reset_token': '',
                    'reset_token_expiry': ''
                }
            }
        )
        
        print(f"✅ Password reset successful for: {user_doc['email']}")
        
        return jsonify({
            'success': True,
            'message': 'Password reset successful! You can now log in with your new password.'
        }), 200
        
    except Exception as e:
        print(f"❌ Reset password error: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred. Please try again.'
        }), 500
