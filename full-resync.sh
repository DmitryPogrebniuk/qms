#!/bin/bash
#
# Повна пересинхронізація записів з MediaSense.
# Скидає стан синхронізації (backfill) і запускає sync — усі записи за період
# (MEDIASENSE_RETENTION_DAYS) будуть знову отримані й оновлені в БД/OpenSearch.
#
# Потрібен JWT з роллю ADMIN (з браузера або логіну).
#
# Використання:
#   export JWT="your_admin_jwt_here"
#   ./full-resync.sh
#
#   або
#   ./full-resync.sh "your_admin_jwt_here"
#
#   або (інший хост)
#   API_BASE_URL=http://192.168.200.199:3000 JWT="..." ./full-resync.sh
#

set -e
cd "$(dirname "$0")"

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
JWT="${JWT:-${QMS_JWT:-$1}}"

if [ -z "$JWT" ]; then
  echo "Потрібен JWT адміна."
  echo ""
  echo "Варіанти:"
  echo "  1. Встановити змінну: export JWT=\"ваш_jwt\""
  echo "  2. Передати аргументом: $0 \"ваш_jwt\""
  echo ""
  echo "Як отримати JWT: увійдіть у веб-інтерфейс QMS, DevTools → Application → Local Storage → jwt_token (або Network → будь-який запит → заголовок Authorization)."
  exit 1
fi

echo "Повна пересинхронізація MediaSense"
echo "  API: $API_BASE_URL"
echo ""

echo "[1/3] Скидання стану синхронізації (sync-reset)..."
HTTP_RESET=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/api/recordings/admin/sync-reset" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json")
CODE_RESET=$(echo "$HTTP_RESET" | tail -1)
BODY_RESET=$(echo "$HTTP_RESET" | sed '$d')

if [ "$CODE_RESET" != "200" ] && [ "$CODE_RESET" != "201" ]; then
  echo "  Помилка: HTTP $CODE_RESET"
  echo "$BODY_RESET" | head -5
  exit 1
fi
echo "  OK (HTTP $CODE_RESET)"

echo ""
echo "[2/3] Запуск синхронізації (sync-now)..."
HTTP_SYNC=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/api/recordings/admin/sync-now" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json")
CODE_SYNC=$(echo "$HTTP_SYNC" | tail -1)
BODY_SYNC=$(echo "$HTTP_SYNC" | sed '$d')

if [ "$CODE_SYNC" != "200" ] && [ "$CODE_SYNC" != "201" ]; then
  echo "  Помилка: HTTP $CODE_SYNC"
  echo "$BODY_SYNC" | head -5
  exit 1
fi
echo "  OK (HTTP $CODE_SYNC)"
echo "$BODY_SYNC" | head -20

echo ""
echo "[3/3] Статус синхронізації (sync-status)..."
curl -s "$API_BASE_URL/api/recordings/admin/sync-status" \
  -H "Authorization: Bearer $JWT" | head -30

echo ""
echo "Готово. Синхронізація запущена; backfill може тривати хвилини. Перевірте логи або sync-status."
