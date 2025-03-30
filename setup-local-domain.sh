#!/bin/bash

# Exit on error
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Generate a random hostname
HOSTNAME="media-viewer-$(openssl rand -hex 4)"
DOMAIN="local"

# Install required packages
echo "Installing required packages..."
apt-get update
apt-get install -y avahi-daemon

# Configure Avahi daemon
cat > /etc/avahi/avahi-daemon.conf << EOL
[server]
use-ipv4=yes
use-ipv6=no
allow-interfaces=eth0,wlan0
ratelimit-interval-usec=1000000
ratelimit-burst=1000

[wide-area]
enable-wide-area=no

[publish]
publish-addresses=yes
publish-hinfo=no
publish-workstation=no
publish-domain=yes
publish-aaaa-on-ipv4=no
publish-a-on-ipv4=yes
EOL

# Create hostname file
echo "$HOSTNAME" > /etc/hostname

# Update hosts file
cat >> /etc/hosts << EOL
127.0.0.1       localhost
::1             localhost ip6-localhost ip6-loopback
EOL

# Restart Avahi daemon
systemctl restart avahi-daemon

# Create self-signed SSL certificate
echo "Generating self-signed SSL certificate..."
mkdir -p /etc/ssl/media-viewer
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/media-viewer/privkey.pem \
    -out /etc/ssl/media-viewer/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$HOSTNAME.$DOMAIN"

# Set proper permissions
chown -R nodejs:nodejs /etc/ssl/media-viewer
chmod 600 /etc/ssl/media-viewer/*.pem

# Create environment file
cat > /etc/media-viewer/.env << EOL
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
ALLOWED_ORIGINS=https://$HOSTNAME.$DOMAIN:3000,http://$HOSTNAME.$DOMAIN:3000
SSL_KEY_PATH=/etc/ssl/media-viewer/privkey.pem
SSL_CERT_PATH=/etc/ssl/media-viewer/fullchain.pem
EOL

echo "Local domain setup completed successfully!"
echo "Your application will be available at:"
echo "https://$HOSTNAME.$DOMAIN:3000"
echo "http://$HOSTNAME.$DOMAIN:3000"
echo ""
echo "Note: You may need to accept the self-signed certificate in your browser" 