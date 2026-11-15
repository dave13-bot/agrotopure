import { app } from '@azure/functions';

const NASA_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const CACHE_TTL_MS = Number(process.env.NASA_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const MAX_DAYS = Number(process.env.NASA_MAX_DAYS || 400);
let cache = { expiresAt: 0, value: null };

function dateParam(value, fallback) {
  return /^\d{8}$/.test(value || '') ? value : fallback;
}

function toDaily(data) {
  const p = data?.properties?.parameter || {};
  const dates = Object.keys(p.T2M || p.PRECTOTCORR || {}).filter((key) => Object.values(p).some((values) => Number.isFinite(Number(values?.[key])) && values?.[key] !== -999)).sort();
  return dates.map((date) => ({
    date,
    temperatureC: finite(p.T2M?.[date]), precipitationMm: finite(p.PRECTOTCORR?.[date]),
    solarRadiation: finite(p.ALLSKY_SFC_SW_DWN?.[date]), windSpeed: finite(p.WS2M?.[date]),
    relativeHumidity: finite(p.RH2M?.[date]), surfacePressure: finite(p.PS?.[date]),
    evapotranspiration: finite(p.EVPTRNS?.[date])
  }));
}

function finite(value) { const n = Number(value); return Number.isFinite(n) && n !== -999 ? n : null; }

async function loadTelemetry(start, end, latitude, longitude, parameters) {
  const url = new URL(NASA_URL);
  url.search = new URLSearchParams({ parameters: parameters.join(','), community: 'AG', longitude: String(longitude), latitude: String(latitude), start, end, format: 'JSON' });
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`NASA POWER respondió HTTP ${response.status}`);
  const payload = await response.json();
  const daily = toDaily(payload);
  if (!daily.length || daily.every((row) => Object.entries(row).filter(([key]) => key !== 'date').every(([, value]) => value === null))) throw new Error('NASA POWER no devolvió observaciones válidas para las coordenadas y fechas solicitadas');
  const latest = [...daily].reverse().find((row) => Object.entries(row).some(([key, value]) => key !== 'date' && value !== null));
  const elevationM = finite(payload?.geometry?.coordinates?.[2]);
  return {
    source: 'NASA POWER', fallback: false,
    location: { latitude, longitude }, dates: daily.map((row) => row.date), daily,
    current: { ...latest, elevationM },
    sourceNotes: { currentMeaning: 'Última fecha disponible de la serie devuelta por NASA POWER; no es dato instantáneo.', pressure: 'PS es presión superficial modelada de NASA POWER; no es presión atmosférica observada ni pronóstico.', elevation: elevationM === null ? 'NASA POWER no entregó elevación con esta respuesta.' : 'Altura que reporta geometry de NASA POWER; no es una extracción independiente de SRTM.' }
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
    const allowedParameters = new Set(['T2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M', 'RH2M', 'PS', 'EVPTRNS']);
    const requestedParameters = (request.query.get('parameters') || 'T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS2M,RH2M,PS,EVPTRNS').split(',').map((x) => x.trim()).filter((x) => allowedParameters.has(x));
    if (!requestedParameters.length) return { status: 400, jsonBody: { error: 'Indica al menos un parámetro NASA POWER permitido.' } };
    const startDate = new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T00:00:00Z`);
    const endDate = new Date(`${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}T00:00:00Z`);
    const days = (endDate - startDate) / 86400000;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || start > end || Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || days > MAX_DAYS) {
      return { status: 400, jsonBody: { error: 'Coordenadas o rango de fechas no válido.' } };
    }
    const cacheKey = `${start}:${end}:${latitude}:${longitude}:${requestedParameters.join(',')}`;
    if (cache.key === cacheKey && cache.value && cache.expiresAt > Date.now()) return { jsonBody: { ...cache.value, cached: true } };
    try {
      const result = await loadTelemetry(start, end, latitude, longitude, requestedParameters);
      cache = { key: cacheKey, value: result, expiresAt: Date.now() + CACHE_TTL_MS };
      return { jsonBody: { ...result, cached: false } };
    } catch (error) {
      context.warn('NASA POWER no disponible; intentando respaldo de caché.', error);
      if (cache.value && cache.key === cacheKey) return { jsonBody: { ...cache.value, cached: true, stale: true, notice: 'NASA POWER no respondió; se entrega la última consulta almacenada.' } };
      return { status: 502, jsonBody: { source: 'NASA POWER', fallback: false, error: 'No se obtuvieron datos NASA POWER para esta solicitud.', detail: error.message, location: { latitude, longitude }, requestedPeriod: { start, end }, daily: [], current: null } };
    }
  }
});
