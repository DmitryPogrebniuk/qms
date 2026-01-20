# Architecture & Design Decisions

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Nginx (TLS)                            │
│                  (Reverse Proxy, Load Balancer)             │
└────────────────┬──────────────────────────────┬─────────────┘
                 │                              │
        ┌────────▼────────┐           ┌────────▼─────────┐
        │   React + Vite   │           │   NestJS API     │
        │   (5173)         │           │   (3000)         │
        │   Material UI    │           │   TypeScript     │
        │   i18n           │           │   OpenAPI Docs   │
        └──────────────────┘           └────────┬─────────┘
                 │                              │
                 └──────────────┬───────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐  ┌────▼──────┐  ┌───▼──────────┐
        │ PostgreSQL   │  │   Redis    │  │ OpenSearch   │
        │ (5432)       │  │  (6379)    │  │  (9200)      │
        │ Primary DB   │  │   Cache    │  │   Indexing   │
        └──────────────┘  └────────────┘  └──────────────┘
                │
                └──► External: UCCX, MediaSense, Keycloak
```

## Key Design Patterns

### 1. RBAC - Role-Based Access Control

**Server-Side Enforcement**:
- Guards & decorators check roles before handler execution
- Database queries filtered by user role automatically
- Audit logs all access attempts

**Role Hierarchy**:
```
ADMIN     ──> Full access + system config
 ├─ QA    ──> All recordings + evaluations
 ├─ SUPERVISOR ──> Team-scoped access
 └─ USER  ──> Own data only
```

### 2. Data Sovereignty - UCCX as Source of Truth

**Sync Strategy**:
- **Full Sync** (nightly): Complete refresh of teams, agents, skills
- **Incremental Sync** (10-min): Only changed records
- **Fault Tolerance**: System operates if UCCX unavailable

**Database Design**:
- Separate `Agent` & `User` tables (agent ≠ user)
- `agentId` (from AD) is unique key
- Sync state tracking for each data source

### 3. Secure Audio Streaming

**Why No Storage**:
1. Compliance: Reduce data at rest
2. Cost: Storage/encryption/compliance overhead
3. Architecture: Single source of truth (MediaSense)

**Implementation**:
- Proxy stream from MediaSense
- HTTP Range support for seeking
- Authorization checked before streaming
- Rate limiting per user (3 concurrent)

### 4. Time-Based Indexing

**OpenSearch Strategy**:
```
Index: recordings-2024.01
       recordings-2024.02
       recordings-2024.03
Alias: recordings-current
```

**Benefits**:
- Fast deletion of old data (drop index)
- Automatic retention policies
- Query isolation by time period
- Easy rollover

### 5. Audit-Everything Pattern

**Logged Events**:
- Login/logout
- Search queries (filters, not data)
- Record access
- Playback start
- Evaluations created
- Disputes filed

**Non-logged**:
- Error stack traces in production
- Sensitive data like passwords
- Raw audio content

## Technology Choices

### NestJS
**Why**:
- Enterprise patterns (decorators, guards, interceptors)
- TypeScript compilation to JavaScript
- Module system for clean architecture
- Swagger auto-generation
- Testing utilities

**Alternatives Considered**:
- Express: More flexible, less structure → chose NestJS for patterns
- GraphQL: Overkill for this use case → REST is simpler

### Prisma
**Why**:
- Type-safe ORM with zero-cost abstraction
- Auto-generated migrations
- Intuitive schema language
- Built-in seeding

**Alternatives Considered**:
- TypeORM: More verbose → Prisma cleaner
- Raw SQL: Less maintainable → ORM for safety

### OpenSearch (Not Elasticsearch)
**Why**:
- Open source (SSPL license, not client-server)
- PostgreSQL not suitable for full-text search at scale
- Time-based indices = cheap retention

**Query Example**:
```json
{
  "query": {
    "bool": {
      "must": [
        { "range": { "startTime": { "gte": "2024-01-01" } } },
        { "terms": { "agentId": ["agent001", "agent002"] } },
        { "match": { "ani": "555*" } }
      ]
    }
  }
}
```

### React + Vite
**Why**:
- Fast development experience (Vite)
- Component reusability (React)
- Material UI for enterprise look
- i18n for multi-language

**Vs Alternatives**:
- Angular: Heavier, overkill for MVP
- Vue: Equally valid, team preference
- Svelte: Smaller ecosystem

### Keycloak (OIDC)
**Why**:
- Open source identity provider
- LDAP federation to Active Directory
- No vendor lock-in
- OIDC is industry standard

**Integration**:
1. User logs in to Keycloak
2. Keycloak returns OIDC token
3. Frontend exchanges for internal JWT
4. API validates JWT on each request

## Scalability Considerations

### Horizontal Scaling
```yaml
# Multiple API instances behind load balancer
api:
  replicas: 3
  
# PostgreSQL read replicas
postgres-replica:
  role: slave
  
# Redis Cluster for caching
redis:
  cluster: true
```

### Database Performance
- Connection pooling (pgBouncer)
- Read replicas for searches
- Index on (agentId, startTime)
- Archive old records to separate table

### Caching Strategy
- Redis for session tokens (10 min TTL)
- Recording metadata cache (1 hour)
- Team/agent list cache (30 min)

## Security Hardening

### Transport
- TLS 1.2+ only
- HTTPS everywhere
- Certificate pinning (mobile only)

### Storage
- PostgreSQL encrypted connections
- Redis password authentication
- OpenSearch HTTPS + Basic auth

### Application
- Input validation (class-validator)
- SQL injection prevention (Prisma)
- XSS prevention (React escaping)
- CSRF protection (token validation)

### Operational
- Secrets management (environment variables)
- Audit logging immutable
- Docker security scanning
- Regular dependency updates

## Testing Strategy

### Unit Tests
```typescript
describe('RecordingsService', () => {
  it('should enforce RBAC on search', async () => {
    // User can only see their team's recordings
  });
});
```

### Integration Tests
```typescript
describe('UCCX Sync', () => {
  it('should sync agents and maintain audit trail', async () => {
    // Full flow with database
  });
});
```

### RBAC Tests
```typescript
describe('RBAC Enforcement', () => {
  it('USER role cannot access evaluations', async () => {
    // Should return 403
  });
});
```

## Deployment Topology

### Development
```
Docker Compose on single machine
All services on one network
```

### Production Single-Datacenter
```
Nginx load balancer → Multiple API instances
PostgreSQL primary + hot standby
Redis Sentinel for failover
OpenSearch 3-node cluster
```

### Production Multi-Datacenter (Future)
```
Geo-distributed Nginx
PostgreSQL streaming replication across DCs
OpenSearch with cross-cluster replication
Redis Cluster for distributed caching
```

## Known Limitations & Future Work

### Current MVP
- [ ] Limited to ~1000 concurrent users per instance
- [ ] OpenSearch indices require manual cleanup (>1 year)
- [ ] No distributed tracing (TODO: Jaeger)
- [ ] WebSocket support for real-time updates (TODO)

### Future Enhancements
- Kubernetes-native deployment (Helm charts)
- GraphQL endpoint alongside REST
- Real-time notifications (WebSocket)
- Machine learning for quality scoring
- Automated coaching recommendations
- Mobile app (React Native)

## Compliance & Standards

- **GDPR**: Data export, deletion, audit trails
- **HIPAA**: Encryption, audit logging, access controls
- **SOC 2**: Regular security audits, monitoring
- **WCAG 2.1**: Accessibility support

## Performance Baselines

- **API Response**: < 500ms (p95)
- **Search**: < 2s for 1M records (p95)
- **Streaming**: 4 Mbps+ (320kbps audio)
- **Throughput**: 10,000 recordings/day ingestion
- **Concurrent Users**: 500 per instance

---

**Architecture Version**: 1.0  
**Last Updated**: January 2026  
**Reviewers**: Architecture Board, DevOps Team
