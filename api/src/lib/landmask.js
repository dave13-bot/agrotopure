// Máscara tierra/agua servida por NASA GIBS (capa OSM_Land_Water_Map, 250 m).
// Se usa para impedir que una parcela quede en el océano o en un cuerpo de agua.
import { inflateSync } from 'node:zlib';
import { centroid } from './geo.js';

const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
export const LAND_LAYER = 'OSM_Land_Water_Map';
const SIZE = 96;
// En la capa, la tierra se dibuja en gris oscuro (≈75) y el agua en gris claro (≈128).
const WATER_FROM = 102;

/** Decodificador PNG mínimo (8 bits, sin entrelazado) → { width, height, at(x, y) → [r, g, b, a] }. */
export function decodePng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (buf.length < 33 || sig.some((b, i) => buf[i] !== b)) throw new Error('No es un PNG.');
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (name === 'PLTE') palette = data;
    else if (name === 'tRNS') trns = data;
    else if (name === 'IDAT') idat.push(data);
    else if (name === 'IEND') break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels || depth !== 8 || interlace !== 0) throw new Error('Formato PNG no soportado.');
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[y * stride + i - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = i >= channels && y > 0 ? px[(y - 1) * stride + i - channels] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + i] = v & 255;
    }
  }
  const at = (x, y) => {
    const i = y * stride + x * channels;
    if (type === 6) return [px[i], px[i + 1], px[i + 2], px[i + 3]];
    if (type === 2) return [px[i], px[i + 1], px[i + 2], 255];
    if (type === 0) return [px[i], px[i], px[i], 255];
    if (type === 4) return [px[i], px[i], px[i], px[i + 1]];
    const k = px[i] * 3;
    return [palette[k], palette[k + 1], palette[k + 2], trns && px[i] < trns.length ? trns[px[i]] : 255];
  };
  return { width, height, at };
}

function inside(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) c = !c;
  }
  return c;
}

/** Puntos de muestreo de una parcela: esquinas, centroide y una malla interior. */
export function samplePoints(polygon) {
  const c = centroid(polygon);
  const lats = polygon.map((p) => p.lat), lons = polygon.map((p) => p.lon);
  const [s, n, w, e] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const grid = [];
  for (let i = 1; i <= 5; i++) for (let j = 1; j <= 5; j++) {
    const p = { lat: s + ((n - s) * i) / 6, lon: w + ((e - w) * j) / 6 };
    if (inside(p, polygon)) grid.push(p);
  }
  return { centroid: c, points: [...polygon, c, ...grid] };
}

/** Evalúa una imagen ya decodificada: fracción de agua y si el centroide cae en agua. */
export function evaluateMask(img, bbox, polygon) {
  const { centroid: c, points } = samplePoints(polygon);
  const isWater = (p) => {
    const x = Math.min(img.width - 1, Math.max(0, Math.floor(((p.lon - bbox.w) / (bbox.e - bbox.w)) * img.width)));
    const y = Math.min(img.height - 1, Math.max(0, Math.floor(((bbox.n - p.lat) / (bbox.n - bbox.s)) * img.height)));
    const [r, , , a] = img.at(x, y);
    return a > 0 && r >= WATER_FROM;
  };
  const water = points.filter(isWater).length;
  const waterFraction = Math.round((water / points.length) * 100) / 100;
  const centroidWater = isWater(c);
  return { waterFraction, centroidWater, onLand: !centroidWater && waterFraction <= 0.25, samples: points.length };
}

export function maskRequest(polygon) {
  const lats = polygon.map((p) => p.lat), lons = polygon.map((p) => p.lon);
  const pad = (a, b) => Math.max(0.02, (b - a) * 0.15);
  const pLat = pad(Math.min(...lats), Math.max(...lats)), pLon = pad(Math.min(...lons), Math.max(...lons));
  const bbox = {
    s: Math.max(-90, Math.min(...lats) - pLat), n: Math.min(90, Math.max(...lats) + pLat),
    w: Math.max(-180, Math.min(...lons) - pLon), e: Math.min(180, Math.max(...lons) + pLon)
  };
  const url = `${GIBS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=${LAND_LAYER}&STYLES=&FORMAT=image/png&SRS=EPSG:4326&BBOX=${bbox.w.toFixed(5)},${bbox.s.toFixed(5)},${bbox.e.toFixed(5)},${bbox.n.toFixed(5)}&WIDTH=${SIZE}&HEIGHT=${SIZE}`;
  return { bbox, url };
}

/**
 * Consulta NASA GIBS y decide si el polígono está en tierra firme.
 * Devuelve { checked:false } si el servicio no responde: la validación no bloquea por una caída externa.
 */
export async function landCheck(polygon, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const { bbox, url } = maskRequest(polygon);
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) throw new Error(`GIBS ${r.status}`);
    const img = decodePng(Buffer.from(await r.arrayBuffer()));
    return { checked: true, source: `NASA GIBS · ${LAND_LAYER} (250 m)`, ...evaluateMask(img, bbox, polygon) };
  } catch (e) {
    return { checked: false, onLand: true, error: e.message };
  }
}
