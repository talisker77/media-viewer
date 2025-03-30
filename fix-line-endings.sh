#!/bin/bash

# Exit on error
set -e

# Check if dos2unix is installed
if ! command -v dos2unix &> /dev/null; then
    echo "Installing dos2unix..."
    sudo apt-get update
    sudo apt-get install -y dos2unix
fi

# Fix line endings for all shell scripts
echo "Fixing line endings for shell scripts..."
find . -type f -name "*.sh" -exec dos2unix {} \;

echo "Line endings fixed successfully!" 