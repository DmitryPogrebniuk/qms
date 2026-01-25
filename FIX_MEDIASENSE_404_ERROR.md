# Виправлення помилки: MediaSense 404 - endpoint not found

## Проблема

```
ERROR [MediasenseIngestionService] AxiosError: Request failed with status code 404
ERROR [MediasenseIngestionService] Metadata ingestion failed
```

**Причина:** `MediaSenseIngestionService` використовує неправильний endpoint `/api/recordings`, який не існує в MediaSense API.

MediaSense використовує endpoints з префіксом `/ora/`, наприклад:
- `/ora/queryService/query/sessions`
- `/ora/queryService/query/sessionBySessionId`

## Рішення

### Варіант 1: Вимкнути старий MediaSenseIngestionService (рекомендовано)

Якщо ви використовуєте новий `MediaSenseSyncService`, старий `MediaSenseIngestionService` не потрібен.

**Перевірте, який сервіс активний:**

```bash
# Перевірити логи - чи працює MediaSenseSyncService
docker-compose logs api | grep -i "mediasense.*sync"
```

Якщо `MediaSenseSyncService` працює, вимкніть `MediaSenseIngestionService`:

**Спосіб A: Коментувати Cron в коді**

Відредагуйте `apps/api/src/modules/media-sense/media-sense-ingestion.service.ts`:

```typescript
// Закоментувати цей метод
// @Cron('*/30 * * * *')
// async ingestMetadata(): Promise<void> {
//   ...
// }
```

**Спосіб B: Вимкнути через конфігурацію**

Додайте в `.env`:
```env
MEDIASENSE_INGESTION_ENABLED=false
```

І оновіть код:
```typescript
@Cron('*/30 * * * *')
async ingestMetadata(): Promise<void> {
  if (!this.configService.get<boolean>('MEDIASENSE_INGESTION_ENABLED', true)) {
    return;
  }
  // ... решта коду
}
```

### Варіант 2: Виправити endpoint в MediaSenseIngestionService

Замініть неправильний endpoint на правильний MediaSense API:

**Файл:** `apps/api/src/modules/media-sense/media-sense-ingestion.service.ts`

**Замінити:**
```typescript
const response = await this.httpService.axiosRef.get(
  `https://${host}:${port}/api/recordings?startTime=${watermark}&limit=${batchSize}&offset=${offset}`,
```

**На:**
```typescript
// Використати MediaSenseClientService замість прямого HTTP запиту
// Або використати правильний endpoint
const response = await this.httpService.axiosRef.post(
  `https://${host}:${port}/ora/queryService/query/sessions`,
  {
    queryType: 'sessions',
    conditions: [
      {
        field: 'sessionEndTime',
        operator: 'gte',
        value: watermark,
      },
    ],
    paging: {
      offset: offset,
      limit: batchSize,
    },
  },
```

**Або краще - використати MediaSenseClientService:**

```typescript
// Інжектувати MediaSenseClientService
constructor(
  private readonly configService: ConfigService,
  private readonly httpService: HttpService,
  private readonly prisma: PrismaService,
  private readonly mediaSenseClient: MediaSenseClientService, // Додати
) {}

// Використати в методі
private async _fetchRecordingMetadata(watermark: string, offset: number): Promise<any[]> {
  const fromTime = new Date(watermark);
  const toTime = new Date();
  
  const response = await this.mediaSenseClient.querySessions({
    startTime: fromTime.toISOString(),
    endTime: toTime.toISOString(),
    offset: offset,
    limit: batchSize || 100,
  });
  
  if (!response.success || !response.data) {
    return [];
  }
  
  return response.data;
}
```

### Варіант 3: Використовувати тільки MediaSenseSyncService

`MediaSenseSyncService` вже використовує правильні endpoints через `MediaSenseClientService`. 

**Переконайтеся, що MediaSenseSyncService активний:**

```bash
# Перевірити логи
docker-compose logs api | grep "MediaSenseSyncService"

# Має бути:
# [MediaSenseSyncService] Starting incremental sync
# [MediaSenseSyncService] Backfill batch: ...
```

**Якщо не працює, перевірте конфігурацію:**

```bash
# Перевірити налаштування MediaSense
docker-compose exec api sh -c 'env | grep MEDIASENSE'
```

## Швидке виправлення (тимчасове)

Вимкнути MediaSenseIngestionService через зміну Cron на дуже рідкісний запуск:

```typescript
// В media-sense-ingestion.service.ts
// Змінити з:
@Cron('*/30 * * * *')  // Кожні 30 хвилин

// На:
@Cron('0 0 1 1 *')  // Раз на рік (практично вимкнено)
```

Або просто закоментувати метод `ingestMetadata()`.

## Перевірка після виправлення

```bash
# Перевірити, що MediaSenseIngestionService не виконується
docker-compose logs api | grep "MediasenseIngestionService" | tail -20

# Перевірити, що MediaSenseSyncService працює
docker-compose logs api | grep "MediaSenseSyncService" | tail -20

# Перевірити статус синхронізації
curl -H "Authorization: Bearer $JWT" \
  http://localhost:3000/api/recordings/admin/sync-status
```

## Рекомендація

**Використовуйте тільки `MediaSenseSyncService`** - він:
- ✅ Використовує правильні MediaSense API endpoints
- ✅ Має кращу обробку помилок
- ✅ Підтримує backfill
- ✅ Має детальне логування
- ✅ Підтримує checkpoint для відновлення

**Вимкніть `MediaSenseIngestionService`** - він:
- ❌ Використовує неправильні endpoints
- ❌ Застарілий код
- ❌ Може конфліктувати з MediaSenseSyncService
