<p align="center">
  <img src="https://img.shields.io/badge/ESP32-IoT-blue?style=for-the-badge&logo=espressif&logoColor=white" />
  <img src="https://img.shields.io/badge/Go-Backend-00ADD8?style=for-the-badge&logo=go&logoColor=white" />
  <img src="https://img.shields.io/badge/React_Native-Mobile-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Next.js-Web-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
</p>

<h1 align="center">🌿 AgriMap — Мониторинг садового участка</h1>

<p align="center">
  IoT-система мониторинга температуры, влажности воздуха, влажности почвы и дождя<br/>
  на базе <b>ESP32</b> с веб-дашбордом и мобильным приложением
</p>

---

## 📋 Оглавление

- [Архитектура](#-архитектура)
- [Компоненты и датчики](#-компоненты-и-датчики)
- [Схема подключения](#-схема-подключения-esp32)
- [Распиновка](#-распиновка-esp32-devkit-v1)
- [Делитель напряжения (почва)](#-делитель-напряжения-для-датчика-почвы)
- [Калибровка](#-калибровка)
- [Структура проекта](#-структура-проекта)
- [Запуск](#-запуск)

---

## 🏗 Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│                        AgriMap System                            │
│                                                                  │
│  ┌─────────┐    HTTP/JSON     ┌──────────┐    WebSocket         │
│  │  ESP32  │ ───────────────► │ Go Server│ ◄──────────────┐     │
│  │         │   POST /api/data │  :8080   │                │     │
│  └─────────┘                  └────┬─────┘                │     │
│       │                            │                      │     │
│   4× DHT11                   ┌─────┴──────┐      ┌───────┴──┐  │
│   1× Soil                    │  Next.js   │      │  React   │  │
│   1× Rain                   │  Web App   │      │  Native  │  │
│                              │  :3000     │      │  Mobile  │  │
│                              └────────────┘      └──────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Компоненты и датчики

| # | Компонент | Количество | Назначение |
|---|-----------|:----------:|------------|
| 1 | **ESP32 DevKit V1** | 1 | Микроконтроллер |
| 2 | **DHT11** | 4 | Температура + влажность воздуха (Зоны 1–4) |
| 3 | **Capacitive Soil Moisture Sensor v1.2** | 1 | Влажность почвы |
| 4 | **Rain Sensor Module** | 1 | Обнаружение дождя |
| 5 | **Резистор 10 kΩ** | 7 | 4× pull-up для DHT11 + 3× делитель для Soil |
| 6 | **Макетная плата** | 1 | Монтаж |
| 7 | **Провода** | — | Соединения |

---

## ⚡ Схема подключения ESP32

### DHT11 — Температура и влажность (4 зоны)

> Каждый DHT11 подключается одинаково. Pull-up резистор 10kΩ обязателен!

```
                    ┌─────────────┐
                    │   DHT11     │
                    │             │
                    │  ┌───┬───┐  │
                    │  │VCC│OUT│  │GND
                    │  └─┬─┴─┬─┘  └─┬─
                    └────┼───┼──────┼──
                         │   │      │
                         │   │      │
                  3.3V ──┘   │      └── GND
                             │
                        ┌────┴────┐
                        │ 10 kΩ  │ ← Pull-up резистор
                        └────┬────┘
                             │
                          3.3V + GPIO (DATA)
```

| Зона | DHT11 PIN | ESP32 GPIO | Pull-up |
|:----:|:---------:|:----------:|:-------:|
| **Зона 1** | DATA | **GPIO 4** | 10kΩ → 3.3V |
| **Зона 2** | DATA | **GPIO 5** | 10kΩ → 3.3V |
| **Зона 3** | DATA | **GPIO 16** | 10kΩ → 3.3V |
| **Зона 4** | DATA | **GPIO 13** | 10kΩ → 3.3V |

**Подключение каждого DHT11:**
```
DHT11 VCC  → ESP32 3.3V
DHT11 GND  → ESP32 GND
DHT11 DATA → ESP32 GPIOxx  ←──┐
                               ├── соединены
          3.3V → [10kΩ]   ────┘   (pull-up)
```

---

### 🌱 Capacitive Soil Moisture Sensor v1.2

> Ёмкостной датчик с делителем напряжения 3×10kΩ для безопасного чтения на ESP32

```
   Capacitive Soil Sensor v1.2
  ┌────────────────────────────┐
  │  VCC    AOUT    GND       │
  └──┬───────┬───────┬────────┘
     │       │       │
   3.3V      │      GND
             │
             │ (аналоговый выход датчика)
             │
        ┌────┴────┐
        │  10 kΩ  │  R1 (от датчика)
        └────┬────┘
             │
             ├───────────────── GPIO 35 (ADC вход)
             │
        ┌────┴────┐
        │  10 kΩ  │  R2
        └────┬────┘
             │
        ┌────┴────┐
        │  10 kΩ  │  R3
        └────┬────┘
             │
            GND
```

**Делитель напряжения:** R2 + R3 = 20kΩ → GND, R1 = 10kΩ от AOUT

```
V_gpio = V_aout × 20kΩ / (10kΩ + 20kΩ) = V_aout × ⅔
```

| Датчик | ESP32 | Примечание |
|--------|-------|------------|
| VCC | 3.3V | Питание датчика |
| GND | GND | Общий минус |
| AOUT | → [10kΩ] → **GPIO 35** | Через делитель! |

---

### 🌧️ Rain Sensor Module (Датчик дождя)

```
  Rain Sensor Module
  ┌──────────────────┐
  │  VCC  DO  AO GND │
  └──┬───┬───────┬───┘
     │   │       │
   3.3V  │      GND
         │
         └──────────── GPIO 34 (Digital вход)
```

| Датчик | ESP32 | Примечание |
|--------|-------|------------|
| VCC | 3.3V (или 5V) | Питание |
| GND | GND | Общий минус |
| **DO** | **GPIO 34** | Цифровой выход |
| AO | — | Не используется |

**Логика:**
- 💧 Капли на датчике → DO = `LOW` → `rain = true`
- ☀️ Сухо → DO = `HIGH` → `rain = false`

---

## 📌 Распиновка ESP32 DevKit V1

```
                    ┌──────────────────┐
                    │    ESP32 DevKit   │
                    │                  │
              3.3V ─┤ 3V3          VIN├─ 5V
                    │                  │
    DHT11 Z1 DATA ─┤ GPIO 4    GPIO 36├─
    DHT11 Z2 DATA ─┤ GPIO 5    GPIO 39├─
                    │                  │
                    │ GPIO 6     ░░░░░░│─ (SPI Flash)
                    │ GPIO 7     ░░░░░░│─ (SPI Flash)
                    │ GPIO 8     ░░░░░░│─ (SPI Flash)
                    │ GPIO 9     ░░░░░░│─ (SPI Flash)
                    │ GPIO 10    ░░░░░░│─ (SPI Flash)
                    │ GPIO 11    ░░░░░░│─ (SPI Flash)
                    │                  │
    DHT11 Z4 DATA ─┤ GPIO 13   GPIO 35├─ SOIL AOUT (через делитель)
                    │                  │
                    │ GPIO 14   GPIO 34├─ RAIN DO
                    │                  │
                    │ GPIO 15   GPIO 33├─
    DHT11 Z3 DATA ─┤ GPIO 16   GPIO 32├─
                    │                  │
                    │ GPIO 17   GPIO 25├─
                    │                  │
                    │                  │
               GND ─┤ GND          GND├─ GND
                    │                  │
                    └──────────────────┘
```

### ⚠️ Важные ограничения GPIO

| GPIO | Статус | Почему |
|------|--------|--------|
| 6, 7, 8, 9, 10, 11 | 🔴 **ЗАПРЕЩЕНЫ** | SPI Flash — зависнет! |
| 34, 35, 36, 39 | 🟡 **Только вход** | Нет pull-up, нет выхода |
| 0 | 🟡 **BOOT кнопка** | Используем для сброса WiFi |
| 4, 5, 13, 16 | 🟢 **Безопасны** | DHT11 зоны |

---

## 🔌 Делитель напряжения для датчика почвы

### Зачем нужен?

Capacitive Soil Moisture Sensor v1.2 может выдавать напряжение выше безопасного диапазона ESP32 (0–3.3V). Делитель на 3×10kΩ снижает напряжение до **⅔ от оригинала**.

### Схема

```
  AOUT ────[R1 10kΩ]────┬────── GPIO 35
                         │
                    [R2 10kΩ]
                         │
                    [R3 10kΩ]
                         │
                        GND

  Формула: V_out = V_in × (R2+R3) / (R1+R2+R3)
                 = V_in × 20kΩ / 30kΩ
                 = V_in × 0.667
```

### Диапазон значений

| Состояние | ADC raw | Напряжение | Влажность |
|-----------|:-------:|:----------:|:---------:|
| В воздухе (сухо) | ~1550 | ~1.25V | **0%** |
| Сухая земля | ~1200 | ~0.97V | **~33%** |
| Влажная земля | ~800 | ~0.64V | **~71%** |
| В воде | ~500 | ~0.40V | **100%** |

> ⚠️ Значения `SOIL_DRY` и `SOIL_WET` в `main.cpp` нужно подстроить под свой датчик!

---

## 🔧 Калибровка

### Датчик почвы

1. Прошей ESP32, открой Serial Monitor (115200 бод)
2. **Сухой замер** — держи датчик в воздухе, запиши `raw=XXXX`
3. **Мокрый замер** — опусти в стакан воды, запиши `raw=XXXX`
4. Впиши значения в `src/main.cpp`:

```cpp
#define SOIL_DRY  1550  // ← твоё значение "в воздухе"
#define SOIL_WET  500   // ← твоё значение "в воде"
```

### Serial Monitor вывод

```
──────────────────────────
  [SOIL] raw=1545  V=1.25V → 0% (dry=1550 wet=500)
  Z1: 22.6°C  51%
  Z2: 23.0°C  51%
  Z3: 23.4°C  49%
  Z4: 23.4°C  52%
  Почва: 0%  Дождь: нет
[HTTP] POST → 200
```

---

## 📁 Структура проекта

```
esp/
├── src/
│   └── main.cpp              ← Прошивка ESP32 (Arduino)
├── platformio.ini             ← Конфигурация PlatformIO
│
├── server/
│   └── main.go               ← Go-бэкенд (REST + WebSocket)
│
├── web/
│   └── app/                   ← Next.js веб-дашборд
│
├── mobile/
│   └── src/                   ← React Native мобильное приложение
│       ├── screens/
│       │   ├── DashboardScreen.tsx  ← Показания датчиков
│       │   └── MapScreen.tsx        ← Карта поля с зонами
│       ├── hooks/
│       │   └── useSensorData.ts     ← WebSocket хук
│       └── types/
│           └── sensors.ts           ← Типы данных
│
└── README.md                  ← Этот файл
```

---

## 🚀 Запуск

### 1. ESP32 — Прошивка

```bash
# Из корня проекта (нужен PlatformIO)
pio run --target upload
pio device monitor          # Serial Monitor
```

При первом запуске:
- ESP32 создаст WiFi точку **AgriMap-Setup** (пароль: `agrimap123`)
- Подключись к ней и введи SSID/пароль + IP Go-сервера
- Удерживай кнопку **BOOT** при включении для повторной настройки WiFi

### 2. Go-сервер

```bash
cd server
go run main.go
# Сервер запускается на :8080
```

### 3. Web-дашборд

```bash
cd web
npm install
npm run dev
# Открой http://localhost:3000
```

### 4. Мобильное приложение

```bash
cd mobile
npm install
npm start
# Сканируй QR-код в Expo Go
```

> ⚠️ Поменяй `SERVER_IP` в `mobile/src/hooks/useSensorData.ts` на IP своего Go-сервера

---

## 📡 API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/data` | ESP32 → сервер (каждые 10 сек) |
| `GET` | `/api/sensors` | Текущие данные (REST) |
| `GET` | `/api/history` | История (до 360 записей) |
| `WS` | `/ws` | WebSocket live-обновления |

### Формат JSON

```json
{
  "zones": [
    { "zone": 1, "temp": 22.6, "humidity": 51, "online": true },
    { "zone": 2, "temp": 23.0, "humidity": 51, "online": true },
    { "zone": 3, "temp": 23.4, "humidity": 49, "online": true },
    { "zone": 4, "temp": 23.4, "humidity": 52, "online": true }
  ],
  "soil_moisture": 45,
  "rain": false,
  "timestamp": 125000,
  "received_at": "2026-05-16T10:30:00Z"
}
```

---

<p align="center">
  <b>AgriMap</b> — IoT-мониторинг для умного садоводства 🌿
</p>
