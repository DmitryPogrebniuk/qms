# Як отримати JSESSIONID (якщо document.cookie не працює)

## Проблема

Якщо `document.cookie` повертає `undefined` для JSESSIONID, це означає, що cookie має атрибут `HttpOnly` і недоступний через JavaScript.

## Рішення: Використайте Application/Storage tab

### Крок 1: Application tab
1. Відкрийте вкладку **Application** (або **Storage** в Firefox)
2. У лівій панелі розгорніть **Cookies**
3. Клікніть на `https://mediasense2.tas.local:8440`

### Крок 2: Знайдіть JSESSIONID
У правій панелі ви побачите таблицю з усіма cookies, включаючи HttpOnly cookies:

```
Name              | Value                              | Domain
JSESSIONID        | 0683BFCE250C6380CF68D66DF21E5DD2  | mediasense2.tas.local
```

Скопіюйте значення з колонки **Value**.

## Альтернатива: Network tab

### Крок 1: Network tab
1. Перейдіть на вкладку **Network** (Сеть)
2. Оновіть сторінку (F5) або виконайте дію (наприклад, пошук)

### Крок 2: Знайдіть запит
1. Знайдіть запит до `/ora/queryService/query/getSessions` (або будь-який інший запит)
2. Клікніть на запит
3. Відкрийте вкладку **Headers**

### Крок 3: Скопіюйте з Request Headers
У розділі **Request Headers** знайдіть:
```
Cookie: JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2; other=cookies...
```

Скопіюйте значення після `JSESSIONID=` (до першої `;` або до кінця).

## Швидкий спосіб через HAR

Якщо у вас є HAR файл з попереднього аналізу:

```bash
cd /opt/qms
sudo git pull origin main
./reverse-engineer-mediasense-api.sh your-file.har | grep -i "JSESSIONID"
```

## Перевірка через curl (якщо є доступ до сервера)

Якщо ви можете виконати curl з сервера:

```bash
# Спробуйте отримати JSESSIONID через веб-інтерфейс
curl -k -c cookies.txt -b cookies.txt \
  -X POST "https://mediasense2.tas.local:8440/j_security_check" \
  -d "j_username=dpogrebnyuk&j_password=YOUR_PASSWORD" \
  -L

# Перевірте cookies
cat cookies.txt | grep JSESSIONID
```

## Важливо

- **HttpOnly cookies** не доступні через `document.cookie`
- Вони доступні тільки через:
  - Application/Storage tab в DevTools
  - Network tab (в Request Headers)
  - HAR файли
  - Server-side код

## Після отримання JSESSIONID

Протестуйте його:

```bash
cd /opt/qms
sudo git pull origin main
sudo chmod +x test-mediasense-with-jsessionid.sh
sudo ./test-mediasense-with-jsessionid.sh YOUR_JSESSIONID
```

## Якщо JSESSIONID все ще не знайдено

1. Переконайтеся, що ви авторизовані в веб-інтерфейсі
2. Перевірте, чи ви на правильному домені
3. Спробуйте оновити сторінку (F5)
4. Перевірте Application tab → Cookies → ваш домен
