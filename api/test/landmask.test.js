import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodePng, evaluateMask, landCheck, maskRequest } from '../src/lib/landmask.js';

// PNG RGBA de 8 bits generado en la prueba: mitad izquierda tierra (gris 75), mitad derecha agua (gris 128).
function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(name, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(name, 'latin1'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
function png(size, colorAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = y % 2 ? 1 : 0; let prev = [0, 0, 0, 0];
    for (let x = 0; x < size; x++) { const g = colorAt(x, y); const px = [g, g, g, 255]; const o = y * (size * 4 + 1) + 1 + x * 4;
      for (let k = 0; k < 4; k++) raw[o + k] = y % 2 ? (px[k] - prev[k]) & 255 : px[k]; prev = px; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const sq = (lat, lon, d = 0.01) => [{ lat: lat + d, lon: lon - d }, { lat: lat + d, lon: lon + d }, { lat: lat - d, lon: lon + d }, { lat: lat - d, lon: lon - d }];

test('decodifica PNG con filtros None y Sub', () => {
  const img = decodePng(png(8, (x) => (x < 4 ? 75 : 128)));
  assert.equal(img.width, 8);
  assert.deepEqual(img.at(0, 3), [75, 75, 75, 255]);
  assert.deepEqual(img.at(7, 3), [128, 128, 128, 255]);
  assert.throws(() => decodePng(Buffer.from('no es png, es otra cosa mucho más larga que la cabecera')), /PNG/);
});

test('distingue tierra, océano y parcela a medias', () => {
  const bbox = { w: -103, e: -102, s: 18, n: 19 };
  const img = decodePng(png(64, (x) => (x < 32 ? 75 : 128)));
  assert.equal(evaluateMask(img, bbox, sq(18.5, -102.8)).onLand, true);
  const sea = evaluateMask(img, bbox, sq(18.5, -102.2));
  assert.equal(sea.onLand, false); assert.equal(sea.waterFraction, 1); assert.equal(sea.centroidWater, true);
  const half = evaluateMask(img, bbox, sq(18.5, -102.5, 0.2));
  assert.equal(half.onLand, false); assert.ok(half.waterFraction > 0.25 && half.waterFraction < 0.75);
});

test('consulta NASA GIBS y no bloquea si el servicio falla', async () => {
  const poly = sq(19.42, -102.06);
  const { url, bbox } = maskRequest(poly);
  assert.match(url, /gibs\.earthdata\.nasa\.gov.*LAYERS=OSM_Land_Water_Map.*SRS=EPSG:4326/);
  assert.ok(bbox.w < -102.07 && bbox.e > -102.05 && bbox.s < 19.41 && bbox.n > 19.43);
  const ok = await landCheck(poly, { fetchImpl: async () => ({ ok: true, arrayBuffer: async () => png(16, () => 75) }) });
  assert.deepEqual([ok.checked, ok.onLand], [true, true]);
  const sea = await landCheck(poly, { fetchImpl: async () => ({ ok: true, arrayBuffer: async () => png(16, () => 128) }) });
  assert.deepEqual([sea.checked, sea.onLand], [true, false]);
  const down = await landCheck(poly, { fetchImpl: async () => { throw new Error('sin red'); } });
  assert.deepEqual([down.checked, down.onLand], [false, true]);
});
