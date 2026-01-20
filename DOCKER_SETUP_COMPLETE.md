# Docker Installation Complete ✅

## System Status

All Cisco QMS services are now running in Docker containers!

### Running Services

| Service | Port | Status | URL |
|---------|------|--------|-----|
| **API (NestJS)** | 3000 | ✅ Running | http://localhost:3000 |
| **Web (React)** | 5173 | ✅ Running | http://localhost:5173 |
| **Keycloak** | 8080 | ✅ Running | http://localhost:8080 |
| **PostgreSQL** | 5432 | ✅ Running | postgres://qms_user@localhost:5432/qms |
| **Redis** | 6379 | ✅ Running | redis://localhost:6379 |
| **OpenSearch** | 9200 | ✅ Running | http://localhost:9200 |
| **Nginx** | 80/443 | ✅ Running | (reverse proxy) |

## Installation Issues Fixed

### 1. **TypeScript Configuration**
- ✅ Fixed: Added DOM and DOM.Iterable to root tsconfig.json lib
- ✅ Fixed: Created tsconfig.json for shared package
- ✅ Fixed: Removed unused Box import from Dashboard.tsx
- ✅ Fixed: Made localStorage access safe with feature detection

### 2. **Docker Build**
- ✅ Updated from Node 18 to Node 20 in both Dockerfiles
- ✅ Switched from `npm ci` to `npm install --legacy-peer-deps`
- ✅ Added OpenSSL and dependencies to API container
- ✅ Fixed Prisma generation in Docker runtime
- ✅ Added fallback from compiled JS to ts-node

### 3. **Prisma Migration**
- ✅ Fixed SQL syntax error in migration: duplicate `ON` clause in CREATE INDEX
- ✅ Reset database from clean state
- ✅ Migration now applies successfully

### 4. **Package Dependencies**
- ✅ Added missing `@nestjs/schedule` to API package.json

## Quick Start Commands

### View Logs
```bash
# API logs
docker logs qms-api -f

# Web logs
docker logs qms-web -f

# All services
docker-compose -f infra/docker-compose.yml logs -f
```

### Restart Services
```bash
# Full restart
docker-compose -f infra/docker-compose.yml restart

# Individual service
docker-compose -f infra/docker-compose.yml restart qms-api
```

### Stop All Services
```bash
docker-compose -f infra/docker-compose.yml stop
```

### Clean Up (removes all data)
```bash
docker-compose -f infra/docker-compose.yml down -v
```

## Access the Application

### Frontend
- **URL**: http://localhost:5173
- **Default Credentials**: Check GETTING_STARTED.md

### API Documentation
- **Swagger UI**: http://localhost:3000/api
- **Health Check**: http://localhost:3000

### Keycloak Admin
- **URL**: http://localhost:8080
- **Admin Console**: http://localhost:8080/admin
- **Credentials**: admin / admin (default, change in production!)

### Database
- **Host**: localhost
- **Port**: 5432
- **Database**: qms
- **Username**: qms_user
- **Password**: qms_password_secure

### OpenSearch
- **URL**: http://localhost:9200
- **Cluster Health**: http://localhost:9200/_cluster/health

## Next Steps

1. **Configure Environment**
   ```bash
   nano apps/api/.env
   ```
   Update with actual:
   - Keycloak credentials
   - UCCX integration settings
   - MediaSense API keys
   - Email service settings

2. **Seed Database** (optional, if seed script exists)
   ```bash
   docker exec qms-api npx prisma db seed
   ```

3. **Verify API Health**
   ```bash
   curl http://localhost:3000
   ```

4. **Start Development**
   - API develops with hot-reload in container
   - Web frontend with live updates at http://localhost:5173
   - Changes are reflected immediately

## Troubleshooting

### API Container Won't Start
```bash
docker logs qms-api
```
Check for:
- Database connection errors
- Missing .env file
- Port 3000 already in use

### Web Won't Load
```bash
docker logs qms-web
```
Check if API is responding: http://localhost:3000

### Database Connection Issues
```bash
docker exec qms-postgres psql -U qms_user -d qms -c '\dt'
```

### Port Already in Use
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Restart Everything
```bash
cd /Users/dpogrebniuk/QMS
docker-compose -f infra/docker-compose.yml down
docker-compose -f infra/docker-compose.yml up -d
```

## System Requirements Met

✅ **Node.js**: v20.20.0 (installed locally)
✅ **Docker**: v29.1.3 (verified working)
✅ **Docker Compose**: v5.0.1 (verified working)
✅ **PostgreSQL**: 15-alpine (running in container)
✅ **Redis**: 7-alpine (running in container)
✅ **macOS**: Sonoma+ (Apple Silicon compatible)
✅ **Disk Space**: 33GB available (sufficient)

## Architecture

The system uses a multi-container architecture:

```
┌─────────────────────────────────────────────┐
│              Nginx Reverse Proxy             │
│           (Port 80 / 443)                   │
├──────────────┬──────────────┬───────────────┤
│              │              │               │
v              v              v               v
Web (5173)  API (3000)   Keycloak(8080)  Static Files
│              │
├─────┬────────┴─────┬────────────┐
│     │              │            │
v     v              v            v
Redis PostgreSQL OpenSearch  Seed Data
(6379) (5432)    (9200)
```

## Production Readiness

Current setup is **development-ready** but needs for production:

- [ ] Remove default passwords from .env
- [ ] Configure TLS/SSL certificates
- [ ] Set proper CORS origins
- [ ] Configure authentication providers
- [ ] Setup log aggregation
- [ ] Configure backup strategy
- [ ] Performance tuning
- [ ] Security scanning

See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup.

---

**Installation Date**: January 19, 2026
**Status**: ✅ Complete and Running
**Next Review**: Check logs after extended use
