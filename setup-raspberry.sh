#!/bin/bash

# Exit on error
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Get the IP address
IP_ADDRESS=$(hostname -I | awk '{print $1}')

# Get the current user who will run the application
CURRENT_USER=$(logname || echo $SUDO_USER)
if [ -z "$CURRENT_USER" ]; then
    echo "Could not determine the current user"
    exit 1
fi

# Create SSL directory
mkdir -p /etc/ssl/media-viewer

# Generate self-signed certificate
echo "Generating self-signed SSL certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/media-viewer/privkey.pem \
    -out /etc/ssl/media-viewer/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$IP_ADDRESS"

# Set proper permissions
chown -R $CURRENT_USER:$CURRENT_USER /etc/ssl/media-viewer
chmod 600 /etc/ssl/media-viewer/*.pem

# Create environment file
mkdir -p /etc/media-viewer
cat > /etc/media-viewer/.env << EOL
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
ALLOWED_ORIGINS=https://$IP_ADDRESS:3000,http://$IP_ADDRESS:3000
SSL_KEY_PATH=/etc/ssl/media-viewer/privkey.pem
SSL_CERT_PATH=/etc/ssl/media-viewer/fullchain.pem
EOL

# Set permissions for the environment file
chown $CURRENT_USER:$CURRENT_USER /etc/media-viewer/.env
chmod 600 /etc/media-viewer/.env

echo "Setup completed successfully!"
echo "Your application will be available at:"
echo "https://$IP_ADDRESS:3000"
echo "http://$IP_ADDRESS:3000"
echo ""
echo "Note: You may need to accept the self-signed certificate in your browser" 