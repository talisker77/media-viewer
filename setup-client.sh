#!/bin/bash

# Exit on error
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Install required packages
echo "Installing required packages..."
apt-get update
apt-get install -y avahi-utils

# Get the hostname of the media viewer server
read -p "Enter the hostname of the media viewer server (e.g., media-viewer-1234.local): " SERVER_HOSTNAME

# Test connection
echo "Testing connection to $SERVER_HOSTNAME..."
ping -c 1 $SERVER_HOSTNAME

# Add the server's certificate to trusted certificates
echo "Adding server certificate to trusted certificates..."
mkdir -p /usr/local/share/ca-certificates/media-viewer
openssl s_client -connect $SERVER_HOSTNAME:3000 -showcerts </dev/null 2>/dev/null | openssl x509 -outform PEM -out /usr/local/share/ca-certificates/media-viewer/media-viewer.crt
update-ca-certificates

echo "Client setup completed successfully!"
echo "You can now access the media viewer at:"
echo "https://$SERVER_HOSTNAME:3000"
echo ""
echo "Note: If you're using a different operating system, you'll need to manually add the certificate to your trusted certificates." 