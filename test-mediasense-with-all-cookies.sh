#!/bin/bash
#
# Тест MediaSense API з усіма cookies з браузера
# Використання: sudo ./test-mediasense-with-all-cookies.sh "<full-cookie-string>"
#
# Як отримати full cookie string:
# 1. DevTools -> Network -> знайдіть запит -> Headers -> Request Headers
# 2. Скопіюйте весь рядок Cookie: (всі cookies разом)
#

set -e

echo "=========================================="
echo "Тест MediaSense API з усіма cookies"
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

COOKIE_STRING="${1:-}"

if [ -z "$COOKIE_STRING" ]; then
    log_info "Використання: sudo ./test-mediasense-with-all-cookies.sh \"<full-cookie-string>\""
    log_info ""
    log_info "Як отримати full cookie string:"
    echo "  1. DevTools -> Network tab"
    echo "  2. Знайдіть запит до /ora/queryService/query/getSessions"
    echo "  3. Клікніть на запит -> Headers tab"
    echo "  4. У Request Headers знайдіть Cookie:"
    echo "  5. Скопіюйте ВСЕ після 'Cookie: ' (всі cookies разом)"
    echo ""
    log_info "Приклад:"
    echo "  Cookie: JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2; timeBeforeFailover=1765248781381; JSESSIONID=0C50FEBECAD5DE3282791397C5B6A135; ..."
    echo ""
    exit 0
fi

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

# Парсимо JSON
API_URL=$(echo "$CONFIG" | grep -o '"apiUrl":"[^"]*' | cut -d'"' -f4)

if [ -z "$API_URL" ]; then
    log_error "Не вдалося отримати API URL з БД"
    exit 1
fi

log_info "  URL: $API_URL"
log_info "  Cookies: ${COOKIE_STRING:0:80}..."
echo ""

# Тест запиту
log_info "1. Тест запиту сесій з усіма cookies..."

# Timestamps
END_TIMESTAMP=$(date -u +%s)000
START_TIMESTAMP=$((END_TIMESTAMP - 7 * 24 * 60 * 60 * 1000))

QUERY_BODY=$(cat <<EOF
{
  "requestParameters": [
    {
      "fieldName": "sessionState",
      "fieldConditions": [
        {
          "fieldOperator": "equals",
          "fieldValues": ["CLOSED_NORMAL"],
          "fieldConnector": "OR"
        },
        {
          "fieldOperator": "equals",
          "fieldValues": ["CLOSED_ERROR"]
        }
      ],
      "paramConnector": "AND"
    },
    {
      "fieldName": "sessionStartDate",
      "fieldConditions": [
        {
          "fieldOperator": "between",
          "fieldValues": [$START_TIMESTAMP, $END_TIMESTAMP]
        }
      ]
    }
  ]
}
EOF
)

log_info "  Endpoint: POST /ora/queryService/query/getSessions"
log_info "  Діапазон: $START_TIMESTAMP до $END_TIMESTAMP"

QUERY_RESPONSE=$(curl -k -s -w "\n%{http_code}" \
    -X POST "$API_URL/ora/queryService/query/getSessions" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/javascript, */*; q=0.01" \
    -H "X-Requested-With: XMLHttpRequest" \
    -H "Cookie: $COOKIE_STRING" \
    -d "$QUERY_BODY")

QUERY_HTTP_CODE=$(echo "$QUERY_RESPONSE" | tail -1)
QUERY_BODY_RESPONSE=$(echo "$QUERY_RESPONSE" | sed '$d')

log_info "  HTTP Status: $QUERY_HTTP_CODE"
echo ""

# Перевірити результат
if [ "$QUERY_HTTP_CODE" = "200" ]; then
    RESPONSE_CODE=$(echo "$QUERY_BODY_RESPONSE" | grep -o '"responseCode":[0-9]*' | cut -d':' -f2 || echo "")
    
    if [ -n "$RESPONSE_CODE" ]; then
        if [ "$RESPONSE_CODE" = "2000" ]; then
            log_info "  ✓ responseCode: $RESPONSE_CODE (Success)"
            
            SESSION_COUNT=$(echo "$QUERY_BODY_RESPONSE" | grep -o '"sessionId"' | wc -l || echo "0")
            if [ "$SESSION_COUNT" -gt 0 ]; then
                log_info "  ✓ Знайдено сесій: $SESSION_COUNT"
                log_info "  ✓ Тест успішний! Формат запиту правильний!"
            else
                log_warn "  ⚠ Сесій не знайдено (можливо, немає даних для цього діапазону)"
            fi
            
            log_info "  Структура відповіді (перші 500 символів):"
            echo "$QUERY_BODY_RESPONSE" | head -c 500 | sed 's/^/    /'
            echo ""
        elif [ "$RESPONSE_CODE" = "4021" ]; then
            log_error "  ✗ Помилка: Invalid session (responseCode: 4021)"
            log_warn "  Cookies можуть бути невалідними або застарілими"
            log_info "  Спробуйте отримати СВІЖІ cookies з браузера"
        else
            log_warn "  ⚠ responseCode: $RESPONSE_CODE"
        fi
    fi
else
    log_error "  ✗ Запит не вдався (HTTP $QUERY_HTTP_CODE)"
fi

echo ""
log_info "=========================================="
log_info "Тест завершено"
log_info "=========================================="
echo ""
