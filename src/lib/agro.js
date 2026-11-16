// Motor agronómico de AGROTOPURE: fusión de datos (Δ) satélite NASA ↔ sensores de piso,
// compatibilidad de cultivos, calendario de vulnerabilidad, estrategias de rotación y predicciones.
// Todos los cálculos son deterministas y explicables; cada resultado incluye su método.
import { PLANTS } from '../data/plants.js';

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MID_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

// Propiedades hidráulicas típicas por textura (humedad volumétrica, %). Valores de referencia
// generales; se recomienda calibrar el sensor con el suelo de la parcela.
export const TEXTURES = {
  arenoso: { label: 'Arenoso', sat: 40, fc: 12, wp: 5 },
  'franco-arenoso': { label: 'Franco-arenoso', sat: 43, fc: 18, wp: 8 },
  franco: { label: 'Franco', sat: 46, fc: 27, wp: 12 },
  'franco-limoso': { label: 'Franco-limoso', sat: 48, fc: 31, wp: 13 },
  'franco-arcilloso': { label: 'Franco-arcilloso', sat: 48, fc: 34, wp: 19 },
  arcilloso: { label: 'Arcilloso', sat: 50, fc: 40, wp: 25 },
  desconocido: { label: 'Desconocida (se usa franco)', sat: 46, fc: 27, wp: 12 }
};
export const textureOf = (t) => TEXTURES[t] || TEXTURES.desconocido;

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

/** Radiación extraterrestre Ra (MJ/m²/día), FAO-56 ec. 21. */
export function extraterrestrialRadiation(latDeg, doy) {
  const phi = rad(latDeg);
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(delta), -1, 1));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

const doyOf = (date) => {
  const d = new Date(`${date}T12:00:00Z`);
  return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
};

/** Convierte radiación de NASA POWER a MJ/m²/día según la unidad reportada. */
export function radToMJ(value, units = '') {
  if (value === null || value === undefined) return null;
  return /kW-?hr?|kWh/i.test(units) ? value * 3.6 : value;
}

/**
 * ETo diaria FAO-56 Penman-Monteith (mm/día) a partir de variables NASA POWER.
 * Requiere tmax, tmin, rh, wind (2 m), rad (MJ/m²/día); presión de POWER (kPa) o elevación.
 */
export function eto(day, latDeg, elevationM = 0) {
  const { tmax, tmin, rh, wind } = day;
  const rs = day.radMJ;
  if ([tmax, tmin, rh, wind, rs].some((v) => v === null || v === undefined)) return null;
  const t = (tmax + tmin) / 2;
  const P = day.ps ?? 101.3 * ((293 - 0.0065 * (elevationM || 0)) / 293) ** 5.26;
  const gamma = 0.000665 * P;
  const es = (T) => 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
  const esMean = (es(tmax) + es(tmin)) / 2;
  const ea = (rh / 100) * esMean;
  const delta = (4098 * es(t)) / (t + 237.3) ** 2;
  const ra = extraterrestrialRadiation(latDeg, doyOf(day.date));
  const rso = (0.75 + 2e-5 * (elevationM || 0)) * ra;
  const rns = 0.77 * rs;
  const sigma = 4.903e-9;
  const rnl = sigma * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * Math.sqrt(Math.max(ea, 0))) * (1.35 * clamp(rs / rso, 0.25, 1) - 0.35);
  const rn = rns - rnl;
  const v = (0.408 * delta * rn + gamma * (900 / (t + 273)) * wind * (esMean - ea)) / (delta + gamma * (1 + 0.34 * wind));
  return Math.max(0, v);
}

/** ETo mensual por Hargreaves-Samani (mm/mes) para climatología. */
export function etoHargreavesMonth(m, latDeg) {
  // En la climatología de POWER, T2M_MAX/T2M_MIN son extremos del mes; Hargreaves usa el rango diario medio (T2M_RANGE).
  const range = m.range ?? (m.tmax !== null && m.tmin !== null ? m.tmax - m.tmin : null);
  if (m.t2m === null || m.t2m === undefined || range === null || range === undefined) return null;
  const ra = extraterrestrialRadiation(latDeg, MID_DOY[m.month - 1]);
  const d = 0.0023 * (m.t2m + 17.8) * Math.sqrt(Math.max(0, range)) * 0.408 * ra;
  return d * DAYS_IN_MONTH[m.month - 1];
}

/** Agrega ETo a la serie diaria de POWER y devuelve el último valor válido de cada variable. */
export function enrichDaily(power, latDeg) {
  if (!power?.daily) return { daily: [], latest: {} };
  const radUnits = power.units?.ALLSKY_SFC_SW_DWN || '';
  const clearUnits = power.units?.CLRSKY_SFC_SW_DWN || radUnits;
  const toaUnits = power.units?.TOA_SW_DWN || radUnits;
  const daily = power.daily.map((d) => {
    const radMJ = radToMJ(d.rad, radUnits);
    const radClearMJ = radToMJ(d.radClear ?? null, clearUnits);
    const radToaMJ = radToMJ(d.radToa ?? null, toaUnits);
    // Si POWER no publica el índice de claridad, se deriva de superficie ÷ tope de atmósfera.
    const kt = d.kt ?? (radMJ !== null && radToaMJ ? round(radMJ / radToaMJ, 2) : null);
    const row = {
      ...d, radMJ, radClearMJ, radToaMJ, kt,
      gwetrootPct: d.gwetroot === null || d.gwetroot === undefined ? null : Math.round(d.gwetroot * 100),
      gwettopPct: d.gwettop === null || d.gwettop === undefined ? null : Math.round(d.gwettop * 100)
    };
    row.eto = round(eto(row, latDeg, power.elevationM), 2);
    return row;
  });
  const latest = {};
  for (const k of ['t2m', 'tmax', 'tmin', 'rh', 'precip', 'radMJ', 'radClearMJ', 'radToaMJ', 'kt', 'uv', 'par', 'wind', 'windMax', 'ps', 'ts', 'gwettop', 'gwetroot', 'gwetprof', 'eto', 'dew']) {
    for (let i = daily.length - 1; i >= 0; i--) {
      if (daily[i][k] !== null && daily[i][k] !== undefined) { latest[k] = { value: daily[i][k], date: daily[i].date }; break; }
    }
  }
  // Valores solares publicados con retraso: se toman de la ventana larga y conservan su fecha.
  const SOLAR_FIELDS = { CLRSKY_SFC_SW_DWN: 'radClearMJ', ALLSKY_KT: 'kt', ALLSKY_SFC_PAR_TOT: 'par', ALLSKY_SFC_UV_INDEX: 'uv' };
  for (const [param, field] of Object.entries(SOLAR_FIELDS)) {
    const hit = power.solarLatest?.[{ radClearMJ: 'radClear', kt: 'kt', par: 'par', uv: 'uv' }[field]];
    if (!hit) continue;
    const value = field === 'radClearMJ' ? radToMJ(hit.value, clearUnits) : hit.value;
    if (!latest[field] || latest[field].date < hit.date) latest[field] = { value, date: hit.date, param };
  }
  const last7 = daily.map((d) => d.eto).filter((v) => v !== null).slice(-7); // la radiación de POWER se publica con retraso
  const precip30 = daily.slice(-30).map((d) => d.precip).filter((v) => v !== null);
  const rad7 = daily.map((d) => d.radMJ).filter((v) => v !== null && v !== undefined).slice(-7);
  return {
    daily, latest, etoAvg7: round(mean(last7), 2),
    precip30: round(precip30.reduce((s, x) => s + x, 0), 1),
    radAvg7: round(mean(rad7), 1)
  };
}

/** Climatología mensual enriquecida: lluvia y ETo mensual, balance hídrico. */
export function monthlyClimate(clim, latDeg) {
  if (!clim?.months) return [];
  return clim.months.map((m) => {
    const precip = m.precipDay === null ? null : m.precipDay * DAYS_IN_MONTH[m.month - 1];
    const etoM = etoHargreavesMonth(m, latDeg);
    return { ...m, label: MONTHS[m.month - 1], precip: round(precip, 0), eto: round(etoM, 0), balance: precip === null || etoM === null ? null : round(precip - etoM, 0) };
  });
}

/** Calendario anual de vulnerabilidad del suelo/cultivo (NASA POWER climatología). */
export function vulnerabilityCalendar(months) {
  return months.map((m) => {
    const risks = [];
    const deficit = m.balance === null ? null : -m.balance;
    if (deficit !== null && deficit > 100) risks.push({ id: 'sequia', level: 2, key: 'risk.sequiaHigh', vars: { mm: deficit } });
    else if (deficit !== null && deficit > 40) risks.push({ id: 'sequia', level: 1, key: 'risk.sequia', vars: { mm: deficit } });
    if (m.precip !== null && m.precip > 280) risks.push({ id: 'erosion', level: 2, key: 'risk.erosionHigh', vars: { mm: m.precip } });
    else if (m.precip !== null && m.precip > 150) risks.push({ id: 'erosion', level: 1, key: 'risk.erosion', vars: { mm: m.precip } });
    if (m.tmin !== null && m.tmin < 0) risks.push({ id: 'helada', level: 2, key: 'risk.heladaHigh', vars: { t: round(m.tmin) } });
    else if (m.tmin !== null && m.tmin < 3) risks.push({ id: 'helada', level: 1, key: 'risk.helada', vars: { t: round(m.tmin) } });
    if (m.tmax !== null && m.tmax > 38) risks.push({ id: 'calor', level: 2, key: 'risk.calorHigh', vars: { t: round(m.tmax) } });
    else if (m.tmax !== null && m.tmax > 35) risks.push({ id: 'calor', level: 1, key: 'risk.calor', vars: { t: round(m.tmax) } });
    const level = risks.reduce((a, r) => Math.max(a, r.level), 0);
    const advice = [];
    if (risks.some((r) => r.id === 'erosion')) advice.push({ key: 'risk.adviceErosion' });
    if (risks.some((r) => r.id === 'sequia')) advice.push({ key: 'risk.adviceSequia' });
    if (risks.some((r) => r.id === 'helada')) advice.push({ key: 'risk.adviceHelada' });
    if (risks.some((r) => r.id === 'calor')) advice.push({ key: 'risk.adviceCalor' });
    return { month: m.month, label: m.label, level, risks, advice };
  });
}

// ---------- Compatibilidad de cultivos ----------
const monthOk = (plant, m) => {
  if (m.t2m === null) return false;
  const [a, b] = plant.temp;
  const tol = plant.perennial ? 3 : 0;
  if (m.t2m < a - tol || m.t2m > b + tol) return false;
  if (plant.frostSensitive && m.tmin !== null && m.tmin < 0) return false; // mínima extrema del mes bajo cero
  return true;
};

/**
 * Mejor mes de siembra: dentro de los meses térmicamente aptos (y permitidos), elige el inicio
 * cuya secuencia de `need` meses consecutivos aptos recibe más lluvia climatológica.
 */
function bestWindow(plant, months, allowed, need) {
  const ok = months.map((m, i) => allowed.includes(i + 1) && monthOk(plant, m));
  let best = { start: null, length: 0, fit: 0, rain: -1 };
  for (let s = 0; s < 12; s++) {
    if (!ok[s]) continue;
    let len = 0;
    while (len < 12 && ok[(s + len) % 12]) len++;
    const fit = Math.min(len, need);
    const rain = Array.from({ length: fit }, (_, k) => months[(s + k) % 12].precip || 0).reduce((a, b) => a + b, 0);
    if (fit > best.fit || (fit === best.fit && rain > best.rain)) best = { start: s + 1, length: len, fit, rain };
  }
  return { start: best.start, length: best.length };
}

/**
 * Puntúa la aptitud de un cultivo en la parcela.
 * ctx: { months (monthlyClimate), ph, ec, allowedMonths? }
 */
export function compatibility(plant, ctx) {
  const months = ctx.months || [];
  const allowed = ctx.allowedMonths || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const factors = [];
  const reasons = [];
  let window = null;
  if (months.length === 12) {
    if (plant.perennial) {
      const okCount = months.filter((m) => monthOk(plant, m)).length;
      const s = okCount / 12;
      factors.push({ id: 'temp', w: 0.4, s, source: 'NASA POWER' });
      reasons.push({ key: plant.frostSensitive ? 'compat.perennialMonthsFrost' : 'compat.perennialMonths', vars: { ok: okCount, a: plant.temp[0], b: plant.temp[1] } });
    } else {
      const need = Math.max(1, Math.ceil((plant.cycle?.[0] || 90) / 30.4));
      window = bestWindow(plant, months, allowed, need);
      const s = clamp(window.length / need, 0, 1);
      factors.push({ id: 'temp', w: 0.4, s, source: 'NASA POWER' });
      reasons.push(window.length
        ? { key: 'compat.window', vars: { len: window.length, monthKey: window.start, need } }
        : { key: plant.frostSensitive ? 'compat.windowNoneFrost' : 'compat.windowNone', vars: { a: plant.temp[0], b: plant.temp[1] } });
      // Agua: lluvia climatológica en la ventana frente a la demanda de la guía o ETo×0.85.
      if (window.length) {
        const span = Array.from({ length: Math.min(need, window.length) }, (_, k) => months[(window.start - 1 + k) % 12]);
        const rain = span.reduce((acc, m) => acc + (m.precip || 0), 0);
        const demand = plant.water ? (plant.water[0] + plant.water[1]) / 2 : span.reduce((acc, m) => acc + (m.eto || 0), 0) * 0.85;
        const ratio = demand ? rain / demand : 1;
        factors.push({ id: 'water', w: 0.25, s: clamp(ratio, 0, 1), source: 'NASA POWER' });
        window.rainMm = Math.round(rain);
        window.demandMm = Math.round(demand);
        window.irrigationMm = Math.max(0, Math.round(demand - rain));
        reasons.push(ratio >= 1
          ? { key: 'compat.waterOk', vars: { rain: Math.round(rain), demand: Math.round(demand) } }
          : { key: 'compat.waterShort', vars: { rain: Math.round(rain), demand: Math.round(demand), irrigation: Math.max(0, Math.round(demand - rain)) } });
      }
    }
  } else {
    reasons.push({ key: 'compat.noClim' });
  }
  if (ctx.ph !== null && ctx.ph !== undefined) {
    const [a, b] = plant.ph;
    const d = ctx.ph < a ? a - ctx.ph : ctx.ph > b ? ctx.ph - b : 0;
    factors.push({ id: 'ph', w: 0.2, s: clamp(1 - d / 1.0, 0, 1), source: 'sensor' });
    reasons.push(d === 0 ? { key: 'compat.phIn', vars: { ph: ctx.ph, a, b } } : { key: 'compat.phOut', vars: { ph: ctx.ph, a, b, d: round(d) } });
  } else reasons.push({ key: 'compat.phMissing' });
  if (ctx.ec !== null && ctx.ec !== undefined && plant.cee) {
    const s = ctx.ec <= plant.cee ? 1 : clamp(1 - (ctx.ec - plant.cee) * 0.25, 0, 1);
    factors.push({ id: 'salinity', w: 0.15, s, source: 'sensor' });
    reasons.push(ctx.ec <= plant.cee ? { key: 'compat.ecOk', vars: { ec: ctx.ec, cee: plant.cee } } : { key: 'compat.ecOver', vars: { ec: ctx.ec, cee: plant.cee } });
  }
  const wsum = factors.reduce((a, f) => a + f.w, 0);
  const score = wsum ? Math.round((factors.reduce((a, f) => a + f.w * f.s, 0) / wsum) * 100) : null;
  return { plant, score, confidence: round(wsum / 1.0, 2), window, reasons, factors };
}

export function rankCrops(ctx, filter = () => true) {
  return PLANTS.filter(filter).map((p) => compatibility(p, ctx)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

// ---------- Estrategias de rotación ----------
export const PRIORITY_LABELS = { agua: 'Ahorro de agua', suelo: 'Regenerar suelo', plagas: 'Romper ciclos de plagas', mercado: 'Valor de mercado', clima: 'Resiliencia climática' };
const PV = [6, 7, 8, 9, 10];        // primavera-verano (temporal de lluvias en Michoacán)
const OI = [11, 12, 1, 2, 3, 4, 5]; // otoño-invierno

function seasonPick(ctx, months, filter, exclude = []) {
  const ranked = PLANTS.filter((p) => !p.perennial && !p.added && filter(p) && !exclude.includes(p.family))
    .map((p) => compatibility(p, { ...ctx, allowedMonths: months }))
    .filter((r) => r.score !== null)
    .sort((a, b) => b.score - a.score || Number(b.plant.mich || 0) - Number(a.plant.mich || 0));
  return ranked[0] || null;
}

function cropMonths(s) {
  if (!s.window?.start) return [];
  const n = s.plant.perennial ? 12 : Math.ceil((s.plant.cycle?.[0] || 90) / 30.4);
  return Array.from({ length: Math.min(n, 12) }, (_, k) => (s.window.start - 1 + k) % 12);
}

function strategyMetrics(seq, calendar, prevFamily) {
  const families = new Set(seq.map((s) => s.plant.family));
  const irrigation = seq.reduce((a, s) => a + (s.window?.irrigationMm || 0), 0);
  const demand = seq.reduce((a, s) => a + (s.window?.demandMm || 0), 0) || 1;
  const water = clamp(1 - irrigation / demand, 0, 1);
  const covered = new Set(seq.flatMap(cropMonths));
  const erosionMonths = calendar.filter((c) => c.risks.some((r) => r.id === 'erosion')).map((c) => c.month - 1);
  let soil = 0.35;
  if (seq.some((s) => s.plant.legumeN)) soil += 0.3;
  if (seq.some((s) => s.plant.cover)) soil += 0.15;
  if (erosionMonths.length && erosionMonths.every((m) => covered.has(m))) soil += 0.15;
  if (seq.length > 1 && seq[0].plant.family === seq[1].plant.family) soil -= 0.25;
  const pests = clamp((families.size - (prevFamily && families.has(prevFamily) ? 1 : 0)) / seq.length, 0, 1);
  const market = clamp(seq.reduce((a, s) => a + (['fruitveg', 'leafveg', 'fruit'].includes(s.plant.cat) ? 1 : s.plant.mich ? 0.6 : 0.35), 0) / seq.length, 0, 1);
  // Riesgo climático que afecta al cultivo en pie: heladas (más en sensibles) y calor extremo.
  const penalties = seq.flatMap((s) => cropMonths(s).map((i) => {
    const risks = calendar[i]?.risks || [];
    const frost = risks.find((r) => r.id === 'helada')?.level || 0;
    const heat = risks.find((r) => r.id === 'calor')?.level || 0;
    return Math.max(s.plant.frostSensitive ? frost : frost / 2, heat) / 2;
  }));
  const climate = penalties.length ? clamp(1 - mean(penalties), 0, 1) : 0.5;
  return { agua: water, suelo: clamp(soil, 0, 1), plagas: pests, mercado: market, clima: climate, irrigationMm: irrigation };
}

/**
 * Tres estrategias de rotación comparables, ponderadas por las prioridades del productor.
 * ctx: { months, ph, ec }, currentCrop: objeto de PLANTS o null, priorities: ['agua', ...]
 */
export function rotationStrategies(ctx, currentCrop, priorities = []) {
  const calendar = vulnerabilityCalendar(ctx.months || []);
  const weights = Object.fromEntries(Object.keys(PRIORITY_LABELS).map((k) => [k, priorities.includes(k) ? 2 : 1]));
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0);
  const total = (m) => Math.round((Object.keys(weights).reduce((a, k) => a + weights[k] * m[k], 0) / wsum) * 100);
  const prevFamily = currentCrop?.family || null;
  const strategies = [];

  if (currentCrop?.perennial) {
    const base = compatibility(currentCrop, ctx);
    const legume = seasonPick(ctx, OI, (p) => p.legumeN && p.cycle[1] <= 200);
    const grass = seasonPick(ctx, PV, (p) => p.cover);
    const defs = [
      { id: 'A', nameKey: 'rot.perBareName', nameVars: { crop: currentCrop.name }, seq: [base], noteKey: 'rot.perBareNote' },
      { id: 'B', nameKey: 'rot.perLegName', nameVars: { crop: currentCrop.name }, seq: [base, legume].filter(Boolean), noteKey: 'rot.perLegNote' },
      { id: 'C', nameKey: 'rot.perGrassName', nameVars: { crop: currentCrop.name }, seq: [base, grass].filter(Boolean), noteKey: 'rot.perGrassNote' }
    ];
    for (const d of defs) {
      const m = strategyMetrics(d.seq, calendar, null);
      if (d.id === 'A') { m.suelo = 0.2; m.plagas = 0.3; }
      strategies.push({ ...d, metrics: m, score: total(m) });
    }
  } else {
    const pvMain = currentCrop ? compatibility(currentCrop, { ...ctx, allowedMonths: PV }) : seasonPick(ctx, PV, (p) => p.mich && p.cat === 'cereal');
    const cover = seasonPick(ctx, OI, (p) => p.cover);
    const legume = seasonPick(ctx, OI, (p) => p.legumeN, pvMain ? [pvMain.plant.family] : []);
    const hortPV = seasonPick(ctx, PV, (p) => ['fruitveg', 'leafveg'].includes(p.cat) && p.mich, prevFamily ? [prevFamily] : []);
    const hortOI = seasonPick(ctx, OI, (p) => (p.legumeN || p.family === 'Brassicaceae'), hortPV ? [hortPV.plant.family] : []);
    const defs = [
      { id: 'A', nameKey: 'rot.contName', seq: [pvMain, cover].filter(Boolean), noteKey: 'rot.contNote' },
      { id: 'B', nameKey: 'rot.legName', seq: [pvMain, legume].filter(Boolean), noteKey: 'rot.legNote' },
      { id: 'C', nameKey: 'rot.divName', seq: [hortPV, hortOI].filter(Boolean), noteKey: 'rot.divNote' }
    ];
    for (const d of defs) {
      if (!d.seq.length) continue;
      const m = strategyMetrics(d.seq, calendar, prevFamily);
      strategies.push({ ...d, metrics: m, score: total(m) });
    }
  }
  const best = strategies.reduce((a, s) => (!a || s.score > a.score ? s : a), null);
  return strategies.map((s) => ({ ...s, recommended: s === best }));
}

// ---------- Fusión Δ y predicciones ----------
/** Última lectura válida de cada variable a partir del historial de sensores. */
export function latestReadings(readings) {
  const out = {};
  for (const r of readings || []) {
    for (const [k, v] of Object.entries(r)) {
      if (['ts', 'source', 'notes'].includes(k) || v === null || v === undefined) continue;
      if (!out[k] || out[k].ts <= r.ts) out[k] = { value: v, ts: r.ts, source: r.source };
    }
  }
  return out;
}

/** Regresión lineal sobre medias diarias: pendiente por día y r². */
export function trend(readings, field, days = 7) {
  const since = Date.now() - days * 864e5;
  const byDay = new Map();
  for (const r of readings || []) {
    const t = Date.parse(r.ts);
    if (r[field] === null || r[field] === undefined || t < since) continue;
    const d = r.ts.slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(r[field]);
  }
  const pts = [...byDay.entries()].sort().map(([d, v]) => ({ x: Date.parse(`${d}T12:00:00Z`) / 864e5, y: mean(v) }));
  if (pts.length < 3) return { slope: null, r2: null, n: pts.length };
  const mx = mean(pts.map((p) => p.x)), my = mean(pts.map((p) => p.y));
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const slope = sxy / sxx;
  const ssTot = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
  const ssRes = pts.reduce((a, p) => a + (p.y - (my + slope * (p.x - mx))) ** 2, 0);
  return { slope: round(slope, 3), r2: ssTot ? round(1 - ssRes / ssTot, 2) : 1, n: pts.length };
}

/**
 * Motor de fusión Δ: compara la humedad medida a 25 cm (sensor de piso) con la humedad de zona
 * radicular modelada/satelital (NASA POWER GWETROOT, fracción de saturación) y la superficial (GWETTOP).
 */
export function fusion({ sensor, nasa, texture, crop, readings }) {
  const tx = textureOf(texture);
  const vwc = sensor.moisture25?.value ?? null;
  const out = { texture: tx, available: false, insights: [], method: [] };
  out.methodKey = 'fusion.method';
  if (vwc === null) {
    out.insights.push({ level: 'info', titleKey: 'fusion.noSensorTitle', textKey: 'fusion.noSensorText' });
    return out;
  }
  out.available = true;
  out.vwc = vwc;
  out.wetSensor = round(clamp(vwc / tx.sat, 0, 1), 2);
  out.aw = round(clamp((vwc - tx.wp) / (tx.fc - tx.wp), 0, 1.2), 2); // agua disponible relativa
  const gRoot = nasa.gwetroot?.value ?? null;
  const gTop = nasa.gwettop?.value ?? null;
  if (gRoot !== null) out.deltaRoot = round(out.wetSensor - gRoot, 2);
  if (gTop !== null) out.deltaTop = round(out.wetSensor - gTop, 2);
  const triggerVwc = tx.wp + 0.5 * (tx.fc - tx.wp); // agotamiento permisible 50% (FAO-56 p≈0.5)
  out.triggerVwc = round(triggerVwc, 1);

  // Predicción de humedad a 25 cm.
  const tr = trend(readings, 'moisture25', 7);
  const etoDay = nasa.etoAvg7 ?? null;
  const physSlope = etoDay !== null ? -(etoDay * 0.85) / 300 * 100 : null; // mm/día sobre 300 mm de zona radicular → %VWC/día
  const useTrend = tr.slope !== null && tr.r2 !== null && tr.r2 >= 0.3;
  const slope = useTrend ? tr.slope : physSlope;
  out.prediction = {
    slope: round(slope, 2),
    basisKey: useTrend ? 'pred.trendBasis' : etoDay !== null ? 'pred.etoBasis' : 'pred.noBasis',
    basisVars: useTrend ? { n: tr.n, r2: tr.r2 } : etoDay !== null ? { eto: etoDay } : {}
  };
  if (slope !== null && slope < 0 && vwc > triggerVwc) out.prediction.daysToIrrigate = Math.round((vwc - triggerVwc) / -slope);
  else if (vwc <= triggerVwc) out.prediction.daysToIrrigate = 0;

  // Interpretación.
  if (vwc <= triggerVwc) {
    out.insights.push({ level: 'alert', titleKey: 'fusion.irrigateTitle', textKey: 'fusion.irrigateText', textVars: { vwc, trigger: round(triggerVwc), textureKey: texture || 'desconocido' } });
  } else if (out.prediction.daysToIrrigate !== undefined) {
    const d = out.prediction.daysToIrrigate;
    const saved = etoDay !== null ? Math.round(d * etoDay * 0.85) : null;
    out.insights.push({
      level: 'ok', titleKey: 'fusion.holdTitle', titleVars: { days: d },
      textKey: 'fusion.holdText', textVars: { vwc, trigger: round(triggerVwc) },
      extraKey: saved ? 'fusion.holdSaved' : null, extraVars: saved ? { mm: saved, m3: saved * 10 } : null
    });
    out.savedMm = saved;
  }
  if (out.deltaRoot !== undefined) {
    if (out.deltaRoot >= 0.15) out.insights.push({ level: 'ok', titleKey: 'fusion.deltaHighTitle', titleVars: { d: out.deltaRoot }, textKey: 'fusion.deltaHighText' });
    else if (out.deltaRoot <= -0.15) out.insights.push({ level: 'warn', titleKey: 'fusion.deltaLowTitle', titleVars: { d: out.deltaRoot }, textKey: 'fusion.deltaLowText' });
    else out.insights.push({ level: 'info', titleKey: 'fusion.deltaOkTitle', titleVars: { d: out.deltaRoot }, textKey: 'fusion.deltaOkText' });
  }
  // Ventana de siembra oculta.
  const rootT = sensor.rootTempC?.value ?? null;
  if (gTop !== null && gTop < 0.45 && out.aw >= 0.6) {
    const tOk = crop && rootT !== null ? rootT >= crop.temp[0] - 3 : null;
    out.hiddenWindow = true;
    out.insights.push({
      level: 'ok', titleKey: 'fusion.hiddenTitle',
      textKey: 'fusion.hiddenText', textVars: { gtop: gTop, aw: Math.round(out.aw * 100) },
      extraKey: tOk === false ? 'fusion.hiddenTempLow' : tOk ? 'fusion.hiddenTempOk' : null,
      extraVars: tOk === null ? null : { t: rootT, crop: crop.name }
    });
  }
  if (rootT !== null && nasa.ts?.value !== undefined) out.deltaTemp = round(rootT - nasa.ts.value, 1);
  return out;
}

export const scoreColor = (s) => (s === null ? 'bg-slate-200 text-slate-600' : s >= 75 ? 'bg-emerald-100 text-emerald-800' : s >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800');
export { round, mean };
