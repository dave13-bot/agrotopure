// Servidor local de pruebas: sirve dist/ y emula Azure SWA (/.auth) + Functions usando
// la lógica real de api/src/lib/service.js con almacenamiento en memoria.
// NASA se simula con datos de ejemplo (el entorno de pruebas no tiene salida a internet).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { MemoryStore } from '../../api/src/lib/storage.js';
import * as svc from '../../api/src/lib/service.js';
import { HttpError } from '../../api/src/lib/http.js';

const root = resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 4173);
const storage = process.argv[4] !== 'nostorage';
const store = new MemoryStore();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' };

const user = (req) => {
  const m = /mockuser=([^;]+)/.exec(req.headers.cookie || '');
  return m ? { userId: `u-${m[1]}`, provider: 'github', userDetails: m[1] } : null;
};
const body = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };

function power(days) {
  const out = [];
  for (let i = days; i >= 4; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const k = i % 7;
    out.push({
      date: d.toISOString().slice(0, 10), t2m: 18 + k * 0.3, tmax: 26 + k * 0.4, tmin: 10 + k * 0.2, dew: 9,
      rh: 62 - k, precip: k === 2 ? 6.5 : 0, rad: 19 + k * 0.5, radToa: 33,
      radClear: i > 12 ? 24 + k * 0.4 : null, wind: 2.1, windMax: 4.2, ps: 83.9, ts: 21 + k * 0.4,
      gwettop: 0.31, gwetroot: i < 8 ? null : 0.42, gwetprof: 0.5
    });
  }
  return {
    source: 'NASA POWER Daily API (comunidad AG)', location: {}, elevationM: 1634,
    units: { ALLSKY_SFC_SW_DWN: 'MJ/m^2/day', CLRSKY_SFC_SW_DWN: 'MJ/m^2/day' }, notes: [],
    // KT, PAR y UV llegan con meses de retraso, igual que en el servicio real.
    solarLatest: { radClear: { value: 25.6, date: '2026-10-30' }, kt: { value: 0.6, date: '2026-08-30' }, par: { value: 10.1, date: '2026-08-30' }, uv: { value: 2.4, date: '2026-08-30' } },
    daily: out
  };
}
const eonet = {
  source: 'NASA EONET v3', disclaimer: 'EONET es un repositorio de metadatos…', radiusKm: 800, days: 30,
  events: [
    { id: 'EONET_9001', title: 'Tropical Cyclone Prueba', categories: ['severeStorms'], categoryTitles: ['Severe Storms'], sources: [{ id: 'JTWC', url: 'https://example.invalid/a' }], link: 'https://example.invalid/a', distanceKm: 120, lastDate: '2026-11-14T00:00:00Z', magnitudeValue: 65, magnitudeUnit: 'kts' },
    { id: 'EONET_9002', title: 'Wildfire Prueba', categories: ['wildfires'], categoryTitles: ['Wildfires'], sources: [], link: null, distanceKm: 340, lastDate: '2026-11-09T00:00:00Z', magnitudeValue: null }
  ]
};
const clim = { source: 'mock', period: '2001-2020', months: [[17, 25, 9, 1.0], [18, 27, 9, 0.6], [20, 29, 11, 0.5], [22, 31, 13, 0.6], [23, 31, 15, 2.5], [22, 28, 16, 8.0], [21, 26, 16, 10.5], [21, 26, 16, 10.0], [21, 26, 16, 8.5], [20, 26, 14, 3.5], [19, 26, 11, 1.2], [17, 25, 9, 1.0]].map(([t2m, tmax, tmin, precipDay], i) => ({ month: i + 1, t2m, tmax, tmin, precipDay, rh: 60, rad: 20, wind: 2, gwettop: 0.4, gwetroot: 0.5 })) };
const modis = { source: 'mock', ndvi: [['2026-09-14', 0.71], ['2026-09-30', 0.66], ['2026-10-16', 0.58], ['2026-11-01', 0.52]].map(([date, value]) => ({ date, value })), lstDayC: [{ date: '2026-11-01', value: 27.4 }], errors: [] };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const p = url.pathname;
  try {
    if (p.startsWith('/.auth/login/')) { res.writeHead(302, { 'Set-Cookie': 'mockuser=ana; Path=/', Location: url.searchParams.get('post_login_redirect_uri') || '/' }); return res.end(); }
    if (p === '/.auth/logout') { res.writeHead(302, { 'Set-Cookie': 'mockuser=; Path=/; Max-Age=0', Location: '/' }); return res.end(); }
    if (p === '/.auth/me') { const u = user(req); return send(res, 200, { clientPrincipal: u ? { userId: u.userId, identityProvider: 'github', userDetails: u.userDetails, userRoles: ['anonymous', 'authenticated'] } : null }); }
    if (p.startsWith('/api/')) {
      const route = p.slice(5);
      if (route === 'status') return send(res, 200, { ok: true, storage, authenticated: Boolean(user(req)) });
      if (route === 'nasa/power') return send(res, 200, power(60));
      if (route === 'nasa/climatology') return send(res, 200, clim);
      if (route === 'nasa/modis') return send(res, 200, modis);
      if (route === 'nasa/eonet') return send(res, 200, eonet);
      if (route === 'ingest') return send(res, 200, await svc.ingest(store, req.headers['x-device-id'], req.headers['x-device-key'], await body(req)));
      const u = user(req);
      if (!u) return send(res, 401, { error: 'unauthenticated' });
      if (!storage) return send(res, 503, { error: 'sin almacenamiento', code: 'storage_not_configured' });
      const m = req.method;
      if (route === 'me') return m === 'GET' ? send(res, 200, { profile: await svc.getProfile(store, u) }) : m === 'PUT' ? send(res, 200, { profile: await svc.saveProfile(store, u, await body(req)) }) : (await svc.deleteAccount(store, u), send(res, 200, {}));
      if (route === 'parcels') return m === 'GET' ? send(res, 200, { parcels: await svc.listParcels(store, u) }) : send(res, 201, { parcel: await svc.saveParcel(store, u, await body(req)) });
      if (route.startsWith('parcels/')) { const id = route.slice(8); return m === 'PUT' ? send(res, 200, { parcel: await svc.saveParcel(store, u, await body(req), id) }) : (await svc.deleteParcel(store, u, id), send(res, 200, {})); }
      if (route === 'devices') return m === 'GET' ? send(res, 200, { devices: await svc.listDevices(store, u) }) : send(res, 201, { device: await svc.createDevice(store, u, await body(req)) });
      if (route.startsWith('devices/')) { const [id, action] = route.slice(8).split('/'); return action === 'rotate' ? send(res, 200, { device: await svc.rotateDeviceKey(store, u, id) }) : (await svc.deleteDevice(store, u, id), send(res, 200, {})); }
      if (route === 'readings') {
        if (m === 'GET') return send(res, 200, { readings: await svc.listReadings(store, u, url.searchParams.get('parcelId'), url.searchParams.get('days')) });
        if (m === 'DELETE') { await svc.deleteReading(store, u, url.searchParams.get('parcelId'), url.searchParams.get('ts')); return send(res, 200, {}); }
        return send(res, 201, { reading: await svc.addManualReading(store, u, await body(req)) });
      }
      return send(res, 404, { error: 'no encontrado' });
    }
    // Teselas de mapas externos no disponibles en pruebas.
    let file = join(root, p === '/' ? 'index.html' : p);
    let data;
    try { data = await readFile(file); } catch { file = join(root, 'index.html'); data = await readFile(file); }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, code: e.code });
    console.error(e);
    send(res, 500, { error: String(e) });
  }
}).listen(port, () => console.log(`mock en http://localhost:${port}`));
