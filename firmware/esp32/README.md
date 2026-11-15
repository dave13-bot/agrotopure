# AGROTOPURE · ESP32

Nodo de bajo consumo que lee los sensores de suelo y envía las lecturas a AGROTOPURE.

## Material
| Sensor | Variable | Conexión |
|---|---|---|
| Sonda capacitiva v1.2/v2.0 enterrada a **25 cm** | `moisture25` (% vol.) | GPIO 34 |
| Sonda capacitiva superficial (opcional) | `moistureSurface` | GPIO 35 |
| DS18B20 sumergible a 10-25 cm + resistencia 4.7 kΩ a 3.3 V | `rootTempC` | GPIO 4 |
| Módulo analógico de pH (p. ej. DFRobot) | `ph` | GPIO 32 |
| Módulo analógico de CE (opcional) | `ec` (dS/m) | GPIO 33 |

Usa solo pines ADC1 (32-39): ADC2 no funciona con WiFi activo.

## Pasos
1. En AGROTOPURE: **Sensores → Dispositivo**, elige la parcela y copia la configuración.
2. Copia `config.example.h` como `config.h` y pega `AGROTOPURE_URL`, `DEVICE_ID`, `DEVICE_KEY` y tu WiFi.
3. Certificado raíz (recomendado): obtén el certificado raíz de tu sitio y pégalo en `ROOT_CA`:
   ```bash
   openssl s_client -showcerts -connect TU-SITIO.azurestaticapps.net:443 </dev/null
   ```
   Copia el **último** certificado de la cadena (el raíz) entre `-----BEGIN CERTIFICATE-----` y `-----END CERTIFICATE-----`.
4. Calibra:
   - Humedad: anota `analogRead` con la sonda al aire (`MOIST_RAW_DRY`) y en suelo saturado de tu parcela (`MOIST_RAW_WET`). Ajusta `SOIL_SATURATION_VWC` a tu textura (arenoso 40, franco 46, arcilloso 50).
   - pH: mide el voltaje en soluciones buffer pH 7 y pH 4.
5. En Arduino IDE instala **OneWire**, **DallasTemperature** y **ArduinoJson 7**, selecciona *ESP32 Dev Module* y sube el sketch.

El monitor serie (115200) muestra cada lectura y la respuesta del servidor (`POST 200`). Sin WiFi, guarda hasta 48 lecturas y las reenvía al reconectar.

## Formato que acepta `/api/ingest`
```http
POST /api/ingest
x-device-id: dev_xxxxxxxxxx
x-device-key: <llave>
Content-Type: application/json

{ "readings": [ { "ts": 1763200000, "moisture25": 31.4, "rootTempC": 21.3, "ph": 6.42 } ] }
```
Campos aceptados: `moisture25`, `moistureSurface`, `moistureDeep`, `rootTempC`, `ph`, `ec`, `airTempC`, `airRh`, `batteryV`. `ts` es opcional (epoch en segundos o ISO 8601).
