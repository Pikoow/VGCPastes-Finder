#!/bin/bash

# Exit immediately if any command fails
set -e

# Run the Flask app
echo "Starting the application..."
gunicorn app.app:app --bind 0.0.0.0:${PORT:-5000} --workers 4