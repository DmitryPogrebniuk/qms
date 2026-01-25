#!/bin/bash
#
# Простий скрипт для виправлення failed міграції
# Використання: sudo ./fix-migration-simple.sh
#

set -e

echo "Виправлення failed міграції Prisma..."
echo ""

cd /opt/qms || exit 1

# Позначити міграцію як успішну
sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms_user -d qms << 'EOF'
-- Позначити міграцію 0005 як успішну
UPDATE "_prisma_migrations"
SET 
    finished_at = COALESCE(finished_at, started_at, NOW()),
    rolled_back_at = NULL,
    applied_steps_count = 1
WHERE migration_name = '0005_add_partial_to_sync_status'
  AND finished_at IS NULL;

-- Перевірити результат
SELECT migration_name, finished_at IS NOT NULL as is_finished
FROM "_prisma_migrations"
WHERE migration_name = '0005_add_partial_to_sync_status';
EOF

echo ""
echo "✓ Міграція виправлена!"
echo ""
echo "Тепер запустіть:"
echo "  cd /opt/qms/apps/api"
echo "  export DATABASE_URL=\"postgresql://qms_user:qms_password_secure@localhost:5432/qms\""
echo "  npm run db:migrate:deploy"
