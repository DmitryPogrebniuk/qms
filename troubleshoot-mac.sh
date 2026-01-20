#!/bin/bash

#############################################################################
# Cisco QMS - macOS Troubleshooting Script
# 
# This script helps diagnose and fix common installation issues
#
# Usage: bash troubleshoot-mac.sh
#############################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Welcome
clear
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Cisco QMS - macOS Troubleshooting Script              ║"
echo "║                                                        ║"
echo "║  This script will:                                     ║"
echo "║  • Diagnose installation issues                        ║"
echo "║  • Fix common problems                                 ║"
echo "║  • Verify system configuration                         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

#############################################################################
# DIAGNOSTIC MENU
#############################################################################
while true; do
    echo ""
    echo -e "${BLUE}Select an option:${NC}"
    echo ""
    echo "  1. Run full diagnostic (check everything)"
    echo "  2. Fix npm issues"
    echo "  3. Fix Docker issues"
    echo "  4. Fix Node.js issues"
    echo "  5. Clear caches and reinstall"
    echo "  6. Check service status"
    echo "  7. View system information"
    echo "  8. Fix port conflicts"
    echo "  9. Reset database"
    echo "  0. Exit"
    echo ""
    read -p "Enter choice (0-9): " choice
    
    case $choice in
        1)
            run_full_diagnostic
            ;;
        2)
            fix_npm_issues
            ;;
        3)
            fix_docker_issues
            ;;
        4)
            fix_node_issues
            ;;
        5)
            clear_caches_reinstall
            ;;
        6)
            check_service_status
            ;;
        7)
            view_system_info
            ;;
        8)
            fix_port_conflicts
            ;;
        9)
            reset_database
            ;;
        0)
            log_success "Exiting troubleshooting script"
            exit 0
            ;;
        *)
            log_error "Invalid choice. Please enter 0-9."
            ;;
    esac
done

#############################################################################
# DIAGNOSTIC FUNCTIONS
#############################################################################

run_full_diagnostic() {
    log_section "Running Full Diagnostic"
    
    echo "Checking Node.js..."
    if command -v node &> /dev/null; then
        log_success "Node.js: $(node --version)"
    else
        log_error "Node.js not found"
    fi
    
    echo "Checking npm..."
    if command -v npm &> /dev/null; then
        log_success "npm: $(npm --version)"
    else
        log_error "npm not found"
    fi
    
    echo "Checking Docker..."
    if command -v docker &> /dev/null; then
        log_success "Docker: $(docker --version)"
        if docker ps &> /dev/null; then
            log_success "Docker is running"
        else
            log_warn "Docker is installed but not running"
        fi
    else
        log_error "Docker not found"
    fi
    
    echo "Checking project files..."
    if [ -f "package.json" ]; then
        log_success "Found package.json"
    else
        log_error "package.json not found"
    fi
    
    if [ -f "apps/api/package.json" ]; then
        log_success "Found apps/api/package.json"
    else
        log_error "apps/api/package.json not found"
    fi
    
    if [ -f "apps/web/package.json" ]; then
        log_success "Found apps/web/package.json"
    else
        log_error "apps/web/package.json not found"
    fi
    
    echo "Checking node_modules..."
    if [ -d "node_modules" ]; then
        log_success "Root node_modules exists ($(du -sh node_modules | cut -f1))"
    else
        log_warn "Root node_modules not found"
    fi
    
    if [ -d "apps/api/node_modules" ]; then
        log_success "API node_modules exists ($(du -sh apps/api/node_modules | cut -f1))"
    else
        log_warn "API node_modules not found"
    fi
    
    if [ -d "apps/web/node_modules" ]; then
        log_success "Web node_modules exists ($(du -sh apps/web/node_modules | cut -f1))"
    else
        log_warn "Web node_modules not found"
    fi
    
    echo "Checking Prisma..."
    if [ -f "apps/api/prisma/schema.prisma" ]; then
        log_success "Found Prisma schema"
    else
        log_error "Prisma schema not found"
    fi
    
    echo ""
    echo -e "${GREEN}Diagnostic complete!${NC}"
}

fix_npm_issues() {
    log_section "Fixing npm Issues"
    
    log_warn "This will clear npm cache and reinstall packages"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    log_info "Step 1: Clearing npm cache..."
    npm cache clean --force
    log_success "Cache cleared"
    
    log_info "Step 2: Clearing npm modules..."
    rm -rf node_modules
    rm -rf apps/api/node_modules
    rm -rf apps/web/node_modules
    rm -rf packages/shared/node_modules
    log_success "Modules cleared"
    
    log_info "Step 3: Removing package-lock.json files..."
    find . -name "package-lock.json" -delete
    log_success "Lock files removed"
    
    log_info "Step 4: Reinstalling packages..."
    npm install --legacy-peer-deps
    
    log_info "Step 5: Installing API packages..."
    cd apps/api && npm install --legacy-peer-deps && cd ../..
    
    log_info "Step 6: Installing Web packages..."
    cd apps/web && npm install --legacy-peer-deps && cd ../..
    
    log_success "npm issues fixed!"
}

fix_docker_issues() {
    log_section "Fixing Docker Issues"
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker not installed"
        log_info "Run: bash install-mac.sh"
        return
    fi
    
    if ! docker ps &> /dev/null; then
        log_warn "Docker is not running"
        read -p "Start Docker? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            open /Applications/Docker.app
            log_info "Docker is starting. Please wait 30 seconds..."
            sleep 30
        else
            return
        fi
    fi
    
    log_info "Checking Docker daemon..."
    if docker ps &> /dev/null; then
        log_success "Docker is working"
    else
        log_error "Docker daemon not responding"
        log_info "Try restarting Docker:  open /Applications/Docker.app"
        return
    fi
    
    log_info "Checking docker-compose..."
    if command -v docker-compose &> /dev/null; then
        log_success "docker-compose: $(docker-compose --version)"
    elif docker compose version &> /dev/null; then
        log_success "Docker Compose V2 available"
    else
        log_warn "docker-compose not found"
        log_info "Installing docker-compose..."
        brew install docker-compose
    fi
    
    log_info "Removing stopped containers..."
    docker container prune -f
    
    log_info "Removing unused images..."
    docker image prune -f
    
    log_success "Docker issues fixed!"
}

fix_node_issues() {
    log_section "Fixing Node.js Issues"
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js not installed"
        log_info "Installing Node.js..."
        brew install node
        return
    fi
    
    NODE_VERSION=$(node --version)
    log_info "Current Node.js: $NODE_VERSION"
    
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        log_warn "Node.js version $NODE_VERSION is too old (need 18+)"
        read -p "Upgrade Node.js? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            brew upgrade node
            log_success "Node.js upgraded to $(node --version)"
        fi
    else
        log_success "Node.js version is OK"
    fi
    
    log_info "Checking npm..."
    if ! npm --version &> /dev/null; then
        log_warn "npm is not working"
        log_info "Reinstalling npm..."
        npm install -g npm@latest
    else
        log_success "npm is working: $(npm --version)"
    fi
    
    log_success "Node.js issues fixed!"
}

clear_caches_reinstall() {
    log_section "Clearing Caches and Reinstalling"
    
    log_warn "This will delete all node_modules and reinstall from scratch"
    log_warn "This may take 10-15 minutes"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    log_info "Clearing npm cache..."
    npm cache clean --force
    
    log_info "Clearing brew cache..."
    brew cleanup
    
    log_info "Removing node_modules..."
    find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
    
    log_info "Removing lock files..."
    find . -name "package-lock.json" -delete
    find . -name "yarn.lock" -delete
    
    log_info "Reinstalling packages..."
    npm install --legacy-peer-deps
    
    cd apps/api && npm install --legacy-peer-deps && cd ../..
    cd apps/web && npm install --legacy-peer-deps && cd ../..
    cd packages/shared && npm install --legacy-peer-deps && cd ../..
    
    log_success "Cache cleared and packages reinstalled!"
}

check_service_status() {
    log_section "Checking Service Status"
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker not installed"
        return
    fi
    
    if ! docker ps &> /dev/null; then
        log_warn "Docker is not running"
        return
    fi
    
    if [ ! -f "infra/docker-compose.yml" ]; then
        log_error "docker-compose.yml not found"
        return
    fi
    
    log_info "Services status:"
    docker-compose -f infra/docker-compose.yml ps
    
    echo ""
    log_info "Detailed container status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    log_info "Checking health:"
    docker-compose -f infra/docker-compose.yml ps --services | while read service; do
        if docker-compose -f infra/docker-compose.yml ps "$service" | grep -q "healthy"; then
            log_success "$service is healthy"
        elif docker-compose -f infra/docker-compose.yml ps "$service" | grep -q "Up"; then
            log_warn "$service is running (not yet healthy)"
        else
            log_error "$service is down"
        fi
    done
}

view_system_info() {
    log_section "System Information"
    
    echo "macOS Version:     $(sw_vers -productVersion)"
    echo "Architecture:      $(uname -m)"
    echo "Hostname:          $(hostname)"
    echo "Available Memory:  $(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/.$//' | awk '{printf "%.1f GB\n", $1 / 256000}')"
    echo "Disk Usage:        $(df -h / | tail -1 | awk '{print $5 " used of " $2}')"
    echo ""
    
    echo "Software Versions:"
    echo "  Homebrew:       $(brew --version | head -1)"
    echo "  Node.js:        $(node --version 2>/dev/null || echo 'Not installed')"
    echo "  npm:            $(npm --version 2>/dev/null || echo 'Not installed')"
    echo "  Docker:         $(docker --version 2>/dev/null || echo 'Not installed')"
    echo "  Git:            $(git --version)"
    echo ""
    
    echo "Project Information:"
    if [ -f "package.json" ]; then
        VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4)
        echo "  QMS Version:    $VERSION"
    fi
    echo "  Project Path:   $(pwd)"
    echo "  Total Size:     $(du -sh . | cut -f1)"
}

fix_port_conflicts() {
    log_section "Fixing Port Conflicts"
    
    PORTS=(3000 5173 5432 6379 8080 9200)
    
    log_info "Checking for port conflicts..."
    echo ""
    
    for port in "${PORTS[@]}"; do
        if lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            PID=$(lsof -Pi ":$port" -sTCP:LISTEN -t)
            PROCESS=$(lsof -Pi ":$port" -sTCP:LISTEN | grep -v COMMAND)
            log_warn "Port $port is in use"
            echo "  $PROCESS"
            
            read -p "Kill process on port $port (PID: $PID)? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                kill -9 $PID
                log_success "Killed process on port $port"
            fi
        else
            log_success "Port $port is available"
        fi
    done
}

reset_database() {
    log_section "Resetting Database"
    
    log_warn "This will DELETE all data and reset the database"
    log_warn "Use this only for development environments"
    read -p "Continue? Type 'yes' to confirm: " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_warn "Reset cancelled"
        return
    fi
    
    if ! [ -f "apps/api/prisma/schema.prisma" ]; then
        log_error "Prisma schema not found"
        return
    fi
    
    log_info "Stopping containers..."
    docker-compose -f infra/docker-compose.yml down
    
    log_info "Resetting database..."
    cd apps/api
    
    # Drop and recreate database
    log_info "Dropping database..."
    npx prisma migrate reset --force
    
    log_info "Running migrations..."
    npx prisma migrate deploy
    
    log_info "Seeding database..."
    if [ -f "prisma/seed.ts" ]; then
        npx prisma db seed
    fi
    
    cd ../..
    
    log_success "Database reset complete!"
    log_info "Starting services again..."
    docker-compose -f infra/docker-compose.yml up -d
}

log_success "Troubleshooting script loaded"
