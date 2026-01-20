# Cisco QMS - Quick Reference Card

## 🚀 Startup Commands

```bash
# Development environment
npm install                          # Install all dependencies
docker-compose -f infra/docker-compose.yml up -d  # Start services
npm run db:migrate:deploy           # Apply database migrations
npm run db:seed                     # Load demo data (optional)

# Access URLs
Web UI:        http://localhost:5173
API Docs:      http://localhost:3000/api
Keycloak:      http://localhost:8080
PostgreSQL:    localhost:5432
Redis:         localhost:6379
OpenSearch:    localhost:9200

# Default Credentials
Username: admin
Password: admin123
```

## 💻 Development Commands

```bash
# Watch mode for hot reload
npm run dev:api                     # Backend (NestJS)
npm run dev:web                     # Frontend (Vite)

# Database operations
npm run db:studio                   # Open Prisma Studio UI
npm run db:migrate:dev --name <name>  # Create migration
npm run db:reset                    # Reset dev database
npm run db:seed                     # Seed demo data

# Linting & formatting
npm run lint                        # ESLint check
npm run format                      # Prettier format
npm test                           # Run Jest tests
npm test -- --watch               # Watch mode

# Build for production
npm run build:api                  # Build backend
npm run build:web                  # Build frontend
```

## 📁 Key Files & Locations

```
Database Schema          → apps/api/prisma/schema.prisma
API Routes              → apps/api/src/modules/*/controller
Authentication          → apps/api/src/modules/auth/
RBAC Guards             → apps/api/src/common/guards/
Frontend Pages          → apps/web/src/pages/
API Client              → apps/web/src/services/api.ts
Configuration           → apps/api/.env
Translations (UK)       → apps/web/src/locales/uk.json
Translations (EN)       → apps/web/src/locales/en.json
Docker Services         → infra/docker-compose.yml
Nginx Config            → infra/nginx/nginx.conf
```

## 🔐 RBAC Roles

| Role | Access Level | Permissions |
|------|--------------|-------------|
| ADMIN | Full system | Everything |
| QA | Team recordings | Search, evaluate, create evaluations |
| SUPERVISOR | Team-scoped | Profile, team recordings, coaching |
| USER | Own data | Own recordings, profile |

## 📡 API Endpoints Quick List

```
Auth:
  POST /api/auth/verify-token
  POST /api/auth/refresh

Users:
  GET /api/users/profile
  GET /api/users/agents
  GET /api/users/teams

Recordings:
  GET /api/recordings/search?q=&agent=&team=&from=&to=
  GET /api/recordings/:id
  GET /api/recordings/:id/stream

Evaluations:
  POST /api/evaluations
  GET /api/evaluations
  PUT /api/evaluations/:id/submit

Coaching:
  POST /api/coaching/plans
  GET /api/coaching/plans
  PATCH /api/coaching/plans/:id/status

Sampling:
  GET /api/sampling/qa-worklist
  PUT /api/sampling/records/:id/evaluate
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3000 in use | `lsof -i :3000` then `kill -9 <PID>` |
| Docker not starting | `sudo systemctl start docker` |
| DB migration failed | `npm run db:reset` then `npm run db:migrate:deploy` |
| Services won't connect | `docker-compose logs <service>` to check logs |
| Keycloak not responding | Wait 30s, check http://localhost:8080 |
| Frontend not loading | Check `npm run dev:web` terminal for errors |

## 📊 Module Structure

```
Backend Modules:
  auth/              → Keycloak OIDC, JWT tokens
  users/             → Profile, agents, teams
  recordings/        → Search + streaming
  chats/             → CCP integration
  evaluations/       → Scorecards + workflow
  coaching/          → Action plans
  sampling/          → QA sampling engine
  uccx/              → Directory + stats sync
  media-sense/       → Streaming + ingestion
  opensearch/        → Full-text search
```

## 🔗 Integration Points

```
UCCX 15:
  - Teams, agents, skills directory sync
  - Daily historical statistics import
  - Connection: HTTPS (self-signed cert supported)

MediaSense 11.5:
  - Recording metadata incremental ingestion
  - Audio stream proxy for playback
  - Connection: HTTPS (self-signed cert supported)

Keycloak 22:
  - OIDC authentication
  - User sync to database
  - LDAP/AD federation ready

CCP 15:
  - Chat metadata ingestion (stub ready)
  - Real-time status integration (future)
```

## 🏗 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/qms

# Auth
KEYCLOAK_ISSUER=http://keycloak:8080
KEYCLOAK_REALM=qms
JWT_SECRET=<generate-with-openssl>

# UCCX
UCCX_HOST=uccx.company.com
UCCX_PORT=8443
UCCX_USERNAME=admin
UCCX_PASSWORD=password

# MediaSense
MEDIASENSE_HOST=mediasense.company.com
MEDIASENSE_PORT=8443
MEDIASENSE_USERNAME=admin
MEDIASENSE_PASSWORD=password

# OpenSearch
OPENSEARCH_HOST=opensearch
OPENSEARCH_PORT=9200
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- recordings.service

# Coverage report
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## 📚 Documentation Links

- **Setup**: [GETTING_STARTED.md](./GETTING_STARTED.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Contributing**: [CONTRIBUTING.md](./CONTRIBUTING.md)
- **API Reference**: [API.md](./API.md)

## 💾 Database Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U qms_user qms | gzip > backup.sql.gz

# Restore
gunzip < backup.sql.gz | docker-compose exec -T postgres psql -U qms_user -d qms

# Test restore
docker-compose exec postgres psql -U qms_user -d qms_test < backup.sql
```

## 🚢 Deployment

```bash
# See DEPLOYMENT.md for full guide

# Production build
npm run build:api
npm run build:web

# Docker image
docker build -f infra/Dockerfile.api -t qms-api:1.0.0 .
docker build -f infra/Dockerfile.web -t qms-web:1.0.0 .

# Deploy to Linux VM
# 1. Copy repository to server
# 2. Configure .env files
# 3. Generate SSL certificates
# 4. docker-compose -f infra/docker-compose.yml up -d
# 5. npm run db:migrate:deploy
```

## 📞 Quick Help

```bash
# View API logs
docker-compose logs -f api

# View database logs
docker-compose logs -f postgres

# Connect to database
docker-compose exec postgres psql -U qms_user -d qms

# Restart specific service
docker-compose restart api

# Full system restart
docker-compose down && docker-compose up -d
```

## ✅ Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] SSL certificates generated/obtained
- [ ] Database backups tested
- [ ] API endpoints verified
- [ ] Frontend build successful
- [ ] Docker images built
- [ ] Firewall rules configured
- [ ] Logging setup complete
- [ ] Health checks enabled
- [ ] Documentation reviewed

## 🎯 Success Criteria

✅ System is production-ready when:
1. All 9 Docker services healthy
2. Database migrations completed
3. API responds to health check
4. Frontend loads without errors
5. UCCX sync working (teams/agents present)
6. Search returns results
7. Evaluations can be created
8. Audit logs recorded

---

**Keep this card handy during development!**  
Print or bookmark for quick reference.
