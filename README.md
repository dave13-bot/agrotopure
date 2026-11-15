# AGROTOPURE

**Plataforma híbrida de decisión agrícola que fusiona telemetría satelital de la NASA con sensores IoT subterráneos (Δ) para optimizar la rotación de cultivos y la salud del suelo en Michoacán.**

AGROTOPURE es una plataforma web y móvil de inteligencia agrícola desarrollada para el reto **Field Shift de NASA Space Apps 2026**, diseñada para optimizar la rotación de cultivos, regenerar el suelo y fortalecer la resiliencia climática. Su núcleo es un motor de **Fusión de Datos (Δ)** que cruza información macroscópica de satélites de la NASA (POWER, SMAP, MODIS, ECOSTRESS y SRTM) con telemetría microscópica de sensores IoT en parcela (humedad a 25 cm, temperatura radicular y pH), corrigiendo puntos ciegos espaciales para detectar ventanas de siembra ocultas y reducir el consumo de riego. Evalúa la compatibilidad del terreno con cultivos clave de Michoacán (maíz, aguacate, berries, trigo y hortalizas), mapea un calendario anual de vulnerabilidad del suelo y compara tres estrategias de rotación según las prioridades de cada productor.

## Menú
| Sección | Qué hace |
|---|---|
| **Inicio** | Clima NASA POWER de la parcela activa, estado Δ y tus parcelas. |
| **Parcelas** | Alta/edición: dibujando las esquinas en el mapa o escribiendo/pegando las coordenadas de cada esquina (decimal o GMS). Área y centroide automáticos. |
| **Análisis** | Fusión Δ, clima 60 días (NASA POWER + ETo FAO-56), NDVI y temperatura MODIS, compatibilidad de cultivos, calendario de vulnerabilidad y 3 estrategias de rotación. |
| **Sensores** | Dispositivos ESP32/Raspberry Pi con llave propia, histórico, tendencia, predicción de riego, captura manual (pH, CE, materia orgánica, NPK, textura) y CSV. |
| **Plantas** | Repositorio de 73 cultivos (68 de la guía agronómica corregida + aguacate y berries) con cuidados, condiciones y aptitud en tu parcela. |
| **Cuenta** | Perfil, prioridades, cierre de sesión y borrado de datos. |

## Fuentes de datos (solo NASA)
- **NASA POWER** (LaRC) Daily y Climatology, comunidad AG: T2M, extremos, rocío, HR, lluvia, radiación, viento, presión, temperatura de superficie y humedad de suelo GWETTOP/GWETROOT/GWETPROF.
- **ORNL DAAC (NASA)** MODIS Land Product Subsets: NDVI MOD13Q1 (250 m) y temperatura de superficie MOD11A2 (1 km).
- **NASA GIBS** (capas de mapa): HLS 30 m, NDVI MODIS, SMAP L4 humedad superficial y radicular, temperatura MODIS y elevación SRTM / ASTER.
- **ECOSTRESS** no está publicado en GIBS ni tiene API abierta (requiere cuenta Earthdata/AppEEARS); queda como integración futura.

Los mapas base (Esri, OpenStreetMap) solo sirven como referencia visual para dibujar la parcela.

## Cuentas y almacenamiento
- Inicio de sesión con **GitHub o Microsoft** mediante la autenticación integrada de Azure Static Web Apps. Cada cuenta solo ve sus parcelas, dispositivos y lecturas.
- Datos en **Azure Table Storage**. Configura en Azure Portal → Static Web App → *Environment variables*:
  `AZURE_STORAGE_CONNECTION_STRING = <cadena de conexión de una cuenta de almacenamiento>`.
  Sin esta variable la app funciona en modo local (datos en el navegador) y avisa en pantalla.
- Modo invitado sin cuenta: datos solo en el navegador.

## Sensores
Firmware listo en [`firmware/`](firmware/): ESP32 (deep sleep, cola offline) y Raspberry Pi (servicio systemd). Envían a `POST /api/ingest` con `x-device-id` y `x-device-key`.

## Desarrollo
```bash
npm install && npm install --prefix api
npm test            # motor agronómico, geometría, API (cuentas, parcelas, dispositivos, ingesta, NASA)
npm run build
node test/e2e/mock-server.mjs dist 4173   # servidor local de pruebas con almacenamiento en memoria
```
Despliegue: GitHub Actions → Azure Static Web Apps (`app_location: /`, `api_location: api`, `output_location: dist`).

## Android
```bash
npm run build && npx cap add android && npx cap sync android && npx cap open android
```
