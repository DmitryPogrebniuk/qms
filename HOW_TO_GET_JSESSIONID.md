# Як отримати JSESSIONID з веб-інтерфейсу MediaSense

## Метод 1: Через DevTools (Chrome/Firefox)

### Крок 1: Відкрийте веб-інтерфейс
1. Відкрийте браузер
2. Перейдіть до: `https://192.168.200.133:8440` (або ваш URL MediaSense)
3. Авторизуйтеся

### Крок 2: Відкрийте DevTools
- **Chrome/Edge**: `F12` або `Ctrl+Shift+I`
- **Firefox**: `F12` або `Ctrl+Shift+I`

### Крок 3: Знайдіть JSESSIONID

**Варіант A: Application/Storage tab (Chrome)**
1. Відкрийте вкладку **Application** (або **Storage** в Firefox)
2. Розгорніть **Cookies** → `https://192.168.200.133:8440`
3. Знайдіть `JSESSIONID`
4. Скопіюйте **Value** (наприклад: `0683BFCE250C6380CF68D66DF21E5DD2`)

**Варіант B: Network tab**
1. Відкрийте вкладку **Network**
2. Знайдіть будь-який запит до MediaSense
3. Відкрийте запит → вкладка **Headers**
4. В **Request Headers** знайдіть `Cookie: JSESSIONID=...`
5. Скопіюйте значення після `JSESSIONID=`

## Метод 2: Через консоль браузера

1. Відкрийте DevTools → Console
2. Введіть:
```javascript
document.cookie.split(';').find(c => c.trim().startsWith('JSESSIONID'))
```
3. Скопіюйте значення після `JSESSIONID=`

## Тестування з JSESSIONID

Після отримання JSESSIONID:

```bash
cd /opt/qms
sudo git pull origin main
sudo chmod +x test-mediasense-with-jsessionid.sh
sudo ./test-mediasense-with-jsessionid.sh YOUR_JSESSIONID_HERE
```

## Очікуваний результат

Якщо JSESSIONID валідний:
- HTTP Status: 200
- responseCode: 2000
- responseBody.sessions: масив сесій

Якщо JSESSIONID невалідний:
- HTTP Status: 200
- responseCode: 4021
- responseMessage: "Invalid session..."

## Важливо

JSESSIONID має термін дії (зазвичай 30 хвилин). Якщо він застарілий:
1. Оновіть сторінку в браузері
2. Отримайте новий JSESSIONID
3. Повторіть тест

## Автоматизація (майбутнє)

Якщо тест з JSESSIONID з браузера працює, можна:
1. Створити механізм для автоматичного отримання JSESSIONID
2. Використовувати Selenium/Playwright для автоматизації браузера
3. Або налаштувати MediaSense сервер для встановлення cookies через API
