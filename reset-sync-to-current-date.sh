#!/bin/bash
#
# Скидання синхронізації на поточні дати
# Використання: sudo ./reset-sync-to-current-date.sh
#

set -e

echo "=========================================="
echo "Скидання синхронізації MediaSense на поточні дати"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

cd /opt/qms || exit 1

# Поточна дата мінус 7 днів для початку синхронізації
# Використовуємо PostgreSQL для правильного розрахунку дати
# Це гарантує правильну дату незалежно від системи

log_info "Скидання checkpoint на поточні дати..."

# Скинути checkpoint (використовуємо PostgreSQL для правильного розрахунку дати)
sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms_user -d qms << 'EOF'
-- Скинути checkpoint для початку з поточних дат (7 днів тому)
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
  "totalUpdated" = 0
WHERE "syncType" = 'mediasense_recordings';

-- Показати результат
SELECT 
    "syncType",
    status,
    (checkpoint::jsonb)->>'backfillComplete' as backfill_complete,
    (checkpoint::jsonb)->>'lastSyncTime' as last_sync,
    "watermarkTime"
FROM "SyncState" 
WHERE "syncType" = 'mediasense_recordings';
EOF

log_info ""
log_info "✓ Checkpoint скинуто"
log_info ""
log_info "Перезапуск API для початку нової синхронізації..."

# Перезапустити API
if sudo docker compose -f infra/docker-compose.yml restart api; then
    log_info "✓ API перезапущено"
    log_info ""
    log_info "Зачекайте 2-3 хвилини і перевірте логи:"
    echo "  sudo docker compose -f infra/docker-compose.yml logs api | grep -i 'mediasense' | tail -30"
    echo ""
    log_info "Або перевірте статус:"
    echo "  sudo ./check-sync-status.sh"
else
    log_warn "Не вдалося перезапустити API"
fi

echo ""
