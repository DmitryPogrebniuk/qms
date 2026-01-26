# MediaSense API Integration - Оновлений Support Request

**Дата:** 25 січня 2026  
**Версія MediaSense:** 11.5.1.12001-8  
**Статус:** ✅ API формат визначено через reverse engineering, ⚠️ Проблема з автентифікацією залишається

---

## Резюме

Після проведення reverse engineering веб-інтерфейсу MediaSense 11.5.1.12001-8, ми успішно визначили правильний формат API запитів та отримуємо коректні відповіді з даними сесій. Однак залишається проблема з автоматичною автентифікацією через API - MediaSense не встановлює `JSESSIONID` cookie при автентифікації через прямий API виклик, хоча веб-інтерфейс успішно отримує та використовує цей cookie.

---

## ✅ Успішні знахідки (Reverse Engineering)

### 1. Правильний Endpoint

**Працює:**
```
POST /ora/queryService/query/getSessions
```

**НЕ працює:**
- `/ora/queryService/query/sessions` (404)
- `/ora/queryService/query/sessionBySessionId` (404)

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
- Використовується `requestParameters` (не `conditions`)
- Використовується `fieldName` та `fieldConditions`
- Використовується `fieldOperator: "between"` для діапазону дат
- Використовується `sessionStartDate` (не `sessionEndTime`)
- **Timestamps в мілісекундах** (не ISO strings)

### 3. Формат успішної відповіді

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

### 4. Структура даних сесії

**Основні поля:**
- `sessionId` - унікальний ID сесії
- `sessionStartDate` - timestamp початку в мілісекундах
- `sessionDuration` - тривалість в мілісекундах
- `sessionState` - CLOSED_NORMAL, CLOSED_ERROR, тощо
- `callControllerType` - Cisco-CUCM, тощо
- `callControllerIP` - IP адреса контролера

**Медіа URL:**
- `urls.httpUrl` - HTTP URL для медіа
- `urls.mp4Url` - MP4 URL
- `urls.wavUrl` - WAV URL
- `urls.rtspUrl` - RTSP URL

**Треки:**
- `tracks[]` - масив треків
  - `trackStartDate` - timestamp початку треку
  - `trackDuration` - тривалість треку в мілісекундах
  - `codec` - кодек (PCMA, PCMU, G722, тощо)
  - `trackMediaType` - AUDIO, VIDEO
  - `downloadUrl` - URL для завантаження сирого треку
  - `participants[]` - масив учасників треку

**Учасники:**
- `participants[].deviceRef` - посилання на пристрій (номер телефону)
- `participants[].deviceId` - ID пристрою (SIP_trunk_2951, SEP..., тощо)
- `participants[].xRefCi` - cross-reference ID (contact ID)
- `participants[].participantStartDate` - timestamp початку участі
- `participants[].participantDuration` - тривалість участі в мілісекундах
- `participants[].isConference` - чи це конференція

---

## ⚠️ Проблема з автентифікацією

### Симптоми

1. **Автентифікація через API не встановлює JSESSIONID cookie**
   - HTTP Status: `200 OK`
   - Response: `{"responseCode": 2000, "responseMessage": "Success..."}`
   - **Set-Cookie заголовки: ВІДСУТНІ**

2. **Веб-інтерфейс успішно отримує JSESSIONID**
   - При логіні через браузер, cookie встановлюється
   - Cookie використовується для подальших запитів
   - Запити з цим cookie працюють коректно

3. **Запити без JSESSIONID повертають помилку**
   ```json
   {
     "responseMessage": "Failure: Invalid session. The session may have expired. Sign in again or enter a valid JSESSIONID.",
     "responseCode": 4021
   }
   ```

### Спробовані методи автентифікації

1. ✅ `POST /j_security_check` (Java form-based auth)
   - Status: 200/302
   - Set-Cookie: **ВІДСУТНІЙ**

2. ✅ `POST /ora/authenticationService/authentication/login` з Basic Auth + JSON body
   - Status: 200
   - Response: `{"responseCode": 2000, "responseMessage": "Success..."}`
   - Set-Cookie: **ВІДСУТНІЙ**

3. ✅ `GET /ora/serviceInfo` з Basic Auth
   - Status: 200
   - Set-Cookie: **ВІДСУТНІЙ**

4. ✅ `POST /ora/authenticationService/authentication/login` з Basic Auth + empty body
   - Status: 200
   - Set-Cookie: **ВІДСУТНІЙ**

**Висновок:** Жоден метод автентифікації через API не встановлює JSESSIONID cookie, хоча HTTP запити успішні.

### Робоче рішення (тимчасове)

1. Отримати JSESSIONID з веб-інтерфейсу вручну:
   - Відкрити DevTools → Application/Storage → Cookies
   - Скопіювати значення `JSESSIONID`
   - Використати в API запитах

2. Використати cookie в запитах:
   ```bash
   curl -k -X POST "https://192.168.200.133:8440/ora/queryService/query/getSessions" \
     -H "Content-Type: application/json" \
     -H "Cookie: JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2" \
     -H "Authorization: Basic ..." \
     -d '{ "requestParameters": [...] }'
   ```

**Проблема:** Це не масштабоване рішення, оскільки вимагає ручного втручання.

---

## Питання для підтримки Cisco MediaSense

### 1. Автентифікація через API

**Питання:** Який правильний метод автентифікації для отримання JSESSIONID через API?

**Контекст:**
- MediaSense 11.5.1.12001-8
- Прямі API виклики не встановлюють cookie
- Веб-інтерфейс успішно встановлює cookie
- Basic Auth працює для деяких endpoints, але не для query endpoints

**Можливі причини:**
- Потрібен інший endpoint для автентифікації?
- Потрібен інший формат запиту?
- Потрібні додаткові заголовки?
- Потрібна спеціальна конфігурація на сервері MediaSense?
- Чи є обмеження на IP/порт для встановлення cookies?

### 2. Підтримка Basic Auth для query endpoints

**Питання:** Чи підтримує MediaSense 11.5 Basic Auth для query endpoints?

**Контекст:**
- Basic Auth працює для `/ora/serviceInfo`
- Basic Auth НЕ працює для `/ora/queryService/query/getSessions` (повертає 4021)
- Query endpoints вимагають JSESSIONID cookie

**Питання:** Чи є спосіб використовувати Basic Auth для query endpoints без cookie?

### 3. Конфігурація сервера

**Питання:** Чи потрібна спеціальна конфігурація на сервері MediaSense для встановлення cookies через API?

**Можливі налаштування:**
- CORS налаштування
- Cookie domain/path налаштування
- Security policies
- API access permissions

### 4. Альтернативні методи автентифікації

**Питання:** Чи є альтернативні методи автентифікації для API інтеграцій?

**Можливі варіанти:**
- API ключі/токени
- OAuth
- Certificate-based authentication
- Інші методи

### 5. Документація

**Питання:** Де знайти актуальну документацію для MediaSense 11.5 API?

**Контекст:**
- Офіційна документація Cisco MediaSense Developer Guide Release 11.0+ не містить деталей про формат `requestParameters`
- Reverse engineering показав інший формат, ніж описано в документації
- Потрібна актуальна документація для версії 11.5.1.12001-8

---

## Технічні деталі

### Конфігурація

- **MediaSense URL:** `https://192.168.200.133:8440`
- **Username:** `dpogrebnyuk`
- **Port:** `8440` (HTTPS)
- **Self-signed certificates:** Дозволені (`allowSelfSigned: true`)
- **Version:** 11.5.1.12001-8

### Технології інтеграції

- **Framework:** NestJS (Node.js)
- **HTTP Client:** Axios
- **Language:** TypeScript

### Приклад успішного запиту (з JSESSIONID)

```bash
# 1. Отримати JSESSIONID з веб-інтерфіейсу
# 2. Використати в запиті

curl -k -X POST "https://192.168.200.133:8440/ora/queryService/query/getSessions" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Cookie: JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2" \
  -H "Authorization: Basic $(echo -n 'user:pass' | base64)" \
  -d '{
    "requestParameters": [
      {
        "fieldName": "sessionState",
        "fieldConditions": [
          {"fieldOperator": "equals", "fieldValues": ["CLOSED_NORMAL"], "fieldConnector": "OR"},
          {"fieldOperator": "equals", "fieldValues": ["CLOSED_ERROR"]}
        ],
        "paramConnector": "AND"
      },
      {
        "fieldName": "sessionStartDate",
        "fieldConditions": [
          {"fieldOperator": "between", "fieldValues": [1768771615694, 1769376415694]}
        ]
      }
    ]
  }'
```

**Результат:** ✅ Успішно повертає сесії з даними

---

## Висновки

### ✅ Що працює

1. **Формат API запитів** - визначено через reverse engineering
2. **Endpoint** - `/ora/queryService/query/getSessions` працює
3. **Структура відповіді** - коректно парситься
4. **Дані сесій** - успішно отримуються при наявності JSESSIONID

### ⚠️ Що не працює

1. **Автоматична автентифікація** - API не встановлює JSESSIONID cookie
2. **Basic Auth для query endpoints** - не підтримується
3. **Масштабованість** - вимагає ручного втручання для отримання cookie

### 📋 Наступні кроки

1. ✅ Reverse engineering завершено
2. ✅ Код оновлено відповідно до реального API
3. ⏳ Очікується відповідь від підтримки Cisco MediaSense
4. ⏳ Можливо потрібна конфігурація на сервері MediaSense
5. ⏳ Можливо потрібен інший метод автентифікації

---

## Додаткові матеріали

### Файли для діагностики

- `reverse-engineer-mediasense-api.sh` - скрипт для аналізу HAR файлів
- `test-mediasense-query.sh` - тест запитів з JSESSIONID
- `test-mediasense-with-jsessionid.sh` - тест з ручним JSESSIONID
- `diagnose-mediasense-auth.sh` - діагностика автентифікації
- `apps/api/src/modules/media-sense/media-sense-client.service.ts` - код клієнта

### Документація

- `MEDIASENSE_REVERSE_ENGINEERING_RESULTS.md` - результати reverse engineering
- `MEDIASENSE_API_INTEGRATION.md` - документація інтеграції
- `FIX_MEDIASENSE_COMPLETE.md` - виправлення в коді

---

## Контактна інформація

**Організація:** [Ваша організація]  
**Контактна особа:** [Ваше ім'я]  
**Email:** [Ваш email]  
**Телефон:** [Ваш телефон]  

**MediaSense Server:**
- IP: 192.168.200.133
- Port: 8440
- Version: 11.5.1.12001-8

---

**Примітка:** MediaSense є продуктом, який більше не підтримується виробником (EOL). Однак ми потребуємо допомоги з інтеграцією API для підтримки існуючої інфраструктури.
