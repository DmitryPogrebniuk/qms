# QMS Installation Guide for Ubuntu Linux

Complete installation and deployment guide for Ubuntu Linux (minimal installation).

## Quick Start

```bash
# Download and run the installation script
wget https://raw.githubusercontent.com/your-org/qms/main/install-ubuntu.sh
sudo bash install-ubuntu.sh
```

## Prerequisites

- **OS**: Ubuntu 20.04, 22.04, or 24.04 LTS (minimal installation)
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk**: Minimum 20GB free space
- **Network**: Internet connection for downloading packages
- **Root Access**: sudo privileges required

## What Gets Installed

The installation script automatically installs and configures:

1. **Docker & Docker Compose** - Container runtime
2. **Git** - For cloning the repository
3. **QMS Application** - All services in Docker containers:
   - NestJS API (Node.js 18)
   - React Frontend (Vite)
   - PostgreSQL 15
   - Redis 7
   - OpenSearch 2.11
4. **Security Tools**:
   - UFW (firewall)
   - Fail2ban
   - Self-signed SSL certificate
5. **Systemd Service** - Auto-start on boot

## Installation Options

### Option 1: Automated Installation (Recommended)

```bash
# Download the script
wget https://raw.githubusercontent.com/your-org/qms/main/install-ubuntu.sh

# Make it executable
chmod +x install-ubuntu.sh

# Run with sudo
sudo ./install-ubuntu.sh
```

### Option 2: Clone Repository First

```bash
# Clone the repository
git clone https://github.com/your-org/qms.git
cd qms

# Run installation script
sudo bash install-ubuntu.sh
```

### Option 3: Manual Installation

See [MANUAL_INSTALL.md](MANUAL_INSTALL.md) for step-by-step manual installation.

## Installation Process

The script performs these steps:

1. ✅ Check OS compatibility
2. ✅ Install system dependencies
3. ✅ Install Docker and Docker Compose
4. ✅ Create `qms` system user
5. ✅ Clone/copy application code to `/opt/qms`
6. ✅ Generate secure secrets (JWT, passwords)
7. ✅ Create environment configuration
8. ✅ Generate self-signed SSL certificate
9. ✅ Configure firewall (UFW)
10. ✅ Build and start Docker containers
11. ✅ Run database migrations
12. ✅ Seed initial admin user
13. ✅ Create systemd service for auto-start
14. ✅ Display access information

## Post-Installation Configuration

### 1. Access the Application

After installation completes, access the application:

- **Frontend**: `http://YOUR_SERVER_IP:5173`
- **API**: `http://YOUR_SERVER_IP:3000`
- **API Docs**: `http://YOUR_SERVER_IP:3000/api`

**Default Credentials**:
- Username: `admin`
- Password: `admin123`

⚠️ **IMPORTANT**: Change the default password immediately!

### 2. Update Environment Configuration

Edit `/opt/qms/apps/api/.env` to configure:

```bash
sudo nano /opt/qms/apps/api/.env
```

**UCCX Configuration** (if available):
```env
UCCX_HOST=your-uccx-server.example.com
UCCX_USERNAME=admin
UCCX_PASSWORD=your_password
UCCX_SYNC_ENABLED=true
```

**MediaSense Configuration** (if available):
```env
MEDIASENSE_HOST=your-mediasense-server.example.com
MEDIASENSE_USERNAME=admin
MEDIASENSE_PASSWORD=your_password
```

**Keycloak Configuration** (optional):
```env
KEYCLOAK_ISSUER=https://your-keycloak.example.com
KEYCLOAK_CLIENT_ID=qms
KEYCLOAK_CLIENT_SECRET=your_secret
KEYCLOAK_ENABLED=true
```

After editing, restart services:
```bash
sudo systemctl restart qms
```

### 3. Configure SSL Certificate (Production)

For production, replace the self-signed certificate with a trusted one:

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/qms/infra/nginx/ssl/qms.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/qms/infra/nginx/ssl/qms.key

# Restart services
sudo systemctl restart qms
```

#### Option B: Use Your Own Certificate

```bash
# Copy your certificate and key
sudo cp your-certificate.crt /opt/qms/infra/nginx/ssl/qms.crt
sudo cp your-private-key.key /opt/qms/infra/nginx/ssl/qms.key

# Set permissions
sudo chmod 644 /opt/qms/infra/nginx/ssl/qms.crt
sudo chmod 600 /opt/qms/infra/nginx/ssl/qms.key

# Restart services
sudo systemctl restart qms
```

### 4. Configure Firewall

The installation script configures UFW with these rules:

```bash
# View current rules
sudo ufw status

# Allow additional ports if needed
sudo ufw allow 8080/tcp  # Example: Keycloak
```

For production, remove development ports:
```bash
sudo ufw delete allow 3000/tcp
sudo ufw delete allow 5173/tcp
```

## Service Management

### Systemd Commands

```bash
# Check status
sudo systemctl status qms

# Start services
sudo systemctl start qms

# Stop services
sudo systemctl stop qms

# Restart services
sudo systemctl restart qms

# Enable auto-start on boot (already done by installer)
sudo systemctl enable qms

# Disable auto-start
sudo systemctl disable qms
```

### Docker Commands

```bash
# Navigate to installation directory
cd /opt/qms

# View running containers
docker compose -f infra/docker-compose.yml ps

# View logs
docker compose -f infra/docker-compose.yml logs -f

# View logs for specific service
docker compose -f infra/docker-compose.yml logs -f api

# Restart specific service
docker compose -f infra/docker-compose.yml restart api

# Stop all services
docker compose -f infra/docker-compose.yml down

# Start all services
docker compose -f infra/docker-compose.yml up -d

# Rebuild and restart
docker compose -f infra/docker-compose.yml up -d --build
```

## Backup and Restore

### Backup Database

```bash
# Create backup directory
mkdir -p /opt/qms-backups

# Backup PostgreSQL
docker compose -f /opt/qms/infra/docker-compose.yml exec -T postgres \
  pg_dump -U qms_user qms | gzip > /opt/qms-backups/qms-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup environment files
cp /opt/qms/apps/api/.env /opt/qms-backups/env-$(date +%Y%m%d-%H%M%S).backup
```

### Restore Database

```bash
# Restore from backup
gunzip -c /opt/qms-backups/qms-20260120-120000.sql.gz | \
  docker compose -f /opt/qms/infra/docker-compose.yml exec -T postgres \
  psql -U qms_user qms
```

### Automated Backups

Create a cron job for daily backups:

```bash
# Edit crontab
sudo crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/qms/scripts/backup.sh
```

## Monitoring

### View Logs

```bash
# All services
cd /opt/qms && docker compose -f infra/docker-compose.yml logs -f

# API only
docker logs -f qms-api

# Database only
docker logs -f qms-postgres

# Follow last 100 lines
docker logs --tail 100 -f qms-api
```

### Check Resource Usage

```bash
# Container stats
docker stats

# Disk usage
df -h
docker system df

# Memory usage
free -h
```

## Updating the Application

### Pull Latest Changes

```bash
# Navigate to installation directory
cd /opt/qms

# Pull latest code
sudo -u qms git pull origin main

# Rebuild and restart
sudo docker compose -f infra/docker-compose.yml up -d --build

# Run migrations
sudo docker compose -f infra/docker-compose.yml exec api npx prisma migrate deploy
```

### Update Docker Images

```bash
cd /opt/qms

# Pull latest base images
docker compose -f infra/docker-compose.yml pull

# Rebuild
docker compose -f infra/docker-compose.yml up -d --build
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker status
sudo systemctl status docker

# Check container logs
cd /opt/qms
docker compose -f infra/docker-compose.yml logs

# Check if ports are in use
sudo netstat -tulpn | grep -E ':(3000|5173|5432|6379|9200)'
```

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker logs qms-postgres

# Test database connection
docker compose -f /opt/qms/infra/docker-compose.yml exec postgres \
  psql -U qms_user -d qms -c "SELECT 1;"
```

### API Not Responding

```bash
# Check API logs
docker logs qms-api --tail 50

# Restart API
docker restart qms-api

# Check environment variables
docker compose -f /opt/qms/infra/docker-compose.yml exec api env | grep -E '(DATABASE|REDIS|JWT)'
```

### Frontend Not Loading

```bash
# Check web container
docker logs qms-web

# Rebuild frontend
cd /opt/qms
docker compose -f infra/docker-compose.yml up -d --build web
```

### Disk Space Issues

```bash
# Check disk usage
df -h
docker system df

# Clean up Docker
docker system prune -a --volumes

# Clean old images
docker image prune -a
```

## Security Hardening

### Change Default Passwords

1. **Admin User**: Login to web interface and change password
2. **Database**: Update `DATABASE_URL` in `.env` and docker-compose.yml
3. **Redis**: Update `REDIS_PASSWORD` in `.env` and docker-compose.yml

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Enable Fail2ban

```bash
# Install fail2ban (already installed by script)
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status
```

### Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker
sudo apt install docker-ce docker-ce-cli containerd.io

# Reboot if kernel updated
sudo reboot
```

## Uninstallation

To completely remove QMS:

```bash
# Stop and remove services
sudo systemctl stop qms
sudo systemctl disable qms
sudo rm /etc/systemd/system/qms.service
sudo systemctl daemon-reload

# Remove Docker containers and volumes
cd /opt/qms
docker compose -f infra/docker-compose.yml down -v

# Remove installation directory
sudo rm -rf /opt/qms

# Remove user (optional)
sudo userdel -r qms

# Remove Docker (optional)
sudo apt remove docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo rm -rf /var/lib/docker
```

## Performance Tuning

### PostgreSQL Optimization

Edit `/opt/qms/infra/docker-compose.yml` and add:

```yaml
postgres:
  command: 
    - "postgres"
    - "-c"
    - "shared_buffers=256MB"
    - "-c"
    - "effective_cache_size=1GB"
    - "-c"
    - "max_connections=200"
```

### OpenSearch Optimization

For production workloads:

```yaml
opensearch:
  environment:
    - "OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m"  # Adjust based on available RAM
```

## Support

- **Documentation**: `/opt/qms/README.md`
- **Architecture**: `/opt/qms/ARCHITECTURE.md`
- **API Documentation**: `http://YOUR_SERVER:3000/api`
- **Issues**: GitHub Issues
- **Community**: Discord/Slack (update with your links)

## License

See [LICENSE](LICENSE) file for details.
