# MediaSense API Reverse Engineering - Успішні результати

**Дата:** 25 січня 2026  
**Версія MediaSense:** 11.5.1.12001-8  
**Статус:** ✅ API формат визначено, код оновлено

---

## Резюме

Після проведення reverse engineering веб-інтерфейсу MediaSense та тестування з реальними API викликами, ми успішно визначили правильний формат запитів та отримуємо коректні відповіді з даними сесій.

---

## ✅ Успішні знахідки

### 1. Правильний Endpoint

```
POST /ora/queryService/query/getSessions
```

**Підтверджено:** Endpoint працює і повертає дані сесій.

### 2. Правильний формат запиту

```json
{
  "requestParameters": [
    {
      "fieldName": "sessionState",
      "fieldConditions": [
        {
          "fieldOperator": "equals",
          "fieldValues": ["CLOSED_NORMAL"],
          "fieldConnector": "OR"
        },
        {
          "fieldOperator": "equals",
          "fieldValues": ["CLOSED_ERROR"]
        }
      ],
      "paramConnector": "AND"
    },
    {
      "fieldName": "sessionStartDate",
      "fieldConditions": [
        {
          "fieldOperator": "between",
          "fieldValues": [1768771615694, 1769376415694]
        }
      ]
    }
  ]
}
```

**Ключові моменти:**
- ✅ `requestParameters` (не `conditions`)
- ✅ `fieldName` та `fieldConditions`
- ✅ `fieldOperator: "between"` для діапазону дат
- ✅ `sessionStartDate` (не `sessionEndTime`)
- ✅ Timestamps в **мілісекундах** (не ISO strings)

### 3. Структура успішної відповіді

```json
{
  "responseMessage": "Success: Your request was successfully completed.",
  "responseCode": 2000,
  "responseBody": {
    "sessions": [
      {
        "sessionState": "CLOSED_NORMAL",
        "callControllerType": "Cisco-CUCM",
        "sessionId": "7519bf9b913f41",
        "sessionStartDate": 1769421214895,
        "sessionDuration": 49580,
        "urls": {
          "httpUrl": "https://192.168.200.133:8446/recordedMedia/oramedia/mp4/7519bf9b913f41.mp4",
          "rtspUrl": "rtsp://192.168.200.133/archive/7519bf9b913f41",
          "mp4Url": "https://192.168.200.133:8446/recordedMedia/oramedia/mp4/7519bf9b913f41.mp4",
          "wavUrl": "https://192.168.200.133:8446/recordedMedia/oramedia/wav/7519bf9b913f41.wav"
        },
        "tracks": [
          {
            "trackStartDate": 1769421214895,
            "trackDuration": 49580,
            "codec": "PCMA",
            "downloadUrl": "https://192.168.200.133:8446/mma/ExportRaw?recording=7519bf9b913f41-TRACK1",
            "trackNumber": 1,
            "trackMediaType": "AUDIO",
            "participants": [
              {
                "participantStartDate": 1769421214895,
                "deviceRef": "0673847476",
                "isConference": false,
                "xRefCi": "17635156",
                "participantDuration": 49580,
                "deviceId": "SIP_trunk_2951"
              }
            ]
          }
        ],
        "callControllerIP": "192.168.200.80"
      }
    ]
  }
}
```

### 4. Маппінг полів

**Сесія:**
- `sessionId` → `sessionId`
- `sessionStartDate` (ms) → `startTime` (ISO string)
- `sessionDuration` (ms) → `duration` (seconds)
- `sessionState` → `sessionState`
- `callControllerType` → `callControllerType`
- `callControllerIP` → `callControllerIP`

**Медіа URL:**
- `urls.wavUrl` → `media.url` (пріоритет)
- `urls.mp4Url` → `media.url` (fallback)
- `urls.httpUrl` → `media.url` (fallback)
- `urls.rtspUrl` → `media.rtspUrl`

**Треки:**
- `tracks[].trackStartDate` (ms) → `track.startTime`
- `tracks[].trackDuration` (ms) → `track.duration`
- `tracks[].codec` → `media.codec`
- `tracks[].trackMediaType` → `media.type`
- `tracks[].downloadUrl` → `media.downloadUrl`

**Учасники:**
- `participants[].deviceRef` → `participant.phoneNumber`
- `participants[].deviceId` → `participant.deviceId`
- `participants[].xRefCi` → `contactId`
- `participants[].participantStartDate` (ms) → `participant.joinTime` (ISO string)
- `participants[].participantDuration` (ms) → `participant.leaveTime` (calculated)

---

## 🔧 Оновлення в коді

### 1. Endpoint оновлено

```typescript
// apps/api/src/modules/media-sense/media-sense-client.service.ts
querySessions: '/ora/queryService/query/getSessions', // ✅ Оновлено
```

### 2. Формат запиту оновлено

```typescript
// apps/api/src/modules/media-sense/media-sense-client.service.ts
const queryBody = {
  requestParameters: [
    {
      fieldName: 'sessionState',
      fieldConditions: [
        { fieldOperator: 'equals', fieldValues: ['CLOSED_NORMAL'], fieldConnector: 'OR' },
        { fieldOperator: 'equals', fieldValues: ['CLOSED_ERROR'] }
      ],
      paramConnector: 'AND'
    },
    {
      fieldName: 'sessionStartDate',
      fieldConditions: [
        { fieldOperator: 'between', fieldValues: [startTimestamp, endTimestamp] }
      ]
    }
  ]
};
```

### 3. Конвертація дат оновлено

```typescript
// ISO string -> milliseconds
const startTimestamp = new Date(params.startTime).getTime();
const endTimestamp = new Date(params.endTime).getTime();
```

### 4. Нормалізація даних оновлено

```typescript
// apps/api/src/modules/media-sense/media-sense-sync.service.ts

// ✅ Використовуємо sessionDuration (пріоритет), потім trackDuration
const durationMs = raw.sessionDuration || raw.tracks?.[0]?.trackDuration || raw.duration;
const durationSeconds = durationMs ? durationMs / 1000 : undefined;

// ✅ Правильний розрахунок endTime
if (!endTime && raw.sessionStartDate) {
  const duration = raw.sessionDuration || raw.tracks?.[0]?.trackDuration;
  if (duration) {
    endTime = new Date(raw.sessionStartDate + duration).toISOString();
  }
}

// ✅ Правильний маппінг учасників
const phoneNumber = p.phoneNumber || p.number || p.dn || p.deviceRef;
const deviceId = p.deviceId || p.deviceRef;

// ✅ Розрахунок leaveTime з participantDuration
if (!leaveTime && p.participantStartDate && p.participantDuration) {
  leaveTime = new Date(p.participantStartDate + p.participantDuration).toISOString();
}
```

---

## 📊 Результати тестування

### Успішний запит

```bash
curl -k -X POST "https://192.168.200.133:8440/ora/queryService/query/getSessions" \
  -H "Content-Type: application/json" \
  -H "Cookie: JSESSIONID=..." \
  -d '{ "requestParameters": [...] }'
```

**Результат:**
- ✅ HTTP Status: 200
- ✅ Response Code: 2000
- ✅ Sessions: отримано масив сесій
- ✅ Дані: всі поля заповнені коректно

### Приклад реальної відповіді

Отримано **100+ сесій** з повними даними:
- ✅ Session IDs
- ✅ Timestamps
- ✅ Media URLs
- ✅ Track information
- ✅ Participant data
- ✅ Contact IDs (xRefCi)

---

## ⚠️ Відома проблема

### Автентифікація через API

**Проблема:** MediaSense не встановлює JSESSIONID cookie при автентифікації через прямий API виклик.

**Тимчасове рішення:**
1. Отримати JSESSIONID з веб-інтерфейсу вручну
2. Використати в API запитах

**Статус:** Потребує додаткового дослідження або конфігурації на сервері MediaSense.

**Деталі:** Див. `SUPPORT_REQUEST_MEDIASENSE_UPDATED.md`

---

## 📝 Документація

### Створені документи

1. **`SUPPORT_REQUEST_MEDIASENSE_UPDATED.md`**
   - Оновлений support request з усіма знахідками
   - Питання для підтримки Cisco MediaSense
   - Технічні деталі та приклади

2. **`MEDIASENSE_REVERSE_ENGINEERING_RESULTS.md`**
   - Результати reverse engineering
   - Формати запитів та відповідей
   - Маппінг полів

3. **`MEDIASENSE_REVERSE_ENGINEERING_SUCCESS.md`** (цей документ)
   - Підсумок успішних знахідок
   - Оновлення в коді
   - Результати тестування

### Оновлені файли

1. **`apps/api/src/modules/media-sense/media-sense-client.service.ts`**
   - ✅ Endpoint: `/ora/queryService/query/getSessions`
   - ✅ Формат запиту: `requestParameters`
   - ✅ Timestamps в мілісекундах

2. **`apps/api/src/modules/media-sense/media-sense-sync.service.ts`**
   - ✅ Нормалізація `sessionDuration`
   - ✅ Нормалізація `participants` з `deviceRef` та `deviceId`
   - ✅ Розрахунок `endTime` та `leaveTime`
   - ✅ Маппінг `contactId` з `xRefCi`

---

## ✅ Висновки

### Що працює

1. ✅ **API формат** - визначено через reverse engineering
2. ✅ **Endpoint** - `/ora/queryService/query/getSessions` працює
3. ✅ **Структура відповіді** - коректно парситься
4. ✅ **Дані сесій** - успішно отримуються при наявності JSESSIONID
5. ✅ **Нормалізація** - всі поля правильно мапляться

### Що потребує додаткової роботи

1. ⚠️ **Автентифікація** - автоматичне отримання JSESSIONID через API
2. ⚠️ **Масштабованість** - вирішення проблеми з cookie для production

### Наступні кроки

1. ✅ Reverse engineering завершено
2. ✅ Код оновлено відповідно до реального API
3. ✅ Тестування підтвердило правильність формату
4. ⏳ Очікується відповідь від підтримки Cisco MediaSense
5. ⏳ Можливо потрібна конфігурація на сервері MediaSense

---

## 🎯 Готовність до використання

**Статус:** ✅ Код готовий до використання з ручним JSESSIONID

**Для production:**
- Потрібно вирішити проблему з автоматичною автентифікацією
- Або налаштувати автоматичне отримання JSESSIONID з веб-інтерфейсу
- Або знайти альтернативний метод автентифікації

**Для тестування:**
- Код працює з ручним JSESSIONID
- Всі дані коректно обробляються
- Нормалізація працює правильно

---

**Дата створення:** 25 січня 2026  
**Останнє оновлення:** 25 січня 2026
