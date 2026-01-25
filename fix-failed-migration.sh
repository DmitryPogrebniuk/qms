#!/bin/bash
#
# Виправлення failed міграції Prisma
# Використання: ./fix-failed-migration.sh
#

set -e

echo "=========================================="
echo "Виправлення failed міграції Prisma"
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

# Визначити docker-compose файл
if [ -f "infra/docker-compose.yml" ]; then
    COMPOSE_FILE="infra/docker-compose.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

# Переконатися, що ми в правильній директорії
cd /opt/qms || { log_error "Не вдалося перейти в /opt/qms"; exit 1; }

# Визначити DB user
log_info "Визначення credentials БД..."
if cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U qms_user -d qms -c "SELECT 1;" > /dev/null 2>&1; then
    DB_USER="qms_user"
    log_info "✓ Використовується qms_user"
else
    DB_USER="qms"
    log_info "✓ Використовується qms"
fi

# Перевірити, чи PARTIAL існує
log_info "Перевірка, чи PARTIAL існує в enum..."
PARTIAL_EXISTS=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms -t -c "
    SELECT COUNT(*) 
    FROM pg_enum 
    WHERE enumlabel = 'PARTIAL' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SyncStatus');
" | tr -d ' ')

if [ "$PARTIAL_EXISTS" = "1" ]; then
    log_info "✓ PARTIAL існує в enum - міграція фактично успішна"
    
    # Перевірити статус міграції
    log_info "Перевірка статусу міграції в _prisma_migrations..."
    MIGRATION_STATUS=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms -t -c "
        SELECT 
            CASE 
                WHEN finished_at IS NOT NULL THEN 'finished'
                WHEN rolled_back_at IS NOT NULL THEN 'rolled_back'
                ELSE 'failed'
            END as status
        FROM \"_prisma_migrations\" 
        WHERE migration_name = '0005_add_partial_to_sync_status';
    " | tr -d ' ')
    
    if [ "$MIGRATION_STATUS" = "failed" ]; then
        log_warn "Міграція позначена як failed, але PARTIAL існує"
        log_info "Виправлення статусу міграції..."
        
        # Оновити міграцію як успішну
        cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms << EOF
UPDATE "_prisma_migrations"
SET 
    finished_at = COALESCE(finished_at, started_at, NOW()),
    rolled_back_at = NULL,
    applied_steps_count = 1
WHERE migration_name = '0005_add_partial_to_sync_status'
  AND finished_at IS NULL;
EOF
        
        log_info "✓ Міграція позначена як успішна"
    elif [ "$MIGRATION_STATUS" = "finished" ]; then
        log_info "✓ Міграція вже позначена як успішна"
    else
        log_warn "Невідомий статус міграції: $MIGRATION_STATUS"
    fi
else
    log_warn "PARTIAL не існує - потрібно застосувати міграцію"
    
    # Спробувати застосувати міграцію вручну
    log_info "Спроба застосувати міграцію вручну..."
    if cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms -c "ALTER TYPE \"SyncStatus\" ADD VALUE 'PARTIAL';" 2>/dev/null; then
        log_info "✓ PARTIAL додано вручну"
        
        # Позначити міграцію як успішну
        cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms << EOF
UPDATE "_prisma_migrations"
SET 
    finished_at = COALESCE(finished_at, started_at, NOW()),
    rolled_back_at = NULL,
    applied_steps_count = 1
WHERE migration_name = '0005_add_partial_to_sync_status'
  AND finished_at IS NULL;
EOF
        log_info "✓ Міграція позначена як успішна"
    else
        log_error "Не вдалося додати PARTIAL"
        exit 1
    fi
fi

# Видалити всі failed міграції (якщо є)
log_info "Перевірка інших failed міграцій..."
FAILED_COUNT=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms -t -c "
    SELECT COUNT(*) 
    FROM \"_prisma_migrations\" 
    WHERE finished_at IS NULL 
      AND rolled_back_at IS NULL;
" | tr -d ' ')

if [ "$FAILED_COUNT" -gt 0 ]; then
    log_warn "Знайдено $FAILED_COUNT failed міграцій"
    log_info "Видалення failed міграцій (якщо вони не потрібні)..."
    
    # Видалити тільки міграцію 0005, якщо вона failed
    cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms << EOF
DELETE FROM "_prisma_migrations"
WHERE migration_name = '0005_add_partial_to_sync_status'
  AND finished_at IS NULL
  AND rolled_back_at IS NULL;
EOF
    
    log_info "✓ Failed міграція видалена"
fi

echo ""
log_info "=========================================="
log_info "Виправлення завершено!"
log_info "=========================================="
echo ""
log_info "Тепер можна запустити міграції:"
echo "  cd /opt/qms/apps/api"
echo "  export DATABASE_URL=\"postgresql://$DB_USER:qms_password_secure@localhost:5432/qms\""
echo "  npm run db:migrate:deploy"
echo ""
