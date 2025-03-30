#!/bin/bash

# Exit on error
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Get the IP address of the Raspberry Pi
read -p "Enter the IP address of the Raspberry Pi: " PI_IP

# Test connection
echo "Testing connection to $PI_IP..."
ping -c 1 $PI_IP

# Add the server's certificate to trusted certificates
echo "Adding server certificate to trusted certificates..."
mkdir -p /usr/local/share/ca-certificates/media-viewer
openssl s_client -connect $PI_IP:3000 -showcerts </dev/null 2>/dev/null | openssl x509 -outform PEM -out /usr/local/share/ca-certificates/media-viewer/media-viewer.crt
update-ca-certificates

echo "Client setup completed successfully!"
echo "You can now access the media viewer at:"
echo "https://$PI_IP:3000"
echo ""
echo "Note: If you're using a different operating system, you'll need to manually add the certificate to your trusted certificates." 