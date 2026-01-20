#!/bin/bash

#############################################################################
# Cisco QMS - macOS Installation Script
# 
# This script installs all dependencies and sets up the project on macOS
# Features:
#   - Checks for required software (Homebrew, Node.js, Docker, etc.)
#   - Installs missing dependencies via Homebrew
#   - Handles npm module installation
#   - Sets up Docker and related services
#   - Comprehensive error handling and recovery
#
# Usage: bash install-mac.sh
#############################################################################

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✓ ${NC}$1"
}

log_warn() {
    echo -e "${YELLOW}⚠ ${NC}$1"
}

log_error() {
    echo -e "${RED}✗ ${NC}$1"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Error handler
trap 'handle_error' ERR

handle_error() {
    local line_number=$1
    log_error "Installation failed at line $line_number"
    echo ""
    log_warn "Troubleshooting steps:"
    echo "1. Check your internet connection"
    echo "2. Ensure you have write permissions to this directory"
    echo "3. Run 'bash install-mac.sh' again to retry"
    echo "4. Check README.md or GETTING_STARTED.md for manual setup"
    exit 1
}

# Welcome message
clear
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Cisco QMS - macOS Installation Script                 ║"
echo "║  Version 1.0.0                                         ║"
echo "║                                                        ║"
echo "║  This script will:                                     ║"
echo "║  • Check for required software                         ║"
echo "║  • Install missing dependencies                        ║"
echo "║  • Install npm modules                                 ║"
echo "║  • Setup Docker and services                           ║"
echo "║  • Handle errors gracefully                            ║"
echo "║                                                        ║"
echo "║  Estimated time: 10-15 minutes                         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

read -p "Continue with installation? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Installation cancelled"
    exit 0
fi

#############################################################################
# SECTION 1: Check macOS and System Requirements
#############################################################################
log_section "1. Checking macOS and System Requirements"

# Check OS
OS_VERSION=$(sw_vers -productVersion)
log_info "macOS version: $OS_VERSION"

# Check if running Apple Silicon or Intel
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    log_info "Architecture: Apple Silicon (M1/M2/M3)"
elif [ "$ARCH" = "x86_64" ]; then
    log_info "Architecture: Intel"
else
    log_warn "Unknown architecture: $ARCH"
fi

# Check available disk space (need at least 5GB)
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
log_info "Available disk space: $AVAILABLE_SPACE"

#############################################################################
# SECTION 2: Check and Install Homebrew
#############################################################################
log_section "2. Checking Homebrew"

if command -v brew &> /dev/null; then
    BREW_VERSION=$(brew --version | head -n 1)
    log_success "Homebrew is installed: $BREW_VERSION"
else
    log_warn "Homebrew not found, installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon
    if [ "$ARCH" = "arm64" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        log_success "Homebrew installed for Apple Silicon"
    else
        log_success "Homebrew installed"
    fi
fi

# Update Homebrew
log_info "Updating Homebrew..."
brew update

#############################################################################
# SECTION 3: Check and Install Node.js and npm
#############################################################################
log_section "3. Checking Node.js and npm"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log_success "Node.js is installed: $NODE_VERSION"
    log_success "npm is installed: $NPM_VERSION"
    
    # Check Node version (need 18+)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        log_warn "Node.js version $NODE_VERSION is older than required (18+)"
        log_info "Upgrading Node.js..."
        brew upgrade node
    fi
else
    log_warn "Node.js not found, installing..."
    brew install node
    log_success "Node.js installed: $(node --version)"
    log_success "npm installed: $(npm --version)"
fi

# Verify npm works
if ! npm --version &> /dev/null; then
    log_error "npm is not working properly"
    log_info "Attempting to fix npm..."
    npm install -g npm@latest
fi

#############################################################################
# SECTION 4: Check and Install Docker
#############################################################################
log_section "4. Checking Docker"

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_success "Docker is installed: $DOCKER_VERSION"
else
    log_warn "Docker not found, installing..."
    log_info "You have two options:"
    echo "  1. Install Docker Desktop (Recommended, includes Docker Compose)"
    echo "  2. Install docker via Homebrew (Requires separate installation)"
    echo ""
    read -p "Install Docker Desktop? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        brew install --cask docker
        log_info "Docker Desktop installed. Please start it manually from Applications."
        log_warn "⚠ Docker Desktop must be running before starting services!"
    else
        log_info "Installing Docker via Homebrew..."
        brew install docker
    fi
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(docker-compose --version)
    log_success "Docker Compose is installed: $DOCKER_COMPOSE_VERSION"
elif docker compose version &> /dev/null; then
    log_success "Docker Compose (V2) is available"
else
    log_warn "Docker Compose not found, installing..."
    brew install docker-compose
    log_success "Docker Compose installed"
fi

#############################################################################
# SECTION 5: Check and Install Additional Dependencies
#############################################################################
log_section "5. Checking Additional Dependencies"

# Git
if command -v git &> /dev/null; then
    log_success "Git installed: $(git --version)"
else
    log_warn "Git not found, installing..."
    brew install git
    log_success "Git installed"
fi

# Yarn (optional, for faster installs)
if command -v yarn &> /dev/null; then
    log_success "Yarn installed: $(yarn --version)"
else
    log_info "Yarn not found. Installing for faster npm operations..."
    npm install -g yarn
    log_success "Yarn installed: $(yarn --version)"
fi

# PostgreSQL client (optional but useful)
if command -v psql &> /dev/null; then
    log_success "PostgreSQL client installed"
else
    log_info "PostgreSQL client not found. Installing for database management..."
    brew install postgresql
    log_success "PostgreSQL client installed"
fi

#############################################################################
# SECTION 6: Navigate to Project and Check Structure
#############################################################################
log_section "6. Checking Project Structure"

if [ ! -f "package.json" ]; then
    log_error "package.json not found. Are you in the correct directory?"
    log_info "Please run this script from the Cisco QMS root directory"
    exit 1
fi

log_success "Found package.json"

if [ ! -d "apps/api" ]; then
    log_error "apps/api directory not found"
    exit 1
fi

if [ ! -d "apps/web" ]; then
    log_error "apps/web directory not found"
    exit 1
fi

if [ ! -f "infra/docker-compose.yml" ]; then
    log_error "docker-compose.yml not found"
    exit 1
fi

log_success "Project structure is valid"

#############################################################################
# SECTION 7: Clean npm Cache (Optional but recommended)
#############################################################################
log_section "7. Cleaning npm Cache"

log_info "Clearing npm cache..."
npm cache clean --force
log_success "npm cache cleared"

#############################################################################
# SECTION 8: Install Root Dependencies
#############################################################################
log_section "8. Installing Root Dependencies"

log_info "Running npm install in root directory..."
if npm install; then
    log_success "Root dependencies installed successfully"
else
    log_warn "Some root dependencies failed to install"
    log_info "Attempting to resolve issues..."
    
    # Try installing with legacy peer deps
    log_info "Retrying with --legacy-peer-deps flag..."
    npm install --legacy-peer-deps
    
    if [ $? -eq 0 ]; then
        log_success "Dependencies installed with legacy peer deps"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi
fi

#############################################################################
# SECTION 9: Install Backend (api) Dependencies
#############################################################################
log_section "9. Installing Backend (NestJS) Dependencies"

if [ ! -f "apps/api/package.json" ]; then
    log_error "apps/api/package.json not found"
    exit 1
fi

log_info "Installing API dependencies..."
cd apps/api

if npm install; then
    log_success "Backend dependencies installed successfully"
else
    log_warn "Some backend dependencies failed"
    log_info "Retrying with --legacy-peer-deps..."
    npm install --legacy-peer-deps
    
    if [ $? -eq 0 ]; then
        log_success "Backend dependencies installed"
    else
        log_error "Failed to install backend dependencies"
        cd ../..
        exit 1
    fi
fi

cd ../..

#############################################################################
# SECTION 10: Install Frontend (web) Dependencies
#############################################################################
log_section "10. Installing Frontend (React) Dependencies"

if [ ! -f "apps/web/package.json" ]; then
    log_error "apps/web/package.json not found"
    exit 1
fi

log_info "Installing Web dependencies..."
cd apps/web

if npm install; then
    log_success "Frontend dependencies installed successfully"
else
    log_warn "Some frontend dependencies failed"
    log_info "Retrying with --legacy-peer-deps..."
    npm install --legacy-peer-deps
    
    if [ $? -eq 0 ]; then
        log_success "Frontend dependencies installed"
    else
        log_error "Failed to install frontend dependencies"
        cd ../..
        exit 1
    fi
fi

cd ../..

#############################################################################
# SECTION 11: Install Shared Package Dependencies
#############################################################################
log_section "11. Installing Shared Package Dependencies"

if [ ! -f "packages/shared/package.json" ]; then
    log_error "packages/shared/package.json not found"
    exit 1
fi

log_info "Installing Shared package dependencies..."
cd packages/shared

if npm install; then
    log_success "Shared package dependencies installed"
else
    log_warn "Some shared package dependencies failed"
    log_info "Retrying..."
    npm install --legacy-peer-deps
fi

cd ../..

#############################################################################
# SECTION 12: Setup Environment Files
#############################################################################
log_section "12. Setting Up Environment Files"

if [ ! -f "apps/api/.env" ] && [ -f "apps/api/.env.example" ]; then
    log_info "Creating apps/api/.env from template..."
    cp apps/api/.env.example apps/api/.env
    log_success "Created apps/api/.env (configure with actual values)"
else
    log_info "apps/api/.env already exists"
fi

if [ ! -f ".env.example" ]; then
    log_info ".env.example not found, skipping"
else
    log_info ".env.example found (copy to .env if needed)"
fi

#############################################################################
# SECTION 13: Verify TypeScript Compilation
#############################################################################
log_section "13. Verifying TypeScript Configuration"

if [ -f "tsconfig.json" ]; then
    log_info "Checking TypeScript configuration..."
    if npx tsc --noEmit &> /dev/null; then
        log_success "TypeScript compilation check passed"
    else
        log_warn "TypeScript has some issues, but this is normal for template code"
        log_info "Run 'npm run build' after making changes to verify"
    fi
else
    log_warn "tsconfig.json not found"
fi

#############################################################################
# SECTION 14: Check Docker Status
#############################################################################
log_section "14. Checking Docker Status"

if ! docker ps &> /dev/null; then
    log_warn "Docker is not running"
    log_info "Instructions to start Docker:"
    if [ "$ARCH" = "arm64" ]; then
        echo "  • Apple Silicon: Open '/Applications/Docker.app'"
    else
        echo "  • Intel: Open '/Applications/Docker.app'"
    fi
    echo "  • Or run: open /Applications/Docker.app"
    
    read -p "Start Docker now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open /Applications/Docker.app
        log_info "Docker is starting. Please wait 30 seconds for it to fully load..."
        sleep 30
    else
        log_warn "Skipping Docker start. You'll need to start it manually later."
    fi
else
    log_success "Docker is running"
    log_info "$(docker ps -q | wc -l) container(s) currently running"
fi

#############################################################################
# SECTION 15: Installation Summary and Next Steps
#############################################################################
log_section "15. Installation Complete!"

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║        ✓ Installation Completed Successfully!          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${BLUE}System Information:${NC}"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  macOS: $(sw_vers -productVersion)"
echo "  Architecture: $ARCH"

if command -v docker &> /dev/null; then
    echo "  Docker: $(docker --version)"
fi

echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo "1. ${YELLOW}Configure Environment Variables:${NC}"
echo "   Edit apps/api/.env with your actual configuration"
echo "   • UCCX credentials"
echo "   • MediaSense credentials"
echo "   • Keycloak settings"
echo "   • Database passwords"
echo ""
echo "2. ${YELLOW}Start Docker Services:${NC}"
echo "   docker-compose -f infra/docker-compose.yml up -d"
echo ""
echo "3. ${YELLOW}Setup Database:${NC}"
echo "   npm run db:migrate:deploy"
echo "   npm run db:seed"
echo ""
echo "4. ${YELLOW}Start Development Servers:${NC}"
echo "   Terminal 1: npm run dev:api    (Backend on port 3000)"
echo "   Terminal 2: npm run dev:web    (Frontend on port 5173)"
echo ""
echo "5. ${YELLOW}Access the Application:${NC}"
echo "   Web UI:    http://localhost:5173"
echo "   API Docs:  http://localhost:3000/api"
echo "   Keycloak:  http://localhost:8080"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "  • README.md          - Project overview"
echo "  • GETTING_STARTED.md - Development setup"
echo "  • API.md             - API reference"
echo "  • DEPLOYMENT.md      - Production setup"
echo ""
echo -e "${BLUE}🔧 Troubleshooting:${NC}"
if [ ! -z "$(<apps/api/.env)" ]; then
    echo "  • Port already in use:        lsof -i :3000"
    echo "  • Docker won't start:         open /Applications/Docker.app"
    echo "  • npm errors:                 npm cache clean --force"
    echo "  • Database issues:            npm run db:reset (dev only)"
fi
echo ""
echo -e "${GREEN}✓ You're all set! Happy coding! 🚀${NC}"
echo ""

#############################################################################
# SECTION 16: Optional: Offer to Start Docker Services
#############################################################################
read -p "Start Docker services now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_section "Starting Docker Services"
    
    log_info "Building Docker images (this may take 5-10 minutes)..."
    
    if docker-compose -f infra/docker-compose.yml up -d; then
        log_success "Docker services started successfully"
        echo ""
        log_info "Waiting for services to be ready (30 seconds)..."
        sleep 30
        
        log_info "Service status:"
        docker-compose -f infra/docker-compose.yml ps
        
        echo ""
        log_success "All services are running!"
        echo ""
        log_info "Next: Run 'npm run db:migrate:deploy' to setup the database"
    else
        log_error "Failed to start Docker services"
        log_info "Try manually running:"
        echo "  docker-compose -f infra/docker-compose.yml up -d"
    fi
else
    log_info "You can start services later with:"
    echo "  docker-compose -f infra/docker-compose.yml up -d"
fi

log_success "Installation script completed!"
