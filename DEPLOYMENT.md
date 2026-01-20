## Deployment Guide

### Prerequisites

- **OS**: Ubuntu 22.04 LTS (recommended)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Linux Kernel**: 5.15+
- **Memory**: Minimum 8GB RAM
- **Disk**: Minimum 50GB SSD
- **Network**: HTTPS/TLS support required

### 1. Server Preparation

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 2. Clone Repository

```bash
# Clone QMS repository
git clone <repo-url> /opt/qms
cd /opt/qms

# Set permissions
sudo chown -R $USER:$USER /opt/qms
```

### 3. SSL/TLS Certificate Setup

Generate self-signed certificate (development):
```bash
mkdir -p infra/nginx/ssl

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout infra/nginx/ssl/qms.key \
  -out infra/nginx/ssl/qms.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=qms.example.com"
```

Or use Let's Encrypt (production):
```bash
sudo apt-get install -y certbot

sudo certbot certonly --standalone \
  -d qms.example.com \
  -d api.example.com

# Copy certificates
sudo cp /etc/letsencrypt/live/qms.example.com/fullchain.pem infra/nginx/ssl/qms.crt
sudo cp /etc/letsencrypt/live/qms.example.com/privkey.pem infra/nginx/ssl/qms.key
sudo chown $USER:$USER infra/nginx/ssl/*
```

### 4. Environment Configuration

Create production `.env` file:

```bash
cp apps/api/.env.example apps/api/.env.production

# Edit with production values
nano apps/api/.env.production
```

Key production settings:
```env
NODE_ENV=production
KEYCLOAK_ISSUER=https://keycloak.example.com
UCCX_HOST=uccx.internal.company.com
MEDIASENSE_HOST=mediasense.internal.company.com
OPENSEARCH_PASSWORD=<strong-password>
JWT_SECRET=<generate-with-openssl-rand-hex-32>
```

Generate secure JWT secret:
```bash
openssl rand -hex 32
```

### 5. Database Backup Strategy

```bash
# Create backup directory
mkdir -p /backups/qms

# Setup automated backups
cat > /home/user/backup-qms.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/qms"
DATE=$(date +%Y%m%d_%H%M%S)

docker-compose -f /opt/qms/infra/docker-compose.yml exec -T postgres \
  pg_dump -U qms_user qms | gzip > $BACKUP_DIR/qms_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "qms_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /home/user/backup-qms.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/user/backup-qms.sh
```

### 6. Container Startup

```bash
# Build images
docker-compose -f infra/docker-compose.yml build

# Start services
docker-compose -f infra/docker-compose.yml up -d

# Verify services are healthy
docker-compose -f infra/docker-compose.yml ps

# Run database migrations
docker-compose -f infra/docker-compose.yml exec api npm run db:migrate:deploy

# Seed demo data (optional)
docker-compose -f infra/docker-compose.yml exec api npm run db:seed
```

### 7. Firewall Configuration

```bash
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5432/tcp  # PostgreSQL (internal only)
sudo ufw allow 6379/tcp  # Redis (internal only)
sudo ufw allow 9200/tcp  # OpenSearch (internal only)
```

### 8. Monitoring & Logging

```bash
# View logs
docker-compose logs -f api
docker-compose logs -f postgres

# Export logs to file
docker-compose logs api > /var/log/qms-api.log

# Setup log rotation
cat > /etc/logrotate.d/qms << 'EOF'
/var/log/qms-*.log {
  daily
  rotate 30
  compress
  delaycompress
  notifempty
  create 0640 root root
}
EOF
```

### 9. Health Checks

```bash
# API health
curl -k https://qms.example.com/api/health

# Database connectivity
docker-compose exec postgres psql -U qms_user -d qms -c "SELECT 1"

# Redis connectivity
docker-compose exec redis redis-cli ping

# OpenSearch connectivity
curl -k -u admin:password https://opensearch:9200/_cluster/health
```

### 10. Backup Verification

```bash
# Test restore procedure (on backup system)
gunzip < qms_backup.sql.gz | psql -U qms_user -d qms_test
```

### 11. Regular Maintenance

```bash
# Monthly container cleanup
docker system prune -a

# Update containers
docker-compose pull
docker-compose up -d

# Database optimization (weekly)
docker-compose exec postgres psql -U qms_user -d qms -c "VACUUM ANALYZE;"

# OpenSearch index cleanup (monthly)
# Keep last 90 days of indices
```

### 12. Performance Tuning

**PostgreSQL**:
```bash
# Edit docker-compose.yml environment section
POSTGRES_INIT_ARGS: "-c shared_buffers=256MB -c max_connections=200"
```

**Redis**:
```bash
# Set max memory
docker-compose exec redis redis-cli CONFIG SET maxmemory 512mb
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

**OpenSearch**:
```bash
OPENSEARCH_JAVA_OPTS: -Xms1g -Xmx1g  # Adjust for your system
```

### 13. Disaster Recovery Plan

**Recovery Procedures**:

1. **Full System Recovery**:
```bash
# Stop services
docker-compose down

# Restore database
gunzip < /backups/qms/qms_latest.sql.gz | psql -U qms_user -d qms

# Start services
docker-compose up -d
```

2. **Database-Only Recovery**:
```bash
# Backup current database
docker-compose exec postgres pg_dump -U qms_user qms > current_backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U qms_user < backup.sql

# Restart
docker-compose restart api
```

3. **RTO/RPO Target**:
- **RTO** (Recovery Time Objective): < 30 minutes
- **RPO** (Recovery Point Objective): < 1 hour

### 14. Security Hardening

```bash
# Disable container access from outside
docker-compose down
# Edit firewall to restrict PostgreSQL/Redis/OpenSearch ports

# Enable audit logging
docker-compose exec api npm run audit:enable

# Rotate JWT secret periodically
# Update .env and restart: docker-compose restart api

# Keep images updated
docker pull postgres:15-alpine
docker pull redis:7-alpine
docker-compose build --no-cache
```

### 15. Scaling for Production

For high availability:

1. **Database Replication**:
```yaml
  postgres-replica:
    image: postgres:15-alpine
    environment:
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_REPLICATION_USER: replicator
```

2. **Load Balancing**:
```yaml
  haproxy:
    image: haproxy:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
```

3. **Kubernetes Migration**:
   - Architecture is K8s-ready
   - Helm charts available in `/infra/helm`
   - See K8S_DEPLOYMENT.md for details

### Troubleshooting

**Services won't start**:
```bash
docker-compose logs api
docker system df  # Check disk space
```

**Database migration fails**:
```bash
docker-compose exec postgres dropdb -U qms_user qms
docker-compose exec postgres createdb -U qms_user qms
docker-compose exec api npm run db:migrate:deploy
```

**Out of memory**:
```bash
# Increase Docker resource limits
# Edit /etc/docker/daemon.json
{
  "memory": "8g",
  "memory-swap": "16g"
}
```

### Support & Maintenance

- **Updates**: Check GitHub for releases
- **Security**: Subscribe to security advisories
- **Backups**: Test restore procedures monthly
- **Monitoring**: Setup alerts for disk/memory usage

---

For additional help, check README.md and API.md
