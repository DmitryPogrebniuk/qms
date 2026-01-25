# Команда для виправлення SyncStatus enum в БД

## Швидке виправлення

Виконайте цю команду для додавання значення `PARTIAL` до enum `SyncStatus`:

```bash
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "ALTER TYPE \"SyncStatus\" ADD VALUE IF NOT EXISTS 'PARTIAL';"
```

## Якщо IF NOT EXISTS не підтримується (PostgreSQL < 12)

```bash
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "ALTER TYPE \"SyncStatus\" ADD VALUE 'PARTIAL';"
```

**Примітка:** Якщо значення вже існує, команда видасть помилку, але це не критично.

## Перевірка після виправлення

```bash
# Перевірити, що PARTIAL додано
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "SELECT unnest(enum_range(NULL::\"SyncStatus\")) AS sync_status_values;"
```

Повинно показати:
- IDLE
- IN_PROGRESS
- SUCCESS
- FAILED
- PARTIAL ← нове значення

## Повна команда з перевіркою

```bash
cd /opt/qms && \
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms << 'EOF'
-- Додати PARTIAL до enum
ALTER TYPE "SyncStatus" ADD VALUE 'PARTIAL';

-- Перевірити результат
SELECT unnest(enum_range(NULL::"SyncStatus")) AS sync_status_values;
EOF
```

## Після виправлення

Після виконання команди запустіть міграцію:

```bash
cd /opt/qms/apps/api
export DATABASE_URL="postgresql://qms_user:qms_password_secure@localhost:5432/qms"
npm run db:migrate:deploy
```

Або якщо використовуєте qms:qms:

```bash
cd /opt/qms/apps/api
export DATABASE_URL="postgresql://qms:qms@localhost:5432/qms"
npm run db:migrate:deploy
```
