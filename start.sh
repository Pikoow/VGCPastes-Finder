#!/bin/bash

# Exit immediately if any command fails
set -e

pip install gdown

# Download model files from Google Drive
echo "Downloading model files..."
gdown https://drive.google.com/drive/folders/$NLP_MODEL_FILE_ID -O models/ --folder

# Run the Flask app
echo "Starting the application..."
gunicorn app.app:app --bind 0.0.0.0:${PORT:-5000} --workers 4