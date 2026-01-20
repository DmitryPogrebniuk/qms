#!/bin/bash
# Quick test runner script for QMS Web UI

set -e

echo "🧪 QMS Web UI Testing Suite"
echo "============================"
echo ""

cd apps/web

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Parse command line arguments
TEST_TYPE=${1:-"all"}

case $TEST_TYPE in
    "unit")
        echo "🔬 Running unit tests..."
        npm run test
        ;;
    "e2e")
        echo "🌐 Running E2E tests..."
        # Check if Playwright browsers are installed
        if [ ! -d "$HOME/.cache/ms-playwright" ]; then
            echo "📥 Installing Playwright browsers..."
            npx playwright install --with-deps
        fi
        npm run test:e2e
        ;;
    "coverage")
        echo "📊 Running tests with coverage..."
        npm run test:coverage
        ;;
    "all")
        echo "🔬 Running unit tests..."
        npm run test
        echo ""
        echo "🌐 Running E2E tests..."
        if [ ! -d "$HOME/.cache/ms-playwright" ]; then
            echo "📥 Installing Playwright browsers..."
            npx playwright install --with-deps
        fi
        npm run test:e2e
        ;;
    "ui")
        echo "🎨 Opening test UI..."
        npm run test:ui
        ;;
    "e2e-ui")
        echo "🎨 Opening E2E test UI..."
        npm run test:e2e:ui
        ;;
    *)
        echo "❌ Unknown test type: $TEST_TYPE"
        echo ""
        echo "Usage: ./run-tests.sh [unit|e2e|coverage|all|ui|e2e-ui]"
        echo ""
        echo "  unit      - Run unit/component tests"
        echo "  e2e       - Run end-to-end tests"
        echo "  coverage  - Run tests with coverage report"
        echo "  all       - Run all tests (default)"
        echo "  ui        - Open unit test UI"
        echo "  e2e-ui    - Open E2E test UI"
        exit 1
        ;;
esac

echo ""
echo "✅ Tests completed!"
