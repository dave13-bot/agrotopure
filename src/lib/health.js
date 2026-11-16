// Salud del cultivo a partir de la luz que refleja (NDVI de MODIS MOD13Q1, NASA).
// Una planta sana absorbe luz roja para la fotosíntesis y refleja mucho infrarrojo cercano:
//   NDVI = (NIR − Rojo) / (NIR + Rojo)
// El valor esperado depende del tipo de cultivo y de su etapa; cuando lo observado no coincide
// con lo esperado, o cae de golpe sin que la cosecha lo explique, se genera una alerta. La causa
// se acota con NASA POWER (agua, helada, calor); si el clima no la explica, puede ser plaga,
// enfermedad o nutrición y toca revisar en campo. Los rangos son ORIENTATIVOS para píxeles de 250 m.

/** NDVI esperado con el dosel desarrollado, por tipo de cultivo. */
export const PEAK_NDVI = {
  cereal: [0.65, 0.9], legume: [0.6, 0.85], root: [0.55, 0.8], industrial: [0.55, 0.85],
  fruitveg: [0.5, 0.8], leafveg: [0.45, 0.75], fruit: [0.55, 0.9]
};
// Berries bajo macrotúnel o acolchado: el plástico baja el NDVI que ve el satélite.
const BERRIES = ['fresa', 'zarzamora', 'frambuesa', 'arandano'];
const BERRY_PEAK = [0.4, 0.75];

const round = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dayMs = 864e5;
const toMs = (iso) => Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`);

export function peakRange(plant) {
  if (!plant) return null;
  if (plant.berry || BERRIES.includes(plant.id)) return BERRY_PEAK;
  return PEAK_NDVI[plant.cat] || [0.5, 0.85];
}

/**
 * Etapa fenológica aproximada (proporciones tipo FAO-56: inicial, desarrollo, media, final)
 * y rango de NDVI esperado en esa etapa.
 */
export function expectedNdvi(plant, sowDate, atDate) {
  const peak = peakRange(plant);
  if (!peak) return null;
  if (plant.perennial) return { stage: 'perennial', range: peak, basis: 'perennial' };
  if (!sowDate) return null;
  const days = Math.round((toMs(atDate) - toMs(sowDate)) / dayMs);
  const cycle = ((plant.cycle?.[0] || 90) + (plant.cycle?.[1] || plant.cycle?.[0] || 90)) / 2;
  const f = days / cycle;
  const base = { days, cycle: Math.round(cycle), basis: 'stage' };
  if (f < 0) return { ...base, stage: 'presow', range: null };
  if (f < 0.15) return { ...base, stage: 'initial', range: [0.12, 0.45] };
  if (f < 0.4) return { ...base, stage: 'development', range: [0.3, peak[1]] };
  if (f < 0.8) return { ...base, stage: 'mid', range: peak };
  if (f <= 1.05) return { ...base, stage: 'late', range: [0.3, peak[1]] };
  return { ...base, stage: 'harvested', range: null };
}

/** Qué dice NASA POWER sobre la causa probable de un NDVI bajo o en caída. */
export function likelyCauses(daily = []) {
  const recent = daily.slice(-21);
  const causes = [];
  const val = (k) => recent.map((d) => d[k]).filter((v) => v !== null && v !== undefined);
  const root = daily.map((d) => d.gwetroot).filter((v) => v !== null && v !== undefined).slice(-1)[0];
  const rain = daily.filter((d) => d.precip !== null && d.precip !== undefined);
  let dry = 0;
  for (let i = rain.length - 1; i >= 0 && rain[i].precip < 1; i--) dry++;
  if ((root !== undefined && root < 0.35) || dry >= 15) causes.push({ id: 'water', vars: { root: root === undefined ? null : Math.round(root * 100), days: dry } });
  const tmin = val('tmin'); const tmax = val('tmax');
  if (tmin.length && Math.min(...tmin) <= 3) causes.push({ id: 'frost', vars: { t: round(Math.min(...tmin), 1) } });
  if (tmax.length && Math.max(...tmax) >= 35) causes.push({ id: 'heat', vars: { t: round(Math.max(...tmax), 1) } });
  const rain7 = rain.slice(-7).reduce((s, d) => s + d.precip, 0);
  if (rain7 >= 100 || (root !== undefined && root >= 0.95)) causes.push({ id: 'waterlogging', vars: { mm: Math.round(rain7) } });
  if (!causes.length) causes.push({ id: 'biotic', vars: {} });
  return causes;
}

/**
 * Indicador de salud del cultivo.
 * ndviSeries: [{ date, value, reliability }] de MOD13Q1; plant: cultivo de la parcela (o null);
 * sowDate: 'YYYY-MM-DD' o ''; daily: serie diaria enriquecida de NASA POWER.
 */
export function cropHealth({ ndviSeries, plant, sowDate, daily }) {
  const valid = (ndviSeries || []).filter((x) => x.value !== null && x.value !== undefined);
  // Se descartan compuestos nublados o con nieve (confiabilidad 2 y 3) para no confundir nubes con estrés.
  const good = valid.filter((x) => x.reliability === null || x.reliability === undefined || x.reliability <= 1);
  const cloudy = valid.length - good.length;
  if (!good.length) return { status: 'unknown', reason: valid.length ? 'cloudy' : 'noData', cloudy };
  const last = good[good.length - 1];
  const prev = good.length > 1 ? good[good.length - 2] : null;
  const peak = good.slice(-7).reduce((a, x) => (x.value > a.value ? x : a), good[0]);
  const drop = prev ? round(prev.value - last.value) : null;          // caída en un compuesto (16 días)
  const dropFromPeak = round(peak.value - last.value);                // caída desde el máximo reciente
  const exp = expectedNdvi(plant, sowDate, last.date);
  const out = {
    ndvi: last.value, date: last.date, marginal: last.reliability === 1, cloudy,
    prev: prev ? { value: prev.value, date: prev.date } : null, drop, dropFromPeak,
    stage: exp?.stage || null, stageDays: exp?.days ?? null, cycleDays: exp?.cycle ?? null,
    expected: exp?.range || null, basis: exp?.basis || 'trend', plantId: plant?.id || null
  };

  // Tras la cosecha o antes de sembrar no hay cultivo que evaluar.
  if (exp?.stage === 'harvested' || exp?.stage === 'presow') return { ...out, status: 'idle', score: null, causes: [] };

  const declineExpected = exp?.stage === 'late';
  const deficit = out.expected ? Math.max(0, round(out.expected[0] - last.value)) : 0;
  const sudden = !declineExpected && drop !== null && drop >= 0.1;
  const fading = !declineExpected && dropFromPeak >= 0.15;
  let status = 'healthy';
  if (deficit >= 0.15 || (sudden && drop >= 0.15) || (fading && dropFromPeak >= 0.25)) status = 'stress';
  else if (deficit > 0 || sudden || fading) status = 'watch';

  let score = 100;
  if (out.expected) score -= clamp(deficit / 0.35, 0, 1) * 70;
  if (!declineExpected) score -= clamp(Math.max(drop || 0, dropFromPeak * 0.7) / 0.3, 0, 1) * (out.expected ? 30 : 80);
  out.score = Math.round(clamp(score, 0, 100));
  out.deficit = deficit;
  out.kind = deficit > 0 ? 'low' : sudden || fading ? 'drop' : null;
  out.causes = status === 'healthy' ? [] : likelyCauses(daily);
  return { ...out, status };
}

/** Alerta de salud del cultivo para el selector de notificaciones. */
export function healthAlert(h, plantName) {
  if (!h || !['stress', 'watch'].includes(h.status)) return null;
  const strong = h.status === 'stress';
  const severity = strong ? ((h.deficit || 0) >= 0.25 || (h.drop || 0) >= 0.2 ? 3 : 2) : 1;
  const cause = h.causes?.[0] || { id: 'biotic', vars: {} };
  return {
    id: 'modis:health', type: 'health', severity, source: 'NASA MODIS', date: h.date,
    key: h.kind === 'low' ? 'alerts.health.low' : 'alerts.health.drop',
    vars: { ndvi: h.ndvi.toFixed(2), lo: h.expected?.[0]?.toFixed(2), hi: h.expected?.[1]?.toFixed(2), crop: plantName || null, drop: (Math.max(h.drop || 0, h.dropFromPeak || 0)).toFixed(2) },
    extraKey: `health.cause.${cause.id}`, extraVars: cause.vars
  };
}
