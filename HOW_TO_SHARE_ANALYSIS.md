# Як передати результат аналізу MediaSense API

## Варіант 1: HAR файл (найкращий спосіб)

### Крок 1: Експортуйте HAR файл з DevTools

1. Відкрийте DevTools (F12) → Network tab
2. Виконайте дії в веб-інтерфейсі MediaSense
3. Right-click на будь-якому запиті
4. Виберіть **"Save all as HAR with content"**
5. Збережіть файл (наприклад, `mediasense.har`)

### Крок 2: Експортуйте аналіз

```bash
cd /opt/qms
sudo git pull origin main
sudo chmod +x export-mediasense-analysis.sh
./export-mediasense-analysis.sh /path/to/mediasense.har
```

### Крок 3: Передайте файл

**Варіант A: Скопіюйте вміст файлу**
```bash
cat mediasense-analysis-*.txt
# Скопіюйте весь вивід та вставте в повідомлення
```

**Варіант B: Завантажте файл на сервер**
```bash
# Якщо є доступ до сервера через SCP
scp mediasense-analysis-*.txt user@server:/tmp/
```

## Варіант 2: Копіювання з DevTools (якщо немає HAR)

### Крок 1: Знайдіть важливі запити

В DevTools → Network tab знайдіть:

1. **Запит автентифікації** (login/auth):
   - Right-click → Copy → Copy as cURL
   - Вставте в файл `auth-request.txt`

2. **Запит query** (sessions/recordings):
   - Right-click → Copy → Copy as cURL
   - Вставте в файл `query-request.txt`

### Крок 2: Скопіюйте деталі

Для кожного важливого запиту скопіюйте:

1. **Request Headers** (вкладка Headers → Request Headers):
   - Скопіюйте всі заголовки

2. **Request Payload** (вкладка Payload або Request):
   - Скопіюйте body запиту

3. **Response Headers** (вкладка Headers → Response Headers):
   - Особливо шукайте `Set-Cookie`

4. **Response Body** (вкладка Response):
   - Скопіюйте відповідь (або перші 500 символів)

### Крок 3: Створіть файл з інформацією

```bash
cat > mediasense-manual-analysis.txt << 'EOF'
=== АВТЕНТИФІКАЦІЯ ===

URL: [вставте URL]
Метод: POST/GET
Request Headers:
[вставте заголовки]

Request Body:
[вставте body]

Response Headers:
[вставте заголовки, особливо Set-Cookie]

Response Body:
[вставте відповідь]

=== QUERY ЗАПИТ ===

URL: [вставте URL]
Метод: POST/GET
Request Headers:
[вставте заголовки, особливо Cookie]

Request Body:
[вставте body]

Response Body:
[вставте відповідь]
EOF
```

## Варіант 3: Скріншоти (якщо інше не працює)

Зробіть скріншоти:

1. **Network tab** з видимими запитами
2. **Headers tab** для запиту автентифікації
3. **Headers tab** для query запиту
4. **Payload/Request tab** для query запиту
5. **Response tab** для обох запитів

## Що обов'язково потрібно

### Для автентифікації:
- ✅ URL endpoint
- ✅ Метод (POST/GET)
- ✅ Request Headers (особливо Authorization, Content-Type)
- ✅ Request Body (якщо є)
- ✅ Response Headers (особливо Set-Cookie)
- ✅ Response Status Code

### Для query запитів:
- ✅ URL endpoint
- ✅ Метод (POST/GET)
- ✅ Request Headers (особливо Cookie, Authorization)
- ✅ Request Body (формат JSON)
- ✅ Response Body (структура відповіді)

## Формат для передачі

Можна передати:

1. **Текстовий файл** з аналізом
2. **HAR файл** (якщо можна завантажити)
3. **Скопійований текст** з DevTools
4. **Скріншоти** (якщо інше не працює)

## Швидкий спосіб

Якщо хочете швидко передати найважливіше:

1. Відкрийте DevTools → Network
2. Знайдіть запит автентифікації
3. Right-click → Copy → Copy as cURL
4. Вставте сюди

5. Знайдіть query запит
6. Right-click → Copy → Copy as cURL
7. Вставте сюди

Цього буде достатньо для початкового аналізу!
