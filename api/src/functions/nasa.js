import { app } from '@azure/functions';
import { handle, json, coordsParam } from '../lib/http.js';
import { powerDaily, powerClimatology, modis, eonet } from '../lib/nasa.js';

const cacheHeaders = { 'Cache-Control': 'public, max-age=1800' };

app.http('nasaPower', {
  methods: ['GET'], route: 'nasa/power', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const { lat, lon } = coordsParam(request);
    return json(200, await powerDaily(lat, lon, Number(request.query.get('days')) || 60), cacheHeaders);
  })
});

app.http('nasaClimatology', {
  methods: ['GET'], route: 'nasa/climatology', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const { lat, lon } = coordsParam(request);
    return json(200, await powerClimatology(lat, lon), cacheHeaders);
  })
});

app.http('nasaModis', {
  methods: ['GET'], route: 'nasa/modis', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const { lat, lon } = coordsParam(request);
    return json(200, await modis(lat, lon), cacheHeaders);
  })
});

app.http('nasaEonet', {
  methods: ['GET'], route: 'nasa/eonet', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const { lat, lon } = coordsParam(request);
    const opts = { radiusKm: Number(request.query.get('radiusKm')) || 800, days: Number(request.query.get('days')) || 30 };
    return json(200, await eonet(lat, lon, opts), { 'Cache-Control': 'public, max-age=1800' });
  })
});
