# Cisco Quality Management System (QMS)

Production-ready MVP for on-premise Linux deployment. Integrated with Cisco UCCX 15, MediaSense 11.5, and Customer Collaboration Platform (CCP) 15.

## 🎯 Features

### Core Capabilities
- **Secure Access Control**: RBAC with OIDC/Keycloak integration
- **Unified Interaction View**: Voice recordings + chat interactions
- **Quality Evaluations**: Versioned scorecards, workflow management
- **Coaching Plans**: Action items with tracking
- **Sampling Engine**: Rules-based QA sampling
- **Secure Audio Streaming**: Proxy to MediaSense with Range support
- **Multi-language UI**: Ukrainian/English interface

### UCCX Integration (Source of Truth)
- **High Availability Support**: Automatic failover between UCCX nodes
- Directory sync: Teams, agents, skills
- Historical statistics (daily aggregated)
- Incremental + full sync strategies
- Automatic retry/backoff with exponential backoff
- Round-robin load distribution

### MediaSense Integration
- Incremental metadata ingestion
- Recording timeline metadata
- Secure streaming proxy (no local storage)

### Audit & Compliance
- Comprehensive audit logging
- Legal hold capabilities
- Evidence PDF export (no audio)

## 🏗️ Architecture

### Tech Stack

**Backend**: NestJS + TypeScript  
**Database**: PostgreSQL  
**Search**: OpenSearch (time-based indices)  
**Cache**: Redis  
**Auth**: Keycloak (OIDC)  
**Frontend**: React + Vite + Material UI  
**Infrastructure**: Docker Compose, Nginx (TLS)  

### Project Structure

```
.
├── apps/
│   ├── api/                 # NestJS backend
│   │   ├── src/
│   │   │   ├── common/      # Guards, interceptors, utilities
│   │   │   ├── modules/     # Feature modules
│   │   │   ├── config/      # Configuration
│   │   │   └── main.ts
│   │   └── prisma/          # Database schema & migrations
│   └── web/                 # React frontend
│       ├── src/
│       │   ├── pages/       # Route pages
│       │   ├── components/  # Reusable components
│       │   ├── hooks/       # Custom hooks
│       │   ├── services/    # API clients
│       │   ├── locales/     # i18n translations
│       │   └── App.tsx
│       └── index.html
├── packages/
│   └── shared/              # Shared types & constants
├── infra/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── nginx/
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- npm/yarn

### 1. Clone & Install

```bash
cd /Users/dpogrebniuk/QMS
npm install
```

### 2. Environment Configuration

Create `.env` files:

**apps/api/.env**:
```env
NODE_ENV=development
API_PORT=3000
DATABASE_URL=postgresql://qms_user:qms_password_secure@localhost:5432/qms

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Keycloak
KEYCLOAK_ISSUER=http://localhost:8080
KEYCLOAK_REALM=qms
KEYCLOAK_CLIENT_ID=qms-api
KEYCLOAK_CLIENT_SECRET=your-secret
JWT_SECRET=jwt_secret_key

# UCCX (configure for your environment)
UCCX_HOST=uccx.example.com
UCCX_PORT=8443
UCCX_USERNAME=admin
UCCX_PASSWORD=password

# MediaSense
MEDIASENSE_HOST=192.168.200.133
MEDIASENSE_PORT=8443
MEDIASENSE_USERNAME=admin
MEDIASENSE_PASSWORD=password

# OpenSearch
OPENSEARCH_HOST=localhost
OPENSEARCH_PORT=9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=admin_password

CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
```

### 3. Start Services

```bash
# Start all services (PostgreSQL, Redis, OpenSearch, Keycloak, API, Web, Nginx)
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

### 4. Database Setup

```bash
# Run migrations
npm run db:migrate:deploy

# Seed demo data (optional)
npm run db:seed
```

### 5. Access the Application

| Service | URL | Credentials |
|---------|-----|-----------|
| Frontend | http://localhost:5173 | N/A |
| API | http://localhost:3000 | Bearer JWT |
| API Docs | http://localhost:3000/api/docs | N/A |
| Keycloak | http://localhost:8080 | admin / admin_password |

## 🔐 Authentication & Authorization

### RBAC Roles

| Role | Capabilities |
|------|--------------|
| **ADMIN** | Full system access, user management |
| **QA** | All recordings, read-only access, create evaluations |
| **SUPERVISOR** | Team recordings only, create evaluations/coaching |
| **USER** | Own recordings, view evaluations, submit disputes |

### Authentication Flow

1. User logs in via Keycloak OIDC
2. System exchanges OIDC token for internal JWT
3. JWT sent in `Authorization: Bearer` header
4. Server enforces RBAC on all endpoints

## 📊 Database Schema

Key entities:

- **User**: Keycloak identity + RBAC
- **Agent**: UCCX agents (from directory sync)
- **Team**: UCCX teams (from directory sync)
- **Recording**: MediaSense metadata
- **Chat**: CCP interactions
- **Evaluation**: QMS scorecards with workflow
- **Dispute**: Agent disputes to evaluations
- **CoachingPlan**: Action items from evaluations
- **SamplingRule**: QA sampling criteria
- **AuditLog**: Compliance logging

See `apps/api/prisma/schema.prisma` for full schema.

## 🔍 Key Features

### Search & Indexing

```bash
# Manual test
curl -H "Authorization: Bearer $JWT" \
  'http://localhost:3000/api/recordings/search?page=1&pageSize=20&dateFrom=2024-01-01'
```

- OpenSearch indices by month (`recordings-2024.01`)
- Role-based query filtering
- Full-text over metadata fields

### Audio Streaming

```bash
# Stream recording (HTTP Range support)
curl -H "Authorization: Bearer $JWT" \
  -H "Range: bytes=0-1023" \
  http://localhost:3000/api/recordings/{id}/stream \
  -o audio.wav
```

- Proxy direct to MediaSense
- No local storage
- HTTP Range seek support
- Rate limiting per user

### UCCX Sync

Automatic syncs:
- **Full**: Nightly at 2 AM
- **Incremental**: Every 10 minutes
- **Stats**: Daily at 3 AM

**High Availability Features:**
- Automatic failover to secondary UCCX nodes
- Round-robin load distribution
- Configurable timeout and retry logic
- Exponential backoff on failures

See [UCCX_HA_SETUP.md](UCCX_HA_SETUP.md) for HA configuration guide.

### Sampling Engine

Rules-based sampling for QA worklists:

```typescript
{
  "name": "High-value interactions",
  "samplePercentage": 10,
  "period": "DAILY",
  "criteria": {
    "minDurationSeconds": 600,
    "minHoldTimeSeconds": 120,
    "wrapUpReasons": ["COMPLAINT"],
    "csqs": ["BILLING"]
  }
}
```

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:e2e

# Coverage
npm run test:cov
```

Test files:
- RBAC enforcement
- Streaming authorization
- Sampling logic
- UCCX sync retry

## 📚 API Documentation

Swagger/OpenAPI available at: `http://localhost:3000/api/docs`

Key endpoints:

```
POST   /api/auth/verify-token           Verify Keycloak token
GET    /api/users/profile                Get current user
GET    /api/recordings/search            Search recordings
GET    /api/recordings/:id               Get recording details
GET    /api/recordings/:id/stream        Stream audio
POST   /api/evaluations                  Create evaluation
GET    /api/evaluations/agent/:id        Get agent evaluations
POST   /api/coaching/:id/plans           Create coaching plan
GET    /api/sampling/qa-worklist         QA worklist
```

## 🔧 Development

### Local Development (without Docker)

```bash
# Terminal 1: Database
docker run -d \
  -e POSTGRES_DB=qms \
  -e POSTGRES_USER=qms_user \
  -e POSTGRES_PASSWORD=qms_password_secure \
  -p 5432:5432 \
  postgres:15-alpine

# Terminal 2: Backend
cd apps/api
npm run dev

# Terminal 3: Frontend
cd apps/web
npm run dev

# Terminal 4: Migrations
cd apps/api
npm run db:migrate:dev
```

### Code Quality

```bash
npm run lint
npm run format
```

## 🚢 Production Deployment

### Linux Server Setup

1. **OS**: Ubuntu 22.04 LTS (recommended)
2. **Docker**: Install Docker & Compose
3. **Certificates**: Generate TLS certs for Nginx
4. **Environment**: Update `.env` with production values

### Deployment Steps

```bash
# 1. Clone repo
git clone https://github.com/DmitryPogrebniuk/qms.git /opt/qms
cd /opt/qms

# 2. Update environment
cp .env.example .env.production
# Edit .env.production with actual values

# 3. Generate SSL certificates
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout infra/nginx/ssl/qms.key \
  -out infra/nginx/ssl/qms.crt

# 4. Start services
docker-compose -f infra/docker-compose.yml up -d

# 5. Verify
curl -k https://your-server.com
```

### High Availability Considerations

- Multi-container deployment with Kubernetes
- Database replication (PostgreSQL streaming replication)
- Redis Sentinel for caching
- Load balancing with HAProxy

## 📋 Compliance & Security

- **Encryption**: TLS 1.2+, encrypted database connections
- **RBAC**: Server-side enforcement (never frontend-only)
- **Audit**: All access logged with user/timestamp
- **No Audio Storage**: AudioRecordings proxied from MediaSense
- **GDPR Ready**: Audit trails, legal hold, data export

## 🐛 Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs api
docker-compose logs web

# Verify connectivity
docker-compose exec api curl http://postgres:5432

# Restart everything
docker-compose down -v
docker-compose up -d
```

### Database migration errors

```bash
# Reset database (dev only!)
docker-compose exec postgres dropdb -U qms_user qms
docker-compose exec postgres createdb -U qms_user qms
npm run db:migrate:deploy
```

### UCCX/MediaSense connection issues

- Check `apps/api/.env` credentials
- Verify network connectivity: `telnet uccx.host 8443`
- Check logs: `docker-compose logs api | grep UCCX`

## 📞 Support

For issues:
1. Check logs: `npm run docker:logs`
2. Review API docs: `http://localhost:3000/api/docs`
3. Consult schema: `apps/api/prisma/schema.prisma`

## 📄 License

PROPRIETARY - Cisco Systems, Inc.

## 🎯 Next Steps

- [ ] Configure Keycloak realm & roles
- [ ] Connect UCCX environment
- [ ] Connect MediaSense environment
- [ ] Configure OpenSearch authentication
- [ ] Setup SSL certificates
- [ ] Create sampling rules
- [ ] Import historical data
- [ ] Train users
- [ ] Monitor in production

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Architecture**: Production-ready MVP, K8s-ready design
