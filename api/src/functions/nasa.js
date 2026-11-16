import { app } from '@azure/functions';
import { handle, json, coordsParam, HttpError } from '../lib/http.js';
import { landCheck } from '../lib/landmask.js';
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

// Máscara tierra/agua de NASA GIBS para validar que la parcela no quede en el océano.
// points = "lat,lon;lat,lon;..." (3 a 200 esquinas).
app.http('nasaLand', {
  methods: ['GET'], route: 'nasa/land', authLevel: 'anonymous',
  handler: handle(async (request) => {
    const pts = String(request.query.get('points') || '').split(';').filter(Boolean).map((p) => {
      const [lat, lon] = p.split(',').map(Number);
      return { lat, lon };
    });
    if (pts.length < 3 || pts.length > 200 || pts.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180)) {
      throw new HttpError(400, 'Esquinas inválidas (points=lat,lon;lat,lon;...).', 'bad_coords');
    }
    return json(200, await landCheck(pts), { 'Cache-Control': 'public, max-age=3600' });
  })
});
