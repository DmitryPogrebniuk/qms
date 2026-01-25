#!/bin/bash
#
# Комплексний скрипт для виправлення всіх проблем деплою на Ubuntu
# Використання: ./fix-all-issues.sh
#

set -e

echo "=========================================="
echo "QMS - Комплексне виправлення проблем"
echo "=========================================="
echo ""

# Кольори
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Визначити docker-compose файл
if [ -f "infra/docker-compose.yml" ]; then
    COMPOSE_FILE="infra/docker-compose.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

log_info "Використовується: $COMPOSE_FILE"
echo ""

# ============================================
# КРОК 1: Виправлення enum SyncStatus
# ============================================
log_step "Крок 1: Виправлення enum SyncStatus (додавання PARTIAL)..."

if sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -c "ALTER TYPE \"SyncStatus\" ADD VALUE 'PARTIAL';" 2>/dev/null; then
    log_info "✓ Значення PARTIAL додано до enum SyncStatus"
elif sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms -d qms -c "ALTER TYPE \"SyncStatus\" ADD VALUE 'PARTIAL';" 2>/dev/null; then
    log_info "✓ Значення PARTIAL додано до enum SyncStatus (qms:qms)"
else
    log_warn "Можливо, PARTIAL вже існує або помилка підключення"
fi

# ============================================
# КРОК 2: Визначення credentials БД
# ============================================
log_step "Крок 2: Визначення credentials БД..."

if sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -c "SELECT version();" > /dev/null 2>&1; then
    DB_USER="qms_user"
    DB_PASS="qms_password_secure"
    log_info "✓ Використовується qms_user:qms_password_secure"
elif sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms -d qms -c "SELECT version();" > /dev/null 2>&1; then
    DB_USER="qms"
    DB_PASS="qms"
    log_info "✓ Використовується qms:qms"
else
    log_error "Не вдалося підключитися до БД"
    exit 1
fi

# ============================================
# КРОК 3: Створення .env файлу
# ============================================
log_step "Крок 3: Створення .env файлу для міграцій..."

cd apps/api || { log_error "Директорія apps/api не знайдена"; exit 1; }

if [ "$DB_USER" = "qms_user" ]; then
    DATABASE_URL="postgresql://qms_user:qms_password_secure@localhost:5432/qms"
else
    DATABASE_URL="postgresql://qms:qms@localhost:5432/qms"
fi

cat > .env << EOF
# Database
DATABASE_URL=$DATABASE_URL

# Application
NODE_ENV=production
API_PORT=3000
EOF

log_info "✓ .env файл створено"

# ============================================
# КРОК 4: Запуск міграцій
# ============================================
log_step "Крок 4: Запуск міграцій Prisma..."

if npm run db:migrate:deploy; then
    log_info "✓ Міграції успішно застосовано"
else
    log_error "Помилка при застосуванні міграцій"
    log_info "Спробуйте вручну:"
    echo "  export DATABASE_URL=\"$DATABASE_URL\""
    echo "  npm run db:migrate:deploy"
    exit 1
fi

# ============================================
# КРОК 5: Скидання checkpoint синхронізації
# ============================================
log_step "Крок 5: Скидання checkpoint синхронізації MediaSense..."

cd ../..

sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d qms << EOF
-- Скинути checkpoint для початку з поточних дат
UPDATE "SyncState" 
SET 
  status = 'IDLE',
  checkpoint = '{"backfillComplete": false, "lastSyncTime": ""}'::jsonb,
  "watermarkTime" = NULL,
  "errorMessage" = NULL
WHERE "syncType" = 'mediasense_recordings';
EOF

log_info "✓ Checkpoint скинуто - синхронізація почне з поточних дат"

# ============================================
# КРОК 6: Перезапуск API
# ============================================
log_step "Крок 6: Перезапуск API контейнера..."

if sudo docker compose -f "$COMPOSE_FILE" restart api; then
    log_info "✓ API контейнер перезапущено"
    log_info "  Зачекайте 10-15 секунд для повного запуску..."
    sleep 5
else
    log_warn "Не вдалося перезапустити API"
fi

# ============================================
# КРОК 7: Перевірка статусу
# ============================================
log_step "Крок 7: Перевірка статусу..."

sleep 5

# Перевірка enum
if sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d qms -c "SELECT unnest(enum_range(NULL::\"SyncStatus\")) AS values;" | grep -q "PARTIAL"; then
    log_info "✓ Enum SyncStatus містить PARTIAL"
else
    log_warn "PARTIAL не знайдено в enum"
fi

# Перевірка контейнера
if sudo docker compose -f "$COMPOSE_FILE" ps api | grep -q "Up"; then
    log_info "✓ API контейнер працює"
else
    log_warn "API контейнер не запущений"
fi

# Перевірка записів в БД
RECORD_COUNT=$(sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d qms -t -c "SELECT COUNT(*) FROM \"Recording\";" | tr -d ' ')
log_info "  Записів в БД: $RECORD_COUNT"

# ============================================
# РЕЗУЛЬТАТ
# ============================================
echo ""
echo "=========================================="
log_info "Виправлення завершено!"
echo "=========================================="
echo ""
log_info "Наступні кроки:"
echo ""
echo "1. Перевірте логи API (через 2-3 хвилини після перезапуску):"
echo "   sudo docker compose -f $COMPOSE_FILE logs api | grep -i 'mediasense' | tail -30"
echo ""
echo "2. Запустіть діагностику синхронізації:"
echo "   ./diagnose-sync-issue.sh"
echo ""
echo "3. Перевірте інтерфейс - записи повинні з'явитися через 5-10 хвилин"
echo ""
echo "4. Якщо записів все ще немає, перевірте:"
echo "   - Чи є записи в MediaSense для поточного періоду"
echo "   - Логи API на помилки MediaSense API"
echo "   - Формат відповіді MediaSense (може відрізнятися)"
echo ""
