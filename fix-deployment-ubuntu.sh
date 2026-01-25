#!/bin/bash
#
# Скрипт для виправлення проблем деплою на Ubuntu сервері
# Використання: ./fix-deployment-ubuntu.sh
#

set -e  # Зупинитися при помилці

echo "=========================================="
echo "QMS Deployment Fix Script for Ubuntu"
echo "=========================================="
echo ""

# Кольори для виводу
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функції
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Перевірка, що скрипт запущено з правильної директорії
if [ ! -f "docker-compose.yml" ] && [ ! -f "infra/docker-compose.yml" ]; then
    log_error "Скрипт повинен бути запущений з кореневої директорії проекту (/opt/qms)"
    exit 1
fi

# Визначити шлях до docker-compose.yml
if [ -f "infra/docker-compose.yml" ]; then
    COMPOSE_FILE="infra/docker-compose.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

log_info "Використовується: $COMPOSE_FILE"

# Крок 1: Виправлення enum SyncStatus - додати PARTIAL
log_info "Крок 1: Виправлення enum SyncStatus (додавання PARTIAL)..."
if sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -c "ALTER TYPE \"SyncStatus\" ADD VALUE 'PARTIAL';" 2>/dev/null; then
    log_info "✓ Значення PARTIAL додано до enum SyncStatus"
else
    log_warn "Можливо, PARTIAL вже існує або помилка підключення"
fi

# Перевірка підключення до БД
log_info "Перевірка підключення до БД..."
if sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -c "SELECT version();" > /dev/null 2>&1; then
    log_info "✓ Підключення до БД успішне"
    DB_USER="qms_user"
    DB_PASS="qms_password_secure"
else
    log_warn "Спробуємо з користувачем qms..."
    if sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms -d qms -c "SELECT version();" > /dev/null 2>&1; then
        log_info "✓ Підключення до БД успішне (qms:qms)"
        DB_USER="qms"
        DB_PASS="qms"
    else
        log_error "Не вдалося підключитися до БД. Перевірте credentials."
        exit 1
    fi
fi

# Крок 2: Створити .env файл для міграцій
log_info "Крок 2: Створення .env файлу для міграцій..."
cd apps/api || { log_error "Директорія apps/api не знайдена"; exit 1; }

# Визначити DATABASE_URL
if [ "$DB_USER" = "qms_user" ]; then
    DATABASE_URL="postgresql://qms_user:qms_password_secure@localhost:5432/qms"
else
    DATABASE_URL="postgresql://qms:qms@localhost:5432/qms"
fi

# Створити .env файл
cat > .env << EOF
# Database
DATABASE_URL=$DATABASE_URL

# Application
NODE_ENV=production
API_PORT=3000
EOF

log_info "✓ .env файл створено з DATABASE_URL"

# Крок 3: Запустити міграції
log_info "Крок 3: Запуск міграцій Prisma..."
if npm run db:migrate:deploy; then
    log_info "✓ Міграції успішно застосовано"
else
    log_error "Помилка при застосуванні міграцій"
    log_info "Спробуйте вручну:"
    echo "  export DATABASE_URL=\"$DATABASE_URL\""
    echo "  npm run db:migrate:deploy"
    exit 1
fi

# Крок 4: Перезапустити API для застосування змін
log_info "Крок 4: Перезапуск API контейнера..."
cd ../..
if sudo docker compose -f "$COMPOSE_FILE" restart api; then
    log_info "✓ API контейнер перезапущено"
else
    log_warn "Не вдалося перезапустити API. Спробуйте вручну:"
    echo "  sudo docker compose -f $COMPOSE_FILE restart api"
fi

# Крок 5: Перевірка статусу
log_info "Крок 5: Перевірка статусу сервісів..."
sleep 3

if sudo docker compose -f "$COMPOSE_FILE" ps api | grep -q "Up"; then
    log_info "✓ API контейнер працює"
else
    log_warn "API контейнер не запущений. Перевірте логи:"
    echo "  sudo docker compose -f $COMPOSE_FILE logs api"
fi

# Перевірка enum SyncStatus
log_info "Перевірка enum SyncStatus..."
if sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d qms -c "SELECT unnest(enum_range(NULL::\"SyncStatus\")) AS values;" | grep -q "PARTIAL"; then
    log_info "✓ Enum SyncStatus містить значення PARTIAL"
else
    log_warn "PARTIAL не знайдено в enum. Можливо, потрібно виконати вручну."
fi

echo ""
echo "=========================================="
log_info "Виправлення завершено!"
echo "=========================================="
echo ""
log_info "Перевірте логи API:"
echo "  sudo docker compose -f $COMPOSE_FILE logs api | tail -50"
echo ""
log_info "Перевірте статус синхронізації MediaSense:"
echo "  sudo docker compose -f $COMPOSE_FILE logs api | grep -i 'mediasense.*sync' | tail -20"
echo ""
