# Run as administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Please run this script as Administrator"
    Break
}

# Create SSL directory
$sslPath = "C:\etc\ssl\media-viewer"
New-Item -ItemType Directory -Force -Path $sslPath | Out-Null

# Get the IP address
$ipAddress = (Get-NetIPAddress | Where-Object {$_.AddressFamily -eq "IPv4" -and $_.PrefixOrigin -eq "Dhcp"}).IPAddress

# Generate self-signed certificate
Write-Host "Generating self-signed SSL certificate..."
$cert = New-SelfSignedCertificate -DnsName $ipAddress -CertStoreLocation "Cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(1)

# Export the certificate and private key
$pwd = ConvertTo-SecureString -String "media-viewer" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "$sslPath\cert.pfx" -Password $pwd

# Create environment file
$envPath = "C:\etc\media-viewer"
New-Item -ItemType Directory -Force -Path $envPath | Out-Null

$envContent = @"
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
ALLOWED_ORIGINS=https://$ipAddress`:3000,http://$ipAddress`:3000
SSL_KEY_PATH=$sslPath\cert.pfx
SSL_CERT_PATH=$sslPath\cert.pfx
SSL_CERT_PASSWORD=media-viewer
MEDIA_DIR=C:\Media
"@

$envContent | Out-File -FilePath "$envPath\.env" -Encoding UTF8

# Create media directory
New-Item -ItemType Directory -Force -Path "C:\Media" | Out-Null

Write-Host "Setup completed successfully!"
Write-Host "Your application will be available at:"
Write-Host "https://$ipAddress`:3000"
Write-Host "http://$ipAddress`:3000"
Write-Host ""
Write-Host "Note: You may need to accept the self-signed certificate in your browser"
Write-Host ""
Write-Host "Please place your media files in C:\Media" 