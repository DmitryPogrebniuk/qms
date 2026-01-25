# Правильні команди для доступу до PostgreSQL в Docker

## Основні команди

### 1. Підключення до PostgreSQL (інтерактивний режим)

```bash
# З директорії /opt/qms
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms
```

**Або якщо docker-compose.yml в поточній директорії:**
```bash
cd /opt/qms
sudo docker compose exec postgres psql -U qms_user -d qms
```

### 2. Виконання однієї SQL команди

```bash
# Правильна команда (з -U великою літерою)
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "SELECT * FROM \"SyncState\";"
```

**Примітка:** 
- `-U` (велика літера) - для username в psql
- `-u` (мала літера) - не працює в psql, це для інших утиліт

### 3. Видалення даних з таблиці

```bash
# Видалити всі записи з SyncState
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "DELETE FROM \"SyncState\";"

# Або якщо таблиця в нижньому регістрі
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "DELETE FROM sync_state;"
```

## Корисні команди для роботи з БД

### Перевірка підключення

```bash
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "SELECT version();"
```

### Перегляд всіх таблиць

```bash
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "\dt"
```

### Перегляд структури таблиці

```bash
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "\d \"SyncState\""
```

### Перегляд всіх користувачів

```bash
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U postgres -c "\du"
```

### Перегляд всіх баз даних

```bash
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U postgres -c "\l"
```

### Перевірка міграцій Prisma

```bash
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "SELECT * FROM \"_prisma_migrations\" ORDER BY finished_at DESC LIMIT 5;"
```

### Очищення SyncState

```bash
# Видалити всі записи
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "DELETE FROM \"SyncState\";"

# Видалити конкретний sync type
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "DELETE FROM \"SyncState\" WHERE \"syncType\" = 'mediasense_recordings';"

# Скинути статус на IDLE
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "UPDATE \"SyncState\" SET status = 'IDLE', \"errorMessage\" = NULL WHERE \"syncType\" = 'mediasense_recordings';"
```

## Альтернативні способи підключення

### Через psql на хості (якщо порт проброшений)

```bash
# Встановити psql на Ubuntu (якщо не встановлено)
sudo apt-get install postgresql-client

# Підключитися
psql -U qms_user -d qms -h localhost -p 5432
```

### Через Docker без docker-compose

```bash
# Якщо знаєте container ID або ім'я
docker exec -it qms-postgres psql -U qms_user -d qms
```

## Важливі примітки

### 1. Регістр імен таблиць

Prisma створює таблиці з великої літери, тому використовуйте лапки:
```sql
-- Правильно
SELECT * FROM "SyncState";
SELECT * FROM "User";
SELECT * FROM "Recording";

-- Неправильно (якщо таблиця створена з великої літери)
SELECT * FROM syncstate;  -- не знайде таблицю
```

### 2. Параметри psql

- `-U` (велика) - username
- `-d` - database name
- `-h` - host (не потрібен в Docker exec)
- `-p` - port (не потрібен в Docker exec)
- `-c` - виконати команду і вийти
- Без `-c` - інтерактивний режим

### 3. Шлях до docker-compose.yml

Якщо файл в `infra/docker-compose.yml`:
```bash
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms
```

Якщо файл в поточній директорії:
```bash
sudo docker compose exec postgres psql -U qms_user -d qms
```

## Приклади для виправлення SyncState

### Скинути статус синхронізації MediaSense

```bash
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms << 'EOF'
UPDATE "SyncState" 
SET 
  status = 'IDLE',
  "errorMessage" = NULL,
  checkpoint = '{"backfillComplete": false}'::jsonb
WHERE "syncType" = 'mediasense_recordings';
EOF
```

### Переглянути поточний стан синхронізації

```bash
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "SELECT \"syncType\", status, \"lastSyncedAt\", \"errorMessage\" FROM \"SyncState\";"
```

## Швидкий довідник

```bash
# Базове підключення
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms

# Виконати SQL команду
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "YOUR_SQL_HERE"

# Підключитися як superuser (postgres)
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U postgres
```
