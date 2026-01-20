# Cisco QMS - macOS Installation & Troubleshooting Guide

This guide explains how to use the provided installation and troubleshooting scripts for macOS.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Installation Script (`install-mac.sh`)](#installation-script)
3. [Troubleshooting Script (`troubleshoot-mac.sh`)](#troubleshooting-script)
4. [Common Issues & Solutions](#common-issues--solutions)
5. [Detailed Error Messages](#detailed-error-messages)
6. [Manual Installation](#manual-installation)

---

## 🚀 Quick Start

### One-Command Installation (Easiest)

```bash
cd /Users/dpogrebniuk/QMS
bash install-mac.sh
```

That's it! The script will:
- ✅ Check for required software
- ✅ Install missing dependencies via Homebrew
- ✅ Install all npm modules
- ✅ Setup Docker
- ✅ Handle errors automatically
- ✅ Offer to start services

**Estimated Time:** 10-15 minutes (depends on internet speed)

### If Something Goes Wrong

```bash
bash troubleshoot-mac.sh
```

Then select an option to fix the issue.

---

## 📦 Installation Script (`install-mac.sh`)

### What It Does

The `install-mac.sh` script automates the entire installation process:

1. **Checks System Requirements**
   - Verifies macOS version
   - Detects hardware (Apple Silicon vs Intel)
   - Checks available disk space

2. **Installs Homebrew** (if not installed)
   - The package manager for macOS
   - Required for all other installations

3. **Installs Node.js & npm**
   - Requires Node.js 18+
   - Upgrades if you have an older version
   - Verifies npm is working

4. **Installs Docker**
   - Offers to install Docker Desktop (recommended)
   - Alternative: Homebrew installation
   - Checks for Docker Compose

5. **Installs Additional Tools**
   - Git
   - Yarn (optional, for faster installs)
   - PostgreSQL client (optional)

6. **Installs Project Dependencies**
   - Root dependencies
   - Backend (NestJS) dependencies
   - Frontend (React) dependencies
   - Shared package dependencies

7. **Verifies Installation**
   - Checks TypeScript compilation
   - Validates project structure
   - Confirms Docker status

8. **Optionally Starts Services**
   - Builds Docker images
   - Starts all containers
   - Displays service status

### Running the Script

**Basic usage:**
```bash
bash install-mac.sh
```

**With specific Node version:**
```bash
NODE_VERSION=18 bash install-mac.sh
```

**Dry run (see what it would do, without making changes):**
```bash
bash install-mac.sh --dry-run  # Note: Not yet implemented
```

### What You'll See

The script provides colored output with status indicators:

```
ℹ Information message
✓ Success message
⚠ Warning message
✗ Error message
```

### Troubleshooting During Installation

If the script fails:

1. **Read the error message** - It tells you exactly what failed
2. **Check your internet connection** - Required for downloads
3. **Ensure write permissions** - Script needs permission to install
4. **Try running again** - Some transient errors resolve on retry
5. **Run the troubleshooting script** - `bash troubleshoot-mac.sh`

### After Installation

Follow the "Next Steps" provided by the script:

1. Edit environment variables in `apps/api/.env`
2. Start Docker services
3. Setup the database
4. Start development servers

---

## 🔧 Troubleshooting Script (`troubleshoot-mac.sh`)

### What It Does

The `troubleshoot-mac.sh` script provides an interactive menu to diagnose and fix common issues.

### Running the Script

```bash
bash troubleshoot-mac.sh
```

### Menu Options

#### 1. Run Full Diagnostic
Checks everything:
- Node.js and npm installation
- Docker and docker-compose
- Project files (package.json, Prisma schema)
- node_modules directories
- All dependencies

**Use this when:** You're unsure what's broken

#### 2. Fix npm Issues
Solves npm-related problems:
- Clears npm cache
- Removes all node_modules
- Removes package-lock.json files
- Reinstalls all packages

**Use this when:**
- `npm install` fails
- Packages don't install correctly
- You get dependency conflicts

#### 3. Fix Docker Issues
Solves Docker problems:
- Verifies Docker installation
- Starts Docker if stopped
- Installs docker-compose if missing
- Cleans up unused containers/images

**Use this when:**
- Docker won't start
- `docker ps` shows no containers
- You get "Docker daemon not responding" error

#### 4. Fix Node.js Issues
Solves Node.js problems:
- Checks Node.js installation
- Upgrades if version too old
- Reinstalls npm if broken
- Verifies Node version compatibility

**Use this when:**
- Node.js not installed
- `node --version` returns wrong version
- npm won't run

#### 5. Clear Caches and Reinstall
Nuclear option for npm issues:
- Clears npm and Homebrew caches
- Deletes all node_modules
- Removes all lock files
- Completely reinstalls everything

**Use this when:**
- Corruption or major issues
- Nothing else worked
- Starting completely fresh

⚠️ **Warning:** Takes 10-15 minutes

#### 6. Check Service Status
Shows what's running:
- Lists all Docker containers
- Shows container health status
- Displays port mappings
- Confirms services are healthy

**Use this when:**
- Checking if services are running
- Debugging container issues

#### 7. View System Information
Displays your system:
- macOS version
- Hardware architecture
- Available memory and disk
- Installed software versions
- Project information

**Use this when:**
- Reporting issues
- Checking compatibility
- General system info

#### 8. Fix Port Conflicts
Solves port already-in-use errors:
- Checks ports used by QMS (3000, 5173, 5432, etc.)
- Shows which process is using each port
- Can kill conflicting processes

**Use this when:**
- Getting "Port 3000 already in use" errors
- Previous services didn't stop cleanly

#### 9. Reset Database (Dev Only)
Completely resets the database:
- Stops all containers
- Drops the database
- Runs migrations fresh
- Seeds demo data
- Restarts services

**Use this when:**
- Database is corrupted
- You want fresh demo data
- Development only - DO NOT USE IN PRODUCTION

---

## 🐛 Common Issues & Solutions

### Issue: "Command not found: brew"

**Problem:** Homebrew not installed

**Solution:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Or run `bash install-mac.sh` which handles this automatically.

---

### Issue: "command not found: node"

**Problem:** Node.js not installed or not in PATH

**Solution:**
```bash
# Via Homebrew
brew install node

# Or run the install script
bash install-mac.sh
```

---

### Issue: "npm ERR! code ERESOLVE"

**Problem:** npm dependency conflicts

**Solution:**
```bash
npm install --legacy-peer-deps
```

Or use the troubleshooting script:
```bash
bash troubleshoot-mac.sh
# Select option 2: Fix npm Issues
```

---

### Issue: "Docker is not running"

**Problem:** Docker Desktop not started

**Solution:**
```bash
# Start Docker Desktop
open /Applications/Docker.app

# Wait 30 seconds for it to fully start
sleep 30

# Verify it's running
docker ps
```

Or run:
```bash
bash troubleshoot-mac.sh
# Select option 3: Fix Docker Issues
```

---

### Issue: "Port 3000 already in use"

**Problem:** Something else is using port 3000

**Solution:**
```bash
# Find what's using the port
lsof -i :3000

# Kill the process (replace 1234 with actual PID)
kill -9 1234
```

Or use the troubleshooting script:
```bash
bash troubleshoot-mac.sh
# Select option 8: Fix Port Conflicts
```

---

### Issue: "Cannot connect to Docker daemon"

**Problem:** Docker daemon not running properly

**Solution:**
```bash
# Restart Docker
open /Applications/Docker.app

# Or from command line
docker context ls

# If that fails, restart your Mac
```

---

### Issue: npm modules not installing / "ERR! code EACCES"

**Problem:** Permission issues or corrupted modules

**Solution:**
```bash
# Option 1: Use the troubleshooting script
bash troubleshoot-mac.sh
# Select option 5: Clear Caches and Reinstall

# Option 2: Manual fix
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

---

### Issue: "TypeScript error: Cannot find module"

**Problem:** Dependencies not installed properly

**Solution:**
```bash
# Reinstall the specific package workspace
cd apps/api
npm install

cd ../web
npm install

cd ../..
```

---

### Issue: Disk space issues during installation

**Problem:** Docker images or node_modules taking too much space

**Solution:**
```bash
# Clean up Docker
docker image prune -a
docker container prune -f
docker volume prune -f

# Clean up npm
npm cache clean --force

# Check available space
df -h
```

---

## 📊 Detailed Error Messages

### Error: "Homebrew not found"

```
Installing Homebrew...
/bin/bash -c "$(curl -fsSL ...)"
```

This is normal on first installation. The script will install it.

### Error: "npm WARN deprecated"

```
npm WARN deprecated some-package@1.0.0
```

This is usually safe. The script uses `--legacy-peer-deps` to handle these.

### Error: "Docker daemon not responding"

```
Cannot connect to Docker daemon at unix:///var/run/docker.sock
```

**Solution:**
```bash
open /Applications/Docker.app
sleep 30
docker ps
```

### Error: "ENOSPC: no space left on device"

```
ENOSPC: no space left on device
```

Your disk is full. Clean up:
```bash
# Remove old Docker images
docker image prune -a

# Remove old node_modules
find . -type d -name node_modules -exec rm -rf {} +
```

### Error: "Port 3000 already in use"

```
Error: listen EADDRINUSE: address already in use :::3000
```

See "Port 3000 already in use" in [Common Issues](#issue-port-3000-already-in-use) section above.

---

## 🔄 Manual Installation

If the scripts don't work, you can install manually:

### Step 1: Install Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Step 2: Install Node.js

```bash
brew install node
```

Verify:
```bash
node --version  # Should be 18+
npm --version
```

### Step 3: Install Docker

Option A - Docker Desktop (Recommended):
```bash
brew install --cask docker
open /Applications/Docker.app
```

Option B - Homebrew:
```bash
brew install docker docker-compose
```

### Step 4: Install Git

```bash
brew install git
```

### Step 5: Install npm Packages

```bash
cd /Users/dpogrebniuk/QMS

# Root dependencies
npm install

# Backend
cd apps/api && npm install && cd ../..

# Frontend
cd apps/web && npm install && cd ../..

# Shared
cd packages/shared && npm install && cd ../..
```

### Step 6: Setup Environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your configuration
```

### Step 7: Start Docker Services

```bash
docker-compose -f infra/docker-compose.yml up -d
```

### Step 8: Setup Database

```bash
npm run db:migrate:deploy
npm run db:seed
```

### Step 9: Start Development Servers

```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:web
```

---

## 🎯 Next Steps After Installation

1. **Configure Environment Variables**
   ```bash
   nano apps/api/.env
   ```

2. **Start Services**
   ```bash
   docker-compose -f infra/docker-compose.yml up -d
   ```

3. **Setup Database**
   ```bash
   npm run db:migrate:deploy
   npm run db:seed
   ```

4. **Start Development**
   ```bash
   npm run dev:api   # Terminal 1
   npm run dev:web   # Terminal 2
   ```

5. **Access the Application**
   - Web: http://localhost:5173
   - API: http://localhost:3000/api
   - Keycloak: http://localhost:8080

---

## 📞 Getting Help

If you're stuck:

1. **Run the diagnostic:** `bash troubleshoot-mac.sh`
2. **Check this guide:** Look for your error above
3. **Read the logs:** Check the full error message
4. **Consult docs:** See [README.md](./README.md) or [GETTING_STARTED.md](./GETTING_STARTED.md)
5. **Manual setup:** Follow the [Manual Installation](#manual-installation) section

---

## ✅ Verification Checklist

After installation, verify everything works:

```bash
# Check versions
node --version      # Should be 18+
npm --version       # Should be 8+
docker --version    # Should be 20.10+

# Check project structure
ls -la apps/api/node_modules     # Should exist
ls -la apps/web/node_modules     # Should exist
ls -la infra/docker-compose.yml  # Should exist

# Check services
docker ps                         # Should list containers
npm run build:api               # Should compile
npm run build:web               # Should compile

# Test database
npm run db:studio               # Should open Prisma Studio
```

---

## 🎉 Success!

You should now be able to:

✅ Run `npm install` without errors  
✅ Start Docker services with `docker-compose up`  
✅ Run the backend with `npm run dev:api`  
✅ Run the frontend with `npm run dev:web`  
✅ Access the application at http://localhost:5173  

**Happy coding!** 🚀

---

**Questions?** Check [GETTING_STARTED.md](./GETTING_STARTED.md) or the main [README.md](./README.md)
