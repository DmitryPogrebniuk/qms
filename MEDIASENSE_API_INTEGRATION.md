# API взаємодії з MediaSense - Технічна документація

## Огляд

Система QMS інтегрується з Cisco MediaSense для отримання метаданих записів та потокової передачі аудіо. Інтеграція реалізована через REST API MediaSense з підтримкою аутентифікації, синхронізації метаданих та безпечного стримінгу аудіо.

---

## Архітектура модуля

### Компоненти

1. **MediaSenseClientService** - HTTP клієнт для взаємодії з MediaSense API
2. **MediaSenseSyncService** - Синхронізація метаданих записів
3. **MediaSenseStreamService** - Потокова передача аудіо файлів
4. **MediaSenseIngestionService** - Інкрементальна інґестія метаданих
5. **MediaSenseLogger** - Спеціалізоване логування інтеграції
6. **MediaSenseIntegrationController** - REST API для управління інтеграцією

---

## 1. MediaSenseClientService - HTTP Клієнт

### Призначення
Базовий HTTP клієнт для всіх запитів до MediaSense API з підтримкою:
- Аутентифікації (JSESSIONID або Basic Auth)
- Автоматичного повтору запитів при помилках
- Логування всіх запитів/відповідей
- Обробки помилок з детальними повідомленнями

### Конфігурація

```typescript
interface MediaSenseClientConfig {
  baseUrl: string;        // https://192.168.200.133:8440
  apiKey: string;         // Username для Basic Auth
  apiSecret: string;      // Password для Basic Auth
  timeout?: number;       // Таймаут запитів (default: 10000ms)
  allowSelfSigned?: boolean; // Дозволити самопідписані сертифікати
}
```

### Методи аутентифікації

#### 1.1. Primary Login (JSESSIONID)
```typescript
POST /ora/authenticationService/authentication/login
Body: { username, password }
Response: Set-Cookie: JSESSIONID=...
```

#### 1.2. Alternative Login (Basic Auth)
Якщо primary метод не працює, використовується Basic Authentication:
```typescript
GET /ora/serviceInfo
Headers: Authorization: Basic <base64(username:password)>
```

### Основні методи

#### `login(): Promise<MediaSenseSession>`
- Автоматично вибирає метод аутентифікації
- Зберігає сесію з терміном дії 30 хвилин
- Повертає об'єкт сесії з JSESSIONID або Basic Auth токеном

#### `request<T>(method, path, body?, options?): Promise<MediaSenseResponse<T>>`
- Виконує автентифікований HTTP запит
- Автоматично оновлює сесію при закінченні терміну
- Підтримує retry з exponential backoff (до 2 спроб)
- Логує всі запити з requestId для трейсингу

#### `querySessions(params): Promise<MediaSenseResponse<any[]>>`
Запит метаданих сесій з фільтрами:
```typescript
{
  startTime: string;      // ISO timestamp
  endTime: string;        // ISO timestamp
  limit?: number;         // Кількість записів (default: 100)
  offset?: number;        // Пагінація
  agentId?: string;       // Фільтр по агенту
  direction?: string;     // inbound/outbound/internal
  ani?: string;           // Caller number
  dnis?: string;          // Dialed number
}
```

**Endpoint**: `POST /ora/queryService/query/sessions`

**Альтернативні endpoints** (для різних версій MediaSense):
- `/ora/recording/api/sessions`
- `/ora/api/v1/sessions`

#### `getMediaUrl(sessionId, trackIndex?): Promise<MediaSenseResponse<string>>`
Отримує URL для потокової передачі аудіо:
- Перевіряє кілька можливих endpoints
- Повертає URL або redirect location
- Default: `/ora/mediaService/media/session/{sessionId}/track/{trackIndex}`

#### `streamMedia(sessionId, trackIndex?, range?): Promise<StreamResult>`
Потокова передача аудіо з підтримкою HTTP Range:
```typescript
{
  stream: ReadableStream;
  headers: {
    'Content-Type': string;
    'Content-Length': string;
    'Accept-Ranges': 'bytes';
    'Content-Range'?: string;  // При Range запиті
  };
  statusCode: number;  // 200 або 206 (Partial Content)
}
```

#### `testConnection(): Promise<TestConnectionResult>`
Комплексна перевірка підключення:
1. **URL Validation** - перевірка формату URL
2. **Authentication** - тест логіну
3. **API Access** - тест доступу до API endpoints

Повертає детальні рекомендації при помилках.

---

## 2. MediaSenseSyncService - Синхронізація метаданих

### Призначення
Періодична синхронізація метаданих записів з MediaSense до локальної БД та OpenSearch.

### Стратегія синхронізації

#### 2.1. Incremental Sync (Інкрементальна)
- **Частота**: Кожні 5 хвилин (Cron)
- **Watermark**: Використовує `endTime` останнього синхронізованого запису
- **Overlap Window**: 30 хвилин назад від watermark (для "дозрівання" записів)
- **Pagination**: Обробка по 100 записів за раз
- **Max Pages**: Обмеження до 50 сторінок за один цикл

#### 2.2. Backfill (Історичні дані)
- **Тригер**: Автоматично при першому запуску або після скидання стану
- **Стратегія**: Обробка по 1 дню за раз
- **Retention**: За замовчуванням 180 днів (6 місяців)
- **Max Batches**: До 7 днів за один цикл синхронізації

### Процес синхронізації

```typescript
async runIncrementalSync(triggeredBy: string): Promise<SyncResult>
```

**Кроки:**
1. Перевірка наявності активного синхронізації (захист від конкурентності)
2. Отримання checkpoint з БД (останній `lastSyncTime`)
3. Розрахунок часового діапазону з overlap window
4. Запит сесій з MediaSense з пагінацією
5. Нормалізація даних (маппінг полів MediaSense → QMS)
6. Upsert в PostgreSQL (idempotent операція)
7. Індексація в OpenSearch (асинхронно)
8. Оновлення checkpoint

### Нормалізація даних

Маппінг полів з MediaSense API до внутрішнього формату:

```typescript
MediaSense → QMS
- sessionId → mediasenseSessionId
- recordingId → mediasenseRecordingId
- sessionStartTime → startTime
- sessionEndTime → endTime
- agent.id → agentId (зв'язок з таблицею Agent)
- team.id → teamCode
- callDirection → direction (inbound/outbound/internal)
- callerNumber → ani
- calledNumber → dnis
- queue → csq
- wrapUp.reason → wrapUpReason
- media.url → audioUrl
- participants[] → RecordingParticipant[]
- tags → RecordingTag[]
```

### Обробка помилок

- **Retry Logic**: Автоматичний повтор при тимчасових помилках
- **Error Tracking**: Логування помилок без зупинки процесу
- **Status Tracking**: Збереження статусу (SUCCESS, PARTIAL, FAILED) в SyncState
- **Correlation ID**: Унікальний ID для трейсингу кожного циклу синхронізації

### Checkpoint Management

```typescript
interface SyncCheckpoint {
  lastSyncTime: string;        // ISO timestamp останнього запису
  lastSeenId?: string;          // ID для tie-breaking
  backfillComplete: boolean;    // Чи завершено backfill
  backfillProgress?: {           // Прогрес backfill
    currentDate: string;
    startDate: string;
    endDate: string;
  };
}
```

Checkpoint зберігається в таблиці `SyncState` як JSON.

---

## 3. MediaSenseStreamService - Потокова передача аудіо

### Призначення
Безпечний проксі для потокової передачі аудіо файлів з MediaSense без локального зберігання.

### Методи

#### `getStreamUrl(recordingId): Promise<string>`
Отримує URL для стримінгу на основі `mediasenseRecordingId`:
```
https://{MEDIASENSE_HOST}:{PORT}/api/recordings/{mediasenseRecordingId}/stream
```

#### `streamRecording(recordingId, rangeHeader?): Promise<Stream>`
Потокова передача з підтримкою HTTP Range:

**Без Range:**
```
GET /api/recordings/{id}/stream
→ 200 OK
→ Stream: [весь файл]
```

**З Range (для seeking в браузері):**
```
GET /api/recordings/{id}/stream
Range: bytes=0-1023
→ 206 Partial Content
→ Content-Range: bytes 0-1023/5242880
→ Stream: [перші 1024 байти]
```

**Реалізація:**
1. Перевірка доступу користувача до запису
2. Отримання `mediasenseRecordingId` з БД
3. Запит до MediaSense з Basic Auth
4. Проксіювання stream з MediaSense до клієнта
5. Передача заголовків (Content-Type, Content-Length, Accept-Ranges)

### Безпека

- **Authorization**: Перевірка RBAC перед стримінгом
- **Audit Logging**: Логування всіх подій відтворення
- **Rate Limiting**: Обмеження кількості одночасних стримів (3 на користувача)
- **No Local Storage**: Аудіо не зберігається локально, тільки проксіюється

---

## 4. MediaSenseIngestionService - Інґестія метаданих

### Призначення
Альтернативний сервіс для інкрементальної інґестії метаданих (застарілий, використовується MediaSenseSyncService).

### Розклад
```typescript
@Cron('*/30 * * * *')  // Кожні 30 хвилин
async ingestMetadata()
```

### Процес
1. Отримання watermark з `SyncState`
2. Запит нових записів з MediaSense API
3. Batch обробка по 100 записів
4. Upsert в таблицю `Recording`
5. Оновлення watermark

---

## 5. MediaSenseLogger - Логування

### Призначення
Спеціалізований логер для MediaSense інтеграції з:
- Файловим ротаційним логуванням
- In-memory буфером (останні 1000 записів)
- Маскуванням чутливих даних
- Runtime зміною рівня логування

### Рівні логування
- **ERROR** (0): Критичні помилки
- **WARN** (1): Попередження
- **INFO** (2): Інформаційні повідомлення (default)
- **DEBUG** (3): Детальна діагностика

### Маскування даних
Автоматично маскує в логах:
- `password`, `secret`, `apiKey`, `apiSecret`
- `JSESSIONID` cookies
- `Authorization` headers
- URLs з credentials

### API для UI
```typescript
queryLogs({
  level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  cursor?: string;      // Timestamp для пагінації
  limit?: number;       // Кількість записів
  search?: string;      // Пошук в повідомленнях
}): Promise<LogQueryResult>
```

---

## 6. MediaSenseIntegrationController - REST API

### Endpoints

#### `PUT /integrations/mediasense`
Збереження конфігурації MediaSense (тільки ADMIN):
```json
{
  "apiUrl": "https://192.168.200.133:8440",
  "apiKey": "admin",
  "apiSecret": "password",
  "allowSelfSigned": false,
  "timeout": 10000
}
```

#### `POST /integrations/mediasense/test`
Тест підключення з наданими credentials:
```json
Response: {
  "success": true,
  "message": "MediaSense connection successful",
  "details": [
    { "step": "URL Validation", "status": "ok" },
    { "step": "Authentication", "status": "ok", "duration": 234 },
    { "step": "API Access", "status": "ok", "duration": 567 }
  ],
  "recommendations": []
}
```

#### `GET /integrations/mediasense/logs`
Отримання логів з фільтрацією:
```
Query params:
- level: ERROR | WARN | INFO | DEBUG
- cursor: timestamp для пагінації
- limit: кількість записів (default: 100)
- search: пошук в повідомленнях
```

#### `POST /integrations/mediasense/logs/clear`
Очищення логів (архівування поточного файлу)

#### `PUT /integrations/mediasense/logs/level`
Встановлення рівня логування:
```json
{ "level": "DEBUG" }
```

#### `GET /integrations/mediasense/status`
Статус інтеграції:
```json
{
  "configured": true,
  "logLevel": "INFO",
  "logBufferSize": 1234
}
```

---

## 7. Інтеграція з Recordings API

### Endpoints, що використовують MediaSense

#### `GET /api/recordings/:id/stream`
Потокова передача аудіо через MediaSense:
1. Перевірка доступу (RBAC)
2. Логування події відтворення
3. Виклик `MediaSenseStreamService.streamRecording()`
4. Проксіювання stream з MediaSense

#### `GET /api/recordings/search`
Пошук записів з метаданими з MediaSense:
- Фільтр по `mediasenseSessionId`
- Пошук в OpenSearch (індексовані дані з MediaSense)

#### `GET /api/recordings/:id`
Деталі запису з перевіркою доступності аудіо в MediaSense:
```json
{
  "id": "rec-id",
  "mediasenseSessionId": "MS_001",
  "mediasenseRecordingId": "MS_REC_001",
  "audioStatus": {
    "available": true,
    "url": "https://mediasense:8440/ora/media/..."
  }
}
```

---

## 8. Конфігурація

### Environment Variables

```env
# MediaSense Connection
MEDIASENSE_HOST=192.168.200.133
MEDIASENSE_PORT=8443
MEDIASENSE_USERNAME=admin
MEDIASENSE_PASSWORD=password

# Або через IntegrationSetting в БД
# (пріоритет над env vars)
```

### Database Configuration

Конфігурація зберігається в таблиці `IntegrationSetting`:
```sql
{
  "integrationType": "mediasense",
  "isEnabled": true,
  "isConfigured": true,
  "settings": {
    "apiUrl": "https://192.168.200.133:8440",
    "apiKey": "admin",
    "apiSecret": "password",
    "allowSelfSigned": false,
    "timeout": 10000
  }
}
```

---

## 9. Обробка помилок

### Типи помилок та обробка

#### Network Errors
- **ECONNREFUSED**: MediaSense сервер недоступний
- **ENOTFOUND**: DNS помилка
- **ETIMEDOUT**: Таймаут підключення
- **Обробка**: Retry з exponential backoff

#### Authentication Errors
- **401 Unauthorized**: Невірні credentials
- **403 Forbidden**: Недостатньо прав
- **Обробка**: Повернення детального повідомлення

#### API Errors
- **404 Not Found**: Endpoint не існує (можлива інша версія MediaSense)
- **500 Internal Server Error**: Помилка MediaSense
- **Обробка**: Спробувати альтернативні endpoints

#### TLS Errors
- **CERT_HAS_EXPIRED**: Сертифікат прострочений
- **UNABLE_TO_VERIFY_LEAF_SIGNATURE**: Проблема з сертифікатом
- **Обробка**: Дозволити self-signed для тестування

---

## 10. Моніторинг та діагностика

### Sync Status

```typescript
GET /api/recordings/admin/sync-status
```

Повертає:
- Статус синхронізації (IDLE, IN_PROGRESS, SUCCESS, FAILED)
- Статистику (fetched, created, updated, skipped, errors)
- Останній checkpoint
- Історію останніх 10 синхронізацій

### Logs

```typescript
GET /integrations/mediasense/logs?level=ERROR&limit=50
```

Фільтрація по:
- Рівню логування
- Тексту повідомлення
- Timestamp (cursor-based pagination)

### Manual Triggers

```typescript
POST /api/recordings/admin/sync-now    // Запуск синхронізації
POST /api/recordings/admin/sync-reset  // Скидання стану
```

---

## 11. Best Practices

### Безпека
1. ✅ Використовувати HTTPS для MediaSense
2. ✅ Не зберігати credentials в коді (тільки env vars або БД)
3. ✅ Маскувати чутливі дані в логах
4. ✅ Перевіряти RBAC перед стримінгом
5. ✅ Логувати всі події доступу

### Продуктивність
1. ✅ Використовувати пагінацію (100 записів за раз)
2. ✅ Обмежувати кількість сторінок за цикл (50)
3. ✅ Асинхронна індексація в OpenSearch
4. ✅ Кешування сесій MediaSense (30 хв)
5. ✅ Rate limiting для стримінгу

### Надійність
1. ✅ Retry logic з exponential backoff
2. ✅ Idempotent upsert операції
3. ✅ Checkpoint для відновлення після збоїв
4. ✅ Overlap window для "дозрівання" записів
5. ✅ Детальне логування з correlation IDs

### Підтримка різних версій MediaSense
1. ✅ Пробувати альтернативні endpoints
2. ✅ Підтримка різних форматів аутентифікації
3. ✅ Нормалізація різних форматів відповідей
4. ✅ Гнучка конфігурація endpoints

---

## 12. Приклади використання

### Тест підключення
```bash
curl -X POST http://localhost:3000/api/integrations/mediasense/test \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://192.168.200.133:8440",
    "apiKey": "admin",
    "apiSecret": "password"
  }'
```

### Запуск синхронізації
```bash
curl -X POST http://localhost:3000/api/recordings/admin/sync-now \
  -H "Authorization: Bearer $JWT"
```

### Перегляд логів
```bash
curl "http://localhost:3000/api/integrations/mediasense/logs?level=ERROR&limit=20" \
  -H "Authorization: Bearer $JWT"
```

### Стримінг аудіо
```bash
curl "http://localhost:3000/api/recordings/{id}/stream" \
  -H "Authorization: Bearer $JWT" \
  -H "Range: bytes=0-1023" \
  -o audio.wav
```

---

## 13. Troubleshooting

### Проблема: Authentication failed
**Рішення:**
- Перевірити credentials в IntegrationSetting
- Спробувати Basic Auth (встановити `allowSelfSigned: true` для тесту)
- Перевірити версію MediaSense та endpoints

### Проблема: Sync не працює
**Рішення:**
- Перевірити статус: `GET /api/recordings/admin/sync-status`
- Переглянути логи: `GET /integrations/mediasense/logs?level=ERROR`
- Перезапустити sync: `POST /api/recordings/admin/sync-now`
- Скинути стан: `POST /api/recordings/admin/sync-reset`

### Проблема: Audio stream не працює
**Рішення:**
- Перевірити доступність MediaSense
- Перевірити `mediasenseRecordingId` в БД
- Перевірити логи MediaSenseLogger
- Тестувати напряму MediaSense URL

### Проблема: Slow sync performance
**Рішення:**
- Зменшити `DEFAULT_PAGE_SIZE` (за замовчуванням 100)
- Зменшити `MAX_PAGES_PER_SYNC` (за замовчуванням 50)
- Перевірити мережеве підключення до MediaSense
- Оптимізувати запити до БД (індекси)

---

## 14. Майбутні покращення

- [ ] WebSocket підписка на події MediaSense (real-time sync)
- [ ] Підтримка MediaSense кластерів (load balancing)
- [ ] Кешування метаданих для швидшого пошуку
- [ ] Batch індексація в OpenSearch
- [ ] Метрики Prometheus для моніторингу
- [ ] Distributed tracing (Jaeger) для діагностики

---

**Версія документа**: 1.0  
**Останнє оновлення**: Січень 2026  
**Автор**: QMS Development Team
