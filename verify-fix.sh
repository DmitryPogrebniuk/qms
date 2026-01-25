#!/bin/bash
#
# Скрипт для перевірки, що всі виправлення працюють
# Використання: sudo ./verify-fix.sh
#

set -e

echo "=========================================="
echo "Перевірка виправлень QMS"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

cd /opt/qms || exit 1

if [ -f "infra/docker-compose.yml" ]; then
    COMPOSE_FILE="infra/docker-compose.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

# 1. Перевірка enum SyncStatus
echo "1. Перевірка enum SyncStatus..."
PARTIAL_EXISTS=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -t -c "
    SELECT COUNT(*) 
    FROM pg_enum 
    WHERE enumlabel = 'PARTIAL' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SyncStatus');
" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$PARTIAL_EXISTS" = "1" ]; then
    log_info "PARTIAL існує в enum SyncStatus"
else
    log_error "PARTIAL не знайдено в enum SyncStatus"
fi

# 2. Перевірка статусу міграцій
echo ""
echo "2. Перевірка статусу міграцій Prisma..."
MIGRATION_STATUS=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -t -c "
    SELECT 
        migration_name,
        CASE 
            WHEN finished_at IS NOT NULL THEN 'finished'
            WHEN rolled_back_at IS NOT NULL THEN 'rolled_back'
            ELSE 'failed'
        END as status,
        finished_at IS NOT NULL as is_finished
    FROM \"_prisma_migrations\" 
    WHERE migration_name = '0005_add_partial_to_sync_status';
" 2>/dev/null | tr -d ' ')

if echo "$MIGRATION_STATUS" | grep -q "finished"; then
    log_info "Міграція 0005_add_partial_to_sync_status: успішно застосована"
else
    log_warn "Міграція 0005_add_partial_to_sync_status: не застосована або failed"
fi

# 3. Перевірка failed міграцій
echo ""
echo "3. Перевірка failed міграцій..."
FAILED_COUNT=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -t -c "
    SELECT COUNT(*) 
    FROM \"_prisma_migrations\" 
    WHERE finished_at IS NULL 
      AND rolled_back_at IS NULL;
" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$FAILED_COUNT" = "0" ]; then
    log_info "Немає failed міграцій"
else
    log_warn "Знайдено $FAILED_COUNT failed міграцій"
fi

# 4. Перевірка підключення до БД
echo ""
echo "4. Перевірка підключення до БД..."
if cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -c "SELECT version();" > /dev/null 2>&1; then
    log_info "Підключення до БД успішне"
else
    log_error "Не вдалося підключитися до БД"
fi

# 5. Перевірка записів в БД
echo ""
echo "5. Перевірка записів в БД..."
RECORD_COUNT=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -t -c "SELECT COUNT(*) FROM \"Recording\";" 2>/dev/null | tr -d ' ' || echo "0")
log_info "Записів в БД: $RECORD_COUNT"

if [ "$RECORD_COUNT" -gt 0 ]; then
    DATE_RANGE=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -t -c "
        SELECT 
            MIN(\"startTime\")::text || ' до ' || MAX(\"startTime\")::text
        FROM \"Recording\";
    " 2>/dev/null | tr -d ' ')
    log_info "  Діапазон дат: $DATE_RANGE"
fi

# 6. Перевірка статусу синхронізації
echo ""
echo "6. Перевірка статусу синхронізації MediaSense..."
SYNC_STATUS=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -t -c "
    SELECT 
        status::text || ' | Fetched: ' || \"totalFetched\"::text || ' | Created: ' || \"totalCreated\"::text || ' | Updated: ' || \"totalUpdated\"::text || ' | Backfill: ' || COALESCE((checkpoint::jsonb)->>'backfillComplete', 'unknown')
    FROM \"SyncState\" 
    WHERE \"syncType\" = 'mediasense_recordings';
" 2>/dev/null | tr -d ' ')

if [ -n "$SYNC_STATUS" ]; then
    log_info "Статус: $SYNC_STATUS"
else
    log_warn "SyncState не знайдено"
fi

# 7. Перевірка API контейнера
echo ""
echo "7. Перевірка API контейнера..."
if sudo docker compose -f "$COMPOSE_FILE" ps api | grep -q "Up"; then
    log_info "API контейнер працює"
else
    log_error "API контейнер не запущений"
fi

# 8. Перевірка останніх логів
echo ""
echo "8. Останні логи MediaSense синхронізації..."
sudo docker compose -f "$COMPOSE_FILE" logs api 2>/dev/null | grep -i "mediasense.*sync\|backfill" | tail -5 | sed 's/^/    /' || log_warn "Логи не знайдено"

echo ""
echo "=========================================="
echo "Перевірка завершена!"
echo "=========================================="
echo ""
echo "Якщо все ✓ - система працює правильно!"
echo "Якщо є ✗ - перевірте детальніше відповідні компоненти"
echo ""
