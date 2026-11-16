// Clientes de servicios de la NASA usados por AGROTOPURE.
//  - NASA POWER (LaRC): meteorología diaria, radiación solar/UV, humedad de suelo modelada y climatología.
//  - ORNL DAAC (NASA) MODIS/VIIRS Land Product Subsets: NDVI (MOD13Q1) y temperatura de superficie (MOD11A2).
//  - NASA EONET (GSFC): eventos naturales activos (ciclones, incendios, inundaciones, sequía…).
import { HttpError } from './http.js';

const POWER = 'https://power.larc.nasa.gov/api/temporal';
const ORNL = 'https://modis.ornl.gov/rst/api/v1';
const EONET = 'https://eonet.gsfc.nasa.gov/api/v3/events';

// Grupo principal: variables que POWER publica siempre para la comunidad AG.
const DAILY_CORE = ['T2M', 'T2M_MAX', 'T2M_MIN', 'T2MDEW', 'RH2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M', 'WS2M_MAX', 'PS', 'TS', 'GWETTOP', 'GWETROOT', 'GWETPROF'];
const DAILY_MIN = ['T2M', 'T2M_MAX', 'T2M_MIN', 'RH2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M'];
// Grupo solar: si POWER rechaza alguno, se reintenta sin él y la app sigue funcionando.
const DAILY_SOLAR = ['CLRSKY_SFC_SW_DWN', 'TOA_SW_DWN', 'ALLSKY_KT', 'ALLSKY_SFC_PAR_TOT', 'ALLSKY_SFC_UV_INDEX'];
const CLIM_PARAMS = ['T2M', 'T2M_MAX', 'T2M_MIN', 'T2M_RANGE', 'RH2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M', 'GWETTOP', 'GWETROOT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const FIELD_OF = {
  T2M: 't2m', T2M_MAX: 'tmax', T2M_MIN: 'tmin', T2MDEW: 'dew', RH2M: 'rh', PRECTOTCORR: 'precip',
  ALLSKY_SFC_SW_DWN: 'rad', WS2M: 'wind', WS2M_MAX: 'windMax', PS: 'ps', TS: 'ts',
  GWETTOP: 'gwettop', GWETROOT: 'gwetroot', GWETPROF: 'gwetprof',
  CLRSKY_SFC_SW_DWN: 'radClear', TOA_SW_DWN: 'radToa', ALLSKY_KT: 'kt', ALLSKY_SFC_PAR_TOT: 'par', ALLSKY_SFC_UV_INDEX: 'uv'
};

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
      err.upstreamBody = msg;
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

function unitsOf(body, into = {}) {
  for (const [k, v] of Object.entries(body?.parameters || {})) into[k] = v?.units || '';
  return into;
}

/** Extrae {fecha: {campo: valor}} de una respuesta de POWER, convirtiendo los valores de relleno en null. */
function parseDaily(body, into = new Map()) {
  const fill = body?.header?.fill_value ?? -999;
  const params = body?.properties?.parameter || {};
  for (const [name, series] of Object.entries(params)) {
    const field = FIELD_OF[name];
    if (!field) continue;
    for (const [date, raw] of Object.entries(series)) {
      const v = raw === undefined || raw === null || raw === fill || raw <= -990 ? null : raw;
      if (!into.has(date)) into.set(date, {});
      into.get(date)[field] = v;
    }
  }
  return into;
}

/** Serie diaria NASA POWER (comunidad AG) para un punto: clima, humedad de suelo y radiación. */
export async function powerDaily(lat, lon, days = 60) {
  const span = Math.min(366, Math.max(7, days));
  return cached(`pd:${lat}:${lon}:${span}`, 3 * 3600e3, async () => {
    const end = new Date(Date.now() - 864e5);
    const start = new Date(end.getTime() - (span - 1) * 864e5);
    const url = (params) => `${POWER}/daily/point?parameters=${params.join(',')}&community=AG&longitude=${lon}&latitude=${lat}&start=${ymd(start)}&end=${ymd(end)}&format=JSON`;

    let core;
    try {
      core = await getJson(url(DAILY_CORE));
    } catch (e) {
      if (e.upstreamStatus !== 422) throw e;
      core = await getJson(url(DAILY_MIN)); // por si algún parámetro deja de publicarse
    }

    // El grupo solar es opcional: si POWER rechaza un parámetro se reintenta sin los no reconocidos.
    let solar = null;
    const solarNotes = [];
    try {
      solar = await getJson(url(DAILY_SOLAR));
    } catch (e) {
      if (e.upstreamStatus === 422) {
        const rejected = DAILY_SOLAR.filter((p) => String(e.upstreamBody || '').includes(p));
        const keep = DAILY_SOLAR.filter((p) => !rejected.includes(p));
        solarNotes.push(`Parámetros no disponibles en POWER: ${(rejected.length ? rejected : DAILY_SOLAR).join(', ')}.`);
        if (rejected.length && keep.length) {
          try { solar = await getJson(url(keep)); } catch { /* se continúa sin el grupo solar */ }
        }
      } else {
        solarNotes.push('No se pudo consultar el grupo de radiación solar.');
      }
    }

    const map = parseDaily(core);
    if (solar) parseDaily(solar, map);
    const units = unitsOf(core);
    if (solar) unitsOf(solar, units);

    const daily = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => ({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, ...v }));

    return {
      source: 'NASA POWER Daily API (comunidad AG)',
      url: url(DAILY_CORE),
      location: { lat, lon },
      elevationM: core?.geometry?.coordinates?.[2] ?? null,
      units,
      notes: solarNotes,
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

const R_EARTH = 6371;
export function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Puntos de una geometría EONET (Point o Polygon) como {lat, lon}. */
function geometryPoints(g) {
  if (!g?.coordinates) return [];
  if (g.type === 'Point') return [{ lat: g.coordinates[1], lon: g.coordinates[0] }];
  if (g.type === 'Polygon') return (g.coordinates[0] || []).map((c) => ({ lat: c[1], lon: c[0] }));
  return [];
}

/**
 * Eventos naturales activos de NASA EONET cerca de la parcela.
 * EONET es un repositorio de metadatos para visualización y referencia general:
 * no es una fuente oficial de datos espaciales o temporales precisos, ni un pronóstico.
 */
export async function eonet(lat, lon, { radiusKm = 800, days = 30 } = {}) {
  const radius = Math.min(3000, Math.max(50, radiusKm));
  const span = Math.min(120, Math.max(1, days));
  return cached(`eo:${lat.toFixed(1)}:${lon.toFixed(1)}:${radius}:${span}`, 3600e3, async () => {
    // El bbox de EONET va: minLon, maxLat, maxLon, minLat (esquina superior izquierda, luego inferior derecha).
    const dLat = radius / 111;
    const dLon = radius / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const bbox = [lon - dLon, Math.min(90, lat + dLat), lon + dLon, Math.max(-90, lat - dLat)].map((n) => n.toFixed(3)).join(',');
    const url = `${EONET}?status=open&days=${span}&limit=200&bbox=${bbox}`;
    const body = await getJson(url, 20000);
    const here = { lat, lon };

    const events = (body?.events || []).map((e) => {
      let nearest = null;
      for (const g of e.geometry || []) {
        for (const p of geometryPoints(g)) {
          const km = haversineKm(here, p);
          if (!nearest || km < nearest.km) nearest = { km, date: g.date, point: p, magnitudeValue: g.magnitudeValue ?? null, magnitudeUnit: g.magnitudeUnit ?? null };
        }
      }
      const last = (e.geometry || [])[e.geometry.length - 1];
      return {
        id: e.id,
        title: e.title,
        description: e.description || null,
        categories: (e.categories || []).map((c) => c.id),
        categoryTitles: (e.categories || []).map((c) => c.title),
        sources: (e.sources || []).map((s) => ({ id: s.id, url: s.url })),
        link: e.sources?.[0]?.url || e.link || null,
        closed: e.closed || null,
        distanceKm: nearest ? Math.round(nearest.km) : null,
        lastDate: last?.date || nearest?.date || null,
        magnitudeValue: nearest?.magnitudeValue ?? null,
        magnitudeUnit: nearest?.magnitudeUnit ?? null,
        point: nearest?.point || null
      };
    }).filter((e) => e.distanceKm !== null && e.distanceKm <= radius);

    events.sort((a, b) => a.distanceKm - b.distanceKm);
    return {
      source: 'NASA EONET v3 (Earth Observatory Natural Event Tracker)',
      url,
      disclaimer: 'EONET es un repositorio de metadatos para visualización y referencia general; no es una fuente oficial de datos espaciales o temporales precisos ni un pronóstico.',
      location: { lat, lon },
      radiusKm: radius,
      days: span,
      events: events.slice(0, 40)
    };
  });
}
