# MediaSense API - Результати Reverse Engineering

## Дата аналізу
25 січня 2026

## Джерело
Аналіз HAR файлу з веб-інтерфейсу MediaSense 11.5.1.12001-8

## Ключові знахідки

### 1. Endpoint для запиту сесій

**Реальний endpoint:**
```
POST /ora/queryService/query/getSessions
```

**НЕ працює:**
- `/ora/queryService/query/sessions` (404)
- `/ora/queryService/query/sessionBySessionId`

### 2. Формат запиту

**Реальний формат MediaSense 11.5:**
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

**Важливо:**
- Використовується `requestParameters` (не `conditions`)
- Використовується `fieldName` та `fieldConditions`
- Використовується `fieldOperator: "between"` для діапазону дат
- Використовується `sessionStartDate` (не `sessionEndTime`)
- Timestamps в **мілісекундах** (не ISO strings)

### 3. Cookies

**MediaSense 11.5 використовує:**
- `JSESSIONID` (не `JSESSIONIDSSO`!)
- Cookie встановлюється при логіні через веб-інтерфейс
- Cookie передається в заголовку: `Cookie: JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2`

### 4. Формат відповіді

**Успішна відповідь:**
```json
{
  "responseMessage": "Success: Your request was successfully completed.",
  "responseCode": 2000,
  "responseBody": {
    "sessions": [
      {
        "sessionState": "CLOSED_NORMAL",
        "callControllerType": "Cisco-CUCM",
        "sessionId": "f52619bf6fe66d81",
        "sessionStartDate": 1769375426527,
        "urls": {
          "httpUrl": "https://192.168.200.133:8446/recordedMedia/oramedia/mp4/f52619bf6fe66d81.mp4",
          "rtspUrl": "rtsp://192.168.200.133/archive/f52619bf6fe66d81",
          "mp4Url": "https://192.168.200.133:8446/recordedMedia/oramedia/mp4/f52619bf6fe66d81.mp4",
          "wavUrl": "https://192.168.200.133:8446/recordedMedia/oramedia/wav/f52619bf6fe66d81.wav"
        },
        "tracks": [
          {
            "trackStartDate": 1769375426527,
            "trackDuration": 187836,
            "codec": "PCMA",
            "downloadUrl": "https://192.168.200.133:8446/mma/ExportRaw?recording=f52619bf6fe66d81-TRACK1",
            "trackNumber": 1,
            "trackMediaType": "AUDIO",
            "participants": [
              {
                "participantStartDate": 1769375426527,
                "deviceRef": "380675049080",
                "isConference": false,
                "xRefCi": "17601378",
                "participantDuration": 187836,
                "deviceId": "SIP_trunk_2951"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Помилка:**
```json
{
  "responseMessage": "Failure: Invalid session. The session may have expired. Sign in again or enter a valid JSESSIONID.",
  "responseCode": 4021
}
```

### 5. Структура даних сесії

**Поля сесії:**
- `sessionId` - ID сесії
- `sessionStartDate` - timestamp в мілісекундах
- `sessionState` - CLOSED_NORMAL, CLOSED_ERROR, тощо
- `callControllerType` - Cisco-CUCM, тощо
- `urls` - об'єкт з URL для медіа (httpUrl, mp4Url, wavUrl, rtspUrl)
- `tracks` - масив треків з:
  - `trackStartDate` - timestamp
  - `trackDuration` - тривалість в мілісекундах
  - `codec` - кодек (PCMA, тощо)
  - `trackMediaType` - AUDIO, VIDEO
  - `downloadUrl` - URL для завантаження
  - `participants` - масив учасників

**Поля учасника:**
- `participantStartDate` - timestamp
- `participantDuration` - тривалість в мілісекундах
- `deviceRef` - посилання на пристрій
- `deviceId` - ID пристрою
- `xRefCi` - cross-reference ID
- `isConference` - чи це конференція

## Виправлення в коді

### 1. Endpoint
```typescript
querySessions: '/ora/queryService/query/getSessions', // Змінено з /sessions
```

### 2. Формат запиту
```typescript
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

### 3. Конвертація дат
```typescript
// ISO string -> milliseconds
const startTimestamp = new Date(params.startTime).getTime();
const endTimestamp = new Date(params.endTime).getTime();
```

### 4. Обробка відповіді
```typescript
// Response format: { responseCode: 2000, responseBody: { sessions: [...] } }
const sessions = response.data?.responseBody?.sessions || [];
```

### 5. Нормалізація даних
```typescript
// sessionStartDate (milliseconds) -> ISO string
const startTime = raw.sessionStartDate 
  ? new Date(raw.sessionStartDate).toISOString()
  : raw.startTime;

// Calculate endTime from startTime + duration
const endTime = raw.sessionStartDate && raw.tracks?.[0]?.trackDuration
  ? new Date(raw.sessionStartDate + raw.tracks[0].trackDuration).toISOString()
  : raw.endTime;
```

## Проблема з автентифікацією

**Проблема:** MediaSense не встановлює JSESSIONID cookie при автентифікації через API.

**Рішення:**
1. Отримати JSESSIONID з веб-інтерфейсу (вручну)
2. Використовувати його в API запитах
3. Або налаштувати MediaSense сервер для встановлення cookies через API

## Тестування

Після виправлень:

```bash
# 1. Отримайте JSESSIONID з веб-інтерфейсу
# 2. Використайте його в тесті

curl -k -X POST "https://mediasense2.tas.local:8440/ora/queryService/query/getSessions" \
  -H "Content-Type: application/json" \
  -H "Cookie: JSESSIONID=YOUR_SESSION_ID" \
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

## Висновок

Reverse engineering показав, що:
1. ✅ Endpoint: `/ora/queryService/query/getSessions` (не `/sessions`)
2. ✅ Формат: `requestParameters` (не `conditions`)
3. ✅ Дати: timestamps в мілісекундах (не ISO strings)
4. ✅ Cookies: `JSESSIONID` (не `JSESSIONIDSSO`)
5. ✅ Response: `responseBody.sessions` (правильна структура)

Код оновлено відповідно до реального API MediaSense 11.5.
