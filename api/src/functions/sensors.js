import { app } from '@azure/functions';
import { handle, json, readJson, requireUser } from '../lib/http.js';
import { requireStore } from '../lib/storage.js';
import { listDevices, createDevice, deleteDevice, rotateDeviceKey, listReadings, addManualReading, deleteReading, ingest } from '../lib/service.js';

app.http('devices', {
  methods: ['GET', 'POST'], route: 'devices', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const user = requireUser(request);
    const store = requireStore();
    if (request.method === 'GET') return json(200, { devices: await listDevices(store, user) });
    return json(201, { device: await createDevice(store, user, await readJson(request)) });
  })
});

app.http('deviceById', {
  methods: ['DELETE', 'POST'], route: 'devices/{id}/{action?}', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const user = requireUser(request);
    const store = requireStore();
    const { id, action } = request.params;
    if (request.method === 'POST' && action === 'rotate') return json(200, { device: await rotateDeviceKey(store, user, id) });
    if (request.method === 'DELETE' && !action) { await deleteDevice(store, user, id); return json(200, { deleted: true }); }
    return json(404, { error: 'Ruta no encontrada.' });
  })
});

app.http('readings', {
  methods: ['GET', 'POST', 'DELETE'], route: 'readings', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const user = requireUser(request);
    const store = requireStore();
    if (request.method === 'GET') {
      return json(200, { readings: await listReadings(store, user, request.query.get('parcelId'), request.query.get('days')) });
    }
    if (request.method === 'DELETE') {
      await deleteReading(store, user, request.query.get('parcelId'), request.query.get('ts'));
      return json(200, { deleted: true });
    }
    return json(201, { reading: await addManualReading(store, user, await readJson(request)) });
  })
});

// Punto de entrada para ESP32 / Raspberry Pi (sin sesión; autenticado con llave del dispositivo).
app.http('ingest', {
  methods: ['POST'], route: 'ingest', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const store = requireStore();
    const result = await ingest(store, request.headers.get('x-device-id'), request.headers.get('x-device-key'), await readJson(request, 256 * 1024));
    return json(200, result);
  })
});
