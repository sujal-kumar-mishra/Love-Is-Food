#!/bin/bash
# Render startup script for Kitchen Assistant

# Set production environment
export FLASK_ENV=production
export FLASK_DEBUG=false

# Start the application with Gunicorn
exec gunicorn --worker-class gevent -w 1 --bind 0.0.0.0:$PORT app:app --timeout 120 --keep-alive 5 --max-requests 1000 --preload