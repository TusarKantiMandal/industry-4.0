#!/bin/bash

echo "Initializing Industry 4.0 Server..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Seed database
echo "Seeding database..."
node seed.js

echo "Initialization complete! You can now run 'npm start' to start the server."
