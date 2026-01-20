# macOS Installation & Troubleshooting Scripts

**Cisco QMS** now includes automated installation scripts for macOS that handle all setup steps and common errors.

## 🚀 Quick Start

```bash
cd /Users/dpogrebniuk/QMS
bash install-mac.sh
```

That's it! The script will:
- ✅ Check and install Homebrew (if needed)
- ✅ Check and install Node.js 18+ (if needed)
- ✅ Check and install Docker (with options)
- ✅ Install all npm dependencies
- ✅ Handle common errors automatically
- ✅ Offer to start services

**Estimated time:** 10-15 minutes

---

## 📦 What's Included

### `install-mac.sh` - Full Installation Script

**Automates:**
1. System requirements check (macOS, disk space)
2. Homebrew installation
3. Node.js 18+ installation (with auto-upgrade)
4. Docker installation (with options)
5. Additional tools (Git, Yarn, PostgreSQL client)
6. Root npm dependencies
7. Backend (NestJS) dependencies
8. Frontend (React) dependencies
9. Shared package dependencies
10. Environment file setup
11. TypeScript verification
12. Docker service startup (optional)

**Features:**
- Colored output with status indicators (✓, ✗, ⚠, ℹ)
- Error handling and recovery
- Fallback strategies (e.g., `--legacy-peer-deps`)
- Clear next steps provided
- Optional Docker startup
- Section-by-section progress display

**Run:**
```bash
bash install-mac.sh
```

---

### `troubleshoot-mac.sh` - Interactive Troubleshooting Menu

**Interactive menu with 9 options:**

1. **Run Full Diagnostic**
   - Checks Node.js, npm, Docker
   - Verifies project structure
   - Checks node_modules
   - Confirms Prisma setup

2. **Fix npm Issues**
   - Clears npm cache
   - Removes corrupted modules
   - Reinstalls all packages
   - Removes lock files

3. **Fix Docker Issues**
   - Verifies Docker installation
   - Starts Docker if stopped
   - Installs docker-compose if missing
   - Cleans up unused containers/images

4. **Fix Node.js Issues**
   - Checks Node.js installation
   - Auto-upgrades if too old
   - Fixes npm installation

5. **Clear Caches & Reinstall**
   - Nuclear option for corruption
   - Clears all caches
   - Removes all modules
   - Complete reinstall

6. **Check Service Status**
   - Lists running Docker containers
   - Shows health status
   - Displays port mappings

7. **View System Information**
   - macOS version
   - Hardware architecture
   - Available resources
   - Installed software versions

8. **Fix Port Conflicts**
   - Identifies port conflicts
   - Shows processes using ports
   - Can kill conflicting processes

9. **Reset Database (Dev Only)**
   - Stops containers
   - Drops database
   - Runs migrations fresh
   - Restarts services

**Run:**
```bash
bash troubleshoot-mac.sh
```

Then select an option from the menu.

---

### `INSTALL_QUICK_REFERENCE.sh` - Quick Lookup Guide

Print the quick reference:
```bash
bash INSTALL_QUICK_REFERENCE.sh
```

Or view as text:
```bash
cat INSTALL_QUICK_REFERENCE.sh
```

Contains:
- Common issues & quick fixes
- Diagnostic commands
- Development commands
- Verification checklist

---

### `INSTALL_MAC_GUIDE.md` - Detailed Documentation

Comprehensive guide covering:
- Installation script details
- Troubleshooting script menu options
- Common issues & solutions
- Detailed error messages
- Manual installation steps
- Getting help

Read it:
```bash
open INSTALL_MAC_GUIDE.md
# or
cat INSTALL_MAC_GUIDE.md | less
```

---

## 🐛 Common Issues & Quick Fixes

### "Port 3000 already in use"
```bash
bash troubleshoot-mac.sh
# Select: 8 (Fix port conflicts)
```

### npm errors
```bash
bash troubleshoot-mac.sh
# Select: 2 (Fix npm issues)
```

### Docker not responding
```bash
bash troubleshoot-mac.sh
# Select: 3 (Fix Docker issues)
```

### Complete fresh install
```bash
bash troubleshoot-mac.sh
# Select: 5 (Clear caches & reinstall)
```

---

## 📋 Installation Flow

```
Start: bash install-mac.sh
  │
  ├─ Check System Requirements
  │   └─ Verify macOS, disk space, architecture
  │
  ├─ Install Homebrew (if needed)
  │   └─ macOS package manager
  │
  ├─ Install Node.js & npm (if needed)
  │   └─ Upgrade if version < 18
  │
  ├─ Install Docker (if needed)
  │   └─ Offer Desktop or CLI version
  │
  ├─ Install Additional Tools
  │   └─ Git, Yarn, PostgreSQL client
  │
  ├─ Clean npm Cache
  │   └─ Remove old/corrupted cache
  │
  ├─ Install Dependencies
  │   ├─ Root: npm install
  │   ├─ API: npm install
  │   ├─ Web: npm install
  │   └─ Shared: npm install
  │
  ├─ Setup Environment Files
  │   └─ Create .env from .env.example
  │
  ├─ Verify Installation
  │   ├─ TypeScript compilation check
  │   └─ Docker status
  │
  └─ Offer to Start Services
      └─ docker-compose up -d
```

---

## ✅ After Installation

1. **Configure environment variables:**
   ```bash
   nano apps/api/.env
   ```

2. **Start services (if not already running):**
   ```bash
   docker-compose -f infra/docker-compose.yml up -d
   ```

3. **Setup database:**
   ```bash
   npm run db:migrate:deploy
   npm run db:seed
   ```

4. **Start development servers:**
   ```bash
   # Terminal 1
   npm run dev:api
   
   # Terminal 2
   npm run dev:web
   ```

5. **Access the app:**
   - Web: http://localhost:5173
   - API: http://localhost:3000/api
   - Keycloak: http://localhost:8080

---

## 🔍 Diagnostic Commands

Check what's installed:
```bash
node --version      # Node.js
npm --version       # npm
docker --version    # Docker
docker-compose --version  # Docker Compose
```

Check Docker:
```bash
docker ps                  # Running containers
docker-compose -f infra/docker-compose.yml ps  # QMS services
```

Check project:
```bash
ls -la node_modules        # Root modules
ls -la apps/api/node_modules     # Backend modules
ls -la apps/web/node_modules     # Frontend modules
```

View project logs:
```bash
docker-compose -f infra/docker-compose.yml logs api
docker-compose -f infra/docker-compose.yml logs postgres
docker-compose -f infra/docker-compose.yml logs -f  # Follow logs
```

---

## 🛠️ Script Features

### Error Handling
- **Automatic recovery** for common issues
- **Fallback strategies** (e.g., `--legacy-peer-deps`)
- **Clear error messages** with solutions
- **Retry logic** for transient failures

### User Experience
- **Interactive prompts** for decisions
- **Colored output** for easy reading
- **Progress indicators** (ℹ ✓ ⚠ ✗)
- **Section headers** showing progress
- **Estimated times** for operations

### Robustness
- **Pre-flight checks** before installing
- **Version verification** (Node 18+, npm 8+)
- **Architecture detection** (Apple Silicon vs Intel)
- **Disk space checking**
- **Permission verification**

---

## 📖 Documentation

Related files:
- [README.md](./README.md) - Project overview
- [INSTALL_MAC_GUIDE.md](./INSTALL_MAC_GUIDE.md) - Detailed guide
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Development setup
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Command reference

---

## 🎯 Use Cases

### First-time setup
```bash
bash install-mac.sh
```

### Something's broken
```bash
bash troubleshoot-mac.sh
# Select: 1 (Full diagnostic)
```

### npm not working
```bash
bash troubleshoot-mac.sh
# Select: 2 (Fix npm issues)
```

### Docker won't start
```bash
bash troubleshoot-mac.sh
# Select: 3 (Fix Docker issues)
```

### Fresh start
```bash
bash troubleshoot-mac.sh
# Select: 5 (Clear & reinstall)
```

### Port conflict
```bash
bash troubleshoot-mac.sh
# Select: 8 (Fix port conflicts)
```

---

## 📊 Script Statistics

| Script | Size | Lines | Purpose |
|--------|------|-------|---------|
| `install-mac.sh` | 19 KB | 500+ | Full installation |
| `troubleshoot-mac.sh` | 14 KB | 350+ | Troubleshooting |
| `INSTALL_MAC_GUIDE.md` | 25 KB | 600+ | Documentation |
| `INSTALL_QUICK_REFERENCE.sh` | 12 KB | 300+ | Quick lookup |

---

## 🚀 Starting Development

Once installed, start a full development session:

```bash
# Terminal 1: Docker services
docker-compose -f infra/docker-compose.yml up

# Terminal 2: Backend (watches for changes)
npm run dev:api

# Terminal 3: Frontend (watches for changes)
npm run dev:web

# Terminal 4: Database management (optional)
npm run db:studio

# Browser:
# http://localhost:5173 (Frontend)
# http://localhost:3000/api (API)
# http://localhost:8080 (Keycloak)
```

---

## ✨ Key Features

✅ **Automated** - One-command setup  
✅ **Robust** - Handles errors gracefully  
✅ **Flexible** - Works with existing installations  
✅ **Informative** - Colored output shows progress  
✅ **Recoverable** - Multiple recovery strategies  
✅ **Intelligent** - Detects and fixes issues  
✅ **Fast** - ~10-15 minutes for fresh install  
✅ **Documented** - Comprehensive guides included  

---

## 🆘 Need Help?

1. **Check quick reference:**
   ```bash
   bash INSTALL_QUICK_REFERENCE.sh
   ```

2. **Run troubleshooting:**
   ```bash
   bash troubleshoot-mac.sh
   ```

3. **Read detailed guide:**
   ```bash
   open INSTALL_MAC_GUIDE.md
   ```

4. **Check project docs:**
   - [README.md](./README.md)
   - [GETTING_STARTED.md](./GETTING_STARTED.md)
   - [API.md](./API.md)

---

**Ready to get started?**

```bash
bash install-mac.sh
```

Happy coding! 🎉
