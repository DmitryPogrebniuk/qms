#!/bin/bash
#
# Скрипт для позначення міграції як застосованої, якщо enum PARTIAL вже існує
#

set -e

echo "Позначення міграції 0005_add_partial_to_sync_status як застосованої..."

# Визначити docker-compose файл
if [ -f "infra/docker-compose.yml" ]; then
    COMPOSE_FILE="infra/docker-compose.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

# Визначити DB user
if cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U qms_user -d qms -c "SELECT 1;" > /dev/null 2>&1; then
    DB_USER="qms_user"
else
    DB_USER="qms"
fi

# Перевірити, чи PARTIAL існує
PARTIAL_EXISTS=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms -t -c "
    SELECT COUNT(*) 
    FROM pg_enum 
    WHERE enumlabel = 'PARTIAL' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SyncStatus');
" | tr -d ' ')

if [ "$PARTIAL_EXISTS" = "1" ]; then
    echo "✓ PARTIAL існує в enum"
    
    # Перевірити, чи міграція вже застосована
    MIGRATION_EXISTS=$(cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms -t -c "
        SELECT COUNT(*) 
        FROM \"_prisma_migrations\" 
        WHERE migration_name = '0005_add_partial_to_sync_status';
    " | tr -d ' ')
    
    if [ "$MIGRATION_EXISTS" = "0" ]; then
        echo "Додавання запису про міграцію вручну..."
        
        cd /opt/qms && sudo docker compose -f "$COMPOSE_FILE" exec postgres psql -U "$DB_USER" -d qms << EOF
INSERT INTO "_prisma_migrations" (
    id,
    checksum,
    finished_at,
    migration_name,
    logs,
    rolled_back_at,
    started_at,
    applied_steps_count
) VALUES (
    gen_random_uuid()::text,
    '',
    NOW(),
    '0005_add_partial_to_sync_status',
    NULL,
    NULL,
    NOW(),
    1
);
EOF
        
        echo "✓ Міграція позначена як застосована"
    else
        echo "✓ Міграція вже застосована"
    fi
else
    echo "PARTIAL не існує - міграція повинна застосуватися нормально"
fi
