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

# Опціонально: очистити індекс OpenSearch (щоб пошук не показував видалені записи)
if [[ -n "${OPENSEARCH_HOST:-}" ]]; then
  OS_HOST="${OPENSEARCH_HOST}"
  OS_PORT="${OPENSEARCH_PORT:-9200}"
  [[ "${OPENSEARCH_USE_SSL:-false}" == "true" ]] && OS_PROTO="https" || OS_PROTO="http"
  OS_URL="${OS_PROTO}://${OS_HOST}:${OS_PORT}"
  echo ""
  echo "Очищення індексу OpenSearch (qms-recordings-*)..."
  CURL_OPTS=(-s -X POST "${OS_URL}/qms-recordings-*/_delete_by_query" -H "Content-Type: application/json" -d '{"query":{"match_all":{}}}')
  if [[ -n "${OPENSEARCH_USERNAME:-}" && -n "${OPENSEARCH_PASSWORD:-}" ]]; then
    CURL_OPTS+=(-u "${OPENSEARCH_USERNAME}:${OPENSEARCH_PASSWORD}")
  fi
  if curl -k "${CURL_OPTS[@]}" 2>/dev/null | grep -q '"failures":\[\]'; then
    echo "✓ OpenSearch індекс очищено."
  else
    echo "Попередження: не вдалося очистити OpenSearch (перевірте OPENSEARCH_* у .env або виконайте вручну)."
  fi
else
  echo ""
  echo "Попередження: OPENSEARCH_HOST не задано — індекс OpenSearch не очищено."
  echo "Щоб пошук не показував старі записи, задайте OPENSEARCH_HOST у .env і перезапустіть скрипт."
fi

echo ""
echo "Рекомендація: скиньте стан синхронізації MediaSense і запустіть Sync now для повного backfill:"
echo "  ./full-resync.sh"
echo "  або в UI: Параметри інтеграції → MediaSense → Sync now"
echo ""
