#!/bin/bash
#
# Тест MediaSense API з JSESSIONID з браузера
# Використання: sudo ./test-mediasense-with-jsessionid.sh <JSESSIONID>
#

set -e

echo "=========================================="
echo "Тест MediaSense API з JSESSIONID"
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

JSESSIONID="${1:-}"

if [ -z "$JSESSIONID" ]; then
    log_info "Використання: sudo ./test-mediasense-with-jsessionid.sh <JSESSIONID>"
    log_info ""
    log_info "Як отримати JSESSIONID:"
    echo "  1. Відкрийте веб-інтерфейс MediaSense в браузері"
    echo "  2. Авторизуйтеся"
    echo "  3. Відкрийте DevTools (F12) -> Application/Storage -> Cookies"
    echo "  4. Знайдіть JSESSIONID та скопіюйте його значення"
    echo ""
    log_info "Або з Network tab:"
    echo "  1. Відкрийте DevTools -> Network"
    echo "  2. Знайдіть будь-який запит до MediaSense"
    echo "  3. Відкрийте Headers -> Request Headers"
    echo "  4. Знайдіть Cookie: JSESSIONID=..."
    echo "  5. Скопіюйте значення після JSESSIONID="
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
log_info "  JSESSIONID: ${JSESSIONID:0:20}..."
echo ""

# Тест 1: Query з правильним форматом
log_info "1. Тест запиту сесій з JSESSIONID (правильний формат)..."

# Використовуємо минулі дати (7 днів тому до зараз)
CURRENT_YEAR=$(date -u +%Y)
if [ "$CURRENT_YEAR" -gt 2025 ]; then
    END_TIMESTAMP=$(date -u +%s)000
    START_TIMESTAMP=$((END_TIMESTAMP - 7 * 24 * 60 * 60 * 1000))
else
    END_TIMESTAMP=$(date -u +%s)000
    START_TIMESTAMP=$((END_TIMESTAMP - 7 * 24 * 60 * 60 * 1000))
fi

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
log_info "  Діапазон: $START_TIMESTAMP до $END_TIMESTAMP (timestamps в мілісекундах)"

QUERY_RESPONSE=$(curl -k -s -w "\n%{http_code}" \
    -X POST "$API_URL/ora/queryService/query/getSessions" \
    -H "Content-Type: application/json" \
    -H "Cookie: JSESSIONID=$JSESSIONID" \
    -d "$QUERY_BODY")

QUERY_HTTP_CODE=$(echo "$QUERY_RESPONSE" | tail -1)
QUERY_BODY_RESPONSE=$(echo "$QUERY_RESPONSE" | sed '$d')

log_info "  HTTP Status: $QUERY_HTTP_CODE"
echo ""

# Перевірити результат
if [ "$QUERY_HTTP_CODE" = "200" ]; then
    # Перевірити responseCode
    RESPONSE_CODE=$(echo "$QUERY_BODY_RESPONSE" | grep -o '"responseCode":[0-9]*' | cut -d':' -f2 || echo "")
    
    if [ -n "$RESPONSE_CODE" ]; then
        if [ "$RESPONSE_CODE" = "2000" ]; then
            log_info "  ✓ responseCode: $RESPONSE_CODE (Success)"
            
            # Перевірити sessions
            SESSION_COUNT=$(echo "$QUERY_BODY_RESPONSE" | grep -o '"sessionId"' | wc -l || echo "0")
            if [ "$SESSION_COUNT" -gt 0 ]; then
                log_info "  ✓ Знайдено сесій: $SESSION_COUNT"
                
                # Показати першу сесію
                log_info "  Перша сесія:"
                echo "$QUERY_BODY_RESPONSE" | grep -o '"sessionId":"[^"]*' | head -1 | sed 's/^/    /'
            else
                log_warn "  ⚠ Сесій не знайдено (можливо, немає даних для цього діапазону)"
            fi
            
            # Показати структуру відповіді
            log_info "  Структура відповіді (перші 500 символів):"
            echo "$QUERY_BODY_RESPONSE" | head -c 500 | sed 's/^/    /'
            echo ""
        elif [ "$RESPONSE_CODE" = "4021" ]; then
            log_error "  ✗ Помилка: Invalid session (responseCode: 4021)"
            log_warn "  JSESSIONID може бути невалідним або застарілим"
            echo "  Відповідь:"
            echo "$QUERY_BODY_RESPONSE" | head -5 | sed 's/^/    /'
        else
            log_warn "  ⚠ responseCode: $RESPONSE_CODE"
            RESPONSE_MSG=$(echo "$QUERY_BODY_RESPONSE" | grep -o '"responseMessage":"[^"]*' | cut -d'"' -f4 || echo "")
            if [ -n "$RESPONSE_MSG" ]; then
                log_warn "      Message: $RESPONSE_MSG"
            fi
        fi
    else
        log_warn "  ⚠ responseCode не знайдено в відповіді"
        log_info "  Відповідь (перші 200 символів):"
        echo "$QUERY_BODY_RESPONSE" | head -c 200 | sed 's/^/    /'
    fi
else
    log_error "  ✗ Запит не вдався (HTTP $QUERY_HTTP_CODE)"
    echo "  Відповідь:"
    echo "$QUERY_BODY_RESPONSE" | head -20 | sed 's/^/    /'
fi

echo ""
log_info "=========================================="
log_info "Тест завершено"
log_info "=========================================="
log_info ""
log_info "Якщо тест успішний, JSESSIONID працює!"
log_info "Проблема в тому, що MediaSense не встановлює JSESSIONID через API."
log_info "Потрібно використовувати JSESSIONID з веб-інтерфейсу або налаштувати MediaSense сервер."
echo ""
