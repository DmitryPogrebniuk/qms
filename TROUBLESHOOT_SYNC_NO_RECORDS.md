# Виправлення: Синхронізація працює, але записів немає в інтерфейсі

## Проблема

Синхронізація MediaSense запускається, але:
- В логах: `fetched: 0, created: 0` (немає даних)
- В інтерфейсі: "Записи не знайдено"
- Backfill обробляє батчі, але не отримує записів

## Діагностика

### 1. Перевірка даних в БД

```bash
cd /opt/qms
# Перевірити, чи є записи в таблиці Recording
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "SELECT COUNT(*) FROM \"Recording\";"

# Перевірити останні записи
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "SELECT id, \"startTime\", \"agentId\", \"mediasenseSessionId\" FROM \"Recording\" ORDER BY \"startTime\" DESC LIMIT 10;"

# Перевірити статус синхронізації
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "SELECT \"syncType\", status, \"lastSyncedAt\", \"totalFetched\", \"totalCreated\" FROM \"SyncState\" WHERE \"syncType\" = 'mediasense_recordings';"
```

### 2. Перевірка OpenSearch індексації

```bash
# Перевірити, чи є індекси в OpenSearch
curl -u admin:SecurePassword123! http://localhost:9200/_cat/indices?v

# Перевірити записи в індексі
curl -u admin:SecurePassword123! "http://localhost:9200/recordings-*/_search?pretty" -H 'Content-Type: application/json' -d'
{
  "size": 10,
  "sort": [{"startTime": {"order": "desc"}}]
}'
```

### 3. Перевірка MediaSense API

```bash
# Тест підключення до MediaSense
curl -k -u admin:password https://192.168.200.133:8440/ora/serviceInfo

# Тест запиту сесій (останні 24 години)
curl -k -u admin:password -X POST https://192.168.200.133:8440/ora/queryService/query/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "queryType": "sessions",
    "conditions": [
      {
        "field": "sessionEndTime",
        "operator": "gte",
        "value": "'$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S.%3NZ)'"
      }
    ],
    "paging": {
      "offset": 0,
      "limit": 10
    }
  }'
```

## Можливі причини та рішення

### Причина 1: MediaSense не повертає дані для вказаних дат

**Проблема:** Backfill обробляє дати в 2025 році, але MediaSense може не мати даних для цих дат.

**Рішення:** Перевірити реальні дати записів в MediaSense:

```bash
# Запит до MediaSense для поточного періоду
curl -k -u admin:password -X POST https://192.168.200.133:8440/ora/queryService/query/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "queryType": "sessions",
    "conditions": [
      {
        "field": "sessionEndTime",
        "operator": "gte",
        "value": "'$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S.%3NZ)'"
      }
    ],
    "paging": {
      "offset": 0,
      "limit": 100
    }
  }'
```

Якщо MediaSense повертає порожній результат, значить записів немає для цього періоду.

### Причина 2: Неправильний формат запиту до MediaSense API

**Проблема:** MediaSense API може вимагати інший формат запиту.

**Рішення:** Перевірити документацію MediaSense API та оновити `querySessions` метод.

**Файл:** `apps/api/src/modules/media-sense/media-sense-client.service.ts`

Можливо потрібно використати інший endpoint або формат:

```typescript
// Альтернативний формат для старіших версій MediaSense
async querySessionsAlt(params: {
  startTime: string;
  endTime: string;
  limit?: number;
  offset?: number;
}): Promise<MediaSenseResponse<any[]>> {
  // Спробувати GET запит з параметрами в URL
  const queryParams = new URLSearchParams({
    startTime: params.startTime,
    endTime: params.endTime,
    maxResults: String(params.limit || 100),
    offset: String(params.offset || 0),
  });
  
  return this.request('GET', `/ora/sessionquery?${queryParams}`);
}
```

### Причина 3: Дані не індексуються в OpenSearch

**Проблема:** Записи зберігаються в БД, але не індексуються в OpenSearch, тому не з'являються в пошуку.

**Рішення:** Перевірити логування OpenSearch:

```bash
# Перевірити логи API на помилки OpenSearch
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "opensearch\|index" | tail -30
```

Якщо є помилки індексації, перевірте підключення до OpenSearch:

```bash
# Тест підключення до OpenSearch
curl -u admin:SecurePassword123! http://localhost:9200/_cluster/health?pretty
```

### Причина 4: Фільтри пошуку занадто обмежені

**Проблема:** Записи є в БД, але фільтр "Останні 7 днів" не знаходить їх, бо дати не відповідають.

**Рішення:** Перевірити дати записів:

```bash
# Знайти найстаріший та найновіший запис
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "
SELECT 
  MIN(\"startTime\") as oldest,
  MAX(\"startTime\") as newest,
  COUNT(*) as total
FROM \"Recording\";
"
```

Якщо записи є, але дати не відповідають фільтру, спробуйте:
- Змінити фільтр на "Власний" (Custom) з більш широким діапазоном
- Перевірити часовий пояс (можливо записи в UTC, а інтерфейс показує локальний час)

### Причина 5: Backfill обробляє майбутні дати

**Проблема:** В логах видно backfill для серпня 2025, що в майбутньому.

**Рішення:** Скинути checkpoint синхронізації:

```bash
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms << 'EOF'
-- Скинути checkpoint для MediaSense синхронізації
UPDATE "SyncState" 
SET 
  status = 'IDLE',
  checkpoint = '{"backfillComplete": false, "lastSyncTime": ""}'::jsonb,
  "watermarkTime" = NULL,
  "errorMessage" = NULL
WHERE "syncType" = 'mediasense_recordings';
EOF
```

Потім перезапустити синхронізацію:

```bash
# Перезапустити API для нового циклу синхронізації
sudo docker compose -f infra/docker-compose.yml restart api
```

## Швидке виправлення

### Крок 1: Перевірити, чи MediaSense повертає дані

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
      },
      {
        \"field\": \"sessionEndTime\",
        \"operator\": \"lte\",
        \"value\": \"$END_DATE\"
      }
    ],
    \"paging\": {
      \"offset\": 0,
      \"limit\": 10
    }
  }"
```

### Крок 2: Скинути синхронізацію та перезапустити

```bash
cd /opt/qms

# Скинути checkpoint
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "
UPDATE \"SyncState\" 
SET status = 'IDLE', checkpoint = '{\"backfillComplete\": false}'::jsonb
WHERE \"syncType\" = 'mediasense_recordings';
"

# Перезапустити API
sudo docker compose -f infra/docker-compose.yml restart api

# Перевірити логи через 1-2 хвилини
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense" | tail -30
```

### Крок 3: Перевірити дані в БД

```bash
# Через 5-10 хвилин після перезапуску перевірити
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "
SELECT 
  COUNT(*) as total_records,
  MIN(\"startTime\") as oldest,
  MAX(\"startTime\") as newest
FROM \"Recording\";
"
```

## Детальна діагностика

### Перевірка логів MediaSense синхронізації

```bash
# Переглянути останні логи синхронізації
sudo docker compose -f infra/docker-compose.yml logs api | grep -A 5 -B 5 "MediaSenseSyncService" | tail -50

# Перевірити помилки
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "error.*mediasense" | tail -20
```

### Перевірка конфігурації MediaSense

```bash
# Перевірити налаштування MediaSense в БД
sudo docker compose -f infra/docker-compose.yml exec postgres psql -U qms_user -d qms -c "
SELECT \"integrationType\", \"isEnabled\", \"isConfigured\", settings->>'apiUrl' as api_url
FROM \"IntegrationSetting\" 
WHERE \"integrationType\" = 'mediasense';
"
```

## Якщо MediaSense не повертає дані

1. **Перевірте, чи є записи в MediaSense:**
   - Відкрийте MediaSense веб-інтерфейс
   - Перевірте, чи є записи для потрібного періоду

2. **Перевірте права доступу:**
   - Користувач MediaSense повинен мати права на читання записів
   - Перевірте credentials в налаштуваннях

3. **Перевірте версію MediaSense API:**
   - Різні версії MediaSense мають різні endpoints
   - Можливо потрібно оновити код для вашої версії

## Контакт для додаткової допомоги

Якщо проблема залишається:
1. Зберіть логи: `sudo docker compose -f infra/docker-compose.yml logs api > api-logs.txt`
2. Перевірте відповідь MediaSense API (використайте curl команди вище)
3. Перевірте дані в БД та OpenSearch
