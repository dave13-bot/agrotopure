import { app } from '@azure/functions';

const readingsByPlot = new Map();
const writeKey = process.env.IOT_WRITE_KEY || '';
const maxPayload = 16 * 1024;
const finiteField = (value, min, max, label, optional = false) => {
  if ((value === null || value === undefined || value === '') && optional) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} fuera del rango válido (${min} a ${max}).`);
  return n;
};

app.http('iot-fusion-get', {
  methods: ['GET'], authLevel: 'anonymous', route: 'iot-fusion',
  handler: async (request) => {
    const plotId = String(request.query.get('plotId') || '').slice(0, 80);
    if (!plotId) return { status: 400, jsonBody: { error: 'plotId es obligatorio.' } };
    const readings = (readingsByPlot.get(plotId) || []).slice(-100).reverse();
    return { jsonBody: { plotId, count: readings.length, readings, latest: readings[0] || null, storage: 'memory' } };
  }
});

app.http('iot-fusion-post', {
  methods: ['POST'], authLevel: 'anonymous', route: 'iot-fusion',
  handler: async (request) => {
    if (!writeKey) return { status: 503, jsonBody: { error: 'Configura IOT_WRITE_KEY en Azure para habilitar recepción IoT.' } };
    if (request.headers.get('x-iot-key') !== writeKey) return { status: 401, jsonBody: { error: 'Dispositivo no autorizado.' } };
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > maxPayload) return { status: 413, jsonBody: { error: 'Payload demasiado grande.' } };
      const body = JSON.parse(raw);
      const plotId = String(body.plotId || '').trim().slice(0, 80);
      if (!plotId) throw new Error('plotId es obligatorio.');
      const reading = {
        plotId,
        deviceId: String(body.deviceId || 'ESP32').slice(0, 80),
        moisture25cm: finiteField(body.moisture25cm, 0, 100, 'Humedad 25 cm', true),
        rootTemperatureC: finiteField(body.rootTemperatureC, -20, 80, 'Temperatura raíz', true),
        soilPh: finiteField(body.soilPh, 0, 14, 'pH', true),
        pressureHpa: finiteField(body.pressureHpa, 300, 1200, 'Presión', true),
        recordedAt: new Date().toISOString(), source: String(body.source || 'manual').slice(0, 30)
      };
      if (Object.entries(reading).filter(([key]) => ['moisture25cm','rootTemperatureC','soilPh','pressureHpa'].includes(key)).every(([, value]) => value === null)) throw new Error('Incluye al menos una lectura numérica.');
      const list = readingsByPlot.get(plotId) || [];
      list.push(reading);
      readingsByPlot.set(plotId, list.slice(-500));
      return { status: 201, jsonBody: { reading } };
    } catch (error) {
      return { status: 400, jsonBody: { error: error instanceof SyntaxError ? 'JSON inválido.' : error.message } };
    }
  }
});
