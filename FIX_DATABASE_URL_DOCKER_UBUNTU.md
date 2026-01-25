# Виправлення DATABASE_URL для Docker на Ubuntu

## Контекст

База даних PostgreSQL працює в Docker контейнері на Ubuntu сервері. Потрібно правильно налаштувати `DATABASE_URL` для міграцій.

## Варіанти підключення

### Варіант 1: Міграція з хоста (рекомендовано)

Якщо виконуєте міграцію з Ubuntu хоста (не з контейнера), використовуйте `localhost`:

```bash
cd /opt/qms/apps/api

# Створіть .env файл (використовуйте localhost, бо ви на хості)
cat > .env << 'EOF'
DATABASE_URL=postgresql://qms:qms@localhost:5432/qms
NODE_ENV=production
EOF

# Або експортуйте змінну
export DATABASE_URL="postgresql://qms:qms@localhost:5432/qms"
npm run db:migrate:deploy
```

**Примітка:** Використовуйте `localhost`, бо міграція виконується на Ubuntu хості, а не в контейнері. Порт 5432 проброшений з контейнера на хост.

**Важливо:** Переконайтеся, що порт 5432 проброшений з контейнера на хост:
```yaml
# В docker-compose.yml повинно бути:
postgres:
  ports:
    - "5432:5432"
```

### Варіант 2: Міграція з Docker контейнера

Якщо виконуєте міграцію всередині Docker контейнера API, використовуйте ім'я сервісу:

```bash
# Виконати міграцію через контейнер API
cd /opt/qms
docker-compose exec api sh -c 'export DATABASE_URL="postgresql://qms:qms@postgres:5432/qms" && npm run db:migrate:deploy'
```

Або створити .env файл в контейнері:
```bash
# Створити .env в контейнері
docker-compose exec api sh -c 'echo "DATABASE_URL=postgresql://qms:qms@postgres:5432/qms" > .env'
docker-compose exec api npm run db:migrate:deploy
```

### Варіант 3: Використати docker-compose run (якщо контейнер не запущений)

```bash
cd /opt/qms
docker-compose run --rm api sh -c 'export DATABASE_URL="postgresql://qms:qms@postgres:5432/qms" && npm run db:migrate:deploy'
```

## Перевірка підключення

### Перевірка з хоста Ubuntu:

```bash
# Перевірити, що PostgreSQL доступний
psql -U qms -d qms -h localhost -p 5432 -c "SELECT version();"

# Або через Docker
docker-compose exec postgres psql -U qms -d qms -c "SELECT version();"
```

### Перевірка з контейнера:

```bash
# Виконати команду всередині контейнера API
docker-compose exec api sh -c 'export DATABASE_URL="postgresql://qms:qms@postgres:5432/qms" && npx prisma db execute --stdin <<< "SELECT version();"'
```

## Налаштування docker-compose.yml

Переконайтеся, що в `infra/docker-compose.yml` правильно налаштована база даних:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: qms-postgres
    environment:
      POSTGRES_DB: qms
      POSTGRES_USER: qms
      POSTGRES_PASSWORD: qms
    ports:
      - "5432:5432"  # Проброс порту на хост
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - qms_network

  api:
    # ... інші налаштування
    environment:
      DATABASE_URL: postgresql://qms:qms@postgres:5432/qms  # Для використання всередині контейнера
    depends_on:
      postgres:
        condition: service_healthy
```

## Рекомендований підхід для production

### 1. Створіть .env файл на хості:

```bash
cd /opt/qms/apps/api
nano .env
```

Додайте:
```env
# Для міграцій з хоста
DATABASE_URL=postgresql://qms:qms@localhost:5432/qms

# Або якщо використовуєте інший порт
# DATABASE_URL=postgresql://qms:qms@localhost:5433/qms
```

### 2. Запустіть міграцію:

```bash
cd /opt/qms/apps/api
npm run db:migrate:deploy
```

### 3. Перевірте результат:

```bash
# Перевірити статус міграцій
npx prisma migrate status

# Перевірити підключення
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"_prisma_migrations\";"
```

## Troubleshooting

### Помилка: "connection refused" при підключенні до localhost

**Причина:** Порт не проброшений або PostgreSQL не слухає на 0.0.0.0

**Рішення:**
```bash
# Перевірити, що контейнер слухає на порту
docker-compose ps postgres
netstat -tlnp | grep 5432

# Перевірити логи PostgreSQL
docker-compose logs postgres
```

### Помилка: "host not found: postgres"

**Причина:** Міграція виконується з хоста, а не з контейнера

**Рішення:** Використовуйте `localhost` замість `postgres`:
```bash
export DATABASE_URL="postgresql://qms:qms@localhost:5432/qms"
```

### Помилка: "authentication failed"

**Причина:** Неправильні credentials

**Рішення:** Перевірте credentials в docker-compose.yml:
```bash
# Перевірити налаштування PostgreSQL
docker-compose exec postgres env | grep POSTGRES

# Перевірити підключення
docker-compose exec postgres psql -U qms -d qms -c "SELECT current_user;"
```

### Помилка: "database does not exist"

**Рішення:** Створіть базу даних:
```bash
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE qms;"
docker-compose exec postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE qms TO qms;"
```

## Швидка команда для виконання

### Варіант 1: З Ubuntu хоста (рекомендовано)

```bash
# Найпростіший спосіб (з хоста Ubuntu)
cd /opt/qms/apps/api
export DATABASE_URL="postgresql://qms:qms@localhost:5432/qms"
npm run db:migrate:deploy
```

### Варіант 2: Через Docker контейнер

```bash
# Якщо база даних не проброшена на хост або хочете виконати з контейнера
cd /opt/qms
docker-compose exec api sh -c 'export DATABASE_URL="postgresql://qms:qms@postgres:5432/qms" && npm run db:migrate:deploy'
```

**Важливо:** 
- `localhost` - коли виконуєте з Ubuntu хоста
- `postgres` - коли виконуєте з Docker контейнера (ім'я сервісу в docker-compose)
