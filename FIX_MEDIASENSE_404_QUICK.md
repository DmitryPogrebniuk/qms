# Швидке виправлення MediaSense 404 помилки

## Проблема

```
ERROR [MediasenseIngestionService] AxiosError: Request failed with status code 404
```

**Причина:** `MediaSenseIngestionService` використовує неправильний endpoint `/api/recordings`, який не існує в MediaSense API.

## Рішення

Старий `MediaSenseIngestionService` вимкнено. Використовується `MediaSenseSyncService`, який працює з правильними endpoints.

### Перевірка після виправлення

```bash
# Перезапустити API
docker-compose restart api

# Перевірити логи - не повинно бути помилок 404 від MediaSenseIngestionService
docker-compose logs api | grep -i "mediasense.*404"

# Перевірити, що MediaSenseSyncService працює
docker-compose logs api | grep "MediaSenseSyncService" | tail -10
```

### Якщо потрібно повністю видалити старий сервіс

Можна видалити `MediaSenseIngestionService` з модуля:

**Файл:** `apps/api/src/modules/media-sense/media-sense.module.ts`

```typescript
// Видалити імпорт
// import { MediaSenseIngestionService } from './media-sense-ingestion.service';

// Видалити з providers
providers: [
  // MediaSenseIngestionService,  // Видалити
  MediaSenseStreamService,
  // ...
],

// Видалити з exports
exports: [
  // MediaSenseIngestionService,  // Видалити
  // ...
],
```

Але зараз достатньо просто вимкнути Cron - це вже зроблено.
