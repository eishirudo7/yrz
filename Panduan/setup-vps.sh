#!/bin/bash
# Script Setup Awal VPS Ubuntu untuk Project Next.js (OmniYrz)
# Cara pakai di VPS kamu: 
#   nano setup.sh
#   (Paste semua isi file ini, lalu Save dengan menekan Ctrl+X, Y, Enter)
#   chmod +x setup.sh
#   ./setup.sh

set -e

echo "=========================================="
echo "🚀 Memulai Setup Awal VPS untuk OmniYrz..."
echo "=========================================="

echo "Memperbarui sistem Ubuntu..."
sudo apt update && sudo apt upgrade -y

echo "Menginstall Curl, Git, UFW, dan Nginx..."
sudo apt install -y curl git nginx ufw

echo "Menginstall Node.js (Versi 20 LTS)..."
if ! command -v node &> /dev/null
then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js sudah terinstall: $(node -v)"
fi

echo "Menginstall PM2 secara global..."
sudo npm install -g pm2

echo "Mengatur Firewall (UFW) - Membuka port SSH, Nginx, dan 10000"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 10000
echo "y" | sudo ufw enable

echo "=========================================="
echo "✅ SETUP AWAL VPS SELESAI"
echo "=========================================="
echo "Langkah selanjutnya, copy project kamu ke VPS (dari branch upgrade/nextjs-16):"
echo "  git clone -b upgrade/nextjs-16 https://github.com/eishirudo7/yrz.git omniyrz"
echo "  cd omniyrz"
echo "lalu buat file '.env.local', jalankan 'npm install', 'npm run build', dan 'pm2 start npm --name \"omniyrz\" -- run start'."
