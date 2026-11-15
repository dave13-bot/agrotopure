import { app } from '@azure/functions';
import { handle, json, readJson, requireUser } from '../lib/http.js';
import { requireStore } from '../lib/storage.js';
import { listParcels, saveParcel, deleteParcel } from '../lib/service.js';

app.http('parcels', {
  methods: ['GET', 'POST'], route: 'parcels', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const user = requireUser(request);
    const store = requireStore();
    if (request.method === 'GET') return json(200, { parcels: await listParcels(store, user) });
    return json(201, { parcel: await saveParcel(store, user, await readJson(request)) });
  })
});

app.http('parcelById', {
  methods: ['PUT', 'DELETE'], route: 'parcels/{id}', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const user = requireUser(request);
    const store = requireStore();
    const { id } = request.params;
    if (request.method === 'PUT') return json(200, { parcel: await saveParcel(store, user, await readJson(request), id) });
    await deleteParcel(store, user, id);
    return json(200, { deleted: true });
  })
});
