#!/bin/bash
#
# Комплексне виправлення: автентифікація MediaSense та скидання синхронізації
#

set -e

echo "=========================================="
echo "Виправлення MediaSense: автентифікація та синхронізація"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

cd /opt/qms || exit 1

# Крок 1: Скинути checkpoint на правильну дату
log_info "Крок 1: Скидання checkpoint на поточні дати (7 днів тому)..."

sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms_user -d qms << 'EOF'
-- Скинути checkpoint для початку з поточних дат (7 днів тому)
-- Використовуємо PostgreSQL для правильного розрахунку дати
UPDATE "SyncState" 
SET 
  status = 'IDLE',
  checkpoint = jsonb_build_object(
    'backfillComplete', false,
    'lastSyncTime', (NOW() - INTERVAL '7 days')::text
  ),
  "watermarkTime" = NOW() - INTERVAL '7 days',
  "errorMessage" = NULL,
  "totalFetched" = 0,
  "totalCreated" = 0,
  "totalUpdated" = 0,
  "lastSyncedAt" = NOW()
WHERE "syncType" = 'mediasense_recordings';

-- Перевірити, що дата не в майбутньому
DO $$
DECLARE
    last_sync_text TEXT;
    last_sync_timestamp TIMESTAMP;
    current_time TIMESTAMP;
BEGIN
    SELECT (checkpoint::jsonb)->>'lastSyncTime' INTO last_sync_text
    FROM "SyncState" 
    WHERE "syncType" = 'mediasense_recordings';
    
    IF last_sync_text IS NOT NULL THEN
        last_sync_timestamp := last_sync_text::timestamp;
        current_time := NOW();
        
        -- Якщо lastSyncTime в майбутньому, скинути на 7 днів тому
        IF last_sync_timestamp > current_time THEN
            UPDATE "SyncState" 
            SET 
              checkpoint = jsonb_build_object(
                'backfillComplete', false,
                'lastSyncTime', (current_time - INTERVAL '7 days')::text
              ),
              "watermarkTime" = current_time - INTERVAL '7 days'
            WHERE "syncType" = 'mediasense_recordings';
        END IF;
    END IF;
END $$;

-- Показати результат
SELECT 
    "syncType",
    status,
    (checkpoint::jsonb)->>'backfillComplete' as backfill_complete,
    (checkpoint::jsonb)->>'lastSyncTime' as last_sync,
    "watermarkTime",
    "lastSyncedAt",
    CASE 
        WHEN ((checkpoint::jsonb)->>'lastSyncTime')::timestamp > NOW() THEN 'FUTURE_DATE'
        ELSE 'OK'
    END as date_check
FROM "SyncState" 
WHERE "syncType" = 'mediasense_recordings';
EOF

log_info "✓ Checkpoint скинуто"
echo ""

# Крок 2: Перезапустити API для застосування виправлень
log_info "Крок 2: Перезапуск API для застосування виправлень..."

if sudo docker compose -f infra/docker-compose.yml restart api; then
    log_info "✓ API перезапущено"
else
    log_error "✗ Не вдалося перезапустити API"
    exit 1
fi

echo ""
log_info "Зачекайте 30 секунд для ініціалізації..."
sleep 30

# Крок 3: Перевірити статус
log_info "Крок 3: Перевірка статусу синхронізації..."

sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms_user -d qms << 'EOF'
SELECT 
    "syncType",
    status,
    ((checkpoint::jsonb)->>'lastSyncTime')::timestamp as last_sync_timestamp,
    NOW() as current_timestamp,
    EXTRACT(EPOCH FROM (NOW() - (((checkpoint::jsonb)->>'lastSyncTime')::timestamp))) / 86400 as days_ago
FROM "SyncState" 
WHERE "syncType" = 'mediasense_recordings';
EOF

echo ""
log_info "=========================================="
log_info "Виправлення завершено"
log_info "=========================================="
log_info ""
log_info "Наступні кроки:"
log_info "1. Перевірте логи автентифікації:"
echo "   sudo docker compose -f infra/docker-compose.yml logs api | grep -i 'mediasense.*login\|mediasense.*session' | tail -20"
log_info ""
log_info "2. Зачекайте 2-3 хвилини і перевірте статус:"
echo "   sudo ./check-sync-status.sh"
log_info ""
log_info "3. Якщо totalFetched все ще 0, перевірте:"
echo "   - Чи працює автентифікація (JSESSIONID отримано?)"
echo "   - Чи правильний діапазон дат (має бути минуле, не майбутнє)"
echo "   - Чи є дані в MediaSense для цього діапазону"
echo ""
