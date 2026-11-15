import { app } from '@azure/functions';
import { handle, json, readJson, requireUser, getPrincipal } from '../lib/http.js';
import { getStore, requireStore } from '../lib/storage.js';
import { getProfile, saveProfile, deleteAccount } from '../lib/service.js';

app.http('status', {
  methods: ['GET'], route: 'status', authLevel: 'anonymous',
  handler: handle(async (request) => json(200, {
    ok: true, storage: Boolean(getStore()), authenticated: Boolean(getPrincipal(request)), time: new Date().toISOString()
  }))
});

app.http('me', {
  methods: ['GET', 'PUT', 'DELETE'], route: 'me', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const user = requireUser(request);
    const store = requireStore();
    if (request.method === 'GET') {
      const profile = await getProfile(store, user);
      return json(200, { user: { userId: user.userId, provider: user.provider, userDetails: user.userDetails }, profile });
    }
    if (request.method === 'PUT') return json(200, { profile: await saveProfile(store, user, await readJson(request)) });
    await deleteAccount(store, user);
    return json(200, { deleted: true });
  })
});
