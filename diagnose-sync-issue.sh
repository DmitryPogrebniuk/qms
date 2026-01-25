#!/bin/bash
#
# Скрипт для діагностики проблеми: синхронізація працює, але записів немає
#

set -e

echo "=========================================="
echo "QMS Sync Diagnostics Script"
echo "=========================================="
echo ""

# Кольори
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

# Визначити docker-compose файл
if [ -f "infra/docker-compose.yml" ]; then
    COMPOSE_FILE="infra/docker-compose.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

# 1. Перевірка даних в БД
log_info "1. Перевірка записів в БД..."
RECORD_COUNT=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U qms_user -d qms -t -c "SELECT COUNT(*) FROM \"Recording\";" | tr -d ' ')
if [ "$RECORD_COUNT" -gt 0 ]; then
    log_info "✓ Знайдено $RECORD_COUNT записів в БД"
    
    # Показати діапазон дат
    DATE_RANGE=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U qms_user -d qms -t -c "
        SELECT 
            MIN(\"startTime\")::text || ' до ' || MAX(\"startTime\")::text
        FROM \"Recording\";
    " | tr -d ' ')
    log_info "  Діапазон дат: $DATE_RANGE"
else
    log_warn "✗ Записів в БД немає (COUNT = 0)"
fi

# 2. Перевірка статусу синхронізації
log_info ""
log_info "2. Перевірка статусу синхронізації..."
SYNC_STATUS=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U qms_user -d qms -t -c "
    SELECT 
        status::text || ' | Fetched: ' || \"totalFetched\"::text || ' | Created: ' || \"totalCreated\"::text
    FROM \"SyncState\" 
    WHERE \"syncType\" = 'mediasense_recordings';
" | tr -d ' ')

if [ -n "$SYNC_STATUS" ]; then
    log_info "✓ Статус: $SYNC_STATUS"
else
    log_warn "✗ SyncState не знайдено"
fi

# 3. Перевірка OpenSearch
log_info ""
log_info "3. Перевірка OpenSearch індексів..."
if curl -s -u admin:SecurePassword123! http://localhost:9200/_cat/indices?v | grep -q "recordings"; then
    log_info "✓ Індекси recordings знайдено"
    OPENSEARCH_COUNT=$(curl -s -u admin:SecurePassword123! "http://localhost:9200/recordings-*/_count" | grep -o '"count":[0-9]*' | cut -d: -f2)
    if [ -n "$OPENSEARCH_COUNT" ]; then
        log_info "  Записів в OpenSearch: $OPENSEARCH_COUNT"
    fi
else
    log_warn "✗ Індекси recordings не знайдено в OpenSearch"
fi

# 4. Тест MediaSense API
log_info ""
log_info "4. Тест підключення до MediaSense..."
MEDIASENSE_HOST=$(grep MEDIASENSE_HOST "$COMPOSE_FILE" | head -1 | awk '{print $2}' | tr -d '"')
MEDIASENSE_PORT=$(grep MEDIASENSE_PORT "$COMPOSE_FILE" | head -1 | awk '{print $2}' | tr -d '"')
MEDIASENSE_USER=$(grep MEDIASENSE_USERNAME "$COMPOSE_FILE" | head -1 | awk '{print $2}' | tr -d '"')
MEDIASENSE_PASS=$(grep MEDIASENSE_PASSWORD "$COMPOSE_FILE" | head -1 | awk '{print $2}' | tr -d '"')

if [ -z "$MEDIASENSE_HOST" ]; then
    log_warn "✗ MEDIASENSE_HOST не знайдено в $COMPOSE_FILE"
else
    log_info "  Host: $MEDIASENSE_HOST:$MEDIASENSE_PORT"
    log_info "  User: $MEDIASENSE_USER"
    
    # Тест підключення
    if curl -k -s -u "$MEDIASENSE_USER:$MEDIASENSE_PASS" "https://$MEDIASENSE_HOST:$MEDIASENSE_PORT/ora/serviceInfo" > /dev/null 2>&1; then
        log_info "✓ Підключення до MediaSense успішне"
    else
        log_error "✗ Не вдалося підключитися до MediaSense"
    fi
    
    # Тест запиту сесій (останні 7 днів)
    log_info ""
    log_info "5. Тест запиту сесій з MediaSense (останні 7 днів)..."
    START_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S.%3NZ)
    END_DATE=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    
    RESPONSE=$(curl -k -s -u "$MEDIASENSE_USER:$MEDIASENSE_PASS" -X POST \
        "https://$MEDIASENSE_HOST:$MEDIASENSE_PORT/ora/queryService/query/sessions" \
        -H "Content-Type: application/json" \
        -d "{
            \"queryType\": \"sessions\",
            \"conditions\": [
                {
                    \"field\": \"sessionEndTime\",
                    \"operator\": \"gte\",
                    \"value\": \"$START_DATE\"
                },
                {
                    \"field\": \"sessionEndTime\",
                    \"operator\": \"lte\",
                    \"value\": \"$END_DATE\"
                }
            ],
            \"paging\": {
                \"offset\": 0,
                \"limit\": 10
            }
        }")
    
    if echo "$RESPONSE" | grep -q "sessionId\|sessions"; then
        SESSION_COUNT=$(echo "$RESPONSE" | grep -o '"sessionId"' | wc -l || echo "0")
        log_info "✓ MediaSense повернув дані (знайдено ~$SESSION_COUNT сесій)"
        log_info "  Приклад відповіді:"
        echo "$RESPONSE" | head -20 | sed 's/^/    /'
    else
        log_warn "✗ MediaSense не повернув сесій або помилка"
        log_warn "  Відповідь:"
        echo "$RESPONSE" | head -10 | sed 's/^/    /'
    fi
fi

# 6. Перевірка логів
log_info ""
log_info "6. Останні логи синхронізації..."
sudo docker compose -f "$COMPOSE_FILE" logs api 2>/dev/null | grep -i "mediasense.*sync\|backfill" | tail -10 | sed 's/^/    /' || log_warn "Логи не знайдено"

# 7. Рекомендації
log_info ""
log_info "=========================================="
log_info "Рекомендації:"
log_info "=========================================="

if [ "$RECORD_COUNT" -eq 0 ]; then
    log_warn "1. Записів в БД немає. Можливі причини:"
    echo "   - MediaSense не повертає дані для вказаного періоду"
    echo "   - Неправильний формат запиту до MediaSense API"
    echo "   - Проблеми з нормалізацією даних"
    echo ""
    log_info "   Рішення:"
    echo "   - Перевірте, чи є записи в MediaSense для потрібного періоду"
    echo "   - Перевірте формат відповіді MediaSense (використайте curl команди вище)"
    echo "   - Перевірте логи API на помилки нормалізації"
fi

if [ -n "$SYNC_STATUS" ] && echo "$SYNC_STATUS" | grep -q "Fetched: 0"; then
    log_warn "2. Синхронізація не отримує дані (fetched: 0)"
    echo "   - MediaSense може не повертати дані для вказаних дат"
    echo "   - Можливо потрібно змінити діапазон дат або формат запиту"
fi

log_info ""
log_info "Для детальної діагностики дивіться: TROUBLESHOOT_SYNC_NO_RECORDS.md"
