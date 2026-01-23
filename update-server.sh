#!/bin/bash
#
# QMS Update & Rebuild Script for Ubuntu Server
# Usage: ./update-server.sh
#
# This script will:
# 1. Pull latest changes from git
# 2. Install dependencies
# 3. Rebuild the application
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

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  QMS Update & Rebuild Script${NC}"
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

echo -e "${GREEN}[1/6]${NC} Pulling latest changes from git..."
git fetch --all
git pull origin main || {
    echo -e "${RED}Error: Failed to pull from git${NC}"
    exit 1
}
echo -e "${GREEN}✓ Git pull complete${NC}"
echo ""

echo -e "${GREEN}[2/6]${NC} Installing dependencies..."
npm install || {
    echo -e "${RED}Error: npm install failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${GREEN}[3/6]${NC} Building shared package..."
npm run build -w packages/shared || {
    echo -e "${YELLOW}Warning: Shared package build skipped or failed${NC}"
}
echo -e "${GREEN}✓ Shared package built${NC}"
echo ""

echo -e "${GREEN}[4/6]${NC} Stopping existing containers..."
if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    docker-compose -f "$DOCKER_COMPOSE_FILE" down || {
        echo -e "${YELLOW}Warning: Could not stop containers (may not be running)${NC}"
    }
else
    echo -e "${YELLOW}Warning: docker-compose.yml not found, skipping container stop${NC}"
fi
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

echo -e "${GREEN}[5/6]${NC} Rebuilding Docker images..."
if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache api web || {
        echo -e "${RED}Error: Docker build failed${NC}"
        exit 1
    }
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

echo -e "${GREEN}[6/6]${NC} Starting containers..."
if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d || {
        echo -e "${RED}Error: Failed to start containers${NC}"
        exit 1
    }
    echo ""
    echo -e "${GREEN}✓ Containers started${NC}"
    echo ""
    
    # Show running containers
    echo -e "${BLUE}Running containers:${NC}"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
else
    echo -e "${YELLOW}No Docker Compose file - starting in development mode${NC}"
    echo -e "${YELLOW}Run 'npm run dev' manually to start the application${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Update complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Web UI should be available at: ${BLUE}http://localhost:5173${NC} (dev) or ${BLUE}https://your-server${NC} (prod)"
echo -e "API should be available at: ${BLUE}http://localhost:3000${NC}"
echo ""

# Show logs hint
echo -e "${YELLOW}To view logs:${NC}"
echo -e "  docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
echo ""
