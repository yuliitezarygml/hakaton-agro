#include <Arduino.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiManager.h>

// ─── DHT11 (4 зоны) ──────────────────────────────────────────────────────────

#define DHTTYPE DHT11
// IMPORTANT: GPIO 6,7,8,9,10,11 — SPI Flash! НЕЛЬЗЯ использовать!
DHT dht1(4, DHTTYPE);  // Зона 1 — GPIO 4  (безопасен)
DHT dht2(5, DHTTYPE);  // Зона 2 — GPIO 5  (безопасен)
DHT dht3(16, DHTTYPE); // Зона 3 — GPIO 16 (безопасен)
DHT dht4(13, DHTTYPE); // Зона 4 — GPIO 13 (безопасен)

// ─── Датчики ─────────────────────────────────────────────────────────────────
#define SOIL_PIN 35 // ADC input-only (GPIO35) — датчик почвы через 3×10kΩ
#define RAIN_PIN 34 // Digital input-only (GPIO34) — датчик дождя

// ─── Делитель 3×10kΩ для Capacitive Soil Moisture Sensor v1.2 ───────────────
// AOUT → [10kΩ] → GPIO35 → [10kΩ] → [10kΩ] → GND
// Коэфф. делителя: 20k/(10k+20k) = 2/3, значит реальное V = V_gpio × 1.5
// ESP32 ADC 12-bit (0–4095) = 0–3.3V → через делитель макс. ~4950 мВ

// ─── Глобальные переменные (только POD-типы, без конструкторов C++)
// ───────────
Preferences prefs;
char serverIP[40] = "192.168.1.100";

// ─── Сохранение / загрузка
// ────────────────────────────────────────────────────
void loadSettings() {
  // false = read-write (создаёт namespace если не существует)
  prefs.begin("agrimap", false);
  String ip = prefs.getString("server_ip", serverIP);
  prefs.end();
  ip.toCharArray(serverIP, sizeof(serverIP));
  Serial.printf("[NVS] Server IP: %s\n", serverIP);
}

void saveIP(const char *ip) {
  strncpy(serverIP, ip, sizeof(serverIP) - 1);
  serverIP[sizeof(serverIP) - 1] = '\0';
  prefs.begin("agrimap", false);
  prefs.putString("server_ip", serverIP);
  prefs.end();
  Serial.printf("[NVS] Сохранён IP: %s\n", serverIP);
}

// ─── HTTP отправка
// ────────────────────────────────────────────────────────────
void sendPayload(JsonDocument &doc) {
  if (WiFi.status() != WL_CONNECTED)
    return;
  char url[80];
  snprintf(url, sizeof(url), "http://%s:8080/api/data", serverIP);
  String body;
  serializeJson(doc, body);
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  Serial.printf("[HTTP] POST → %d\n", code);
  http.end();
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000); // ждём стабилизации питания + USB

  Serial.println("\n=== AgriMap ESP32 v1.0 ===");

  // Сенсоры
  dht1.begin();
  dht2.begin();
  dht3.begin();
  dht4.begin();
  // GPIO 34/35 — input-only, не поддерживают pull-up
  pinMode(RAIN_PIN, INPUT);
  pinMode(SOIL_PIN, INPUT);
  analogSetAttenuation(ADC_11db); // 0–3.3V полный диапазон ADC

  // Загружаем сохранённый IP
  loadSettings();

// ── BOOT-кнопка (GPIO 0) — удержи при включении чтоб открыть портал ────────
//    Кнопка BOOT на плате ESP32 = GPIO 0, подтянут к HIGH
//    Нажата = LOW
#define BOOT_PIN 0
  pinMode(BOOT_PIN, INPUT_PULLUP);
  delay(100);
  bool forcePortal = (digitalRead(BOOT_PIN) == LOW);
  if (forcePortal) {
    Serial.println("[WiFi] BOOT удержан → принудительный портал настройки");
  }

  // ── WiFiManager (все объекты ЛОКАЛЬНО в setup) ────────────────────────────
  WiFiManager wm;
  wm.setDebugOutput(false);
  wm.setConfigPortalTimeout(180);

  // Кастомный параметр: IP Go-сервера
  // Важно: создаём ЛОКАЛЬНО, не глобально — иначе WDT crash до FreeRTOS
  WiFiManagerParameter paramIP("server_ip", "IP Go-сервера (напр. 192.168.1.5)",
                               serverIP, 39);
  wm.addParameter(&paramIP);

  // При сохранении из портала
  wm.setSaveParamsCallback([&paramIP]() { saveIP(paramIP.getValue()); });

  // Запускаем портал или подключаемся к сохранённой сети
  // AP: "AgriMap-Setup"  пароль: agrimap123
  Serial.println("[WiFi] Запуск... AP: AgriMap-Setup / agrimap123");
  Serial.println(
      "       [Держи BOOT при включении чтобы снова открыть портал]");

  bool ok;
  if (forcePortal) {
    // Открыть портал принудительно (WiFi не сбрасывается)
    ok = wm.startConfigPortal("AgriMap-Setup", "agrimap123");
  } else {
    ok = wm.autoConnect("AgriMap-Setup", "agrimap123");
  }

  if (!ok) {
    Serial.println("[WiFi] Таймаут. Перезагрузка...");
    delay(2000);
    ESP.restart();
  }

  Serial.println("[WiFi] OK! IP: " + WiFi.localIP().toString());
  Serial.printf("[WiFi] Сервер: http://%s:8080\n", serverIP);
}

// ─── DHT с повторными попытками ──────────────────────────────────────────────
float dhtRead(DHT &s, bool temp) {
  for (int i = 0; i < 3; i++) {
    float v = temp ? s.readTemperature() : s.readHumidity();
    if (!isnan(v))
      return v;
    delay(600);
  }
  return NAN;
}

// ─── Чтение датчика почвы через делитель (как map на Arduino) ────────────────
int readSoilMoisture() {
  int rawValue = analogRead(SOIL_PIN);

  // 1. Пересчитываем в милливольты на датчике (с учётом делителя 2/3)
  //    ESP32: 0–4095 = 0–3300 мВ на пине
  //    Делитель ×1.5: реальное напряжение датчика = 0–4950 мВ
  long voltageMV = map(rawValue, 0, 4095, 0, 4950);

  // 2. Конвертируем мВ → проценты влажности
  //    Ёмкостной: сухо = ~1860 мВ (на столе), мокро = ~500 мВ
  //    constrain ограничивает диапазон, map инвертирует
  int percent = map(constrain(voltageMV, 200, 1860), 1860, 500, 0, 100);

  Serial.printf("  [SOIL] raw=%d  %ldмВ → %d%%\n", rawValue, voltageMV,
                percent);
  return percent;
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  DHT *sensors[4] = {&dht1, &dht2, &dht3, &dht4};

  struct {
    float t, h;
    bool ok;
  } z[4];
  int failCount = 0;

  for (int i = 0; i < 4; i++) {
    z[i].t = dhtRead(*sensors[i], true);
    z[i].h = dhtRead(*sensors[i], false);
    z[i].ok = !isnan(z[i].t) && !isnan(z[i].h);
    if (!z[i].ok) {
      failCount++;
      z[i].t = -99;
      z[i].h = 0;
      Serial.printf(
          "  [!] Z%d: нет ответа — проверь DATA→GPIO%d + pull-up 4.7kΩ\n",
          i + 1, (int[]){4, 5, 16, 13}[i]);
    }
  }

  int soilPct = readSoilMoisture();
  bool rain = (digitalRead(RAIN_PIN) == LOW);

  Serial.println("──────────────────────────");
  for (int i = 0; i < 4; i++) {
    if (z[i].ok)
      Serial.printf("  Z%d: %.1f°C  %.0f%%\n", i + 1, z[i].t, z[i].h);
    else
      Serial.printf("  Z%d: [нет датчика]\n", i + 1);
  }
  Serial.printf("  Почва: %d%%  Дождь: %s", soilPct, rain ? "ДА" : "нет");
  if (failCount)
    Serial.printf("  ⚠ %d датч. не отвеч.", failCount);
  Serial.println();

  // Отправляем всегда — даже если часть датчиков молчит
  JsonDocument doc;
  for (int i = 0; i < 4; i++) {
    doc["zones"][i]["zone"] = i + 1;
    doc["zones"][i]["temp"] = z[i].ok ? round(z[i].t * 10) / 10.0 : (float)-99;
    doc["zones"][i]["humidity"] =
        z[i].ok ? round(z[i].h * 10) / 10.0 : (float)0;
    doc["zones"][i]["online"] = z[i].ok;
  }
  doc["soil_moisture"] = soilPct;
  doc["rain"] = rain;
  doc["timestamp"] = (long)millis();

  sendPayload(doc);
  delay(2000);
}
