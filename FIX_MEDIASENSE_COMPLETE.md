# Комплексне виправлення взаємодії з MediaSense згідно з документацією Cisco

## Виявлені проблеми

1. **Неправильна обробка відповідей MediaSense API**
   - MediaSense повертає: `{ responseCode: 2000, responseMessage: "...", responseBody: { sessions: [...] } }`
   - Код не витягував дані з `responseBody`
   - `responseCode: 2000` означає успіх, а не помилку

2. **Неправильний формат запитів**
   - Використовувався `sessionStartTime` + `sessionEndTime`
   - Згідно з документацією, краще використовувати тільки `sessionEndTime`

3. **Майбутні дати в checkpoint**
   - `lastSyncTime` міг бути в майбутньому
   - Це призводило до запитів за майбутніми датами → `totalFetched: 0`

4. **Відсутність підтримки JSESSIONIDSSO**
   - MediaSense може використовувати JSESSIONIDSSO замість JSESSIONID

## Виправлення

### 1. Правильна обробка відповідей MediaSense API

**Формат відповіді MediaSense:**
```json
{
  "responseCode": 2000,  // 2000 = success, 4021 = invalid session, other = error
  "responseMessage": "Success: Your request was successfully completed.",
  "responseBody": {
    "sessions": [...]
  }
}
```

**Виправлення:**
- Перевірка `responseCode === 2000` для успіху
- Витягування даних з `responseBody` (не з кореня відповіді)
- Правильна обробка помилки 4021 (Invalid session) з автоматичним re-login

### 2. Використання тільки sessionEndTime для фільтрації

**Було:**
```json
{
  "conditions": [
    { "field": "sessionStartTime", "operator": "gte", "value": "..." },
    { "field": "sessionEndTime", "operator": "lte", "value": "..." }
  ]
}
```

**Стало:**
```json
{
  "conditions": [
    { "field": "sessionEndTime", "operator": "gte", "value": "..." },
    { "field": "sessionEndTime", "operator": "lte", "value": "..." }
  ]
}
```

**Чому:** Згідно з документацією та прикладами, використання тільки `sessionEndTime` більш надійне.

### 3. Виявлення та виправлення майбутніх дат

**Додано перевірку:**
```typescript
if (lastSync > now) {
  // Reset to 7 days ago if lastSyncTime is in the future
  fromTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}
```

### 4. Підтримка JSESSIONIDSSO

**Оновлено `extractJSessionId()`:**
- Спочатку шукає `JSESSIONIDSSO` (MediaSense специфічний)
- Потім fallback на `JSESSIONID`
- Використовує правильну назву cookie в headers

### 5. Покращена обробка responseBody в normalizeSessionData

**Додано пріоритет:**
1. `rawData.responseBody.sessions` (стандартний формат MediaSense)
2. `rawData.sessions` (fallback)
3. Інші можливі структури

## Зміни в коді

### `media-sense-client.service.ts`

1. **Обробка відповідей:**
   - Правильна перевірка `responseCode === 2000`
   - Витягування даних з `responseBody`
   - Автоматичний re-login при помилці 4021

2. **Query запити:**
   - Використання тільки `sessionEndTime` для фільтрації
   - Покращена обробка помилок

3. **Cookies:**
   - Підтримка JSESSIONIDSSO
   - Правильне форматування Cookie header

### `media-sense-sync.service.ts`

1. **Виявлення майбутніх дат:**
   - Автоматичне виправлення `lastSyncTime` якщо він в майбутньому

2. **Обробка відповідей:**
   - Пріоритет `responseBody.sessions`
   - Покращене логування структури відповіді

## Очікуваний результат

Після виправлень:

1. ✅ **Правильна обробка відповідей** - дані витягуються з `responseBody`
2. ✅ **Правильний формат запитів** - використання `sessionEndTime`
3. ✅ **Автоматичне виправлення майбутніх дат** - синхронізація почне з правильних дат
4. ✅ **Підтримка JSESSIONIDSSO** - правильна автентифікація
5. ✅ **`totalFetched > 0`** - запити повертають дані

## Наступні кроки

1. **Оновіть код на сервері:**
   ```bash
   cd /opt/qms
   sudo git pull origin main
   sudo docker compose -f infra/docker-compose.yml restart api
   ```

2. **Скиньте checkpoint на правильну дату:**
   ```bash
   sudo ./fix-mediasense-auth-and-sync.sh
   ```

3. **Перевірте логи:**
   ```bash
   sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense.*response\|mediasense.*sessions\|mediasense.*responseBody" | tail -50
   ```

4. **Перевірте статус:**
   ```bash
   sudo ./check-sync-status.sh
   ```

## Посилання на документацію

- **Developer Guide (Release 11.0)**: https://www.cisco.com/c/en/us/td/docs/voice_ip_comm/cust_contact/contact_center/mediasense/11/Documentation_Guide/CUMS_BK_P05FD644_00_cisco-mediasense-documentation-guide_11.html
- **Troubleshooting Tips**: http://docwiki.cisco.com/wiki/Troubleshooting_Tips_for_Cisco_MediaSense
- **Community Discussions**: https://community.cisco.com/t5/management/issues-while-downloading-recorded-sessions-using-mediasense/td-p/3605459

## Важливі моменти з документації

1. **Basic Auth працює для всіх запитів** - згідно з відповіддю від Cisco працівника
2. **JSESSIONIDSSO** - MediaSense може використовувати цей cookie
3. **responseCode: 2000** - означає успіх, не помилку
4. **responseBody** - дані знаходяться в цьому полі
5. **sessionEndTime** - рекомендований спосіб фільтрації за датами
