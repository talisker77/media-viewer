#!/bin/bash

# Exit on error
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Get domain name from user
read -p "Enter your domain name (e.g., example.com): " DOMAIN

# Get email for Let's Encrypt notifications
read -p "Enter your email address: " EMAIL

# Stop the Node.js application if it's running
if systemctl is-active --quiet media-viewer; then
    echo "Stopping media-viewer service..."
    systemctl stop media-viewer
fi

# Obtain SSL certificate
echo "Obtaining SSL certificate for $DOMAIN..."
certbot certonly --standalone -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

# Create SSL directory if it doesn't exist
mkdir -p /etc/ssl/media-viewer

# Copy certificates to application directory
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/ssl/media-viewer/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/ssl/media-viewer/

# Set proper permissions
chown -R nodejs:nodejs /etc/ssl/media-viewer
chmod 600 /etc/ssl/media-viewer/*.pem

# Create systemd service file for automatic renewal
cat > /etc/systemd/system/certbot-renew.timer << EOL
[Unit]
Description=Certbot renewal timer

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOL

# Create renewal service
cat > /etc/systemd/system/certbot-renew.service << EOL
[Unit]
Description=Certbot renewal service

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --agree-tos --email $EMAIL
ExecStartPost=/bin/systemctl reload nginx
EOL

# Enable and start the timer
systemctl enable certbot-renew.timer
systemctl start certbot-renew.timer

echo "SSL setup completed successfully!"
echo "Please update your application's configuration to use HTTPS" 