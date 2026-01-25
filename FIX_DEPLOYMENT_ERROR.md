# Виправлення помилки: Invalid input value for enum "SyncStatus":"PARTIAL"

## Проблема

Помилка в журналах MediaSense інтеграції:
```
Invalid input value for enum "SyncStatus":"PARTIAL"
PostgreSQL Error Code: 22P021
```

**Причина:** В схемі Prisma enum `SyncStatus` містить значення `PARTIAL`, але в базі даних PostgreSQL це значення відсутнє в enum типі.

## Рішення

### Варіант 1: Застосувати міграцію Prisma (рекомендовано)

```bash
cd apps/api
npm run db:migrate:deploy
```

Або якщо використовуєте Docker:
```bash
docker-compose exec api npm run db:migrate:deploy
```

### Варіант 2: Виконати SQL напряму в базі даних

Якщо Prisma недоступний, виконайте SQL напряму:

```bash
# Підключитися до PostgreSQL
psql -U qms_user -d qms

# Або через Docker
docker-compose exec postgres psql -U qms_user -d qms
```

Потім виконайте:
```sql
ALTER TYPE "SyncStatus" ADD VALUE 'PARTIAL';
```

Або використайте готовий скрипт:
```bash
psql -U qms_user -d qms -f apps/api/prisma/migrations/0005_add_partial_to_sync_status/FIX_SYNC_STATUS_ENUM.sql
```

### Варіант 3: Через Docker Compose

```bash
# Виконати SQL команду через docker-compose
docker-compose exec postgres psql -U qms_user -d qms -c "ALTER TYPE \"SyncStatus\" ADD VALUE 'PARTIAL';"
```

## Перевірка

Після застосування міграції перевірте, що значення додано:

```sql
SELECT unnest(enum_range(NULL::"SyncStatus")) AS sync_status_values;
```

Повинно показати:
- IDLE
- IN_PROGRESS
- SUCCESS
- FAILED
- PARTIAL ← нове значення

## Що робить міграція

Міграція `0005_add_partial_to_sync_status` додає значення `PARTIAL` до існуючого enum типу `SyncStatus` в PostgreSQL.

**Файл міграції:** `apps/api/prisma/migrations/0005_add_partial_to_sync_status/migration.sql`

## Після виправлення

1. Перезапустіть API сервіс:
   ```bash
   docker-compose restart api
   ```

2. Перевірте синхронізацію MediaSense:
   - Відкрийте журнали інтеграції MediaSense
   - Перевірте, що помилка зникла
   - Запустіть синхронізацію вручну для тестування

3. Моніторинг:
   ```bash
   # Перевірити статус синхронізації
   curl -H "Authorization: Bearer $JWT" \
     http://localhost:3000/api/recordings/admin/sync-status
   ```

## Додаткова інформація

- **Місце помилки:** `media-sense-sync.service.ts:922:33`
- **Використання PARTIAL:** 
  - Лінія 258: `SyncStatus.PARTIAL` при помилках під час синхронізації
  - Лінія 415: `SyncStatus.PARTIAL` під час backfill, якщо не завершено

Значення `PARTIAL` використовується для позначення частково успішної синхронізації (деякі записи синхронізовано, але були помилки).
