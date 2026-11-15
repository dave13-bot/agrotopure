// Copia este archivo como config.h y llena los valores que te da AGROTOPURE
// (Sensores → Dispositivo → "Copiar configuración").
#pragma once

// --- Red WiFi ---
const char* WIFI_SSID     = "MI_RED";
const char* WIFI_PASSWORD = "MI_CONTRASENA";

// --- AGROTOPURE ---
const char* AGROTOPURE_URL = "https://TU-SITIO.azurestaticapps.net/api/ingest";
const char* DEVICE_ID      = "dev_xxxxxxxxxx";
const char* DEVICE_KEY     = "llave-de-48-caracteres";
const uint32_t INTERVAL_SEC = 900;   // cada 15 minutos

// Certificado raíz del servidor (PEM). Ver README para obtenerlo con openssl.
// Si lo dejas vacío, la conexión TLS NO verifica el servidor (solo para pruebas).
const char* ROOT_CA = "";

// --- Pines (ESP32 DevKit) ---
#define PIN_MOISTURE_25CM   34   // sonda capacitiva enterrada a 25 cm (ADC1)
#define PIN_MOISTURE_SURF   35   // sonda capacitiva superficial 0-5 cm (opcional, -1 para desactivar)
#define PIN_PH              32   // módulo analógico de pH (opcional, -1 para desactivar)
#define PIN_EC              33   // módulo analógico de CE (opcional, -1 para desactivar)
#define PIN_ONEWIRE          4   // DS18B20 (temperatura radicular)

// --- Calibración de humedad (lecturas ADC crudas) ---
// RAW_DRY: sonda al aire. RAW_WET: sonda en suelo saturado de tu parcela.
#define MOIST_RAW_DRY  3300
#define MOIST_RAW_WET  1350
#define SOIL_SATURATION_VWC 46.0   // % volumétrico a saturación de tu textura (franco ≈ 46)

// --- Calibración de pH (voltios medidos en soluciones buffer) ---
#define PH7_VOLTAGE 1.50
#define PH4_VOLTAGE 2.03

// --- Calibración de CE: dS/m por voltio (según el módulo) ---
#define EC_DSM_PER_VOLT 1.0
