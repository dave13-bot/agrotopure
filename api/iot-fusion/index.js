import { app } from '@azure/functions';

const store = new Map();
const MAX_READINGS = 500;
const DEFAULT_PLOT = 'uruapan-maiz-01';
const MAX_BODY_BYTES = 16 * 1024;
const IOT_WRITE_KEY = process.env.IOT_WRITE_KEY || '';
const SEED = { plotId: DEFAULT_PLOT, moisture25cm: 35, rootTemperatureC: 22, soilPh: 6.2, surfaceMoisturePct: 18, recordedAt: new Date().toISOString(), source: 'demo' };
store.set(DEFAULT_PLOT, [SEED]);

function numeric(value, min, max, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${name} debe estar entre ${min} y ${max}.`);
  return number;
}

function analyze(reading) {
  const delta = Number((reading.moisture25cm - reading.surfaceMoisturePct).toFixed(1));
  const hiddenWindow = delta >= 10 && reading.moisture25cm >= 25;
  let recommendation = 'Revisa la humedad antes de regar y vuelve a medir en 24 horas.';
  if (hiddenWindow) recommendation = 'Ventana de siembra oculta detectada: Humedad subsuperficial óptima para leguminosa de cobertura sin encender riego';
  else if (reading.moisture25cm < 20) recommendation = 'Humedad profunda baja: confirma con una segunda lectura y evalúa riego localizado.';
  else if (reading.soilPh < 5.5) recommendation = 'El pH es ácido: solicita análisis local antes de aplicar enmiendas.';
  return { deltaMoisturePct: delta, alert: hiddenWindow ? 'positive' : reading.moisture25cm < 20 ? 'water-stress' : 'normal', recommendation };
}

function normalize(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('El cuerpo debe ser un objeto JSON.');
  const reading = {
    plotId: String(payload.plotId || DEFAULT_PLOT).trim().slice(0, 80),
    moisture25cm: numeric(payload.moisture25cm, 0, 100, 'moisture25cm'),
    rootTemperatureC: numeric(payload.rootTemperatureC, -10, 60, 'rootTemperatureC'),
    soilPh: numeric(payload.soilPh, 0, 14, 'soilPh'),
    surfaceMoisturePct: numeric(payload.surfaceMoisturePct ?? 18, 0, 100, 'surfaceMoisturePct'),
    recordedAt: new Date().toISOString(), source: String(payload.source || 'iot').slice(0, 30)
  };
  if (!reading.plotId) throw new Error('plotId es obligatorio.');
  return { ...reading, ...analyze(reading) };
}

app.http('iot-fusion-get', {
  methods: ['GET'], authLevel: 'anonymous', route: 'iot-fusion',
  handler: async (request) => {
    const plotId = String(request.query.get('plotId') || DEFAULT_PLOT);
    const limit = Math.min(200, Math.max(1, Number.parseInt(request.query.get('limit') || '50', 10) || 50));
    const readings = (store.get(plotId) || []).slice(-limit).reverse();
    return { jsonBody: { plotId, count: readings.length, readings, latest: readings[0] || null, storage: 'in-memory; configure Azure Table/Cosmos DB for persistence across function instances' } };
  }
});

app.http('iot-fusion-post', {
  methods: ['POST'], authLevel: 'anonymous', route: 'iot-fusion',
  handler: async (request) => {
    try {
      const declaredLength = Number(request.headers.get('content-length') || 0);
      if (declaredLength > MAX_BODY_BYTES) return { status: 413, jsonBody: { error: 'El cuerpo excede el tamaño permitido.' } };
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return { status: 413, jsonBody: { error: 'El cuerpo excede el tamaño permitido.' } };
      let payload;
      try { payload = JSON.parse(rawBody); } catch { return { status: 400, jsonBody: { error: 'El cuerpo debe contener JSON válido.' } }; }
      if (!IOT_WRITE_KEY) return { status: 503, jsonBody: { error: 'Recepción de sensores deshabilitada: configura IOT_WRITE_KEY en el servicio de Functions.' } };
      if (request.headers.get('x-iot-key') !== IOT_WRITE_KEY) return { status: 401, jsonBody: { error: 'Sensor no autorizado.' } };
      const reading = normalize(payload);
      const readings = store.get(reading.plotId) || [];
      readings.push(reading);
      store.set(reading.plotId, readings.slice(-MAX_READINGS));
      return { status: 201, jsonBody: { reading, analysis: { deltaMoisturePct: reading.deltaMoisturePct, alert: reading.alert, recommendation: reading.recommendation } } };
    } catch (error) {
      return { status: 400, jsonBody: { error: error.message } };
    }
  }
});
