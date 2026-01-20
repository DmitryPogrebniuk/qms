# Quick Start - Cisco QMS Development

##  🚀 30-Second Start (Recommended for Development)

```bash
# 1. Start supporting services
cd /Users/dpogrebniuk/QMS
docker-compose -f infra/docker-compose.yml up postgres redis opensearch keycloak -d

# 2. Terminal A - Run API
cd apps/api && npm run dev

# 3. Terminal B - Run Web
cd apps/web && npm run dev:web

# 4. Open browser
# Web UI: http://localhost:5173
# API: http://localhost:3000
```

## 🐳 Full Docker Start (Production-like)

```bash
# Start all services
docker-compose -f infra/docker-compose.yml up -d

# Check status
docker ps

# View logs
docker logs -f qms-api
docker logs -f qms-web
```

## 🛠️ Development Workflow

### Run Just Database
```bash
docker-compose -f infra/docker-compose.yml up -d postgres
```

### Hot Reload Everything Locally
```bash
# Terminal 1
npm run dev

# Terminal 2  
npm run dev:web
```

### Reset Database
```bash
docker-compose -f infra/docker-compose.yml down -v
docker-compose -f infra/docker-compose.yml up -d postgres
```

## 🔗 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| **Web UI** | http://localhost:5173 | Frontend application |
| **API Docs** | http://localhost:3000/api | Swagger documentation |
| **Keycloak** | http://localhost:8080 | Identity & Access Management |
| **Database** | localhost:5432 | PostgreSQL |
| **Cache** | localhost:6379 | Redis |
| **Search** | http://localhost:9200 | OpenSearch |

## 🐛 Troubleshooting

### API won't start
```bash
cd apps/api
npm install
npm run dev
```

### Port already in use
```bash
# Find process
lsof -i :3000
# Kill it
kill -9 <PID>
```

### Database connection fails
```bash
# Ensure Postgres is running
docker ps | grep postgres

# Check connection
psql -h localhost -U qms_user -d qms -c "SELECT 1"
```

### Web can't connect to API
Make sure API is running on port 3000:
```bash
curl http://localhost:3000
```

## 📦 First-Time Setup

```bash
# Install root dependencies
npm install

# Build shared package
npm run build -w packages/shared

# Start Docker services
docker-compose -f infra/docker-compose.yml up -d postgres redis

# Run API
cd apps/api
npm install
npm run dev

# In another terminal, run Web
cd apps/web
npm install
npm run dev:web
```

## 🚀 Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup instructions.

## 📚 Learn More

- [Installation Guide](INSTALL_MAC_GUIDE.md)
- [Architecture](ARCHITECTURE.md)
- [API Reference](API.md)
- [Contributing Guide](CONTRIBUTING.md)

---
**Happy coding!** 🎉
