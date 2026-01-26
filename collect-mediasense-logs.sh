#!/bin/bash

# Script to collect comprehensive MediaSense logs for diagnostics
# Usage: sudo ./collect-mediasense-logs.sh

set -e

LOG_DIR="./mediasense-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

echo "=========================================="
echo "Збір логів MediaSense для діагностики"
echo "=========================================="
echo ""
echo "Логи зберігаються в: $LOG_DIR"
echo ""

# 1. API logs (last 200 lines with MediaSense)
echo "[1/7] Збір логів API контейнера..."
sudo docker compose -f infra/docker-compose.yml logs --tail=200 api | grep -i "mediasense\|cookie\|jsessionid\|sync" > "$LOG_DIR/api-mediasense.log" 2>&1 || true
echo "  ✅ Зібрано: $LOG_DIR/api-mediasense.log"

# 2. All API logs (last 500 lines)
echo "[2/7] Збір всіх логів API (останні 500 рядків)..."
sudo docker compose -f infra/docker-compose.yml logs --tail=500 api > "$LOG_DIR/api-all.log" 2>&1 || true
echo "  ✅ Зібрано: $LOG_DIR/api-all.log"

# 3. MediaSense cookie service logs (Playwright automation)
echo "[3/7] Збір логів cookie service (Playwright)..."
sudo docker compose -f infra/docker-compose.yml logs --tail=200 api | grep -i "cookie\|playwright\|browser\|chromium\|web interface" > "$LOG_DIR/cookie-service.log" 2>&1 || true
echo "  ✅ Зібрано: $LOG_DIR/cookie-service.log"

# 4. Sync status from database
echo "[4/7] Збір статусу синхронізації з БД..."
sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms -d qms <<EOF > "$LOG_DIR/sync-status.log" 2>&1 || true
SELECT 
  "syncType",
  status,
  (checkpoint::jsonb->>'backfillComplete')::boolean as backfill_complete,
  (checkpoint::jsonb->>'lastSyncTime')::text as last_sync,
  "totalFetched",
  "totalCreated",
  "totalUpdated",
  "lastSyncedAt",
  "errorMessage"
FROM "SyncState"
WHERE "syncType" = 'mediasense_recordings';

SELECT 
  status,
  "triggeredBy",
  fetched,
  created,
  updated,
  errors,
  "durationMs",
  "errorMessage",
  "correlationId",
  "startedAt"
FROM "SyncHistory"
WHERE "syncStateId" IN (SELECT id FROM "SyncState" WHERE "syncType" = 'mediasense_recordings')
ORDER BY "startedAt" DESC
LIMIT 10;
EOF
echo "  ✅ Зібрано: $LOG_DIR/sync-status.log"

# 5. MediaSense integration settings
echo "[5/7] Збір налаштувань інтеграції MediaSense..."
sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms -d qms <<EOF > "$LOG_DIR/integration-settings.log" 2>&1 || true
SELECT 
  "integrationType",
  "isEnabled",
  settings,
  "createdAt",
  "updatedAt"
FROM "IntegrationSetting"
WHERE "integrationType" = 'mediasense';
EOF
echo "  ✅ Зібрано: $LOG_DIR/integration-settings.log"

# 6. Recent MediaSense logger entries (if stored in DB)
echo "[6/7] Перевірка логів MediaSense logger..."
sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms -d qms <<EOF > "$LOG_DIR/mediasense-logger.log" 2>&1 || true
-- Check if MediaSenseLogger table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'MediaSenseLog'
) as table_exists;
EOF
echo "  ✅ Зібрано: $LOG_DIR/mediasense-logger.log"

# 7. Container status and resources
echo "[7/7] Збір інформації про контейнери..."
{
  echo "=== Container Status ==="
  sudo docker compose -f infra/docker-compose.yml ps
  
  echo ""
  echo "=== API Container Resources ==="
  sudo docker stats qms-api --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" || true
  
  echo ""
  echo "=== API Container Environment ==="
  sudo docker compose -f infra/docker-compose.yml exec -T api env | grep -i "mediasense\|playwright\|node" || true
} > "$LOG_DIR/container-info.log" 2>&1
echo "  ✅ Зібрано: $LOG_DIR/container-info.log"

# 8. Test MediaSense connection (if possible)
echo "[8/8] Тест підключення до MediaSense..."
{
  echo "=== Testing MediaSense API endpoints ==="
  echo ""
  echo "1. Testing /ora/serviceInfo (Basic Auth)..."
  curl -k -s -w "\nHTTP Status: %{http_code}\n" \
    -u "$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms -d qms -t -c "SELECT (settings->>'apiKey')::text || ':' || (settings->>'apiSecret')::text FROM \"IntegrationSetting\" WHERE \"integrationType\" = 'mediasense' LIMIT 1" | tr -d ' '):" \
    "https://192.168.200.133:8440/ora/serviceInfo" \
    -H "Accept: application/json" || echo "Failed to connect"
  
  echo ""
  echo "2. Testing /j_security_check..."
  curl -k -s -w "\nHTTP Status: %{http_code}\n" \
    -X POST "https://192.168.200.133:8440/j_security_check" \
    -d "j_username=test&j_password=test" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -L -v 2>&1 | head -30 || echo "Failed to connect"
} > "$LOG_DIR/mediasense-connection-test.log" 2>&1 || true
echo "  ✅ Зібрано: $LOG_DIR/mediasense-connection-test.log"

# Create summary
echo ""
echo "=========================================="
echo "Збір логів завершено"
echo "=========================================="
echo ""
echo "Зібрані файли:"
ls -lh "$LOG_DIR" | tail -n +2 | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "Для аналізу перевірте:"
echo "  1. $LOG_DIR/api-mediasense.log - основні логи MediaSense"
echo "  2. $LOG_DIR/cookie-service.log - логи Playwright automation"
echo "  3. $LOG_DIR/sync-status.log - статус синхронізації"
echo "  4. $LOG_DIR/mediasense-connection-test.log - тести підключення"
echo ""
echo "Архів для передачі:"
echo "  tar -czf mediasense-logs.tar.gz $LOG_DIR"
echo ""
