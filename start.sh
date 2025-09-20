#!/bin/bash
# Render startup script for Kitchen Assistant

# Set production environment
export FLASK_ENV=production
export FLASK_DEBUG=false

# Create necessary directories
mkdir -p data/timers

# Start the application with Gunicorn using threading worker
exec gunicorn --worker-class gthread --workers 1 --threads 4 --bind 0.0.0.0:$PORT app:app --timeout 120 --keep-alive 5 --max-requests 1000 --preload --access-logfile - --error-logfile -