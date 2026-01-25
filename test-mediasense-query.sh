#!/bin/bash
#
# Тест запиту до MediaSense API для перевірки формату відповіді
#

set -e

echo "=========================================="
echo "Тест запиту до MediaSense API"
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

# Отримати конфігурацію з БД
log_info "Отримання конфігурації MediaSense з БД..."

CONFIG=$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms_user -d qms -t -c "
SELECT settings::text 
FROM \"IntegrationSetting\" 
WHERE \"integrationType\" = 'mediasense' AND \"isEnabled\" = true;
" | tr -d ' \n')

if [ -z "$CONFIG" ] || [ "$CONFIG" = "" ]; then
    log_error "MediaSense не налаштовано в БД"
    exit 1
fi

# Парсимо JSON (простий спосіб)
API_URL=$(echo "$CONFIG" | grep -o '"apiUrl":"[^"]*' | cut -d'"' -f4)
API_KEY=$(echo "$CONFIG" | grep -o '"apiKey":"[^"]*' | cut -d'"' -f4)
API_SECRET=$(echo "$CONFIG" | grep -o '"apiSecret":"[^"]*' | cut -d'"' -f4)

if [ -z "$API_URL" ] || [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
    log_error "Не вдалося отримати конфігурацію з БД"
    exit 1
fi

log_info "  URL: $API_URL"
log_info "  User: $API_KEY"
log_info ""

# Тест 1: Запит сесій з Basic Auth
log_info "1. Тест запиту сесій (POST з Basic Auth)..."

START_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%S.000Z)
END_DATE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

QUERY_BODY=$(cat <<EOF
{
  "queryType": "sessions",
  "conditions": [
    {
      "field": "sessionEndTime",
      "operator": "gte",
      "value": "$START_DATE"
    },
    {
      "field": "sessionEndTime",
      "operator": "lte",
      "value": "$END_DATE"
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 10
  }
}
EOF
)

QUERY_RESPONSE=$(curl -k -s -w "\n%{http_code}" -u "$API_KEY:$API_SECRET" \
    -X POST "$API_URL/ora/queryService/query/sessions" \
    -H "Content-Type: application/json" \
    -d "$QUERY_BODY")

QUERY_HTTP_CODE=$(echo "$QUERY_RESPONSE" | tail -1)
QUERY_BODY_RESPONSE=$(echo "$QUERY_RESPONSE" | sed '$d')

log_info "  Запит: POST /ora/queryService/query/sessions"
log_info "  Діапазон: $START_DATE до $END_DATE"
log_info "  HTTP Status: $QUERY_HTTP_CODE"
echo ""

# Перевірити структуру відповіді
if [ "$QUERY_HTTP_CODE" = "200" ]; then
    # Перевірити на помилку в body
    if echo "$QUERY_BODY_RESPONSE" | grep -q "responseCode.*4021\|Invalid session"; then
        log_error "✗ Помилка: Invalid session (навіть при HTTP 200)"
        echo "  Відповідь:"
        echo "$QUERY_BODY_RESPONSE" | head -5 | sed 's/^/    /'
    else
        log_info "✓ Запит успішний"
        echo "  Структура відповіді:"
        
        # Перевірити responseCode
        RESPONSE_CODE=$(echo "$QUERY_BODY_RESPONSE" | grep -o '"responseCode":[0-9]*' | cut -d':' -f2 || echo "")
        if [ -n "$RESPONSE_CODE" ]; then
            log_info "  responseCode: $RESPONSE_CODE"
            if [ "$RESPONSE_CODE" = "2000" ]; then
                log_info "  ✓ responseCode 2000 = Success"
            else
                log_warn "  ⚠ responseCode $RESPONSE_CODE (не 2000)"
            fi
        fi
        
        # Перевірити responseBody
        if echo "$QUERY_BODY_RESPONSE" | grep -q "responseBody"; then
            log_info "  ✓ responseBody присутній"
            
            # Перевірити sessions в responseBody
            if echo "$QUERY_BODY_RESPONSE" | grep -q '"sessions"'; then
                SESSION_COUNT=$(echo "$QUERY_BODY_RESPONSE" | grep -o '"sessionId"' | wc -l || echo "0")
                log_info "  ✓ Знайдено sessions в responseBody: ~$SESSION_COUNT сесій"
            else
                log_warn "  ⚠ sessions не знайдено в responseBody"
            fi
        else
            log_warn "  ⚠ responseBody відсутній"
        fi
        
        # Показати структуру відповіді
        echo ""
        log_info "  Повна відповідь (перші 1000 символів):"
        echo "$QUERY_BODY_RESPONSE" | head -30 | sed 's/^/    /'
    fi
else
    log_error "✗ Запит не вдався (HTTP $QUERY_HTTP_CODE)"
    echo "  Відповідь:"
    echo "$QUERY_BODY_RESPONSE" | head -20 | sed 's/^/    /'
fi

echo ""
log_info "=========================================="
log_info "Тест завершено"
log_info "=========================================="
