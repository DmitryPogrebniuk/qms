#!/bin/bash
#
# QMS AI Diagnose — збір діагностики + аналіз через AI
# Використання:
#   ./qms-ai-diagnose.sh           — вивести діагностику (для вставки в Cursor/ChatGPT)
#   ./qms-ai-diagnose.sh --ai      — відправити в OpenAI API, отримати рекомендації
#   OPENAI_API_KEY=sk-xxx ./qms-ai-diagnose.sh --ai
#
# Потрібно: curl, jq (для --ai)
#

set -e
QMS_DIR="${QMS_DIR:-/opt/qms}"
cd "$QMS_DIR" || exit 1
COMPOSE="${COMPOSE:-docker compose -f infra/docker-compose.yml}"

USE_AI=false
[[ "${1:-}" == "--ai" ]] && USE_AI=true

# Збір діагностики в один текст
collect_diagnostics() {
  {
    echo "=== QMS Diagnostic Report — $(date -Iseconds) ==="
    echo ""
    echo "--- Containers ---"
    $COMPOSE ps -a 2>/dev/null || true
    echo ""
    echo "--- API Health ---"
    $COMPOSE exec -T nginx wget -qO- --timeout=5 http://api:3000/api/health 2>/dev/null || echo "API недоступний"
    echo ""
    echo ""
    echo "--- Sync Status ---"
    if $COMPOSE exec -T api test -f /tmp/qms-mediasense-sync.lock 2>/dev/null; then
      echo "Sync/Reconcile в процесі (lock file)"
    else
      echo "Sync не активний"
    fi
    $COMPOSE exec -T postgres psql -U qms_user -d qms -t -c "
      SELECT status || ' | Last: ' || COALESCE((checkpoint::jsonb)->>'lastSyncTime', '—') || ' | Fetched: ' || \"totalFetched\" || ' | Created: ' || \"totalCreated\"
      FROM \"SyncState\" WHERE \"syncType\" = 'mediasense_recordings';
    " 2>/dev/null || true
    echo ""
    echo "--- Recordings count ---"
    $COMPOSE exec -T postgres psql -U qms_user -d qms -t -c "SELECT COUNT(*) FROM \"Recording\";" 2>/dev/null || true
    echo ""
    echo "--- Disk ---"
    docker system df 2>/dev/null || true
    echo ""
    echo "--- API logs (last 30) ---"
    $COMPOSE logs --tail 30 api 2>/dev/null || true
    echo ""
    echo "--- Nginx logs (last 20) ---"
    $COMPOSE logs --tail 20 nginx 2>/dev/null || true
  } 2>&1
}

PROMPT_PREFIX="Проаналізуй діагностику QMS (Quality Management System на NestJS, PostgreSQL, MediaSense, Docker). 
Система: контейнери Docker, API, nginx, sync з MediaSense.
Надай: 1) виявлені проблеми 2) рекомендації з виправлення 3) команди для виконання на сервері.
Відповідай українською.

Діагностика:
"

if [[ "$USE_AI" == true ]]; then
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "Помилка: для --ai потрібен OPENAI_API_KEY"
    echo "  export OPENAI_API_KEY=sk-xxx"
    echo "  або: OPENAI_API_KEY=sk-xxx $0 --ai"
    exit 1
  fi
  if ! command -v jq &>/dev/null; then
    echo "Помилка: для --ai потрібен jq (apt install jq)"
    exit 1
  fi

  DIAG=$(collect_diagnostics)
  BODY=$(jq -n \
    --arg model "gpt-4o-mini" \
    --arg content "${PROMPT_PREFIX}${DIAG}" \
    '{model: $model, messages: [{role: "user", content: $content}], max_tokens: 2000}')

  echo "Відправляю в OpenAI..."
  RESP=$(curl -s -X POST "https://api.openai.com/v1/chat/completions" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY")

  if echo "$RESP" | jq -e '.choices[0].message.content' &>/dev/null; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  AI Рекомендації"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "$RESP" | jq -r '.choices[0].message.content'
  else
    echo "Помилка API:" >&2
    echo "$RESP" | jq . 2>/dev/null || echo "$RESP" >&2
    exit 1
  fi
else
  echo "Діагностика QMS. Скопіюй нижче та встав у Cursor/ChatGPT для аналізу:"
  echo ""
  echo "--- початок ---"
  echo "$PROMPT_PREFIX"
  collect_diagnostics
  echo ""
  echo "--- кінець ---"
fi
