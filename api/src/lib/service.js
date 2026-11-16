// Lógica de negocio independiente del runtime (probada con MemoryStore).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError, num } from './http.js';
import { polygonAreaM2, centroid, isSelfIntersecting } from './geo.js';

export const PRIORITIES = ['agua', 'suelo', 'plagas', 'mercado', 'clima'];
export const LOCALES = ['es', 'en'];
/** Tipos de alerta que el usuario puede activar o silenciar. */
export const ALERT_TYPES = ['storm', 'fire', 'flood', 'drought', 'volcano', 'frost', 'heat', 'uv', 'rain', 'wind', 'dry'];
const SOIL_TEXTURES = ['arenoso', 'franco-arenoso', 'franco', 'franco-limoso', 'franco-arcilloso', 'arcilloso', 'desconocido'];

/** Variables aceptadas en lecturas (sensor o captura manual) y su rango válido. */
export const READING_FIELDS = {
  moisture25: [0, 100],        // humedad volumétrica a 25 cm (%)
  moistureSurface: [0, 100],   // humedad volumétrica superficial 0-5 cm (%)
  moistureDeep: [0, 100],      // humedad volumétrica a 50+ cm (%)
  rootTempC: [-20, 70],        // temperatura radicular (°C)
  ph: [0, 14],
  ec: [0, 50],                 // conductividad eléctrica (dS/m)
  airTempC: [-40, 60],
  airRh: [0, 100],
  organicMatter: [0, 100],     // materia orgánica (%)
  nitrogen: [0, 20000],        // mg/kg
  phosphorus: [0, 20000],      // mg/kg
  potassium: [0, 20000],       // mg/kg
  batteryV: [0, 30]
};

const now = () => new Date();
const id = (prefix, bytes = 6) => `${prefix}_${randomBytes(bytes).toString('hex')}`;
const sha = (s) => createHash('sha256').update(s).digest('hex');
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const parseJson = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

const MAX_TS = 9999999999999;
export const readingRowKey = (date) => `${String(MAX_TS - date.getTime()).padStart(13, '0')}_${randomBytes(3).toString('hex')}`;

// ---------- Perfil ----------
export async function getProfile(store, user) {
  const e = await store.get('profiles', 'profile', user.userId);
  return e ? profileOut(e) : null;
}

function profileOut(e) {
  return {
    name: e.name, region: e.region, priorities: parseJson(e.priorities, []),
    locale: LOCALES.includes(e.locale) ? e.locale : 'es',
    fineAnalysis: e.fineAnalysis === true,
    alertTypes: e.alertTypes === undefined || e.alertTypes === '' ? [...ALERT_TYPES] : parseJson(e.alertTypes, ALERT_TYPES),
    provider: e.provider, userDetails: e.userDetails, createdAt: e.createdAt, updatedAt: e.updatedAt
  };
}

export async function saveProfile(store, user, body) {
  const name = str(body.name, 80);
  if (!name) throw new HttpError(400, 'Escribe tu nombre.', 'bad_profile');
  const priorities = Array.isArray(body.priorities) ? body.priorities.filter((p) => PRIORITIES.includes(p)) : [];
  const alertTypes = Array.isArray(body.alertTypes) ? body.alertTypes.filter((a) => ALERT_TYPES.includes(a)) : ALERT_TYPES;
  const prev = await store.get('profiles', 'profile', user.userId);
  const t = now().toISOString();
  const e = {
    partitionKey: 'profile', rowKey: user.userId, name, region: str(body.region, 80),
    priorities: JSON.stringify([...new Set(priorities)]),
    locale: LOCALES.includes(body.locale) ? body.locale : 'es',
    fineAnalysis: body.fineAnalysis === true,
    alertTypes: JSON.stringify([...new Set(alertTypes)]),
    provider: user.provider, userDetails: user.userDetails,
    createdAt: prev?.createdAt || t, updatedAt: t
  };
  await store.upsert('profiles', e);
  return profileOut(e);
}

export async function deleteAccount(store, user) {
  for (const p of await store.list('parcels', user.userId)) await deleteParcel(store, user, p.rowKey);
  await store.remove('profiles', 'profile', user.userId);
}

// ---------- Parcelas ----------
function parcelOut(e) {
  return {
    id: e.rowKey, name: e.name, crop: e.crop, coordinates: parseJson(e.coordinates, []),
    areaHa: e.areaHa, centroid: { lat: e.lat, lon: e.lon }, soilTexture: e.soilTexture,
    notes: e.notes, createdAt: e.createdAt, updatedAt: e.updatedAt
  };
}

export function validateParcel(body) {
  const name = str(body.name, 80);
  if (!name) throw new HttpError(400, 'La parcela necesita un nombre.', 'bad_parcel');
  const pts = Array.isArray(body.coordinates) ? body.coordinates : [];
  if (pts.length < 3 || pts.length > 200) throw new HttpError(400, 'La parcela necesita entre 3 y 200 esquinas.', 'bad_parcel');
  const coordinates = pts.map((p) => ({ lat: Number(p.lat), lon: Number(p.lon) }));
  if (coordinates.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180)) {
    throw new HttpError(400, 'Hay coordenadas fuera de rango.', 'bad_parcel');
  }
  if (isSelfIntersecting(coordinates)) throw new HttpError(400, 'Los lados del polígono se cruzan: revisa el orden de las esquinas.', 'bad_parcel');
  const areaM2 = polygonAreaM2(coordinates);
  if (areaM2 < 10) throw new HttpError(400, 'El área de la parcela es demasiado pequeña.', 'bad_parcel');
  if (areaM2 > 5e8) throw new HttpError(400, 'El área supera 50,000 ha; divide el terreno en parcelas.', 'bad_parcel');
  const soilTexture = SOIL_TEXTURES.includes(body.soilTexture) ? body.soilTexture : 'desconocido';
  return { name, crop: str(body.crop, 60), coordinates, areaHa: Math.round(areaM2 / 100) / 100, c: centroid(coordinates), soilTexture, notes: str(body.notes, 500) };
}

export async function listParcels(store, user) {
  return (await store.list('parcels', user.userId)).map(parcelOut).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getOwnedParcel(store, user, parcelId) {
  const e = await store.get('parcels', user.userId, String(parcelId || ''));
  if (!e) throw new HttpError(404, 'Parcela no encontrada.', 'not_found');
  return e;
}

export async function saveParcel(store, user, body, parcelId) {
  const v = validateParcel(body);
  const prev = parcelId ? await getOwnedParcel(store, user, parcelId) : null;
  if (!prev && (await store.list('parcels', user.userId)).length >= 100) throw new HttpError(400, 'Límite de 100 parcelas por cuenta.', 'limit');
  const t = now().toISOString();
  const e = {
    partitionKey: user.userId, rowKey: prev?.rowKey || id('par'), name: v.name, crop: v.crop,
    coordinates: JSON.stringify(v.coordinates), areaHa: v.areaHa, lat: v.c.lat, lon: v.c.lon,
    soilTexture: v.soilTexture, notes: v.notes, createdAt: prev?.createdAt || t, updatedAt: t
  };
  await store.upsert('parcels', e);
  return parcelOut(e);
}

export async function deleteParcel(store, user, parcelId) {
  await getOwnedParcel(store, user, parcelId);
  for (const d of await store.list('devices', 'device')) {
    if (d.userId === user.userId && d.parcelId === parcelId) await store.remove('devices', 'device', d.rowKey);
  }
  for (const r of await store.list('readings', parcelId, { top: 5000 })) await store.remove('readings', parcelId, r.rowKey);
  await store.remove('parcels', user.userId, parcelId);
}

// ---------- Dispositivos (ESP32 / Raspberry Pi) ----------
function deviceOut(e) {
  return { id: e.rowKey, parcelId: e.parcelId, name: e.name, kind: e.kind, intervalSec: e.intervalSec, createdAt: e.createdAt, lastSeen: e.lastSeen || null };
}

export async function listDevices(store, user) {
  return (await store.list('devices', 'device')).filter((d) => d.userId === user.userId).map(deviceOut);
}

export async function createDevice(store, user, body) {
  await getOwnedParcel(store, user, body.parcelId);
  const kind = ['esp32', 'rpi', 'otro'].includes(body.kind) ? body.kind : 'esp32';
  const intervalSec = Math.min(86400, Math.max(60, Number(body.intervalSec) || 900));
  const key = randomBytes(24).toString('hex');
  const e = {
    partitionKey: 'device', rowKey: id('dev', 5), userId: user.userId, parcelId: body.parcelId,
    name: str(body.name, 60) || (kind === 'rpi' ? 'Raspberry Pi' : 'ESP32'), kind, intervalSec,
    keyHash: sha(key), createdAt: now().toISOString(), lastSeen: ''
  };
  await store.upsert('devices', e);
  return { ...deviceOut(e), key };
}

async function ownedDevice(store, user, deviceId) {
  const e = await store.get('devices', 'device', String(deviceId || ''));
  if (!e || e.userId !== user.userId) throw new HttpError(404, 'Dispositivo no encontrado.', 'not_found');
  return e;
}

export async function rotateDeviceKey(store, user, deviceId) {
  const e = await ownedDevice(store, user, deviceId);
  const key = randomBytes(24).toString('hex');
  await store.upsert('devices', { ...e, keyHash: sha(key) });
  return { ...deviceOut(e), key };
}

export async function deleteDevice(store, user, deviceId) {
  await ownedDevice(store, user, deviceId);
  await store.remove('devices', 'device', deviceId);
}

// ---------- Lecturas ----------
export function sanitizeReading(input, { allowText = false } = {}) {
  const out = {};
  let count = 0;
  for (const [k, [min, max]] of Object.entries(READING_FIELDS)) {
    const v = num(input?.[k], min, max);
    if (v === undefined) throw new HttpError(400, `Valor fuera de rango en "${k}" (${min} a ${max}).`, 'bad_reading');
    if (v !== null) { out[k] = v; if (k !== 'batteryV') count++; }
  }
  if (allowText) {
    const texture = str(input?.texture, 40);
    const notes = str(input?.notes, 300);
    if (texture) { out.texture = texture; count++; }
    if (notes) out.notes = notes;
  }
  if (!count) throw new HttpError(400, 'La lectura no contiene ningún valor.', 'bad_reading');
  return out;
}

function parseTs(ts) {
  if (ts === undefined || ts === null || ts === '') return now();
  const d = typeof ts === 'number' ? new Date(ts < 1e12 ? ts * 1000 : ts) : new Date(ts);
  const t = d.getTime();
  if (!Number.isFinite(t) || t > Date.now() + 864e5 || t < Date.now() - 400 * 864e5) return null;
  return d;
}

function readingOut(e) {
  const { partitionKey, rowKey, ...rest } = e;
  return rest;
}

export async function addManualReading(store, user, body) {
  await getOwnedParcel(store, user, body.parcelId);
  const values = sanitizeReading(body, { allowText: true });
  const d = parseTs(body.ts);
  if (!d) throw new HttpError(400, 'Fecha inválida.', 'bad_reading');
  const e = { partitionKey: body.parcelId, rowKey: readingRowKey(d), ts: d.toISOString(), source: 'manual', ...values };
  await store.upsert('readings', e);
  return readingOut(e);
}

export async function listReadings(store, user, parcelId, days = 30) {
  await getOwnedParcel(store, user, parcelId);
  const span = Math.min(400, Math.max(1, Number(days) || 30));
  const since = new Date(Date.now() - span * 864e5);
  const rkTo = `${String(MAX_TS - since.getTime()).padStart(13, '0')}_~`;
  const rows = await store.list('readings', parcelId, { rkTo, top: 5000 });
  return rows.map(readingOut).reverse(); // orden cronológico ascendente
}

export async function deleteReading(store, user, parcelId, ts) {
  await getOwnedParcel(store, user, parcelId);
  for (const r of await store.list('readings', parcelId, { top: 5000 })) {
    if (r.ts === ts && r.source === 'manual') { await store.remove('readings', parcelId, r.rowKey); return true; }
  }
  throw new HttpError(404, 'Lectura manual no encontrada.', 'not_found');
}

/** Ingesta automática desde ESP32 / Raspberry Pi. */
export async function ingest(store, deviceId, key, body) {
  if (!deviceId || !key) throw new HttpError(401, 'Faltan encabezados x-device-id y x-device-key.', 'device_auth');
  const d = await store.get('devices', 'device', String(deviceId));
  const ok = d && (() => {
    const a = Buffer.from(sha(String(key)), 'hex');
    const b = Buffer.from(d.keyHash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  })();
  if (!ok) throw new HttpError(401, 'Dispositivo o llave inválidos.', 'device_auth');
  const list = Array.isArray(body?.readings) ? body.readings : [body];
  if (!list.length || list.length > 200) throw new HttpError(400, 'Envía entre 1 y 200 lecturas.', 'bad_reading');
  let stored = 0;
  for (const item of list) {
    const values = sanitizeReading(item);
    const ts = parseTs(item.ts);
    if (!ts) throw new HttpError(400, 'Marca de tiempo inválida.', 'bad_reading');
    await store.upsert('readings', { partitionKey: d.parcelId, rowKey: readingRowKey(ts), ts: ts.toISOString(), source: d.rowKey, ...values });
    stored++;
  }
  await store.upsert('devices', { ...d, lastSeen: now().toISOString() });
  return { stored, parcelId: d.parcelId, intervalSec: d.intervalSec || 900 };
}
