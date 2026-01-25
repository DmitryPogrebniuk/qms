#!/bin/bash
#
# Діагностика автентифікації MediaSense
# Перевіряє, чи отримується JSESSIONID при логіні
#

set -e

echo "=========================================="
echo "Діагностика автентифікації MediaSense"
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

# Парсимо JSON
API_URL=$(echo "$CONFIG" | grep -o '"apiUrl":"[^"]*' | cut -d'"' -f4)
API_KEY=$(echo "$CONFIG" | grep -o '"apiKey":"[^"]*' | cut -d'"' -f4)
API_SECRET=$(echo "$CONFIG" | grep -o '"apiSecret":"[^"]*' | cut -d'"' -f4)

if [ -z "$API_URL" ] || [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
    log_error "Не вдалося отримати конфігурацію з БД"
    exit 1
fi

log_info "  URL: $API_URL"
log_info "  User: $API_KEY"
echo ""

COOKIE_JAR="/tmp/mediasense_diagnose_cookies.txt"
rm -f "$COOKIE_JAR"

# Тест 1: POST /ora/authenticationService/authentication/login
log_info "1. Тест: POST /ora/authenticationService/authentication/login"
log_info "   З Basic Auth + JSON body"

LOGIN_RESPONSE=$(curl -k -s -i -u "$API_KEY:$API_SECRET" \
    -X POST "$API_URL/ora/authenticationService/authentication/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$API_KEY\",\"password\":\"$API_SECRET\"}" \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" 2>&1)

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep -i "^HTTP" | tail -1 | awk '{print $2}')
HEADERS=$(echo "$LOGIN_RESPONSE" | sed '/^HTTP/q' | head -n -1)
BODY=$(echo "$LOGIN_RESPONSE" | sed -n '/^HTTP/,$p' | tail -n +2 | sed '/^$/,$d')

log_info "   HTTP Status: ${HTTP_CODE:-unknown}"

# Перевірити cookies
if [ -f "$COOKIE_JAR" ]; then
    COOKIES=$(cat "$COOKIE_JAR")
    JSESSIONID=$(grep -i "JSESSIONID" "$COOKIE_JAR" | grep -v "JSESSIONIDSSO" | awk '{print $7}' | head -1)
    JSESSIONIDSSO=$(grep -i "JSESSIONIDSSO" "$COOKIE_JAR" | awk '{print $7}' | head -1)
    
    if [ -n "$JSESSIONIDSSO" ]; then
        log_info "   ✓ JSESSIONIDSSO: ${JSESSIONIDSSO:0:30}..."
    elif [ -n "$JSESSIONID" ]; then
        log_info "   ✓ JSESSIONID: ${JSESSIONID:0:30}..."
    else
        log_warn "   ⚠ JSESSIONID не знайдено в cookies"
        log_info "   Cookies файл:"
        echo "$COOKIES" | sed 's/^/      /'
    fi
else
    log_warn "   ⚠ Cookie jar не створено"
fi

# Перевірити Set-Cookie заголовки
SET_COOKIE=$(echo "$HEADERS" | grep -i "set-cookie" || true)
if [ -n "$SET_COOKIE" ]; then
    log_info "   Set-Cookie заголовки:"
    echo "$SET_COOKIE" | sed 's/^/      /'
else
    log_warn "   ⚠ Set-Cookie заголовки відсутні"
fi

# Перевірити response body
if [ -n "$BODY" ]; then
    RESPONSE_CODE=$(echo "$BODY" | grep -o '"responseCode":[0-9]*' | cut -d':' -f2 || echo "")
    if [ -n "$RESPONSE_CODE" ]; then
        if [ "$RESPONSE_CODE" = "2000" ]; then
            log_info "   ✓ responseCode: $RESPONSE_CODE (Success)"
        else
            log_warn "   ⚠ responseCode: $RESPONSE_CODE"
            RESPONSE_MSG=$(echo "$BODY" | grep -o '"responseMessage":"[^"]*' | cut -d'"' -f4 || echo "")
            if [ -n "$RESPONSE_MSG" ]; then
                log_warn "      Message: $RESPONSE_MSG"
            fi
        fi
    fi
fi

echo ""

# Тест 2: GET /ora/serviceInfo
log_info "2. Тест: GET /ora/serviceInfo"
log_info "   З Basic Auth"

rm -f "$COOKIE_JAR"

SERVICE_RESPONSE=$(curl -k -s -i -u "$API_KEY:$API_SECRET" \
    -X GET "$API_URL/ora/serviceInfo" \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" 2>&1)

HTTP_CODE=$(echo "$SERVICE_RESPONSE" | grep -i "^HTTP" | tail -1 | awk '{print $2}')
HEADERS=$(echo "$SERVICE_RESPONSE" | sed '/^HTTP/q' | head -n -1)

log_info "   HTTP Status: ${HTTP_CODE:-unknown}"

# Перевірити cookies
if [ -f "$COOKIE_JAR" ]; then
    JSESSIONID=$(grep -i "JSESSIONID" "$COOKIE_JAR" | grep -v "JSESSIONIDSSO" | awk '{print $7}' | head -1)
    JSESSIONIDSSO=$(grep -i "JSESSIONIDSSO" "$COOKIE_JAR" | awk '{print $7}' | head -1)
    
    if [ -n "$JSESSIONIDSSO" ]; then
        log_info "   ✓ JSESSIONIDSSO: ${JSESSIONIDSSO:0:30}..."
    elif [ -n "$JSESSIONID" ]; then
        log_info "   ✓ JSESSIONID: ${JSESSIONID:0:30}..."
    else
        log_warn "   ⚠ JSESSIONID не знайдено"
    fi
fi

# Перевірити Set-Cookie заголовки
SET_COOKIE=$(echo "$HEADERS" | grep -i "set-cookie" || true)
if [ -n "$SET_COOKIE" ]; then
    log_info "   Set-Cookie заголовки:"
    echo "$SET_COOKIE" | sed 's/^/      /'
else
    log_warn "   ⚠ Set-Cookie заголовки відсутні"
fi

echo ""

# Тест 3: Перевірка логів API
log_info "3. Перевірка логів API для MediaSense автентифікації"
log_info "   Останні 20 рядків з логів..."

sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense.*login\|mediasense.*session\|mediasense.*jsessionid" | tail -20 | sed 's/^/   /' || log_warn "   Логи не знайдено"

echo ""
log_info "=========================================="
log_info "Діагностика завершена"
log_info "=========================================="

rm -f "$COOKIE_JAR"
