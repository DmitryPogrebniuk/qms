# How to Push QMS to GitHub

## ✅ Repository Successfully Deployed

Your QMS project is now live at:  
**https://github.com/DmitryPogrebniuk/qms**

## Repository Information

- **Repository URL**: `https://github.com/DmitryPogrebniuk/qms.git`
- **Branch**: `main`
- **Files Committed**: 130 files (23,965 lines of code)
- **Status**: ✅ All files pushed successfully

## What Was Done

1. ✅ Initialized git repository with main branch
2. ✅ Committed all project files (API, frontend, tests, documentation)
3. ✅ Added remote origin to GitHub
4. ✅ Pushed code to https://github.com/DmitryPogrebniuk/qms
5. ✅ Updated installation script with correct repository URL
git push -u origin main
```

### 3. Verify

Visit your repository: `https://github.com/YOUR_USERNAME/qms`

## Alternative: GitLab

If you prefer GitLab:

```bash
cd /Users/dpogrebniuk/QMS

# Add GitLab as remote
git remote add origin https://gitlab.com/YOUR_USERNAME/qms.git

# Push code
git push -u origin main
```

## Alternative: Bitbucket

If you prefer Bitbucket:

```bash
cd /Users/dpogrebniuk/QMS

# Add Bitbucket as remote
git remote add origin https://bitbucket.org/YOUR_USERNAME/qms.git

# Push code
git push -u origin main
```

## Update Installation Script

After pushing to GitHub, update the repository URL in:

**File:** `install-ubuntu.sh`

Change line 14:
```bash
QMS_REPO="https://github.com/YOUR_USERNAME/qms.git"
```

Then commit and push the update:
```bash
git add install-ubuntu.sh
git commit -m "Update repository URL in installation script"
git push
```

## Current Git Status

✅ **Local repository initialized**
✅ **130 files committed** (23,965 lines of code)
✅ **Branch**: main
✅ **.gitignore configured** (excludes .env, node_modules, etc.)
✅ **Ready to push**

## What's Included

Your repository contains:

📁 **Application Code**
- NestJS API (TypeScript)
- React Frontend (Vite)
- Prisma Database Schema
- Docker Configuration

📁 **Documentation**
- README.md
- ARCHITECTURE.md
- API.md
- GETTING_STARTED.md
- DEPLOYMENT.md
- INSTALL_UBUNTU.md

📁 **Installation Scripts**
- install-ubuntu.sh (automated installer)
- install-mac.sh
- run-tests.sh

📁 **Testing**
- Unit tests (Vitest)
- E2E tests (Playwright)
- CI/CD workflow (GitHub Actions)

📁 **Infrastructure**
- Docker Compose configuration
- Nginx configuration
- Dockerfiles

## Recommended GitHub Settings

After pushing, configure these on GitHub:

### 1. Add Repository Topics

Go to your repo → About → Settings (⚙️) → Add topics:
- `nestjs`
- `react`
- `typescript`
- `docker`
- `quality-management`
- `cisco`
- `uccx`
- `contact-center`
- `call-recording`

### 2. Enable GitHub Actions

The repository includes a CI/CD workflow at `.github/workflows/web-tests.yml`.
It will automatically run tests on every push/PR.

### 3. Add Branch Protection (Optional)

Settings → Branches → Add rule:
- Branch name pattern: `main`
- ✅ Require pull request reviews
- ✅ Require status checks to pass

### 4. Create Releases

After your first push:
```bash
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

Then create a release on GitHub:
- Go to Releases → Draft a new release
- Choose tag: v1.0.0
- Add release notes

## Clone on Remote Server

After pushing, anyone can install on Ubuntu:

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/qms.git
cd qms

# Run installer
sudo bash install-ubuntu.sh
```

## Update Repository

When you make changes:

```bash
cd /Users/dpogrebniuk/QMS

# Check what changed
git status

# Stage changes
git add .

# Commit
git commit -m "Your commit message"

# Push to GitHub
git push
```

## Troubleshooting

### Authentication Error

If you get authentication errors when pushing:

**Option 1: Personal Access Token (Recommended)**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use token as password when pushing

**Option 2: SSH Key**
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub
cat ~/.ssh/id_ed25519.pub
# Copy output and add to GitHub → Settings → SSH keys

# Change remote to SSH
git remote set-url origin git@github.com:YOUR_USERNAME/qms.git
```

### Large Files Warning

If you get warnings about large files, check:
```bash
find . -type f -size +50M
```

Add large files to `.gitignore` if they shouldn't be in the repo.

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Update `install-ubuntu.sh` with your repo URL
3. ✅ Add README badges (build status, license)
4. ✅ Create CONTRIBUTING.md for contributors
5. ✅ Add LICENSE file
6. ✅ Test installation from remote server
7. ✅ Share repository URL

## Repository URL Format

After pushing, your repository will be accessible at:

**HTTPS:**
```
https://github.com/YOUR_USERNAME/qms
```

**Git Clone:**
```
git clone https://github.com/YOUR_USERNAME/qms.git
```

**Installation Command:**
```bash
wget https://raw.githubusercontent.com/YOUR_USERNAME/qms/main/install-ubuntu.sh
sudo bash install-ubuntu.sh
```

---

**Need help?** Open an issue on GitHub after pushing your repository.
