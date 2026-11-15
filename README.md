# AgroShift Michoacán · AgroSmart MX

Dashboard de parcela con estado inicial vacío. No se crean parcelas ni lecturas de demostración automáticamente. Los polígonos y coordenadas son introducidos por el usuario; cada vértice se guarda localmente en el navegador. NASA POWER es la fuente de variables diarias meteorológicas; NASA GIBS/Worldview aporta mosaicos satelitales de reflectancia MODIS. El mapa base es OpenStreetMap.

## Requisitos y ejecución local

- Node.js 20 LTS o posterior.
- Para el API local: Azure Functions Core Tools v4.

```bash
npm install
npm run dev
```

El frontend funciona en modo demostración si `/api` no está disponible. Para iniciar Functions localmente desde la raíz instala también las dependencias de `api` (`npm install --prefix api`) y usa `npm run api:start`. Vite entrega el frontend en `http://localhost:5173`; para desarrollo con Functions usa SWA CLI o un proxy local dirigido a `http://localhost:7071`.

## NASA POWER y límites de las fuentes

`GET /api/nasa-telemetry` consulta NASA POWER Daily AG para las coordenadas del centroide: T2M, PRECTOTCORR, ALLSKY_SFC_SW_DWN, WS2M, RH2M, PS y EVPTRNS. La interfaz queda sin datos si NASA no responde. NASA POWER es histórico/modelado; no es pronóstico. `PS` no genera alerta de cambio de presión. La elevación solo se muestra si NASA POWER la devuelve en su respuesta. La capa GIBS se sirve desde NASA y su resolución/fecha dependen del producto. No se promete NDVI parcelario ni SMAP mediante POWER.

Las Functions HTTP usan `authLevel: anonymous` para el proxy integrado. El POST IoT requiere `IOT_WRITE_KEY` y encabezado `x-iot-key`. El backend actual mantiene lecturas en memoria, no persistentes y no escalables: para una instalación real de ESP32, se requiere almacenamiento Azure durable y gestión individual de identidad/credenciales de cada dispositivo. No incrustes secretos de sensores en JavaScript público.

Las parcelas están guardadas en `localStorage` de ese navegador únicamente. No se sincronizan a otros dispositivos ni cuentas; eliminar una parcela borra su registro local.

## Azure Static Web Apps

El flujo de GitHub Actions requiere crear el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN` en el repositorio. Conserva un `package-lock.json` generado por `npm install` en el primer commit de despliegue.

```bash
az login
az group create --name rg-agroshift-mx --location centralus
az staticwebapp create --name agroshift-michoacan --resource-group rg-agroshift-mx --location centralus --source https://github.com/ORGANIZACION/REPOSITORIO --branch main --app-location "/" --api-location "api" --output-location "dist" --login-with-github
```

Si `--login-with-github` no está disponible en la versión de Azure CLI instalada, crea el recurso desde Azure Portal o instala/actualiza la extensión de Static Web Apps y configura el workflow; agrega después el token de despliegue en GitHub Actions como `AZURE_STATIC_WEB_APPS_API_TOKEN`. Reemplaza organización/repositorio por el URL real.

## Android / Capacitor

Tras preparar un toolchain Android (Android Studio/JDK/SDK):

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

La configuración PWA y Capacitor permite iniciar la empaquetación; la firma de un APK de producción requiere configurar un keystore y las credenciales de firma fuera del repositorio.

## Persistencia y seguridad antes de producción

El endpoint IoT incluido usa almacenamiento en memoria para que la muestra funcione sin recursos Azure adicionales; no persiste entre reinicios ni instancias. Para producción, sustituirlo por Azure Table Storage/Cosmos DB, autenticar los endpoints (Entra ID o tokens de dispositivo), validar límites/cuotas y configurar alertas/observabilidad. Añadir en Static Web Apps solo los orígenes CORS concretos si se sirve el API fuera del proxy integrado; no se necesita CORS para frontend y API bajo el mismo origen.
