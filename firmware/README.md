# Firmware de sensores AGRO-TOPURE

- [`esp32/`](esp32/): nodo de bajo consumo con deep sleep (Arduino).
- [`raspberry-pi/`](raspberry-pi/): servicio Python con cola local.

Ambos envían a `POST /api/ingest` con los encabezados `x-device-id` y `x-device-key` que entrega la app en **Sensores → Dispositivo**. AGRO-TOPURE guarda cada lectura en el histórico de la parcela y recalcula la fusión Δ, la tendencia y la predicción de riego.
