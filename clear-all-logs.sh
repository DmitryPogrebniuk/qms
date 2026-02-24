#!/bin/bash
#
# Очистити всі логи QMS
# - MediaSense integration logs (через API)
# - Docker container logs (опціонально)
#
# Використання: ./clear-all-logs.sh [--docker]
#   --docker  також очистити логи Docker контейнерів (потребує sudo)
#

set -e

# Конфіг (для віддаленого сервера: API_URL=http://192.168.200.199 ./clear-all-logs.sh)
API_URL="${API_URL:-http://localhost:3000}"
LOGIN_USER="${LOGIN_USER:-boss}"
LOGIN_PASS="${LOGIN_PASS:-boss}"
CLEAR_DOCKER=false

for arg in "$@"; do
  case $arg in
    --docker) CLEAR_DOCKER=true ;;
  esac
done

echo "=== Очищення логів QMS ==="
echo "API: $API_URL"
echo ""

# 1. MediaSense logs через API
echo "1. Очищення логів MediaSense інтеграції..."
TOKEN=""
if TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$LOGIN_USER\",\"password\":\"$LOGIN_PASS\"}" \
  | jq -r '.jwt // .accessToken // .token // empty'); then
  if [ -n "$TOKEN" ]; then
    if curl -s -X POST "$API_URL/api/integrations/mediasense/logs/clear" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -w "\nHTTP: %{http_code}" -o /dev/null | grep -q "HTTP: 200"; then
      echo "   ✓ MediaSense логи очищено"
    else
      echo "   ✗ Не вдалося очистити MediaSense логи (перевірте права ADMIN)"
    fi
  else
    echo "   ✗ Не вдалося отримати токен (перевірте $LOGIN_USER/$LOGIN_PASS)"
  fi
else
  echo "   ✗ API недоступний: $API_URL"
fi

# 2. Очищення файлів логів у контейнері API (якщо API недоступний)
if [ -z "$TOKEN" ] || [ "$CLEAR_DOCKER" = true ]; then
  echo ""
  echo "2. Очищення файлів логів у контейнері qms-api..."
  if sudo docker exec qms-api sh -c 'rm -f /app/logs/mediasense/*.log 2>/dev/null; echo "done"' 2>/dev/null; then
    echo "   ✓ Файли логів MediaSense в контейнері видалено"
  else
    echo "   - Контейнер qms-api не знайдено або шлях не існує"
  fi
fi

# 3. Docker container logs (опціонально)
if [ "$CLEAR_DOCKER" = true ]; then
  echo ""
  echo "3. Очищення логів Docker контейнерів..."
  for name in qms-api qms-web qms-nginx qms-postgres qms-opensearch qms-redis; do
    if CID=$(sudo docker ps -q -f "name=$name" 2>/dev/null | head -1); then
      if [ -n "$CID" ]; then
        LOG_PATH="/var/lib/docker/containers/$CID/${CID}-json.log"
        if [ -f "$LOG_PATH" ]; then
          sudo truncate -s 0 "$LOG_PATH" 2>/dev/null && echo "   ✓ $name" || echo "   - $name (не вдалося)"
        fi
      fi
    fi
  done
fi

echo ""
echo "Очищення завершено."
