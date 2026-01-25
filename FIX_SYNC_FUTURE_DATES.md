# Виправлення: Синхронізація обробляє майбутні дати

## Проблема

Синхронізація MediaSense обробляє дати в майбутньому (2025-10-07), тому не знаходить записів:
- `last_sync: 2026-01-18T18:51:04.706Z` (майбутня дата)
- `totalFetched: 0, totalCreated: 0`
- Backfill обробляє батчі для 2025-10-07 до 2025-10-14

## Рішення

### Команда для скидання на поточні дати

```bash
cd /opt/qms && sudo git pull origin main && sudo chmod +x reset-sync-to-current-date.sh && sudo ./reset-sync-to-current-date.sh
```

### Або вручну через SQL

```bash
cd /opt/qms && sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms_user -d qms << 'EOF'
-- Скинути checkpoint на поточні дати (останні 7 днів)
UPDATE "SyncState" 
SET 
  status = 'IDLE',
  checkpoint = jsonb_build_object(
    'backfillComplete', false,
    'lastSyncTime', (NOW() - INTERVAL '7 days')::text
  ),
  "watermarkTime" = NULL,
  "errorMessage" = NULL,
  "totalFetched" = 0,
  "totalCreated" = 0,
  "totalUpdated" = 0
WHERE "syncType" = 'mediasense_recordings';

-- Показати результат
SELECT 
    "syncType",
    status,
    (checkpoint::jsonb)->>'backfillComplete' as backfill_complete,
    (checkpoint::jsonb)->>'lastSyncTime' as last_sync
FROM "SyncState" 
WHERE "syncType" = 'mediasense_recordings';
EOF

# Перезапустити API
sudo docker compose -f infra/docker-compose.yml restart api
```

## Після виконання

Через 2-3 хвилини перевірте:

```bash
# Перевірити статус
sudo ./check-sync-status.sh

# Перевірити логи
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense" | tail -30
```

## Очікуваний результат

Після виправлення:
- `last_sync` має бути датою 7 днів тому (не майбутньою)
- Синхронізація почне обробляти поточні/минулі дати
- Записи мають з'явитися в БД

## Якщо записів все ще немає

Перевірте, чи MediaSense має записи для поточного періоду:

```bash
# Тест запиту до MediaSense (останні 7 днів)
START_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S.%3NZ)
END_DATE=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)

curl -k -u admin:password -X POST https://192.168.200.133:8440/ora/queryService/query/sessions \
  -H "Content-Type: application/json" \
  -d "{
    \"queryType\": \"sessions\",
    \"conditions\": [
      {
        \"field\": \"sessionEndTime\",
        \"operator\": \"gte\",
        \"value\": \"$START_DATE\"
      }
    ],
    \"paging\": {
      \"offset\": 0,
      \"limit\": 10
    }
  }" | jq .
```

Якщо MediaSense повертає порожній результат - записів немає для цього періоду.
