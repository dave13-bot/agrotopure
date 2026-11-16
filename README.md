# AGRO-TOPURE

**Plataforma híbrida de decisión agrícola que fusiona telemetría satelital de la NASA con sensores IoT subterráneos (Δ) para optimizar la rotación de cultivos y la salud del suelo en Michoacán.**

AGRO-TOPURE es una plataforma web y móvil de inteligencia agrícola desarrollada para el reto **Field Shift de NASA Space Apps 2026**, diseñada para optimizar la rotación de cultivos, regenerar el suelo y fortalecer la resiliencia climática. Su núcleo es un motor de **Fusión de Datos (Δ)** que cruza información macroscópica de satélites de la NASA (POWER, SMAP, MODIS, ECOSTRESS y SRTM) con telemetría microscópica de sensores IoT en parcela (humedad a 25 cm, temperatura radicular y pH), corrigiendo puntos ciegos espaciales para detectar ventanas de siembra ocultas y reducir el consumo de riego. Evalúa la compatibilidad del terreno con cultivos clave de Michoacán (maíz, aguacate, berries, trigo y hortalizas), mapea un calendario anual de vulnerabilidad del suelo y compara tres estrategias de rotación según las prioridades de cada productor.

## Idiomas
Interfaz completa en **español e inglés** (incluidos los 73 cultivos y las alertas). El selector está en el encabezado y el idioma se guarda en el perfil.

## Menú
| Sección | Qué hace |
|---|---|
| **Inicio** | Clima NASA POWER de la parcela activa, estado Δ y tus parcelas. |
| **Parcelas** | Alta/edición: dibujando las esquinas en el mapa o escribiendo/pegando las coordenadas de cada esquina (decimal o GMS). Área y centroide automáticos. |
| **Análisis** | Alertas de peligro, panel NASA, radiación solar, clima con intervalo seleccionable, NDVI y temperatura MODIS, trazabilidad del cálculo, compatibilidad de cultivos, calendario de vulnerabilidad, 3 estrategias de rotación y el análisis fino opcional. |
| **Sensores** | *Solo aparece al activar el análisis fino.* Dispositivos ESP32/Raspberry Pi con llave propia, histórico, tendencia, predicción de riego, captura manual (pH, CE, materia orgánica, NPK, textura) y CSV. |
| **Plantas** | Repositorio de 73 cultivos (68 de la guía agronómica corregida + aguacate y berries) con cuidados, condiciones y aptitud en tu parcela. |
| **Cuenta** | Perfil, prioridades, cierre de sesión y borrado de datos. |

## Satélite primero
El análisis completo (siembra, riego, rotación, calendario y alertas) se calcula **solo con datos de la NASA**. Las casillas sin dato no se muestran. Los sensores de suelo son un extra opcional que se habilita con la casilla **Análisis fino** al final de Análisis: solo entonces aparece el menú Sensores, la fusión Δ y el pH/salinidad en el puntaje de aptitud.

La tarjeta *Cómo influye cada dato de la NASA en los cálculos* detalla, para cada resultado, qué variables lo alimentan y con qué peso.

## Alertas de peligro
`/api/nasa/eonet` consulta **NASA EONET v3** (ciclones, incendios, inundaciones, sequía y volcanes activos) alrededor de la parcela y calcula la distancia. A eso se suman alertas derivadas de **NASA POWER**: helada, frente frío (caída de temperatura contra la normal mensual), calor extremo, índice UV o radiación alta, lluvia intensa, viento fuerte y racha seca. El usuario elige qué alertas recibir desde la campana del encabezado o desde su cuenta.

No es un pronóstico: EONET es un repositorio de referencia general y POWER publica con días de retraso.

## Fuentes de datos (solo NASA)
- **NASA POWER** (LaRC) Daily y Climatology, comunidad AG: T2M, extremos, rocío, HR, lluvia, viento, presión, temperatura de superficie y humedad de suelo GWETTOP/GWETROOT/GWETPROF.
- **NASA POWER · radiación solar**: ALLSKY_SFC_SW_DWN (incidente), CLRSKY_SFC_SW_DWN (cielo despejado), TOA_SW_DWN, ALLSKY_KT (índice de claridad), ALLSKY_SFC_PAR_TOT (radiación fotosintética) y ALLSKY_SFC_UV_INDEX. El grupo solar es opcional: si POWER rechaza un parámetro, la consulta se reintenta sin él.
- **NASA EONET v3**: eventos naturales activos cerca de la parcela.
- **ORNL DAAC (NASA)** MODIS Land Product Subsets: NDVI MOD13Q1 (250 m) y temperatura de superficie MOD11A2 (1 km).
- **NASA GIBS** (capas de mapa): HLS 30 m, NDVI MODIS, SMAP L4 humedad superficial y radicular, temperatura MODIS y elevación SRTM / ASTER.
- **ECOSTRESS** no está publicado en GIBS ni tiene API abierta (requiere cuenta Earthdata/AppEEARS); queda como integración futura.

Los mapas base (imagen de alta resolución de Esri, Landsat WELD de NASA GIBS y calles de OpenStreetMap) solo sirven como referencia visual para dibujar la parcela; ningún cálculo los usa. Una parcela mide como máximo 5,000 ha. La máscara tierra/agua de NASA GIBS (`OSM_Land_Water_Map`) impide guardar parcelas en el océano o en cuerpos de agua.

## Cuentas y almacenamiento
- Inicio de sesión con **GitHub o Microsoft** mediante la autenticación integrada de Azure Static Web Apps. Cada cuenta solo ve sus parcelas, dispositivos y lecturas.
- Datos en **Azure Table Storage**. Sin la variable `AZURE_STORAGE_CONNECTION_STRING` la app funciona en modo local (datos en el navegador) y avisa en pantalla.

### Activar la nube en un paso
Abre [Azure Cloud Shell](https://portal.azure.com/#cloudshell/) (Bash) con la cuenta dueña del Static Web App y pega:

```bash
RG=$(az staticwebapp list --query "[0].resourceGroup" -o tsv)
SWA=$(az staticwebapp list --query "[0].name" -o tsv)
SA="agrotopure$RANDOM"
az storage account create -n "$SA" -g "$RG" -l centralus --sku Standard_LRS -o none
CS=$(az storage account show-connection-string -n "$SA" -g "$RG" --query connectionString -o tsv)
az staticwebapp appsettings set -n "$SWA" -g "$RG" --setting-names AZURE_STORAGE_CONNECTION_STRING="$CS" -o none
echo "Nube activada en $SWA con la cuenta de almacenamiento $SA"
```

Crea una cuenta de almacenamiento estándar (unos centavos de dólar al mes con este uso) y la conecta al sitio. En un par de minutos `/api/status` devuelve `"storage": true` y las sesiones se guardan en la nube.
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

## Salud del cultivo (luz reflejada)
Una planta sana absorbe luz roja y refleja infrarrojo cercano. Con MODIS MOD13Q1 (NASA, 250 m, cada 16 días) se obtiene el NDVI = (NIR − Rojo) ÷ (NIR + Rojo) del píxel de la parcela y se compara con el rango esperado para el tipo de cultivo y su etapa (días desde la siembra). Si no coincide, o cae de golpe sin que la etapa lo explique, se genera la alerta **Salud del cultivo**. NASA POWER acota la causa (falta de agua, frío, calor, exceso de agua); si el clima no la explica, se indica revisar plaga, enfermedad o nutrición en campo. Los compuestos nublados se descartan con la banda de confiabilidad del píxel. Los rangos son orientativos (`src/lib/health.js`).

## Tiempo entre cultivos
Cada estrategia de rotación incluye su calendario: fecha de siembra, cosecha estimada con el ciclo de la guía, días libres entre un cultivo y el siguiente frente al descanso mínimo recomendado, y meses antes de repetir la misma familia botánica. El segundo cultivo se elige de modo que quepa entre la cosecha del primero y su siguiente siembra. Cada paso explica el porqué (datos NASA POWER que lo sustentan) y el cómo (`rotationPlan` en `src/lib/agro.js`). Los descansos y años de retorno son reglas agronómicas orientativas.

## Equipo
**Tesla Legacy** — Uruapan, Michoacán, México. Estudiantes de Ingeniería en Mecatrónica: Efraín Paleo Jacobo, Antonio Contreras Mendoza, Deyvid Lucas Rivera, Carlos Salim López Correa, Cristina Morales López y Rafael González Bravo. NASA Space Apps Challenge 2026, sede Guadalajara, reto *Field Shift* (“Cambio de rumbo: adaptando las granjas con datos de la NASA”).

## Licencia
Código abierto bajo [Apache License 2.0](LICENSE). Ver también [NOTICE](NOTICE).

Este proyecto no está afiliado a la NASA ni respaldado por ella. No usa el logotipo ni la insignia de la NASA.

## Recursos utilizados (citas)
**Datos de la NASA**
- NASA POWER (Prediction Of Worldwide Energy Resources), API diaria y de climatología, comunidad AG — https://power.larc.nasa.gov/
- MODIS/Terra MOD13Q1 (índices de vegetación, 250 m) y MOD11A2 (temperatura de superficie, 1 km), vía ORNL DAAC MODIS/VIIRS Land Product Subsets — https://modis.ornl.gov/
- NASA EONET v3 (Earth Observatory Natural Event Tracker) — https://eonet.gsfc.nasa.gov/
- NASA GIBS / EOSDIS (WMS): HLS S30, MODIS NDVI y temperatura de superficie, SMAP L4, SRTM, ASTER GDEM, Landsat WELD y `OSM_Land_Water_Map` — https://earthdata.nasa.gov/gibs

**Otros datos y referencias**
- Esri World Imagery, mapa base de alta resolución solo como referencia visual para dibujar linderos — fuente: Esri, Maxar, Earthstar Geographics; uso con atribución según los términos de Esri — https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9
- OpenStreetMap, teselas de calles y datos base de la máscara tierra/agua — © colaboradores de OpenStreetMap, ODbL — https://www.openstreetmap.org/copyright
- Allen et al. (1998), FAO Irrigation and Drainage Paper 56 (ETo Penman-Monteith, etapas del cultivo, agotamiento permisible).
- FAO, Irrigation Water Management Training Manual No. 3; FAO Paper 29 Rev. 1 (tolerancia a sales); Kew, Plants of the World Online.
- Hargreaves y Samani (1985), ETo mensual.
- “Guía agronómica corregida — 68 cultivos”, documento base del equipo (`src/data/plants.js` lista sus fuentes).

**Software de terceros (todos con licencia abierta)**
React y React DOM (MIT), Vite (MIT), Tailwind CSS (MIT), Leaflet (BSD-2-Clause), Recharts (MIT), lucide-react (ISC), Plus Jakarta Sans vía @fontsource (OFL-1.1), Capacitor (MIT), @azure/functions y @azure/data-tables (MIT), ArduinoJson (MIT) y bibliotecas de sensores citadas en `firmware/`.

**Imágenes**
- `public/team/equipo.jpg`: fotografía del equipo, propia; todos los integrantes son mayores de edad y autorizaron su uso.
- `public/team/tesla-legacy.png`: emblema del equipo, **imagen generada con IA**, con marca de agua visible.

## Uso de inteligencia artificial
El código, las pruebas y los textos de la plataforma se desarrollaron con asistencia de Claude (Anthropic) bajo la dirección del equipo, que revisó y probó el resultado; los commits generados así lo indican en sus metadatos (`Co-Authored-By`). El emblema del equipo se generó con IA y lleva marca de agua. Ningún contenido generado con IA usa o modifica marcas, logotipos o identificadores de misión de la NASA. Los datos que muestra la aplicación no son generados por IA: provienen de las API de la NASA citadas arriba y de cálculos deterministas documentados en el código.
