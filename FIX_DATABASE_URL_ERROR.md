# Виправлення помилки: Environment variable not found: DATABASE_URL

## Проблема

При виконанні `npm run db:migrate:deploy` на production сервері:
```
Error: Environment variable not found: DATABASE_URL
Error code: P1012
```

**Причина:** Prisma потребує змінну середовища `DATABASE_URL` для підключення до бази даних, але вона не встановлена під час виконання команди.

## Рішення

### Варіант 1: Створити .env файл (рекомендовано)

Створіть файл `.env` в директорії `apps/api/`:

```bash
cd /opt/qms/apps/api
nano .env
```

Додайте наступний вміст (адаптуйте під ваш production):

```env
# Database
DATABASE_URL=postgresql://qms:qms@postgres:5432/qms

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Keycloak
KEYCLOAK_ISSUER=http://keycloak:8080
KEYCLOAK_REALM=qms
KEYCLOAK_CLIENT_ID=qms-api
KEYCLOAK_CLIENT_SECRET=your-secret-key
JWT_SECRET=jwt_secret_key_change_me

# UCCX
UCCX_NODES=uccx.example.com:8443
UCCX_USERNAME=admin
UCCX_PASSWORD=password
UCCX_TIMEOUT_MS=30000
UCCX_RETRY_ATTEMPTS=2

# MediaSense
MEDIASENSE_HOST=192.168.200.133
MEDIASENSE_PORT=8443
MEDIASENSE_USERNAME=admin
MEDIASENSE_PASSWORD=password

# OpenSearch
OPENSEARCH_HOST=opensearch
OPENSEARCH_PORT=9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=SecurePassword123!

# Application
NODE_ENV=production
API_PORT=3000
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
LOG_LEVEL=info
```

**Важливо:** Замініть паролі та хости на реальні production значення!

### Варіант 2: Експортувати змінну перед командою

```bash
cd /opt/qms/apps/api
export DATABASE_URL="postgresql://qms:qms@postgres:5432/qms"
npm run db:migrate:deploy
```

### Варіант 3: Використати Docker Compose (якщо використовуєте Docker)

Якщо база даних працює в Docker:

```bash
# Виконати міграцію через Docker контейнер
docker-compose exec api npm run db:migrate:deploy

# Або якщо контейнер не запущений
docker-compose run --rm api npm run db:migrate:deploy
```

### Варіант 4: Використати Prisma напряму з DATABASE_URL

```bash
cd /opt/qms/apps/api
DATABASE_URL="postgresql://qms:qms@postgres:5432/qms" npx prisma migrate deploy
```

## Перевірка підключення до бази даних

Перед виконанням міграції перевірте, що база даних доступна:

```bash
# Якщо PostgreSQL в Docker
docker-compose exec postgres psql -U qms -d qms -c "SELECT version();"

# Якщо PostgreSQL на хості
psql -U qms -d qms -h localhost -c "SELECT version();"
```

## Формат DATABASE_URL

```
postgresql://[user]:[password]@[host]:[port]/[database]?[parameters]
```

**Приклади:**

- Локальна база: `postgresql://qms:qms@localhost:5432/qms`
- Docker контейнер: `postgresql://qms:qms@postgres:5432/qms`
- Віддалена база: `postgresql://qms:qms@db.example.com:5432/qms`
- З SSL: `postgresql://qms:qms@db.example.com:5432/qms?sslmode=require`

## Після виправлення

1. **Запустіть міграцію:**
   ```bash
   cd /opt/qms/apps/api
   npm run db:migrate:deploy
   ```

2. **Перевірте результат:**
   ```bash
   # Перевірити статус міграцій
   npx prisma migrate status
   ```

3. **Якщо все ОК, ви побачите:**
   ```
   Database schema is up to date!
   ```

## Безпека

⚠️ **Важливо для production:**

1. **Не комітьте `.env` файл в git:**
   ```bash
   # Перевірте, що .env в .gitignore
   echo ".env" >> .gitignore
   ```

2. **Використовуйте сильні паролі:**
   ```bash
   # Генерація безпечного пароля
   openssl rand -base64 32
   ```

3. **Обмежте доступ до .env файлу:**
   ```bash
   chmod 600 /opt/qms/apps/api/.env
   chown qms_user:qms_user /opt/qms/apps/api/.env
   ```

4. **Використовуйте секрети з менеджера секретів** (HashiCorp Vault, AWS Secrets Manager, тощо) для production.

## Troubleshooting

### Помилка: "connection refused"
**Рішення:** Перевірте, що PostgreSQL запущений і доступний:
```bash
docker-compose ps postgres
# або
systemctl status postgresql
```

### Помилка: "authentication failed"
**Рішення:** Перевірте username/password в DATABASE_URL:
```bash
# Тест підключення
psql -U qms -d qms -h localhost
```

### Помилка: "database does not exist"
**Рішення:** Створіть базу даних:
```bash
psql -U postgres -c "CREATE DATABASE qms;"
psql -U postgres -c "CREATE USER qms WITH PASSWORD 'qms';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE qms TO qms;"
```

## Додаткові ресурси

- [Prisma Environment Variables](https://www.prisma.io/docs/guides/development-environment/environment-variables)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
