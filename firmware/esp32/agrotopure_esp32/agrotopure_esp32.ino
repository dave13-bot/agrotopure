/*
  AGROTOPURE · Nodo de sensores de suelo para ESP32
  Lee humedad a 25 cm, humedad superficial, temperatura radicular (DS18B20), pH y CE,
  y envía las lecturas a /api/ingest. Entre lecturas duerme (deep sleep) para ahorrar batería.
  Si no hay red, guarda hasta 48 lecturas en memoria RTC y las reenvía después.

  Bibliotecas: OneWire, DallasTemperature, ArduinoJson (v7). Placa: "ESP32 Dev Module".
*/
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.h"

struct Reading { uint32_t ts; float m25, msurf, rootT, ph, ec; };
RTC_DATA_ATTR Reading queue[48];
RTC_DATA_ATTR uint8_t queued = 0;

OneWire oneWire(PIN_ONEWIRE);
DallasTemperature ds(&oneWire);

static float avgAnalogMilliVolts(int pin, int n = 20) {
  uint32_t s = 0;
  for (int i = 0; i < n; i++) { s += analogReadMilliVolts(pin); delay(5); }
  return s / (float)n;
}
static int avgRaw(int pin, int n = 20) {
  uint32_t s = 0;
  for (int i = 0; i < n; i++) { s += analogRead(pin); delay(5); }
  return s / n;
}
static float moistureVwc(int pin) {
  if (pin < 0) return NAN;
  int raw = avgRaw(pin);
  float frac = (float)(MOIST_RAW_DRY - raw) / (float)(MOIST_RAW_DRY - MOIST_RAW_WET);
  frac = constrain(frac, 0.0f, 1.0f);
  return roundf(frac * SOIL_SATURATION_VWC * 10) / 10.0f;
}
static float readPh() {
  if (PIN_PH < 0) return NAN;
  float v = avgAnalogMilliVolts(PIN_PH) / 1000.0f;
  float slope = (7.0f - 4.0f) / (PH7_VOLTAGE - PH4_VOLTAGE);
  float ph = 7.0f + (v - PH7_VOLTAGE) * slope;
  return (ph < 0 || ph > 14) ? NAN : roundf(ph * 100) / 100.0f;
}
static float readEc() {
  if (PIN_EC < 0) return NAN;
  float v = avgAnalogMilliVolts(PIN_EC) / 1000.0f;
  return roundf(v * EC_DSM_PER_VOLT * 100) / 100.0f;
}
static float readRootTemp() {
  ds.begin();
  ds.requestTemperatures();
  float t = ds.getTempCByIndex(0);
  return (t == DEVICE_DISCONNECTED_C || t < -40) ? NAN : roundf(t * 10) / 10.0f;
}

static bool connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) delay(250);
  return WiFi.status() == WL_CONNECTED;
}

static void addIf(JsonObject o, const char* k, float v) { if (!isnan(v)) o[k] = v; }

static bool sendQueue() {
  WiFiClientSecure client;
  if (strlen(ROOT_CA)) client.setCACert(ROOT_CA);
  else { Serial.println("[AVISO] Sin ROOT_CA: TLS sin verificar el servidor."); client.setInsecure(); }
  HTTPClient http;
  if (!http.begin(client, AGROTOPURE_URL)) return false;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", DEVICE_ID);
  http.addHeader("x-device-key", DEVICE_KEY);
  JsonDocument doc;
  JsonArray arr = doc["readings"].to<JsonArray>();
  for (uint8_t i = 0; i < queued; i++) {
    JsonObject o = arr.add<JsonObject>();
    if (queue[i].ts > 1700000000) o["ts"] = queue[i].ts;  // epoch válido (NTP)
    addIf(o, "moisture25", queue[i].m25);
    addIf(o, "moistureSurface", queue[i].msurf);
    addIf(o, "rootTempC", queue[i].rootT);
    addIf(o, "ph", queue[i].ph);
    addIf(o, "ec", queue[i].ec);
  }
  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  Serial.printf("POST %d: %s\n", code, http.getString().c_str());
  http.end();
  return code == 200;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  Reading r;
  r.m25 = moistureVwc(PIN_MOISTURE_25CM);
  r.msurf = moistureVwc(PIN_MOISTURE_SURF);
  r.rootT = readRootTemp();
  r.ph = readPh();
  r.ec = readEc();
  r.ts = 0;

  bool online = connectWifi();
  if (online) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    struct tm t;
    if (getLocalTime(&t, 5000)) r.ts = (uint32_t)time(nullptr);
  }
  if (queued >= 48) { memmove(queue, queue + 1, sizeof(Reading) * 47); queued = 47; }
  queue[queued++] = r;
  Serial.printf("Humedad25=%.1f%% Sup=%.1f%% Raiz=%.1fC pH=%.2f CE=%.2f (en cola: %u)\n", r.m25, r.msurf, r.rootT, r.ph, r.ec, queued);

  if (online && sendQueue()) queued = 0;
  WiFi.disconnect(true);
  esp_sleep_enable_timer_wakeup((uint64_t)INTERVAL_SEC * 1000000ULL);
  esp_deep_sleep_start();
}

void loop() {}
