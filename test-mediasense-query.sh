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

# Крок 1: Логін для отримання JSESSIONID
log_info "1. Логін для отримання JSESSIONID..."

JSESSIONID=""
COOKIE_JAR="/tmp/mediasense_cookies.txt"
rm -f "$COOKIE_JAR"

# Спробувати різні методи логіну
log_info "  Спробу 1: POST /ora/authenticationService/authentication/login з Basic Auth..."

LOGIN_RESPONSE=$(curl -k -s -w "\n%{http_code}" -u "$API_KEY:$API_SECRET" \
    -X POST "$API_URL/ora/authenticationService/authentication/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$API_KEY\",\"password\":\"$API_SECRET\"}" \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR")

LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

# Перевірити cookies
if [ -f "$COOKIE_JAR" ]; then
    JSESSIONID=$(grep -i "JSESSIONID" "$COOKIE_JAR" | awk '{print $7}' | head -1)
    JSESSIONIDSSO=$(grep -i "JSESSIONIDSSO" "$COOKIE_JAR" | awk '{print $7}' | head -1)
    
    if [ -n "$JSESSIONIDSSO" ]; then
        JSESSIONID="$JSESSIONIDSSO"
        log_info "  ✓ Отримано JSESSIONIDSSO: ${JSESSIONID:0:20}..."
    elif [ -n "$JSESSIONID" ]; then
        log_info "  ✓ Отримано JSESSIONID: ${JSESSIONID:0:20}..."
    fi
fi

# Якщо не отримали, спробувати GET /ora/serviceInfo
if [ -z "$JSESSIONID" ]; then
    log_info "  Спробу 2: GET /ora/serviceInfo з Basic Auth..."
    
    SERVICE_RESPONSE=$(curl -k -s -w "\n%{http_code}" -u "$API_KEY:$API_SECRET" \
        -X GET "$API_URL/ora/serviceInfo" \
        -c "$COOKIE_JAR" \
        -b "$COOKIE_JAR")
    
    if [ -f "$COOKIE_JAR" ]; then
        JSESSIONID=$(grep -i "JSESSIONID" "$COOKIE_JAR" | awk '{print $7}' | head -1)
        JSESSIONIDSSO=$(grep -i "JSESSIONIDSSO" "$COOKIE_JAR" | awk '{print $7}' | head -1)
        
        if [ -n "$JSESSIONIDSSO" ]; then
            JSESSIONID="$JSESSIONIDSSO"
            log_info "  ✓ Отримано JSESSIONIDSSO: ${JSESSIONID:0:20}..."
        elif [ -n "$JSESSIONID" ]; then
            log_info "  ✓ Отримано JSESSIONID: ${JSESSIONID:0:20}..."
        fi
    fi
fi

if [ -z "$JSESSIONID" ]; then
    log_warn "  ⚠ JSESSIONID не отримано, використовуємо Basic Auth для запиту"
fi

echo ""

# Тест 2: Запит сесій
log_info "2. Тест запиту сесій..."

# Використовуємо минулі дати (7 днів тому до зараз)
# Перевіряємо, чи дата не в майбутньому
CURRENT_YEAR=$(date -u +%Y)
if [ "$CURRENT_YEAR" -gt 2025 ]; then
    # Якщо поточна дата в майбутньому (проблема з системним часом), використовуємо фіксовану дату
    log_warn "  ⚠ Системна дата в майбутньому, використовуємо фіксовані дати"
    END_DATE="2025-01-25T00:00:00.000Z"
    START_DATE="2025-01-18T00:00:00.000Z"
else
    # Нормальний розрахунок
    START_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%S.000Z)
    END_DATE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
fi

log_info "  Діапазон: $START_DATE до $END_DATE"

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

# Формуємо заголовки
QUERY_HEADERS=(
    "-H" "Content-Type: application/json"
)

if [ -n "$JSESSIONID" ]; then
    # Використовуємо JSESSIONID cookie
    COOKIE_NAME="JSESSIONID"
    if echo "$JSESSIONID" | grep -q "SSO"; then
        COOKIE_NAME="JSESSIONIDSSO"
    fi
    QUERY_HEADERS+=("-H" "Cookie: ${COOKIE_NAME}=${JSESSIONID}")
    log_info "  Використовуємо ${COOKIE_NAME} cookie"
else
    # Fallback до Basic Auth
    QUERY_HEADERS+=("-u" "$API_KEY:$API_SECRET")
    log_info "  Використовуємо Basic Auth (немає JSESSIONID)"
fi

QUERY_RESPONSE=$(curl -k -s -w "\n%{http_code}" \
    "${QUERY_HEADERS[@]}" \
    -X POST "$API_URL/ora/queryService/query/sessions" \
    -d "$QUERY_BODY" \
    -b "$COOKIE_JAR")

QUERY_HTTP_CODE=$(echo "$QUERY_RESPONSE" | tail -1)
QUERY_BODY_RESPONSE=$(echo "$QUERY_RESPONSE" | sed '$d')

# Очистити cookie jar
rm -f "$COOKIE_JAR"

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
