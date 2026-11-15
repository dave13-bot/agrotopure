// Clientes de servicios de la NASA usados por AGROTOPURE.
//  - NASA POWER (LaRC): meteorología diaria, humedad de suelo modelada (GWET*) y climatología mensual.
//  - ORNL DAAC (NASA) MODIS/VIIRS Land Product Subsets: NDVI (MOD13Q1) y temperatura de superficie (MOD11A2).
import { HttpError } from './http.js';

const POWER = 'https://power.larc.nasa.gov/api/temporal';
const ORNL = 'https://modis.ornl.gov/rst/api/v1';

const DAILY_PARAMS = ['T2M', 'T2M_MAX', 'T2M_MIN', 'T2MDEW', 'RH2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M', 'PS', 'TS', 'GWETTOP', 'GWETROOT', 'GWETPROF'];
const DAILY_MIN = ['T2M', 'T2M_MAX', 'T2M_MIN', 'RH2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M'];
const CLIM_PARAMS = ['T2M', 'T2M_MAX', 'T2M_MIN', 'T2M_RANGE', 'RH2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M', 'GWETTOP', 'GWETROOT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, exp: Date.now() + ttlMs });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}

async function getJson(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'AGROTOPURE/1.0 (NASA Space Apps 2026)' }, signal: ctrl.signal });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    if (!r.ok) {
      const msg = body?.messages?.join?.(' ') || body?.message || body?.detail || text.slice(0, 200);
      const err = new HttpError(502, `Servicio NASA respondió ${r.status}: ${msg}`, 'nasa_upstream');
      err.upstreamStatus = r.status;
      throw err;
    }
    if (!body) throw new HttpError(502, 'Respuesta no válida del servicio NASA.', 'nasa_upstream');
    return body;
  } catch (e) {
    if (e.name === 'AbortError') throw new HttpError(504, 'El servicio de la NASA tardó demasiado en responder.', 'nasa_timeout');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

function unitsOf(body) {
  const out = {};
  for (const [k, v] of Object.entries(body?.parameters || {})) out[k] = v?.units || '';
  return out;
}

/** Serie diaria NASA POWER (comunidad AG) para un punto. */
export async function powerDaily(lat, lon, days = 60) {
  const span = Math.min(366, Math.max(7, days));
  return cached(`pd:${lat}:${lon}:${span}`, 3 * 3600e3, async () => {
    const end = new Date(Date.now() - 864e5);
    const start = new Date(end.getTime() - (span - 1) * 864e5);
    const url = (params) => `${POWER}/daily/point?parameters=${params.join(',')}&community=AG&longitude=${lon}&latitude=${lat}&start=${ymd(start)}&end=${ymd(end)}&format=JSON`;
    let body;
    try {
      body = await getJson(url(DAILY_PARAMS));
    } catch (e) {
      if (e.upstreamStatus !== 422) throw e;
      body = await getJson(url(DAILY_MIN)); // por si algún parámetro deja de publicarse
    }
    const fill = body?.header?.fill_value ?? -999;
    const p = body?.properties?.parameter || {};
    const dates = Object.keys(p.T2M || {}).sort();
    const val = (k, d) => {
      const v = p[k]?.[d];
      return v === undefined || v === null || v === fill || v <= -990 ? null : v;
    };
    const daily = dates.map((d) => ({
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      t2m: val('T2M', d), tmax: val('T2M_MAX', d), tmin: val('T2M_MIN', d), dew: val('T2MDEW', d),
      rh: val('RH2M', d), precip: val('PRECTOTCORR', d), rad: val('ALLSKY_SFC_SW_DWN', d),
      wind: val('WS2M', d), ps: val('PS', d), ts: val('TS', d),
      gwettop: val('GWETTOP', d), gwetroot: val('GWETROOT', d), gwetprof: val('GWETPROF', d)
    }));
    return {
      source: 'NASA POWER Daily API (comunidad AG)',
      url: url(DAILY_PARAMS),
      location: { lat, lon },
      elevationM: body?.geometry?.coordinates?.[2] ?? null,
      units: unitsOf(body),
      daily
    };
  });
}

/** Climatología mensual NASA POWER (normales de largo plazo). */
export async function powerClimatology(lat, lon) {
  return cached(`pc:${lat}:${lon}`, 24 * 3600e3, async () => {
    const url = `${POWER}/climatology/point?parameters=${CLIM_PARAMS.join(',')}&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`;
    let body;
    try { body = await getJson(url); } catch (e) {
      if (e.upstreamStatus !== 422) throw e;
      body = await getJson(url.replace('T2M_RANGE,', ''));
    }
    const fill = body?.header?.fill_value ?? -999;
    const p = body?.properties?.parameter || {};
    const v = (k, m) => { const x = p[k]?.[m]; return x === undefined || x === fill || x <= -990 ? null : x; };
    const months = MONTHS.map((m, i) => ({
      month: i + 1, t2m: v('T2M', m), tmax: v('T2M_MAX', m), tmin: v('T2M_MIN', m), range: v('T2M_RANGE', m), rh: v('RH2M', m),
      precipDay: v('PRECTOTCORR', m), rad: v('ALLSKY_SFC_SW_DWN', m), wind: v('WS2M', m),
      gwettop: v('GWETTOP', m), gwetroot: v('GWETROOT', m)
    }));
    return {
      source: 'NASA POWER Climatology API (comunidad AG)', url, location: { lat, lon },
      period: body?.header?.range || null, elevationM: body?.geometry?.coordinates?.[2] ?? null,
      units: unitsOf(body), months
    };
  });
}

/** Fecha MODIS "AYYYYDDD". */
export function modisDate(d) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const doy = Math.floor((d.getTime() - start) / 864e5) + 1;
  return `A${d.getUTCFullYear()}${String(doy).padStart(3, '0')}`;
}

/** Serie del píxel que contiene el punto; una sola consulta por producto (sin listar todas las fechas). */
async function ornlSeries(lat, lon, product, band, scale, offset, fill, spanDays) {
  const end = new Date();
  const start = new Date(end.getTime() - spanDays * 864e5);
  const url = `${ORNL}/${product}/subset?latitude=${lat}&longitude=${lon}&band=${band}&startDate=${modisDate(start)}&endDate=${modisDate(end)}&kmAboveBelow=0&kmLeftRight=0`;
  const body = await getJson(url, 38000);
  return (body?.subset || [])
    .map((s) => {
      const raw = Array.isArray(s.data) ? s.data[0] : null;
      const value = raw === null || raw === undefined || raw === fill ? null : raw * scale + offset;
      return { date: s.calendar_date, value };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** NDVI (MOD13Q1, 250 m, 16 días) y temperatura de superficie diurna (MOD11A2, 1 km, 8 días). */
export async function modis(lat, lon) {
  return cached(`md:${lat}:${lon}`, 12 * 3600e3, async () => {
    const [ndvi, lst] = await Promise.allSettled([
      ornlSeries(lat, lon, 'MOD13Q1', '250m_16_days_NDVI', 0.0001, 0, -3000, 140),
      ornlSeries(lat, lon, 'MOD11A2', 'LST_Day_1km', 0.02, -273.15, 0, 72)
    ]);
    if (ndvi.status === 'rejected' && lst.status === 'rejected') throw ndvi.reason;
    return {
      source: 'ORNL DAAC (NASA) MODIS Land Product Subsets: MOD13Q1 NDVI, MOD11A2 LST',
      location: { lat, lon },
      ndvi: ndvi.status === 'fulfilled' ? ndvi.value.map((x) => ({ ...x, value: x.value === null ? null : Math.round(x.value * 1000) / 1000 })) : [],
      lstDayC: lst.status === 'fulfilled' ? lst.value.map((x) => ({ ...x, value: x.value === null ? null : Math.round(x.value * 10) / 10 })) : [],
      errors: [ndvi, lst].filter((r) => r.status === 'rejected').map((r) => r.reason?.message || 'error')
    };
  });
}
