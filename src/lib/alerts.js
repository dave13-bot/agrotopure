// Alertas de peligro para los cultivos, construidas SOLO con datos de la NASA.
//  - Eventos activos observados: NASA EONET (ciclones, incendios, inundaciones, sequía, volcanes).
//  - Condiciones de la parcela: NASA POWER diario comparado con su climatología de largo plazo.
// Nada de esto es un pronóstico: POWER publica con días de retraso y EONET es un repositorio de
// metadatos para visualización y referencia general, no una fuente oficial de precisión espacial.

export const ALERT_TYPES = ['storm', 'fire', 'flood', 'drought', 'volcano', 'frost', 'heat', 'uv', 'rain', 'wind', 'dry'];

const EONET_MAP = {
  severeStorms: 'storm', wildfires: 'fire', floods: 'flood', drought: 'drought',
  volcanoes: 'volcano', dustHaze: 'storm', seaLakeIce: null, earthquakes: null, landslides: 'flood', snow: 'frost'
};

const SEV = { high: 3, medium: 2, low: 1 };
const round = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const lastValid = (rows, key, n = 10) => rows.slice(-n).filter((r) => r[key] !== null && r[key] !== undefined);

/** Alertas a partir de eventos activos de NASA EONET. */
export function eonetAlerts(eonetData, { nearKm = 150, midKm = 400 } = {}) {
  return (eonetData?.events || []).map((e) => {
    const type = e.categories.map((c) => EONET_MAP[c]).find(Boolean);
    if (!type) return null;
    const severity = e.distanceKm <= nearKm ? SEV.high : e.distanceKm <= midKm ? SEV.medium : SEV.low;
    return {
      id: `eonet:${e.id}`,
      type,
      severity,
      source: 'NASA EONET',
      sourceDetail: e.sources?.[0]?.id || null,
      date: e.lastDate,
      distanceKm: e.distanceKm,
      eventTitle: e.title,
      link: e.link,
      key: `alerts.${type}.eonet`,
      vars: { km: e.distanceKm, title: e.title, magnitude: e.magnitudeValue !== null ? `${e.magnitudeValue} ${e.magnitudeUnit || ''}`.trim() : null }
    };
  }).filter(Boolean);
}

/**
 * Alertas derivadas de NASA POWER: compara los últimos días publicados con la
 * climatología mensual del mismo punto (normales de 2001-2025).
 */
export function powerAlerts(daily, months, crop) {
  const out = [];
  if (!daily?.length) return out;
  const last = daily[daily.length - 1];
  const month = Number(last.date.slice(5, 7));
  const normal = months?.find((m) => m.month === month) || null;
  const frostSensitive = Boolean(crop?.frostSensitive);

  // --- Frío, helada y entrada de frente frío ---
  const mins = lastValid(daily, 'tmin', 7);
  if (mins.length) {
    const coldest = mins.reduce((a, b) => (b.tmin < a.tmin ? b : a));
    if (coldest.tmin <= 3) {
      out.push({
        id: 'power:frost', type: 'frost', source: 'NASA POWER', date: coldest.date,
        severity: coldest.tmin <= 0 ? SEV.high : frostSensitive ? SEV.high : SEV.medium,
        key: coldest.tmin <= 0 ? 'alerts.frost.freeze' : 'alerts.frost.near',
        vars: { tmin: round(coldest.tmin), crop: crop?.name || null }
      });
    }
    // Frente frío: caída marcada de la temperatura media y mínimas bajo la normal del mes.
    const t2m = lastValid(daily, 't2m', 8).map((r) => r.t2m);
    const drop = t2m.length >= 4 ? mean(t2m.slice(0, 2)) - mean(t2m.slice(-2)) : null;
    const minMean = mean(mins.map((r) => r.tmin));
    const belowNormal = normal?.tmin !== null && normal?.tmin !== undefined ? minMean - normal.tmin : null;
    if (drop !== null && drop >= 4 && belowNormal !== null && belowNormal < 0) {
      out.push({
        id: 'power:coldfront', type: 'frost', source: 'NASA POWER', date: last.date, severity: drop >= 7 ? SEV.high : SEV.medium,
        key: 'alerts.frost.coldFront', vars: { drop: round(drop), tmin: round(minMean) }
      });
    }
  }

  // --- Calor extremo ---
  const maxes = lastValid(daily, 'tmax', 7);
  if (maxes.length) {
    const hottest = maxes.reduce((a, b) => (b.tmax > a.tmax ? b : a));
    if (hottest.tmax >= 35) {
      out.push({
        id: 'power:heat', type: 'heat', source: 'NASA POWER', date: hottest.date,
        severity: hottest.tmax >= 38 ? SEV.high : SEV.medium,
        key: 'alerts.heat.body', vars: { tmax: round(hottest.tmax) }
      });
    }
  }

  // --- Radiación solar y UV ---
  const uvs = lastValid(daily, 'uv', 7);
  const rads = lastValid(daily, 'rad', 7);
  if (uvs.length) {
    const peak = uvs.reduce((a, b) => (b.uv > a.uv ? b : a));
    if (peak.uv >= 8) {
      out.push({
        id: 'power:uv', type: 'uv', source: 'NASA POWER', date: peak.date,
        severity: peak.uv >= 11 ? SEV.high : SEV.medium,
        key: 'alerts.uv.index', vars: { uv: round(peak.uv) }
      });
    }
  } else if (rads.length) {
    const peak = rads.reduce((a, b) => (b.rad > a.rad ? b : a));
    if (peak.rad >= 26) {
      out.push({
        id: 'power:rad', type: 'uv', source: 'NASA POWER', date: peak.date,
        severity: peak.rad >= 29 ? SEV.high : SEV.medium,
        key: 'alerts.uv.radiation', vars: { rad: round(peak.rad) }
      });
    }
  }

  // --- Lluvia intensa ---
  const rain = lastValid(daily, 'precip', 7);
  if (rain.length) {
    const wettest = rain.reduce((a, b) => (b.precip > a.precip ? b : a));
    const three = rain.slice(-3).reduce((s, r) => s + r.precip, 0);
    if (wettest.precip >= 50 || three >= 100) {
      out.push({
        id: 'power:rain', type: 'rain', source: 'NASA POWER', date: wettest.date,
        severity: wettest.precip >= 80 || three >= 150 ? SEV.high : SEV.medium,
        key: 'alerts.rain.body', vars: { mm: round(wettest.precip), mm3: round(three, 0) }
      });
    }
  }

  // --- Viento fuerte ---
  const winds = lastValid(daily, 'windMax', 7).length ? lastValid(daily, 'windMax', 7) : lastValid(daily, 'wind', 7);
  if (winds.length) {
    const key = winds[0].windMax !== undefined && winds[0].windMax !== null ? 'windMax' : 'wind';
    const peak = winds.reduce((a, b) => (b[key] > a[key] ? b : a));
    const limit = key === 'windMax' ? 11 : 8;
    if (peak[key] >= limit) {
      out.push({
        id: 'power:wind', type: 'wind', source: 'NASA POWER', date: peak.date,
        severity: peak[key] >= limit + 4 ? SEV.high : SEV.medium,
        key: 'alerts.wind.body', vars: { ms: round(peak[key]), kmh: round(peak[key] * 3.6, 0) }
      });
    }
  }

  // --- Racha seca: días sin lluvia + humedad de zona radicular baja ---
  const withRain = daily.filter((d) => d.precip !== null && d.precip !== undefined);
  if (withRain.length) {
    let dry = 0;
    for (let i = withRain.length - 1; i >= 0 && withRain[i].precip < 1; i--) dry++;
    const root = lastValid(daily, 'gwetroot', 10);
    const rootNow = root.length ? root[root.length - 1].gwetroot : null;
    if (dry >= 15) {
      out.push({
        id: 'power:dry', type: 'dry', source: 'NASA POWER', date: last.date,
        severity: dry >= 25 || (rootNow !== null && rootNow < 0.3) ? SEV.high : SEV.medium,
        key: 'alerts.dry.body', vars: { days: dry, root: rootNow === null ? null : Math.round(rootNow * 100) }
      });
    }
  }
  return out;
}

/** Lista final ordenada y filtrada por las preferencias del usuario. */
export function buildAlerts({ eonet, daily, months, crop, enabled = ALERT_TYPES }) {
  const all = [...eonetAlerts(eonet), ...powerAlerts(daily, months, crop)];
  return all
    .filter((a) => enabled.includes(a.type))
    .sort((a, b) => b.severity - a.severity || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || String(b.date).localeCompare(String(a.date)));
}

export const severityLabel = (s) => (s === SEV.high ? 'high' : s === SEV.medium ? 'medium' : 'low');
export { SEV };
