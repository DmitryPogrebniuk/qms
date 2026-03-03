#!/bin/bash
#
# QMS Console Agent — збір логів, траблшутінг, моніторинг
# Використання: sudo ./qms-agent.sh [status|logs|collect|full]
#
# Команди:
#   status  — швидкий статус (контейнери, API, sync)
#   logs    — останні логи всіх сервісів
#   collect — зберегти звіт у qms-report-YYYYMMDD-HHMMSS.tar.gz
#   full    — повний статус + логи (за замовчуванням)
#

set -e
QMS_DIR="${QMS_DIR:-/opt/qms}"
cd "$QMS_DIR" || exit 1
COMPOSE="${COMPOSE:-docker compose -f infra/docker-compose.yml}"

cmd="${1:-full}"

run_status() {
  echo "═══════════════════════════════════════════════════════════════"
  echo "  QMS STATUS — $(date -Iseconds)"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo ">>> Контейнери"
  $COMPOSE ps -a 2>/dev/null || true
  echo ""
  echo ">>> API Health"
  $COMPOSE exec -T nginx wget -qO- --timeout=5 http://api:3000/api/health 2>/dev/null | head -c 500 || echo "API недоступний"
  echo ""
  echo ""
  echo ">>> Sync / Reconcile"
  if $COMPOSE exec -T api test -f /tmp/qms-mediasense-sync.lock 2>/dev/null; then
    echo "  ⏳ Sync/Reconcile в процесі (lock file існує)"
  else
    echo "  ✓ Sync не активний"
  fi
  $COMPOSE exec -T postgres psql -U qms_user -d qms -t -c "
    SELECT '  Status: ' || status || ' | Last: ' || COALESCE((checkpoint::jsonb)->>'lastSyncTime', '—') || ' | Fetched: ' || \"totalFetched\" || ' | Created: ' || \"totalCreated\"
    FROM \"SyncState\" WHERE \"syncType\" = 'mediasense_recordings';
  " 2>/dev/null || true
  echo ""
  echo ">>> Записи в БД"
  $COMPOSE exec -T postgres psql -U qms_user -d qms -t -c "SELECT COUNT(*) || ' recordings' FROM \"Recording\";" 2>/dev/null || true
  echo ""
  echo ">>> Диск (Docker volumes)"
  docker system df 2>/dev/null | head -15 || true
}

run_logs() {
  echo "═══════════════════════════════════════════════════════════════"
  echo "  QMS LOGS — $(date -Iseconds)"
  echo "═══════════════════════════════════════════════════════════════"
  for svc in api nginx web postgres; do
    echo ""
    echo ">>> $svc (last 50 lines)"
    echo "───────────────────────────────────────────────────────────────"
    $COMPOSE logs --tail 50 "$svc" 2>/dev/null || true
  done
}

run_collect() {
  REPORT_DIR="/tmp/qms-report-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$REPORT_DIR"
  echo "Збір звіту в $REPORT_DIR ..."
  run_status > "$REPORT_DIR/status.txt" 2>&1
  run_logs > "$REPORT_DIR/logs.txt" 2>&1
  $COMPOSE ps -a > "$REPORT_DIR/containers.txt" 2>&1
  $COMPOSE exec -T postgres psql -U qms_user -d qms -c "
    SELECT * FROM \"SyncState\" WHERE \"syncType\" = 'mediasense_recordings';
  " > "$REPORT_DIR/sync-status.txt" 2>/dev/null || true
  docker system df > "$REPORT_DIR/disk.txt" 2>/dev/null || true
  tar -czf "$REPORT_DIR.tar.gz" -C /tmp "$(basename "$REPORT_DIR")"
  rm -rf "$REPORT_DIR"
  echo "Звіт збережено: $REPORT_DIR.tar.gz"
  echo "Скопіюйте на локальну машину: scp user@server:$REPORT_DIR.tar.gz ."
}

# Main
case "$cmd" in
  status)  run_status ;;
  logs)    run_logs ;;
  collect) run_collect ;;
  full)    run_status; echo ""; run_logs ;;
  *)       echo "Використання: $0 [status|logs|collect|full]"; exit 1 ;;
esac
