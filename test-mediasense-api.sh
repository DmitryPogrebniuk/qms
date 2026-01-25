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

# Тест 1: Автентифікація через j_security_check (Java form-based auth)
log_info "1. Тест автентифікації через j_security_check (Java form-based)..."

# Спробувати POST до j_security_check з form data
JSECURITY_RESPONSE=$(curl -k -s -w "\n%{http_code}" \
    -X POST "$API_URL/j_security_check" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "j_username=$API_KEY&j_password=$API_SECRET" \
    -c /tmp/mediasense_cookies.txt \
    -L)  # Follow redirects

JSECURITY_HTTP_CODE=$(echo "$JSECURITY_RESPONSE" | tail -1)
JSECURITY_BODY=$(echo "$JSECURITY_RESPONSE" | sed '$d')

# Перевірити чи є JSESSIONID в cookies
JSESSIONID=$(grep -i "JSESSIONID" /tmp/mediasense_cookies.txt 2>/dev/null | awk '{print $7}' || echo "")

if [ -n "$JSESSIONID" ]; then
    log_info "✓ JSESSIONID отримано через j_security_check: ${JSESSIONID:0:20}..."
    COOKIE_HEADER="Cookie: JSESSIONID=$JSESSIONID"
    JSESSIONID_FOUND=true
else
    log_warn "⚠ JSESSIONID не знайдено в cookies після j_security_check"
    JSESSIONID_FOUND=false
fi

# Перевірити body на помилки
if echo "$JSECURITY_BODY" | grep -q "responseCode.*4021\|Invalid session\|login\|error"; then
    log_warn "⚠ Можлива помилка в відповіді j_security_check"
    echo "$JSECURITY_BODY" | head -5 | sed 's/^/    /'
elif [ "$JSECURITY_HTTP_CODE" = "200" ] || [ "$JSECURITY_HTTP_CODE" = "302" ]; then
    log_info "✓ j_security_check повернув HTTP $JSECURITY_HTTP_CODE"
    if [ "$JSECURITY_HTTP_CODE" = "302" ]; then
        log_info "  (302 redirect - нормальна поведінка для успішної автентифікації)"
    fi
else
    log_warn "⚠ j_security_check повернув HTTP $JSECURITY_HTTP_CODE"
fi

echo ""

# Тест 1.1: Альтернативний спосіб - REST API login endpoint
log_info "1.1. Тест автентифікації через REST API login endpoint..."

# Спробувати POST login з Basic Auth
LOGIN_RESPONSE=$(curl -k -s -w "\n%{http_code}" -u "$API_KEY:$API_SECRET" \
    -X POST "$API_URL/ora/authenticationService/authentication/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$API_KEY\",\"password\":\"$API_SECRET\"}" \
    -c /tmp/mediasense_cookies_rest.txt)

LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

# Перевірити чи є JSESSIONID в cookies (якщо не знайдено через j_security_check)
if [ "$JSESSIONID_FOUND" = false ]; then
    JSESSIONID_REST=$(grep -i "JSESSIONID" /tmp/mediasense_cookies_rest.txt 2>/dev/null | awk '{print $7}' || echo "")
    if [ -n "$JSESSIONID_REST" ]; then
        log_info "✓ JSESSIONID отримано через REST API: ${JSESSIONID_REST:0:20}..."
        JSESSIONID="$JSESSIONID_REST"
        COOKIE_HEADER="Cookie: JSESSIONID=$JSESSIONID"
        JSESSIONID_FOUND=true
    fi
fi

# Перевірити body на помилки
if echo "$LOGIN_BODY" | grep -q "responseCode.*4021\|Invalid session"; then
    log_warn "⚠ REST API login повернув помилку: Invalid session"
    echo "$LOGIN_BODY" | head -5 | sed 's/^/    /'
elif [ "$LOGIN_HTTP_CODE" = "200" ] || [ "$LOGIN_HTTP_CODE" = "201" ]; then
    log_info "✓ REST API login повернув HTTP $LOGIN_HTTP_CODE"
    if [ "$JSESSIONID_FOUND" = false ]; then
        log_warn "  Але JSESSIONID не знайдено - можливо потрібен інший формат запиту"
    fi
else
    log_warn "⚠ REST API login повернув HTTP $LOGIN_HTTP_CODE"
fi

echo ""

# Тест 1.1: Альтернативний спосіб - Basic Auth на serviceInfo
log_info "1.1. Тест Basic Auth на serviceInfo..."
AUTH_RESPONSE=$(curl -k -s -w "\n%{http_code}" -u "$API_KEY:$API_SECRET" \
    "$API_URL/ora/serviceInfo" \
    -H "Content-Type: application/json" \
    -c /tmp/mediasense_cookies2.txt)

HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -1)
BODY=$(echo "$AUTH_RESPONSE" | sed '$d')

JSESSIONID2=$(grep -i "JSESSIONID" /tmp/mediasense_cookies2.txt 2>/dev/null | awk '{print $7}' || echo "")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    if [ -n "$JSESSIONID2" ]; then
        log_info "✓ serviceInfo повернув HTTP $HTTP_CODE та JSESSIONID"
        JSESSIONID="$JSESSIONID2"
        COOKIE_HEADER="Cookie: JSESSIONID=$JSESSIONID"
    else
        log_info "✓ serviceInfo працює (HTTP $HTTP_CODE), але JSESSIONID не отримано"
        log_warn "  Це може означати, що query endpoints потребують JSESSIONID"
    fi
else
    log_error "✗ serviceInfo не вдався (HTTP $HTTP_CODE)"
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

# Використовувати JSESSIONID якщо є, інакше Basic Auth
if [ "$JSESSIONID_FOUND" = true ] && [ -n "$JSESSIONID" ]; then
    log_info "  Використовую JSESSIONID cookie для запиту"
    QUERY_RESPONSE=$(curl -k -s -w "\n%{http_code}" \
        -X POST "$API_URL/ora/queryService/query/sessions" \
        -H "Content-Type: application/json" \
        -H "$COOKIE_HEADER" \
        -d "$QUERY_BODY")
else
    log_warn "  JSESSIONID не знайдено, використовую Basic Auth (може не працювати)"
    QUERY_RESPONSE=$(curl -k -s -w "\n%{http_code}" -u "$API_KEY:$API_SECRET" \
        -X POST "$API_URL/ora/queryService/query/sessions" \
        -H "Content-Type: application/json" \
        -d "$QUERY_BODY")
fi

QUERY_HTTP_CODE=$(echo "$QUERY_RESPONSE" | tail -1)
QUERY_BODY_RESPONSE=$(echo "$QUERY_RESPONSE" | sed '$d')

log_info "  Запит: POST /ora/queryService/query/sessions"
log_info "  Діапазон: $START_DATE до $END_DATE"
log_info "  HTTP Status: $QUERY_HTTP_CODE"
echo ""

# Перевірити на помилку в body (навіть якщо HTTP 200)
if echo "$QUERY_BODY_RESPONSE" | grep -q "responseCode.*4021\|Invalid session"; then
    log_error "✗ Помилка: Invalid session (навіть при HTTP $QUERY_HTTP_CODE)"
    echo "  Відповідь:"
    echo "$QUERY_BODY_RESPONSE" | head -5 | sed 's/^/    /'
    if [ -z "$JSESSIONID" ]; then
        log_warn "  ⚠ Можлива причина: відсутній JSESSIONID cookie"
        log_info "  Рекомендація: перевірте, чи login endpoint повертає JSESSIONID"
    else
        log_warn "  ⚠ JSESSIONID є, але сесія невалідна - можливо застаріла"
    fi
elif [ "$QUERY_HTTP_CODE" = "200" ] || [ "$QUERY_HTTP_CODE" = "201" ]; then
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
