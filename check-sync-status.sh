#!/bin/bash
#
# Перевірка статусу синхронізації MediaSense
# Використання: sudo ./check-sync-status.sh
#

cd /opt/qms || exit 1

echo "Статус синхронізації MediaSense:"
echo ""

# Правильна команда з приведенням типу
sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms_user -d qms << 'EOF'
SELECT 
    "syncType",
    status,
    (checkpoint::jsonb)->>'backfillComplete' as backfill_complete,
    (checkpoint::jsonb)->>'lastSyncTime' as last_sync,
    "totalFetched",
    "totalCreated",
    "totalUpdated",
    "lastSyncedAt"
FROM "SyncState" 
WHERE "syncType" = 'mediasense_recordings';
EOF

echo ""
echo "Останні записи синхронізації:"
sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms_user -d qms -c "
SELECT 
    COUNT(*) as total_records,
    MIN(\"startTime\") as oldest,
    MAX(\"startTime\") as newest
FROM \"Recording\";
"
