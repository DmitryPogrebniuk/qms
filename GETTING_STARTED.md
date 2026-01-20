# Getting Started with Cisco QMS

## Quick Start (5 minutes)

### 1. Prerequisites
- Docker & Docker Compose
- Git
- Node.js 18+ (for local development)

### 2. Clone & Setup
```bash
git clone <repo> cisco-qms
cd cisco-qms

# Install dependencies
npm install

# Create environment file
cp apps/api/.env.example apps/api/.env
```

### 3. Start Services
```bash
# Start all containers (PostgreSQL, Redis, OpenSearch, Keycloak, API, Web, Nginx)
docker-compose -f infra/docker-compose.yml up -d

# Wait 30 seconds for services to initialize, then:
npm run db:migrate:deploy
npm run db:seed  # Optional: Load demo data
```

### 4. Access System
```
Web UI:        http://localhost:5173
API Docs:      http://localhost:3000/api
Keycloak:      http://localhost:8080
```

### 5. Default Login
```
Username: admin
Password: admin123
```

## Local Development

### IDE Setup (VS Code)

**Recommended Extensions**:
- ESLint
- Prettier
- TypeScript Vue Plugin
- REST Client
- GitLens

**Settings** (`.vscode/settings.json`):
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "typescript.enablePromptUseWorkspaceTypeScriptVersion": true
}
```

### Running in Development Mode

```bash
# Terminal 1: Backend with hot reload
npm run dev:api

# Terminal 2: Frontend with hot reload
npm run dev:web

# Terminal 3: Watch database changes
npm run db:watch
```

### Database Management

```bash
# Create migration after schema change
npx prisma migrate dev --name add_feature_name

# Reset database (dev only!)
npm run db:reset

# Seed demo data
npm run db:seed

# View database studio
npm run db:studio  # Opens http://localhost:5555
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- recordings.service.spec

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

## Project Structure

```
cisco-qms/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── app.module.ts   # Root module
│   │   │   ├── main.ts         # Bootstrap
│   │   │   ├── config/         # Environment validation
│   │   │   ├── common/         # Shared guards, decorators
│   │   │   └── modules/        # Feature modules
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   └── migrations/     # Database migrations
│   │   └── package.json
│   │
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── App.tsx         # Root component
│       │   ├── main.tsx        # Entry point
│       │   ├── i18n.ts         # i18n configuration
│       │   ├── components/     # Reusable components
│       │   ├── pages/          # Page components
│       │   ├── services/       # API clients
│       │   ├── hooks/          # Custom hooks
│       │   └── locales/        # Translation files
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared types & constants
│       └── src/
│           ├── index.ts        # Exported types
│           └── constants.ts    # Constants
│
├── infra/
│   ├── docker-compose.yml      # Services definition
│   ├── Dockerfile.api          # API build config
│   ├── Dockerfile.web          # Web build config
│   └── nginx/
│       ├── nginx.conf          # Reverse proxy config
│       └── ssl/                # SSL certificates
│
└── docs/
    ├── README.md               # Getting started
    ├── API.md                  # API documentation
    ├── ARCHITECTURE.md         # Design decisions
    └── DEPLOYMENT.md           # Production setup
```

## Common Tasks

### Add a New Backend Feature

1. Create module:
```bash
nest generate module modules/feature
nest generate service modules/feature
nest generate controller modules/feature
```

2. Create DTOs in `src/modules/feature/dto/`
3. Implement service logic
4. Add endpoints to controller with `@RequireRoles()`
5. Add to `app.module.ts` imports
6. Test with REST Client

### Add a New Frontend Page

1. Create page component:
```bash
touch apps/web/src/pages/FeaturePage.tsx
```

2. Add to routing in `App.tsx`
3. Create API service:
```bash
touch apps/web/src/services/featureService.ts
```

4. Use `useApi` hook for data fetching
5. Add translations to locales (uk.json, en.json)

### Database Schema Change

```bash
# 1. Update schema.prisma
nano apps/api/prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name add_new_field

# 3. Verify in db:studio
npm run db:studio

# 4. Commit schema.prisma and migration
git add apps/api/prisma/
git commit -m "feat: add new field to recording"
```

## Debugging

### Backend Debugging (VSCode)

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "NestJS Debug",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/apps/api/src/main.ts",
      "preLaunchTask": "build",
      "outFiles": ["${workspaceFolder}/apps/api/dist/**/*.js"]
    }
  ]
}
```

Then press F5 to start debugging.

### Frontend Debugging

1. Open DevTools (F12)
2. Sources tab
3. Set breakpoints in React components
4. Refresh page

### Database Debugging

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U qms_user -d qms

# View schema
\dt

# Check specific table
SELECT * FROM "User" LIMIT 10;
```

## Troubleshooting

### "Port already in use"
```bash
# Find process on port
lsof -i :3000

# Kill process
kill -9 <PID>
```

### "Cannot connect to Docker daemon"
```bash
# Start Docker daemon
sudo systemctl start docker

# Or on Mac, open Docker app
open /Applications/Docker.app
```

### "Database migration failed"
```bash
# Reset local database
npm run db:reset

# Reapply migrations
npm run db:migrate:deploy
```

### "Keycloak not responding"
```bash
# Check Keycloak logs
docker-compose logs keycloak

# Restart Keycloak
docker-compose restart keycloak

# Wait 30 seconds, check http://localhost:8080
```

### "Frontend not loading"
```bash
# Check web container logs
docker-compose logs web

# Verify API responding
curl http://localhost:3000/api/health

# Clear browser cache (Ctrl+Shift+Delete)
```

## Performance Tips

1. **Database**: Use `npm run db:studio` to profile queries
2. **API**: Check response times in Network tab (F12)
3. **OpenSearch**: Monitor index sizes in Keycloak OpenSearch UI
4. **Caching**: Use Redis for frequently accessed data
5. **Frontend**: Use React DevTools Profiler for component renders

## Next Steps

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand design decisions
2. Read [API.md](./API.md) - Learn all available endpoints
3. Check [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
4. Review [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment

## Support

- **Bugs**: Create GitHub issue
- **Questions**: Start a discussion
- **Documentation**: Submit PR
- **Feature Requests**: Open enhancement issue

---

**Happy coding! 🚀**
