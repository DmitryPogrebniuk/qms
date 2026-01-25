#!/bin/bash
#
# Reverse Engineering MediaSense API
# Аналіз HTTP запитів з веб-інтерфейсу MediaSense
#
# Використання:
# 1. Відкрийте веб-інтерфейс MediaSense в браузері
# 2. Відкрийте DevTools (F12) -> Network tab
# 3. Виконайте дії в веб-інтерфейсі (логін, пошук сесій тощо)
# 4. Експортуйте HAR файл (Right-click -> Save all as HAR)
# 5. Запустіть цей скрипт: ./reverse-engineer-mediasense-api.sh <path-to-har-file>
#

set -e

echo "=========================================="
echo "Reverse Engineering MediaSense API"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Перевірка наявності jq для парсингу JSON
if ! command -v jq &> /dev/null; then
    log_error "jq не встановлено. Встановіть: sudo apt-get install jq"
    exit 1
fi

HAR_FILE="${1:-}"

if [ -z "$HAR_FILE" ]; then
    log_info "Інструкції для reverse engineering MediaSense API:"
    echo ""
    log_info "1. Відкрийте веб-інтерфейс MediaSense в браузері"
    echo "   URL: https://192.168.200.133:8440"
    echo ""
    log_info "2. Відкрийте DevTools (F12) -> Network tab"
    echo ""
    log_info "3. Виконайте дії:"
    echo "   - Авторизуйтеся"
    echo "   - Відкрийте сторінку з сесіями/записами"
    echo "   - Виконайте пошук"
    echo ""
    log_info "4. Експортуйте HAR файл:"
    echo "   - Right-click на будь-якому запиті -> Save all as HAR"
    echo "   - Або: Network tab -> Export HAR"
    echo ""
    log_info "5. Запустіть скрипт з HAR файлом:"
    echo "   ./reverse-engineer-mediasense-api.sh /path/to/file.har"
    echo ""
    log_info "Альтернативно, використайте curl для перехоплення:"
    echo "   curl -k -v -u 'user:pass' https://192.168.200.133:8440/ora/serviceInfo 2>&1 | tee mediasense-request.log"
    echo ""
    exit 0
fi

if [ ! -f "$HAR_FILE" ]; then
    log_error "HAR файл не знайдено: $HAR_FILE"
    exit 1
fi

log_info "Аналіз HAR файлу: $HAR_FILE"
echo ""

# Витягнути всі запити до MediaSense API
log_info "Знайдені запити до MediaSense API:"
echo ""

jq -r '.log.entries[] | select(.request.url | contains("8440") or contains("mediasense") or contains("ora")) | 
  "\(.request.method) \(.request.url)\n  Headers: \(.request.headers | map("\(.name): \(.value)") | join(", "))\n  Cookies: \(.request.cookies // [] | map("\(.name)=\(.value)") | join("; "))\n  Response: \(.response.status) \(.response.statusText)\n  Response Headers: \(.response.headers | map("\(.name): \(.value)") | join(", "))\n"' \
  "$HAR_FILE" | head -100

echo ""
log_info "Аналіз автентифікації:"
echo ""

# Знайти запити автентифікації
AUTH_REQUESTS=$(jq -r '.log.entries[] | select(.request.url | contains("login") or contains("auth") or contains("j_security_check")) | 
  "\(.request.method) \(.request.url)"' "$HAR_FILE" | head -10)

if [ -n "$AUTH_REQUESTS" ]; then
    echo "$AUTH_REQUESTS"
    echo ""
    
    # Знайти Set-Cookie заголовки
    log_info "Set-Cookie заголовки з автентифікації:"
    jq -r '.log.entries[] | select(.request.url | contains("login") or contains("auth") or contains("j_security_check")) | 
      .response.headers[] | select(.name == "Set-Cookie") | .value' "$HAR_FILE" | sort -u
else
    log_warn "Запити автентифікації не знайдено"
fi

echo ""
log_info "Аналіз query запитів:"
echo ""

# Знайти query запити
QUERY_REQUESTS=$(jq -r '.log.entries[] | select(.request.url | contains("query") or contains("sessions")) | 
  "\(.request.method) \(.request.url)\n  Body: \(.request.postData.text // "N/A")\n  Cookies: \(.request.cookies // [] | map("\(.name)=\(.value)") | join("; "))"' "$HAR_FILE" | head -50)

if [ -n "$QUERY_REQUESTS" ]; then
    echo "$QUERY_REQUESTS"
else
    log_warn "Query запити не знайдено"
fi

echo ""
log_info "Експорт curl команд для тестування:"
echo ""

# Генерувати curl команди
jq -r '.log.entries[] | select(.request.url | contains("8440")) | 
  "curl -k -X \(.request.method) \"\(.request.url)\" \\\n" +
  "  -H \"Content-Type: \(.request.headers[] | select(.name == "Content-Type") | .value // "application/json")\" \\\n" +
  (if .request.cookies and (.request.cookies | length) > 0 then
    "  -H \"Cookie: \(.request.cookies | map("\(.name)=\(.value)") | join("; "))\" \\\n"
  else "" end) +
  (if .request.postData and .request.postData.text then
    "  -d '\''\(.request.postData.text)'\''"
  else "" end)' "$HAR_FILE" | head -20 > mediasense-curl-commands.sh

log_info "Згенеровано curl команди в: mediasense-curl-commands.sh"
echo ""

log_info "=========================================="
log_info "Аналіз завершено"
log_info "=========================================="
