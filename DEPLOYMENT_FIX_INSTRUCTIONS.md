# Інструкція: Виправлення проблем деплою на Ubuntu

## Швидкий старт

### 1. Отримати останні зміни з репозиторію

```bash
cd /opt/qms
git pull origin main
```

### 2. Запустити скрипт виправлення

```bash
# Зробити скрипт виконуваним (якщо ще не зроблено)
chmod +x fix-deployment-ubuntu.sh

# Запустити скрипт
sudo ./fix-deployment-ubuntu.sh
```

Скрипт автоматично:
- ✅ Додасть `PARTIAL` до enum `SyncStatus`
- ✅ Створить `.env` файл з правильним `DATABASE_URL`
- ✅ Запустить міграції Prisma
- ✅ Перезапустить API контейнер
- ✅ Перевірить статус

## Що робить скрипт

### Крок 1: Виправлення enum SyncStatus
Додає значення `PARTIAL` до enum типу `SyncStatus` в PostgreSQL:
```sql
ALTER TYPE "SyncStatus" ADD VALUE 'PARTIAL';
```

### Крок 2: Створення .env файлу
Створює файл `apps/api/.env` з правильним `DATABASE_URL`:
```env
DATABASE_URL=postgresql://qms_user:qms_password_secure@localhost:5432/qms
NODE_ENV=production
API_PORT=3000
```

### Крок 3: Запуск міграцій
Виконує `npm run db:migrate:deploy` для застосування всіх міграцій.

### Крок 4: Перезапуск API
Перезапускає Docker контейнер API для застосування змін.

### Крок 5: Перевірка
Перевіряє, що все працює правильно.

## Ручне виконання (якщо скрипт не працює)

### 1. Виправлення enum SyncStatus

```bash
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "ALTER TYPE \"SyncStatus\" ADD VALUE 'PARTIAL';"
```

Якщо використовуєте `qms:qms`:
```bash
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms -d qms -c "ALTER TYPE \"SyncStatus\" ADD VALUE 'PARTIAL';"
```

### 2. Створення .env файлу

```bash
cd /opt/qms/apps/api
cat > .env << 'EOF'
DATABASE_URL=postgresql://qms_user:qms_password_secure@localhost:5432/qms
NODE_ENV=production
API_PORT=3000
EOF
```

### 3. Запуск міграцій

```bash
cd /opt/qms/apps/api
export DATABASE_URL="postgresql://qms_user:qms_password_secure@localhost:5432/qms"
npm run db:migrate:deploy
```

### 4. Перезапуск API

```bash
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml restart api
```

## Перевірка після виправлення

### Перевірка enum SyncStatus

```bash
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "SELECT unnest(enum_range(NULL::\"SyncStatus\")) AS values;"
```

Повинно показати:
- IDLE
- IN_PROGRESS
- SUCCESS
- FAILED
- PARTIAL ← нове значення

### Перевірка логів API

```bash
# Перевірити, що немає помилок 404 від MediaSense
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "404" | tail -20

# Перевірити, що MediaSenseSyncService працює
sudo docker compose -f infra/docker-compose.yml logs api | grep "MediaSenseSyncService" | tail -10

# Перевірити загальний стан
sudo docker compose -f infra/docker-compose.yml logs api | tail -50
```

### Перевірка статусу контейнерів

```bash
sudo docker compose -f infra/docker-compose.yml ps
```

Всі сервіси повинні бути в стані "Up".

## Troubleshooting

### Помилка: "command not found: docker compose"

Встановіть Docker Compose:
```bash
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

Або використайте `docker-compose` (з дефісом):
```bash
# Оновіть скрипт або використайте вручну
sudo docker-compose -f infra/docker-compose.yml ...
```

### Помилка: "Authentication failed"

Перевірте credentials в `infra/docker-compose.yml`:
```bash
grep POSTGRES infra/docker-compose.yml
```

Використайте правильні credentials в `.env` файлі.

### Помилка: "Cannot connect to database"

Перевірте, що PostgreSQL контейнер запущений:
```bash
sudo docker compose -f infra/docker-compose.yml ps postgres
```

Якщо не запущений:
```bash
sudo docker compose -f infra/docker-compose.yml up -d postgres
```

### Помилка: "npm: command not found"

Встановіть Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Або виконайте міграції через Docker:
```bash
sudo docker compose -f infra/docker-compose.yml exec api npm run db:migrate:deploy
```

## Після успішного виправлення

1. ✅ Enum `SyncStatus` містить `PARTIAL`
2. ✅ Міграції застосовано
3. ✅ API працює без помилок 404
4. ✅ MediaSense синхронізація працює через `MediaSenseSyncService`

## Додаткові ресурси

- Детальна документація MediaSense API: `MEDIASENSE_API_INTEGRATION.md`
- Команди для роботи з БД: `DATABASE_ACCESS_COMMANDS.md`
- Виправлення помилок: `FIX_*.md` файли
