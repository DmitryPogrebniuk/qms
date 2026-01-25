# Знайдена документація MediaSense API

## Офіційна документація Cisco

### 1. Developer Guide (Основна документація API)

**Посилання:**
- Release 11.0: https://www.cisco.com/c/en/us/td/docs/voice_ip_comm/cust_contact/contact_center/mediasense/11/Documentation_Guide/CUMS_BK_P05FD644_00_cisco-mediasense-documentation-guide_11.html
- Посилання на всі гіди: http://www.cisco.com/c/en/us/support/customer-collaboration/mediasense/products-programming-reference-guides-list.html

**Що містить:**
- Огляд MediaSense
- Введення в розробку MediaSense додатків
- Формат та використання MediaSense Application Programming Interface (API)
- Призначений для системних інтеграторів та розробників

### 2. User Guide

**Посилання:**
- Release 10.0: https://www.cisco.com/en/US/docs/voice_ip_comm/cust_contact/contact_center/mediasense/10/user_guide/CUMS_BK_MCD100EE_00_ms-user-guide-10.html

**Що містить:**
- Встановлення, налаштування, конфігурація
- Обслуговування та усунення неполадок
- Потрібен досвід роботи з Java

### 3. Solution Reference Network Design Guide

**Що містить:**
- Розділ про "Metadata database and the MediaSense API"
- Архітектура та дизайн системи

## Важлива інформація про автентифікацію

### JSESSIONIDSSO vs JSESSIONID

**Важливо:** MediaSense може використовувати **JSESSIONIDSSO** (не просто JSESSIONID)!

Згідно з документацією Cisco:
- При Basic Auth сервер повертає cookie **JSESSIONIDSSO** (не JSESSIONID)
- Формат: `Cookie: JSESSIONIDSSO=<session-token>; Path=/; Secure; HttpOnly`
- Цей cookie можна використовувати замість Authorization header для подальших запитів

### Методи автентифікації

1. **HTTP Basic Authentication (RFC 2617)**
   - Base64 encoded credentials в Authorization header
   - Використовується для кожного запиту
   - Перевага: простота, працює з браузерами

2. **Session Cookie (JSESSIONIDSSO)**
   - Отримується після успішної Basic Auth
   - Використовується для подальших запитів замість Basic Auth
   - Перевага: краща продуктивність, менше навантаження на сервер
   - Уникає throttling та HTTP 503 помилок

### Порти MediaSense

**Важливо:** MediaSense використовує різні порти для різних операцій:
- **Порт 8440**: API автентифікація та запити
- **Порт 8081**: Доступ до медіа файлів (recordings)

**Проблема:** 401 Unauthorized може виникати при доступі до записів на порту 8081, якщо автентифікація була на порту 8440.

## Troubleshooting Resources

### 1. Troubleshooting Tips Wiki
- http://docwiki.cisco.com/wiki/Troubleshooting_Tips_for_Cisco_MediaSense
- Категорії: API, Administration, Configuration, Database, General, Installation, Upgrade, Recording, RTMT, Runtime

### 2. Community Discussions
- https://community.cisco.com/t5/management/issues-while-downloading-recorded-sessions-using-mediasense/td-p/3605459
- Обговорення проблем з завантаженням записів та автентифікацією

### 3. Missing Recorded Media Troubleshooting
- https://www.cisco.com/c/en/us/support/docs/customer-collaboration/mediasense/212089-mediasense-missing-recorded-media-troubl.html
- PDF з порадами по усуненню неполадок

## Рекомендації для нашого коду

### 1. Перевірити JSESSIONIDSSO

Потрібно оновити код, щоб шукати **JSESSIONIDSSO** замість (або разом з) JSESSIONID:

```typescript
private extractJSessionId(cookies: string[]): string | null {
  for (const cookie of cookies) {
    // Спробувати JSESSIONIDSSO (MediaSense специфічний)
    const ssoMatch = cookie.match(/JSESSIONIDSSO=([^;]+)/);
    if (ssoMatch) {
      return ssoMatch[1];
    }
    // Fallback на стандартний JSESSIONID
    const match = cookie.match(/JSESSIONID=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  return null;
}
```

### 2. Використовувати правильний Cookie header

```typescript
if (jsessionId) {
  headers['Cookie'] = `JSESSIONIDSSO=${jsessionId}`; // або JSESSIONID=${jsessionId}
}
```

### 3. Перевірити порти

- API запити: порт 8440
- Медіа файли: порт 8081 (може потребувати окремої автентифікації)

## Наступні кроки

1. **Оновити код** для підтримки JSESSIONIDSSO
2. **Перевірити логи** - чи повертається JSESSIONIDSSO в cookies
3. **Тестувати** з правильним cookie header
4. **Якщо не працює** - звернутися до офіційної документації Developer Guide

## Посилання для завантаження PDF

- Documentation Guide (Release 11.0): PDF доступний на сторінці документації
- User Guide (Release 10.0): 3 MB PDF
- Всі гіди доступні через Cisco Support Portal
