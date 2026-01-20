#!/bin/bash

#############################################################################
# Cisco QMS - macOS Installation & Troubleshooting Quick Reference
#
# A quick lookup guide for common issues and solutions on macOS
#############################################################################

# This file can be viewed as text or executed as a guide

cat << 'EOF'
╔════════════════════════════════════════════════════════════════════════════╗
║                   CISCO QMS - macOS QUICK REFERENCE                        ║
║                  Installation & Troubleshooting Guide                      ║
╚════════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 QUICK START
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

One-command installation:
  bash install-mac.sh

If something goes wrong:
  bash troubleshoot-mac.sh

Access after installation:
  Web:      http://localhost:5173
  API:      http://localhost:3000/api
  Keycloak: http://localhost:8080
  Login:    admin / admin123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 INSTALLATION SCRIPTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

install-mac.sh
  ✓ Full automated installation
  ✓ Installs dependencies (Node, Docker, etc.)
  ✓ Installs npm modules
  ✓ Handles errors automatically
  ✓ Offers to start services
  
  Run: bash install-mac.sh
  Time: 10-15 minutes

troubleshoot-mac.sh
  ✓ Interactive troubleshooting menu
  ✓ Diagnoses issues
  ✓ Fixes common problems
  ✓ Checks service status
  ✓ System information
  
  Run: bash troubleshoot-mac.sh
  Time: Varies by issue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  COMMON ISSUES & QUICK FIXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: "command not found: brew"
Fix:   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

Issue: "command not found: node"
Fix:   brew install node

Issue: "Port 3000 already in use"
Fix:   lsof -i :3000
       kill -9 <PID>

Issue: "Docker daemon not responding"
Fix:   open /Applications/Docker.app
       sleep 30
       docker ps

Issue: "npm ERR! code ERESOLVE"
Fix:   npm install --legacy-peer-deps

Issue: "Cannot connect to Docker daemon"
Fix:   docker context ls
       (If fails, restart your Mac)

Issue: "Disk space issues"
Fix:   docker image prune -a
       docker container prune -f
       docker volume prune -f
       npm cache clean --force

Issue: "node_modules not installing"
Fix:   bash troubleshoot-mac.sh
       Select: 2 (Fix npm Issues)

Issue: "Docker services won't start"
Fix:   docker-compose -f infra/docker-compose.yml down
       docker-compose -f infra/docker-compose.yml up -d

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TROUBLESHOOT SCRIPT MENU OPTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bash troubleshoot-mac.sh

Then select:
  1. Run full diagnostic        → Check everything
  2. Fix npm issues             → Reinstall packages
  3. Fix Docker issues          → Fix Docker problems
  4. Fix Node.js issues         → Fix Node.js/npm
  5. Clear caches & reinstall   → Nuclear option (slow)
  6. Check service status       → View running containers
  7. View system information    → System details
  8. Fix port conflicts         → Fix port-in-use errors
  9. Reset database             → Fresh database (DEV ONLY)
  0. Exit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 AFTER INSTALLATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Configure environment:
   nano apps/api/.env
   
   Set:
   - UCCX_HOST, UCCX_USERNAME, UCCX_PASSWORD
   - MEDIASENSE_HOST, MEDIASENSE_USERNAME, MEDIASENSE_PASSWORD
   - KEYCLOAK_CLIENT_SECRET
   - Database/Redis passwords

2. Start Docker services:
   docker-compose -f infra/docker-compose.yml up -d

3. Setup database:
   npm run db:migrate:deploy
   npm run db:seed

4. Start development servers:
   Terminal 1: npm run dev:api      (Backend, port 3000)
   Terminal 2: npm run dev:web      (Frontend, port 5173)

5. Access application:
   http://localhost:5173
   Login: admin / admin123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 DIAGNOSTIC COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check versions:
  node --version        (Should be 18+)
  npm --version         (Should be 8+)
  docker --version      (Should be 20.10+)
  git --version

Check installation:
  ls -la apps/api/node_modules
  ls -la apps/web/node_modules
  npm list --depth=0

Check Docker:
  docker ps             (List running containers)
  docker ps -a          (List all containers)
  docker images         (List all images)
  docker logs <name>    (View container logs)

Check services:
  docker-compose -f infra/docker-compose.yml ps
  curl http://localhost:3000/api/health
  curl http://localhost:5173 (dev server)

Check ports:
  lsof -i :3000         (What's on port 3000)
  lsof -i :5173         (What's on port 5173)
  lsof -i :5432         (What's on port 5432)

Check database:
  npm run db:studio     (Prisma Studio)
  npx prisma db push    (Apply schema changes)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️  USEFUL COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reinstall everything:
  npm cache clean --force
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
  find . -name package-lock.json -delete
  npm install
  cd apps/api && npm install && cd ../..
  cd apps/web && npm install && cd ../..

Start fresh:
  docker-compose -f infra/docker-compose.yml down
  npm run db:reset
  docker-compose -f infra/docker-compose.yml up -d

Clean Docker:
  docker system prune -a
  docker container prune -f
  docker image prune -f
  docker volume prune -f

Kill process on port:
  kill -9 $(lsof -t -i :3000)
  kill -9 $(lsof -t -i :5173)

View logs:
  docker-compose -f infra/docker-compose.yml logs api
  docker-compose -f infra/docker-compose.yml logs postgres
  docker-compose -f infra/docker-compose.yml logs -f

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 DEVELOPMENT COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

npm run dev:api              Build API with watch
npm run dev:web              Start frontend dev server
npm run build:api            Build API for production
npm run build:web            Build frontend for production
npm run lint                 Run ESLint
npm run format               Format code with Prettier
npm test                     Run tests
npm run db:studio            Open Prisma Studio
npm run db:migrate:dev       Create migration
npm run db:migrate:deploy    Apply migrations
npm run db:seed              Seed demo data
npm run db:reset             Reset database (dev only)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ VERIFICATION CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After installation, verify:

✓ Node.js 18+              node --version
✓ npm 8+                   npm --version
✓ Docker 20.10+            docker --version
✓ Docker running           docker ps
✓ Docker Compose           docker-compose --version
✓ Git                      git --version
✓ Project structure        ls -la apps/
✓ node_modules             ls -la node_modules
✓ API node_modules         ls -la apps/api/node_modules
✓ Web node_modules         ls -la apps/web/node_modules
✓ TypeScript works         npx tsc --noEmit
✓ Docker containers        docker-compose -f infra/docker-compose.yml ps
✓ Database                 npm run db:studio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 DOCUMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTALL_MAC_GUIDE.md        Detailed installation guide (THIS FILE)
README.md                   Project overview
GETTING_STARTED.md          Development setup
API.md                      API reference
ARCHITECTURE.md             Design decisions
DEPLOYMENT.md               Production setup
CONTRIBUTING.md             Code guidelines

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆘 GETTING HELP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Run diagnostic:
   bash troubleshoot-mac.sh

2. Check this guide:
   Look above for your issue

3. Read detailed guide:
   Read INSTALL_MAC_GUIDE.md

4. Check project docs:
   README.md, GETTING_STARTED.md

5. View logs:
   docker-compose -f infra/docker-compose.yml logs

6. Manual installation:
   See INSTALL_MAC_GUIDE.md "Manual Installation" section

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Last Updated: January 2024
Version: 1.0.0

Questions? See INSTALL_MAC_GUIDE.md or README.md
Ready to start? Run: bash install-mac.sh

EOF
