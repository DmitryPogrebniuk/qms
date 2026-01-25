#!/bin/bash
#
# Експорт аналізу MediaSense API для передачі
# Використання: ./export-mediasense-analysis.sh <path-to-har-file>
#

set -e

echo "=========================================="
echo "Експорт аналізу MediaSense API"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

HAR_FILE="${1:-}"

if [ -z "$HAR_FILE" ]; then
    log_info "Використання: ./export-mediasense-analysis.sh <path-to-har-file>"
    log_info ""
    log_info "Або вручну скопіюйте з DevTools:"
    log_info "1. Відкрийте Network tab"
    log_info "2. Знайдіть запити автентифікації та query"
    log_info "3. Right-click -> Copy -> Copy as cURL"
    log_info "4. Вставте в файл mediasense-requests.txt"
    exit 0
fi

if [ ! -f "$HAR_FILE" ]; then
    echo "HAR файл не знайдено: $HAR_FILE"
    exit 1
fi

OUTPUT_FILE="mediasense-analysis-$(date +%Y%m%d-%H%M%S).txt"

log_info "Аналіз HAR файлу: $HAR_FILE"
log_info "Експорт в: $OUTPUT_FILE"
echo ""

# Перевірка jq
if ! command -v jq &> /dev/null; then
    echo "jq не встановлено. Встановіть: sudo apt-get install jq"
    exit 1
fi

{
    echo "=========================================="
    echo "АНАЛІЗ MEDIASENSE API"
    echo "Дата: $(date)"
    echo "=========================================="
    echo ""
    
    echo "=== 1. ЗАПИТИ АВТЕНТИФІКАЦІЇ ==="
    echo ""
    
    jq -r '.log.entries[] | select(.request.url | contains("login") or contains("auth") or contains("j_security_check") or contains("serviceInfo")) | 
      "URL: \(.request.url)
Метод: \(.request.method)
Статус: \(.response.status) \(.response.statusText)

Request Headers:
\(.request.headers | map("  \(.name): \(.value)") | join("\n"))

Request Cookies:
\(.request.cookies // [] | map("  \(.name)=\(.value)") | join("\n") | if . == "" then "  (немає)" else . end)

Response Headers:
\(.response.headers | map("  \(.name): \(.value)") | join("\n"))

Request Body:
\(.request.postData.text // "(немає)")

Response Body (перші 500 символів):
\(.response.content.text // "(немає)" | .[0:500])

---"' "$HAR_FILE"
    
    echo ""
    echo "=== 2. QUERY ЗАПИТИ ==="
    echo ""
    
    jq -r '.log.entries[] | select(.request.url | contains("query") or contains("sessions") or contains("recordings")) | 
      "URL: \(.request.url)
Метод: \(.request.method)
Статус: \(.response.status) \(.response.statusText)

Request Headers:
\(.request.headers | map("  \(.name): \(.value)") | join("\n"))

Request Cookies:
\(.request.cookies // [] | map("  \(.name)=\(.value)") | join("\n") | if . == "" then "  (немає)" else . end)

Request Body:
\(.request.postData.text // "(немає)")

Response Body (перші 1000 символів):
\(.response.content.text // "(немає)" | .[0:1000])

---"' "$HAR_FILE"
    
    echo ""
    echo "=== 3. ВСІ COOKIES ==="
    echo ""
    
    jq -r '.log.entries[] | .response.headers[] | select(.name == "Set-Cookie") | .value' "$HAR_FILE" | sort -u | while read -r cookie; do
        echo "  $cookie"
    done
    
    echo ""
    echo "=== 4. CURL КОМАНДИ ДЛЯ ТЕСТУВАННЯ ==="
    echo ""
    
    jq -r '.log.entries[] | select(.request.url | contains("8440")) | 
      "curl -k -X \(.request.method) \"\(.request.url)\" \\" +
      "\n  -H \"Content-Type: \(.request.headers[] | select(.name == "Content-Type") | .value // "application/json")\" \\" +
      (if .request.cookies and (.request.cookies | length) > 0 then
        "\n  -H \"Cookie: \(.request.cookies | map("\(.name)=\(.value)") | join("; "))\" \\"
      else "" end) +
      (if .request.postData and .request.postData.text then
        "\n  -d '\''\(.request.postData.text)'\''"
      else "" end) +
      "\n"' "$HAR_FILE" | head -30
    
} > "$OUTPUT_FILE"

log_info "✓ Аналіз експортовано в: $OUTPUT_FILE"
log_info ""
log_info "Тепер ви можете:"
echo "  1. Відкрити файл: cat $OUTPUT_FILE"
echo "  2. Скопіювати вміст та передати для аналізу"
echo "  3. Або завантажити файл на сервер"
echo ""
