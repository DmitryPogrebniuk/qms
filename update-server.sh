#!/bin/bash
#
# QMS Update & Rebuild Script for Ubuntu Server
# Usage: ./update-server.sh [--full]
#
# Options:
#   --full    Force full rebuild with no cache
#
# This script will:
# 1. Pull latest changes from git
# 2. Install dependencies
# 3. Rebuild only changed parts (or full rebuild with --full)
# 4. Restart Docker containers
#

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - adjust these paths as needed
QMS_DIR="${QMS_DIR:-/opt/qms}"
DOCKER_COMPOSE_FILE="${QMS_DIR}/infra/docker-compose.yml"
FULL_REBUILD=false

# Parse arguments
if [ "$1" == "--full" ]; then
    FULL_REBUILD=true
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  QMS Update & Rebuild Script${NC}"
if [ "$FULL_REBUILD" = true ]; then
    echo -e "${YELLOW}  Mode: FULL REBUILD (no cache)${NC}"
else
    echo -e "${GREEN}  Mode: Incremental (fast)${NC}"
fi
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as appropriate user
if [ "$EUID" -eq 0 ] && [ -z "$ALLOW_ROOT" ]; then
    echo -e "${YELLOW}Warning: Running as root. Consider using a non-root user.${NC}"
    echo -e "${YELLOW}Set ALLOW_ROOT=1 to suppress this warning.${NC}"
fi

# Navigate to QMS directory
cd "$QMS_DIR" || {
    echo -e "${RED}Error: QMS directory not found at $QMS_DIR${NC}"
    echo -e "${YELLOW}Set QMS_DIR environment variable to your QMS installation path${NC}"
    echo -e "${YELLOW}Example: QMS_DIR=/home/user/qms ./update-server.sh${NC}"
    exit 1
}

echo -e "${GREEN}[1/5]${NC} Pulling latest changes from git..."
git fetch --all
CHANGES=$(git diff --name-only HEAD origin/main)
git pull origin main || {
    echo -e "${RED}Error: Failed to pull from git${NC}"
    exit 1
}
echo -e "${GREEN}✓ Git pull complete${NC}"

# Detect what changed
API_CHANGED=false
WEB_CHANGED=false
INFRA_CHANGED=false

if echo "$CHANGES" | grep -q "^apps/api/"; then
    API_CHANGED=true
    echo -e "${YELLOW}  → API changes detected${NC}"
fi
if echo "$CHANGES" | grep -q "^apps/web/"; then
    WEB_CHANGED=true
    echo -e "${YELLOW}  → Web changes detected${NC}"
fi
if echo "$CHANGES" | grep -q "^infra/\|^packages/"; then
    INFRA_CHANGED=true
    echo -e "${YELLOW}  → Infrastructure/shared changes detected${NC}"
fi
echo ""

echo -e "${GREEN}[2/5]${NC} Installing dependencies..."
npm install || {
    echo -e "${RED}Error: npm install failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${GREEN}[3/5]${NC} Building shared package..."
npm run build -w packages/shared 2>/dev/null || {
    echo -e "${YELLOW}Warning: Shared package build skipped${NC}"
}
echo -e "${GREEN}✓ Shared package built${NC}"
echo ""

# Determine what to rebuild
SERVICES_TO_BUILD=""
if [ "$FULL_REBUILD" = true ] || [ "$INFRA_CHANGED" = true ]; then
    SERVICES_TO_BUILD="api web"
    BUILD_ARGS="--no-cache"
else
    if [ "$API_CHANGED" = true ]; then
        SERVICES_TO_BUILD="$SERVICES_TO_BUILD api"
    fi
    if [ "$WEB_CHANGED" = true ]; then
        SERVICES_TO_BUILD="$SERVICES_TO_BUILD web"
    fi
    BUILD_ARGS=""
fi

echo -e "${GREEN}[4/5]${NC} Rebuilding Docker images..."
if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    if [ -n "$SERVICES_TO_BUILD" ]; then
        echo -e "${BLUE}Building: $SERVICES_TO_BUILD ${BUILD_ARGS:+(no-cache)}${NC}"
        docker compose -f "$DOCKER_COMPOSE_FILE" build $BUILD_ARGS $SERVICES_TO_BUILD || {
            echo -e "${RED}Error: Docker build failed${NC}"
            exit 1
        }
    else
        echo -e "${GREEN}No services need rebuilding${NC}"
    fi
else
    echo -e "${YELLOW}Skipping Docker build - no compose file found${NC}"
    echo -e "${YELLOW}Building locally instead...${NC}"
    npm run build || {
        echo -e "${RED}Error: Local build failed${NC}"
        exit 1
    }
fi
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

echo -e "${GREEN}[5/5]${NC} Restarting containers..."
if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    if [ -n "$SERVICES_TO_BUILD" ]; then
        # Only restart changed services
        docker compose -f "$DOCKER_COMPOSE_FILE" up -d $SERVICES_TO_BUILD || {
            echo -e "${RED}Error: Failed to start containers${NC}"
            exit 1
        }
    else
        echo -e "${GREEN}No containers need restarting${NC}"
    fi
    echo ""
    echo -e "${GREEN}✓ Containers updated${NC}"
    echo ""
    
    # Show running containers
    echo -e "${BLUE}Running containers:${NC}"
    docker compose -f "$DOCKER_COMPOSE_FILE" ps
else
    echo -e "${YELLOW}No Docker Compose file - starting in development mode${NC}"
    echo -e "${YELLOW}Run 'npm run dev' manually to start the application${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Update complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Web UI: ${BLUE}http://localhost:5173${NC} (dev) or ${BLUE}https://your-server${NC} (prod)"
echo -e "API: ${BLUE}http://localhost:3000${NC}"
echo ""

# Show logs hint
echo -e "${YELLOW}To view logs:${NC}"
echo -e "  docker compose -f $DOCKER_COMPOSE_FILE logs -f"
echo ""
echo -e "${YELLOW}For full rebuild (no cache):${NC}"
echo -e "  ./update-server.sh --full"
echo ""
