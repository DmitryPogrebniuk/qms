#!/bin/bash
#
# Тест реального API MediaSense
# Перевіряє формат запитів та відповідей
#

set -e

echo "=========================================="
echo "Тест MediaSense API"
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

# Тест 1: Автентифікація
log_info "1. Тест автентифікації..."
AUTH_RESPONSE=$(curl -k -s -w "\n%{http_code}" -u "$API_KEY:$API_SECRET" \
    "$API_URL/ora/serviceInfo" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -1)
BODY=$(echo "$AUTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    log_info "✓ Автентифікація успішна (HTTP $HTTP_CODE)"
    echo "$BODY" | head -10 | sed 's/^/    /'
else
    log_error "✗ Автентифікація не вдалася (HTTP $HTTP_CODE)"
    echo "$BODY" | head -20 | sed 's/^/    /'
    exit 1
fi

echo ""

# Тест 2: Запит сесій (формат 1 - POST з conditions)
log_info "2. Тест запиту сесій (POST з conditions)..."

START_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%S.000Z)
END_DATE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

QUERY_BODY=$(cat <<EOF
{
  "queryType": "sessions",
  "conditions": [
    {
      "field": "sessionStartTime",
      "operator": "gte",
      "value": "$START_DATE"
    },
    {
      "field": "sessionEndTime",
      "operator": "lte",
      "value": "$END_DATE"
    }
  ],
  "sorting": [
    { "field": "sessionEndTime", "order": "asc" }
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

if [ "$QUERY_HTTP_CODE" = "200" ] || [ "$QUERY_HTTP_CODE" = "201" ]; then
    log_info "✓ Запит успішний"
    echo "  Відповідь:"
    echo "$QUERY_BODY_RESPONSE" | jq '.' 2>/dev/null || echo "$QUERY_BODY_RESPONSE" | head -30 | sed 's/^/    /'
    
    # Перевірити структуру відповіді
    if echo "$QUERY_BODY_RESPONSE" | grep -q "sessionId\|sessions\|data"; then
        SESSION_COUNT=$(echo "$QUERY_BODY_RESPONSE" | grep -o '"sessionId"' | wc -l || echo "0")
        log_info "  Знайдено сесій: $SESSION_COUNT"
    else
        log_warn "  ⚠ Відповідь не містить очікуваних полів (sessionId/sessions/data)"
    fi
else
    log_error "✗ Запит не вдався (HTTP $QUERY_HTTP_CODE)"
    echo "  Відповідь:"
    echo "$QUERY_BODY_RESPONSE" | head -30 | sed 's/^/    /'
fi

echo ""

# Тест 3: Альтернативний формат (тільки sessionEndTime)
log_info "3. Тест альтернативного формату (тільки sessionEndTime)..."

QUERY_BODY_ALT=$(cat <<EOF
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

QUERY_RESPONSE_ALT=$(curl -k -s -w "\n%{http_code}" -u "$API_KEY:$API_SECRET" \
    -X POST "$API_URL/ora/queryService/query/sessions" \
    -H "Content-Type: application/json" \
    -d "$QUERY_BODY_ALT")

QUERY_HTTP_CODE_ALT=$(echo "$QUERY_RESPONSE_ALT" | tail -1)
QUERY_BODY_RESPONSE_ALT=$(echo "$QUERY_RESPONSE_ALT" | sed '$d')

log_info "  HTTP Status: $QUERY_HTTP_CODE_ALT"

if [ "$QUERY_HTTP_CODE_ALT" = "200" ] || [ "$QUERY_HTTP_CODE_ALT" = "201" ]; then
    log_info "✓ Альтернативний формат працює"
    if echo "$QUERY_BODY_RESPONSE_ALT" | grep -q "sessionId\|sessions"; then
        SESSION_COUNT_ALT=$(echo "$QUERY_BODY_RESPONSE_ALT" | grep -o '"sessionId"' | wc -l || echo "0")
        log_info "  Знайдено сесій: $SESSION_COUNT_ALT"
    fi
else
    log_warn "  Альтернативний формат також не працює"
fi

echo ""

# Тест 4: GET запит з query параметрами
log_info "4. Тест GET запиту з query параметрами..."

GET_QUERY_RESPONSE=$(curl -k -s -w "\n%{http_code}" -u "$API_KEY:$API_SECRET" \
    -X GET "$API_URL/ora/queryService/query/sessions?startTime=$START_DATE&endTime=$END_DATE&maxResults=10&offset=0" \
    -H "Content-Type: application/json")

GET_HTTP_CODE=$(echo "$GET_QUERY_RESPONSE" | tail -1)
GET_BODY_RESPONSE=$(echo "$GET_QUERY_RESPONSE" | sed '$d')

log_info "  HTTP Status: $GET_HTTP_CODE"

if [ "$GET_HTTP_CODE" = "200" ] || [ "$GET_HTTP_CODE" = "201" ]; then
    log_info "✓ GET запит працює"
    if echo "$GET_BODY_RESPONSE" | grep -q "sessionId\|sessions"; then
        SESSION_COUNT_GET=$(echo "$GET_BODY_RESPONSE" | grep -o '"sessionId"' | wc -l || echo "0")
        log_info "  Знайдено сесій: $SESSION_COUNT_GET"
    fi
else
    log_warn "  GET запит не працює"
fi

echo ""
log_info "=========================================="
log_info "Тест завершено"
log_info "=========================================="
