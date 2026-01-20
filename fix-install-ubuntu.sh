#!/bin/bash

# QMS Installation Fix Script
# This script completes the installation after the initial script fails on git clone

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
INSTALL_DIR="/opt/qms"
QMS_USER="qms"
QMS_REPO="https://github.com/DmitryPogrebniuk/qms.git"
QMS_BRANCH="main"

log_info "QMS Installation Fix Script"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    log_error "Please run as root (use sudo)"
    exit 1
fi

# Check if qms user exists
if ! id "$QMS_USER" &>/dev/null; then
    log_info "Creating user $QMS_USER..."
    useradd -r -m -s /bin/bash $QMS_USER
fi

# Fix /opt/qms permissions and clone repository
log_info "Setting up QMS directory..."
if [ -d "$INSTALL_DIR/.git" ]; then
    log_warn "Repository already exists at $INSTALL_DIR"
    log_info "Pulling latest changes..."
    cd "$INSTALL_DIR"
    sudo -u $QMS_USER git pull
else
    log_info "Creating directory $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"
    chown $QMS_USER:$QMS_USER "$INSTALL_DIR"
    
    log_info "Cloning repository from $QMS_REPO..."
    sudo -u $QMS_USER git clone -b $QMS_BRANCH $QMS_REPO "$INSTALL_DIR"
fi

# Ensure ownership
log_info "Setting correct permissions..."
chown -R $QMS_USER:$QMS_USER "$INSTALL_DIR"

# Create .env from template if it doesn't exist
if [ ! -f "$INSTALL_DIR/.env" ]; then
    log_info "Creating .env file from template..."
    sudo -u $QMS_USER cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    log_warn "IMPORTANT: You must edit $INSTALL_DIR/.env with your configuration!"
    log_warn "Especially these variables:"
    echo "  - UCCX_NODES (your UCCX servers)"
    echo "  - UCCX_USERNAME"
    echo "  - UCCX_PASSWORD"
    echo "  - POSTGRES_PASSWORD"
    echo "  - JWT_SECRET"
    echo ""
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker service:"
    echo "  sudo systemctl start docker"
    exit 1
fi

# Add qms user to docker group
if ! groups $QMS_USER | grep -q docker; then
    log_info "Adding $QMS_USER to docker group..."
    usermod -aG docker $QMS_USER
fi

log_info "Installation directory setup complete!"
echo ""
log_info "Next steps:"
echo "  1. Edit configuration:"
echo "     sudo nano $INSTALL_DIR/.env"
echo ""
echo "  2. Start QMS services:"
echo "     cd $INSTALL_DIR"
echo "     sudo docker-compose -f infra/docker-compose.yml up -d"
echo ""
echo "  3. Check service status:"
echo "     sudo docker-compose -f infra/docker-compose.yml ps"
echo ""
echo "  4. View logs:"
echo "     sudo docker-compose -f infra/docker-compose.yml logs -f api"
echo ""
echo "  5. Access QMS:"
echo "     Web UI: http://YOUR_SERVER_IP:5173"
echo "     API: http://YOUR_SERVER_IP:3000"
echo ""

# Ask if user wants to start services now
read -p "Do you want to start QMS services now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if .env is configured
    if grep -q "uccx.example.com" "$INSTALL_DIR/.env"; then
        log_warn "WARNING: .env still contains example values!"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Please configure .env first, then run:"
            echo "  cd $INSTALL_DIR"
            echo "  sudo docker-compose -f infra/docker-compose.yml up -d"
            exit 0
        fi
    fi
    
    log_info "Starting QMS services..."
    cd "$INSTALL_DIR"
    docker compose -f infra/docker-compose.yml up -d
    
    log_info "Waiting for services to start..."
    sleep 10
    
    log_info "Service status:"
    docker compose -f infra/docker-compose.yml ps
    
    echo ""
    log_info "✅ QMS is now running!"
    log_info "Access the application at:"
    echo "  Web UI: http://$(hostname -I | awk '{print $1}'):5173"
    echo "  API: http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
    log_info "Default credentials: boss / boss"
fi
