// Capa de datos: nube (Azure Functions + Table Storage) o local (este navegador).
import { polygonAreaM2, centroid, isSelfIntersecting } from './geo.js';
import { ALERT_TYPES } from './alerts.js';

const LOCALES = ['es', 'en'];
const PRIORITIES = ['agua', 'suelo', 'plagas', 'mercado', 'clima'];

export class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export async function request(path, { method = 'GET', body, timeoutMs = 45000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(path, {
      method, signal: ctrl.signal, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!r.ok) throw new ApiError(r.status, data?.error || `Error ${r.status}`, data?.code);
    if (data === null) throw new ApiError(502, 'Respuesta no válida del servidor.', 'bad_response');
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError(504, 'El servidor tardó demasiado en responder.', 'timeout');
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'Sin conexión con el servidor.', 'network');
  } finally {
    clearTimeout(t);
  }
}

/** Sesión: usuario de Azure Static Web Apps + estado del almacenamiento. */
export async function loadSession() {
  let principal = null;
  try {
    const r = await fetch('/.auth/me', { credentials: 'same-origin' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) principal = (await r.json())?.clientPrincipal || null;
  } catch { principal = null; }
  let status = { storage: false, reachable: false };
  try { status = { ...(await request('/api/status', { timeoutMs: 20000 })), reachable: true }; } catch { /* API no disponible */ }
  return { principal, storage: Boolean(status.storage), apiReachable: status.reachable };
}

export const loginUrl = (provider) => `/.auth/login/${provider}?post_login_redirect_uri=${encodeURIComponent('/#/inicio')}`;
export const logoutUrl = () => `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent('/')}`;

// ---------- Repositorio en la nube ----------
export function cloudRepo() {
  return {
    mode: 'cloud',
    async getProfile() { return (await request('/api/me')).profile; },
    async saveProfile(p) { return (await request('/api/me', { method: 'PUT', body: p })).profile; },
    async deleteAccount() { await request('/api/me', { method: 'DELETE' }); },
    async listParcels() { return (await request('/api/parcels')).parcels; },
    async saveParcel(p, id) { return (await request(id ? `/api/parcels/${encodeURIComponent(id)}` : '/api/parcels', { method: id ? 'PUT' : 'POST', body: p })).parcel; },
    async deleteParcel(id) { await request(`/api/parcels/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    async listDevices() { return (await request('/api/devices')).devices; },
    async createDevice(d) { return (await request('/api/devices', { method: 'POST', body: d })).device; },
    async rotateDevice(id) { return (await request(`/api/devices/${encodeURIComponent(id)}/rotate`, { method: 'POST' })).device; },
    async deleteDevice(id) { await request(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    async listReadings(parcelId, days = 30) { return (await request(`/api/readings?parcelId=${encodeURIComponent(parcelId)}&days=${days}`)).readings; },
    async addReading(r) { return (await request('/api/readings', { method: 'POST', body: r })).reading; },
    async deleteReading(parcelId, ts) { await request(`/api/readings?parcelId=${encodeURIComponent(parcelId)}&ts=${encodeURIComponent(ts)}`, { method: 'DELETE' }); }
  };
}

// ---------- Repositorio local (sin cuenta o sin almacenamiento en la nube) ----------
const READING_FIELDS = {
  moisture25: [0, 100], moistureSurface: [0, 100], moistureDeep: [0, 100], rootTempC: [-20, 70], ph: [0, 14], ec: [0, 50],
  airTempC: [-40, 60], airRh: [0, 100], organicMatter: [0, 100], nitrogen: [0, 20000], phosphorus: [0, 20000], potassium: [0, 20000]
};

export function localRepo(namespace) {
  const key = `agrotopure:${namespace}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };
  const save = (db) => { try { localStorage.setItem(key, JSON.stringify(db)); } catch { throw new ApiError(507, 'No hay espacio en el almacenamiento del navegador.'); } };
  const db = () => ({ profile: null, parcels: [], readings: {}, ...load() });
  const uid = (p) => `${p}_${Math.random().toString(16).slice(2, 12)}`;
  const noDevices = () => { throw new ApiError(503, 'Los dispositivos ESP32/Raspberry Pi necesitan una cuenta con almacenamiento en la nube.', 'local_mode'); };
  return {
    mode: 'local',
    async getProfile() {
      const p = db().profile;
      if (!p) return null;
      return { locale: 'es', fineAnalysis: false, alertTypes: [...ALERT_TYPES], ...p };
    },
    async saveProfile(p) {
      if (!p.name?.trim()) throw new ApiError(400, 'Escribe tu nombre.');
      const d = db(); const t = new Date().toISOString();
      d.profile = {
        name: p.name.trim().slice(0, 80),
        region: (p.region || '').trim().slice(0, 80),
        priorities: [...new Set((p.priorities || []).filter((x) => PRIORITIES.includes(x)))],
        locale: LOCALES.includes(p.locale) ? p.locale : 'es',
        fineAnalysis: p.fineAnalysis === true,
        alertTypes: Array.isArray(p.alertTypes) ? [...new Set(p.alertTypes.filter((x) => ALERT_TYPES.includes(x)))] : [...ALERT_TYPES],
        createdAt: d.profile?.createdAt || t, updatedAt: t
      };
      save(d); return d.profile;
    },
    async deleteAccount() { localStorage.removeItem(key); },
    async listParcels() { return db().parcels; },
    async saveParcel(p, id) {
      const pts = (p.coordinates || []).map((c) => ({ lat: Number(c.lat), lon: Number(c.lon) }));
      if (!p.name?.trim()) throw new ApiError(400, 'La parcela necesita un nombre.');
      if (pts.length < 3) throw new ApiError(400, 'La parcela necesita al menos 3 esquinas.');
      if (isSelfIntersecting(pts)) throw new ApiError(400, 'Los lados del polígono se cruzan: revisa el orden de las esquinas.');
      const area = polygonAreaM2(pts);
      if (area < 10) throw new ApiError(400, 'El área de la parcela es demasiado pequeña.');
      const d = db(); const t = new Date().toISOString();
      const prev = id ? d.parcels.find((x) => x.id === id) : null;
      const parcel = {
        id: prev?.id || uid('par'), name: p.name.trim().slice(0, 80), crop: (p.crop || '').trim().slice(0, 60), coordinates: pts,
        areaHa: Math.round(area / 100) / 100, centroid: centroid(pts), soilTexture: p.soilTexture || 'desconocido',
        notes: (p.notes || '').slice(0, 500), createdAt: prev?.createdAt || t, updatedAt: t
      };
      d.parcels = prev ? d.parcels.map((x) => (x.id === id ? parcel : x)) : [...d.parcels, parcel];
      save(d); return parcel;
    },
    async deleteParcel(id) { const d = db(); d.parcels = d.parcels.filter((x) => x.id !== id); delete d.readings[id]; save(d); },
    async listDevices() { return []; },
    createDevice: noDevices, rotateDevice: noDevices, deleteDevice: noDevices,
    async listReadings(parcelId, days = 30) {
      const since = Date.now() - days * 864e5;
      return (db().readings[parcelId] || []).filter((r) => Date.parse(r.ts) >= since).sort((a, b) => a.ts.localeCompare(b.ts));
    },
    async addReading(r) {
      const out = { ts: r.ts ? new Date(r.ts).toISOString() : new Date().toISOString(), source: 'manual' };
      let n = 0;
      for (const [k, [a, b]] of Object.entries(READING_FIELDS)) {
        if (r[k] === undefined || r[k] === null || r[k] === '') continue;
        const v = Number(r[k]);
        if (!Number.isFinite(v) || v < a || v > b) throw new ApiError(400, `Valor fuera de rango en "${k}" (${a} a ${b}).`);
        out[k] = v; n++;
      }
      if (r.texture) { out.texture = String(r.texture).slice(0, 40); n++; }
      if (r.notes) out.notes = String(r.notes).slice(0, 300);
      if (!n) throw new ApiError(400, 'La lectura no contiene ningún valor.');
      const d = db(); d.readings[r.parcelId] = [...(d.readings[r.parcelId] || []), out]; save(d); return out;
    },
    async deleteReading(parcelId, ts) { const d = db(); d.readings[parcelId] = (d.readings[parcelId] || []).filter((x) => x.ts !== ts); save(d); }
  };
}

// ---------- NASA (a través de las Azure Functions) ----------
const nasaCache = new Map();
export function nasa(kind, { lat, lon }, extra = '') {
  const k = `${kind}:${lat.toFixed(4)}:${lon.toFixed(4)}:${extra}`;
  if (!nasaCache.has(k)) {
    const p = request(`/api/nasa/${kind}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}${extra}`, { timeoutMs: 90000 });
    p.catch(() => nasaCache.delete(k));
    nasaCache.set(k, p);
  }
  return nasaCache.get(k);
}
