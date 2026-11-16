// Geometría de parcelas (misma lógica que src/lib/geo.js del frontend).
const R = 6378137;
const rad = (d) => (d * Math.PI) / 180;

/** Área geodésica aproximada (m²) de un polígono [{lat, lon}]. */
export function polygonAreaM2(points) {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += rad(b.lon - a.lon) * (2 + Math.sin(rad(a.lat)) + Math.sin(rad(b.lat)));
  }
  return Math.abs((sum * R * R) / 2);
}

/** Centroide plano (proyección equirectangular local), suficiente para parcelas agrícolas. */
export function centroid(points) {
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos(rad(lat0));
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const x0 = p.lon * k, y0 = p.lat, x1 = q.lon * k, y1 = q.lat;
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-14) return { lat: lat0, lon: points.reduce((s, p) => s + p.lon, 0) / points.length };
  return { lat: cy / (3 * a), lon: cx / (3 * a) / k };
}

function segIntersect(p1, p2, p3, p4) {
  const d = (a, b, c) => (c.lon - a.lon) * (b.lat - a.lat) - (b.lon - a.lon) * (c.lat - a.lat);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function isSelfIntersecting(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Ordena esquinas alrededor del centroide para evitar polígonos cruzados. */
export function orderCorners(points) {
  const c = { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lon: points.reduce((s, p) => s + p.lon, 0) / points.length };
  return [...points].sort((a, b) => Math.atan2(a.lat - c.lat, a.lon - c.lon) - Math.atan2(b.lat - c.lat, b.lon - c.lon));
}

/** Convierte "19.4206" o "19°25'14.2\"N" a grados decimales. */
export function parseCoord(text, kind) {
  if (text === null || text === undefined) return null;
  const s = String(text).trim().replace(',', '.');
  if (!s) return null;
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^([-+]?\d+(?:\.\d+)?)\s*[°º:\s]\s*(\d+(?:\.\d+)?)?\s*['′:\s]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([NSEWOnsewo])?$/);
  if (!m) return NaN;
  let v = Math.abs(Number(m[1])) + (Number(m[2] || 0) / 60) + (Number(m[3] || 0) / 3600);
  const h = (m[4] || '').toUpperCase();
  if (m[1].startsWith('-') || h === 'S' || h === 'W' || h === 'O') v = -v;
  if (kind === 'lat' && Math.abs(v) > 90) return NaN;
  if (kind === 'lon' && Math.abs(v) > 180) return NaN;
  return v;
}

/** Tamaño máximo de una parcela (ha). Terrenos mayores se dividen en varias parcelas. */
export const MAX_PARCEL_HA = 5000;
export const MIN_PARCEL_M2 = 10;

export const formatHa = (ha) => (ha >= 100 ? ha.toFixed(0) : ha >= 10 ? ha.toFixed(1) : ha.toFixed(2));
