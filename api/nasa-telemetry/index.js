import { app } from '@azure/functions';

const NASA_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const CACHE_TTL_MS = Number(process.env.NASA_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const MAX_DAYS = Number(process.env.NASA_MAX_DAYS || 400);
const FALLBACK = {
  source: 'fallback', fallback: true, location: { name: 'Uruapan, Michoacán', latitude: 19.4206, longitude: -102.0628 },
  dates: [], daily: [], current: { temperatureC: 24, precipitationMm: 0, surfaceMoisturePct: 18, rootMoisturePct: 35, ndvi: 0.62, elevationM: 1600 },
  layers: { smap: { moisturePct: 18, depthCm: '0-5', note: 'Estimación de referencia; validar contra producto SMAP disponible.' }, modisLandsat: { ndvi: 0.62, note: 'Estimación de referencia, no observación satelital en tiempo real.' }, srtm: { elevationM: 1600, note: 'Elevación aproximada; validar con DEM local.' } },
  notice: 'No fue posible consultar NASA POWER. Se muestran valores de referencia claramente identificados como respaldo.'
};
let cache = { expiresAt: 0, value: null };

function dateParam(value, fallback) {
  return /^\d{8}$/.test(value || '') ? value : fallback;
}

function toDaily(data) {
  const p = data?.properties?.parameter || {};
  const dates = Object.keys(p.T2M || {}).filter((key) => Number.isFinite(Number(p.T2M[key]))).sort();
  return dates.map((date) => ({
    date,
    temperatureC: finite(p.T2M?.[date]),
    precipitationMm: finite(p.PRECTOTCORR?.[date]),
    surfaceMoisturePct: finite(p.GWETTOP?.[date]),
    rootMoisturePct: finite(p.GWETROOT?.[date])
  }));
}

function finite(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

async function loadTelemetry(start, end, latitude, longitude) {
  const url = new URL(NASA_URL);
  url.search = new URLSearchParams({ parameters: 'T2M,PRECTOTCORR,GWETTOP,GWETROOT', community: 'AG', longitude: String(longitude), latitude: String(latitude), start, end, format: 'JSON' });
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`NASA POWER respondió HTTP ${response.status}`);
  const payload = await response.json();
  const daily = toDaily(payload);
  if (!daily.length) throw new Error('NASA POWER no devolvió observaciones para el periodo solicitado');
  const latest = daily.at(-1);
  const surface = latest.surfaceMoisturePct;
  return {
    source: 'NASA POWER', fallback: false,
    location: { name: 'Uruapan, Michoacán', latitude, longitude }, dates: daily.map((row) => row.date), daily,
    current: { temperatureC: latest.temperatureC, precipitationMm: latest.precipitationMm, surfaceMoisturePct: surface, rootMoisturePct: latest.rootMoisturePct, ndvi: null, elevationM: null },
    layers: {
      smap: { moisturePct: surface, depthCm: '0-5', note: 'GWETTOP de NASA POWER es humedad superficial modelada; no es una lectura directa del satélite SMAP.' },
      modisLandsat: { ndvi: null, note: 'NDVI requiere una fuente independiente de reflectancia MODIS/Landsat; no se inventa un valor.' },
      srtm: { elevationM: null, note: 'SRTM requiere consulta a un DEM externo; no se inventa un valor.' }
    }
  };
}

app.http('nasa-telemetry', {
  methods: ['GET'], authLevel: 'anonymous', route: 'nasa-telemetry',
  handler: async (request, context) => {
    const now = new Date();
    const endDefault = now.toISOString().slice(0, 10).replaceAll('-', '');
    const startDefault = `${now.getUTCFullYear()}0101`;
    const start = dateParam(request.query.get('start'), startDefault);
    const end = dateParam(request.query.get('end'), endDefault);
    const latitude = Number(request.query.get('latitude') || 19.4206);
    const longitude = Number(request.query.get('longitude') || -102.0628);
    const startDate = new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T00:00:00Z`);
    const endDate = new Date(`${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}T00:00:00Z`);
    const days = (endDate - startDate) / 86400000;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || start > end || Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || days > MAX_DAYS) {
      return { status: 400, jsonBody: { error: 'Coordenadas o rango de fechas no válido.' } };
    }
    const cacheKey = `${start}:${end}:${latitude}:${longitude}`;
    if (cache.key === cacheKey && cache.value && cache.expiresAt > Date.now()) return { jsonBody: { ...cache.value, cached: true } };
    try {
      const result = await loadTelemetry(start, end, latitude, longitude);
      cache = { key: cacheKey, value: result, expiresAt: Date.now() + CACHE_TTL_MS };
      return { jsonBody: { ...result, cached: false } };
    } catch (error) {
      context.warn('NASA POWER no disponible; intentando respaldo de caché.', error);
      if (cache.value && cache.key === cacheKey) return { jsonBody: { ...cache.value, cached: true, stale: true, notice: 'NASA POWER no respondió; se entrega la última consulta almacenada.' } };
      return { jsonBody: { ...FALLBACK, fallback: true, requestedPeriod: { start, end }, error: 'NASA POWER no está disponible en este momento.' } };
    }
  }
});
