#!/bin/bash
#
# Очищення БД від усіх записів (Recording та пов'язані дані).
# Каскадно видаляються: RecordingParticipant, RecordingTag, RecordingNote, ExportJob.
# У Evaluation та EvaluationBookmark recordingId встановлюється в NULL.
#
# Використання: з кореня репозиторію, де є infra/docker-compose.yml
#   ./clear-recordings-db.sh
#   або: sudo ./clear-recordings-db.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Завантажити лише рядки виду KEY=value з .env (без source .env, щоб не виконувати рядки типу "QMS")
if [[ -f .env ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < .env
fi

COMPOSE_FILE="infra/docker-compose.yml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Помилка: не знайдено $COMPOSE_FILE. Запустіть скрипт з кореня репозиторію."
  exit 1
fi

echo "=========================================="
echo "Очищення БД від записів (Recording)"
echo "=========================================="
echo ""

# Показати кількість записів до видалення
echo "Кількість записів до видалення:"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -t -c 'SELECT COUNT(*) FROM "Recording";'
echo ""

read -p "Видалити всі записи? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Скасовано."
  exit 0
fi

echo "Видалення записів..."
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms << 'EOF'
-- Каскад видалить RecordingParticipant, RecordingTag, RecordingNote, ExportJob.
-- Evaluation.recordingId / EvaluationBookmark.recordingId стануть NULL.
DELETE FROM "Recording";
EOF

echo ""
echo "Кількість записів після видалення:"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U qms_user -d qms -t -c 'SELECT COUNT(*) FROM "Recording";'
echo ""
echo "✓ БД очищено від записів."

# Очистити індекс OpenSearch (щоб пошук не показував видалені записи)
echo ""
echo "Очищення індексу OpenSearch (qms-recordings-*)..."

OS_CLEANED=0

# 1) З хоста: localhost:9200 (порт проброшений у docker-compose; security часто вимкнено)
if curl -s -X POST "http://localhost:9200/qms-recordings-*/_delete_by_query" \
  -H "Content-Type: application/json" \
  -d '{"query":{"match_all":{}}}' 2>/dev/null | grep -qE '"failures":\[\]|"deleted"'; then
  echo "✓ OpenSearch індекс очищено (localhost:9200)."
  OS_CLEANED=1
fi

# 2) Якщо не вийшло — з .env (OPENSEARCH_HOST=opensearch з хоста не резолвиться, тому спробуємо localhost з auth)
if [[ "$OS_CLEANED" -eq 0 && -n "${OPENSEARCH_HOST:-}" ]]; then
  OS_HOST="${OPENSEARCH_HOST}"
  OS_PORT="${OPENSEARCH_PORT:-9200}"
  [[ "${OPENSEARCH_USE_SSL:-false}" == "true" ]] && OS_PROTO="https" || OS_PROTO="http"
  OS_URL="${OS_PROTO}://${OS_HOST}:${OS_PORT}"
  CURL_OPTS=(-s -k -X POST "${OS_URL}/qms-recordings-*/_delete_by_query" -H "Content-Type: application/json" -d '{"query":{"match_all":{}}}')
  if [[ -n "${OPENSEARCH_USERNAME:-}" && -n "${OPENSEARCH_PASSWORD:-}" ]]; then
    CURL_OPTS+=(-u "${OPENSEARCH_USERNAME}:${OPENSEARCH_PASSWORD}")
  fi
  if curl "${CURL_OPTS[@]}" 2>/dev/null | grep -qE '"failures":\[\]|"deleted"'; then
    echo "✓ OpenSearch індекс очищено (${OS_HOST}:${OS_PORT})."
    OS_CLEANED=1
  fi
fi

# 3) Якщо OPENSEARCH_HOST=opensearch (тільки всередині Docker), спробувати через api-контейнер
if [[ "$OS_CLEANED" -eq 0 ]]; then
  if docker compose -f "$COMPOSE_FILE" exec -T api sh -c 'command -v curl >/dev/null 2>&1' 2>/dev/null; then
    if docker compose -f "$COMPOSE_FILE" exec -T api sh -c \
      'curl -s -X POST "http://${OPENSEARCH_HOST:-opensearch}:${OPENSEARCH_PORT:-9200}/qms-recordings-*/_delete_by_query" -H "Content-Type: application/json" -u "${OPENSEARCH_USERNAME}:${OPENSEARCH_PASSWORD}" -d "{\"query\":{\"match_all\":{}}}"' 2>/dev/null | grep -qE '"failures":\[\]|"deleted"'; then
      echo "✓ OpenSearch індекс очищено (через api-контейнер)."
      OS_CLEANED=1
    fi
  fi
fi

if [[ "$OS_CLEANED" -eq 0 ]]; then
  echo "Попередження: не вдалося очистити OpenSearch."
  echo "Вручну (з хоста, якщо порт 9200 проброшений):"
  echo "  curl -X POST 'http://localhost:9200/qms-recordings-*/_delete_by_query' -H 'Content-Type: application/json' -d '{\"query\":{\"match_all\":{}}}'"
fi

echo ""
echo "Рекомендація: скиньте стан синхронізації MediaSense і запустіть Sync now для повного backfill:"
echo "  ./full-resync.sh"
echo "  або в UI: Параметри інтеграції → MediaSense → Sync now"
echo ""
