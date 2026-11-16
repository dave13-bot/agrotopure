import { test } from 'node:test';
import assert from 'node:assert/strict';
import { powerDaily, powerClimatology, modis, modisDate, eonet } from '../src/lib/nasa.js';

test('fecha MODIS', () => { assert.equal(modisDate(new Date(Date.UTC(2026, 10, 1))), 'A2026305'); });

const respond = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

test('POWER diario: valores de relleno -999 se vuelven null y se lee la elevación', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    return respond({
      geometry: { coordinates: [-102.06, 19.42, 1612.3] }, header: { fill_value: -999 },
      parameters: { ALLSKY_SFC_SW_DWN: { units: 'MJ/m^2/day' } },
      properties: { parameter: { T2M: { 20261101: 18.2, 20261102: 17.9 }, GWETROOT: { 20261101: 0.61, 20261102: -999 }, PRECTOTCORR: { 20261101: 0, 20261102: 3.1 } } }
    });
  });
  const r = await powerDaily(19.42, -102.06, 30);
  assert.equal(r.elevationM, 1612.3);
  assert.equal(r.daily.length, 2);
  assert.equal(r.daily[0].date, '2026-11-01');
  assert.equal(r.daily[1].gwetroot, null);
  assert.equal(r.units.ALLSKY_SFC_SW_DWN, 'MJ/m^2/day');
  assert.match(calls[0], /community=AG/);
  assert.match(calls[0], /GWETROOT/);
});

test('POWER diario: reintenta con parámetros mínimos si POWER responde 422', async (t) => {
  let core = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.includes('CLRSKY_SFC_SW_DWN')) return respond({ properties: { parameter: {} } });
    return ++core === 1 ? respond({ messages: ['parámetro inválido'] }, 422) : respond({ properties: { parameter: { T2M: { 20261101: 20 } } } });
  });
  const r = await powerDaily(10.1, 10.1, 15);
  assert.equal(core, 2, 'reintento del grupo principal');
  assert.equal(r.daily[0].t2m, 20);
});

test('POWER climatología: 12 meses', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => respond({ properties: { parameter: { T2M: { JAN: 15, FEB: 16, MAR: 18, APR: 20, MAY: 21, JUN: 21, JUL: 20, AUG: 20, SEP: 20, OCT: 19, NOV: 17, DEC: 15, ANN: 18.5 }, PRECTOTCORR: { JUL: 7.2 } } } }));
  const r = await powerClimatology(19.4, -102.1);
  assert.equal(r.months.length, 12);
  assert.equal(r.months[6].precipDay, 7.2);
  assert.equal(r.months[0].precipDay, null);
});

test('MODIS ORNL: escala NDVI y LST', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.match(url, /startDate=A\d{7}&endDate=A\d{7}/);
    if (url.includes('MOD13Q1')) return respond({ subset: [{ calendar_date: '2026-10-16', data: [6512] }, { calendar_date: '2026-11-01', data: [-3000] }] });
    return respond({ subset: [{ calendar_date: '2026-11-01', data: [15000] }] });
  });
  const r = await modis(19.5, -102.2);
  assert.equal(r.ndvi[0].value, 0.651);
  assert.equal(r.ndvi[1].value, null);
  assert.equal(r.lstDayC[0].value, 26.9);
});

test('EONET: bbox correcto, distancia y filtrado por radio', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    return respond({ events: [
      { id: 'EONET_1', title: 'Huracán Prueba', categories: [{ id: 'severeStorms', title: 'Severe Storms' }], sources: [{ id: 'JTWC', url: 'https://x' }],
        geometry: [{ type: 'Point', date: '2026-11-14T00:00:00Z', coordinates: [-103.0, 19.5], magnitudeValue: 75, magnitudeUnit: 'kts' }] },
      { id: 'EONET_2', title: 'Incendio lejano', categories: [{ id: 'wildfires', title: 'Wildfires' }], sources: [],
        geometry: [{ type: 'Point', date: '2026-11-10T00:00:00Z', coordinates: [-80.0, 19.5] }] }
    ] });
  });
  const r = await eonet(19.42, -102.06, { radiusKm: 300, days: 30 });
  const bbox = new URL(calls[0]).searchParams.get('bbox').split(',').map(Number);
  assert.ok(bbox[0] < -102.06 && bbox[2] > -102.06, 'longitudes');
  assert.ok(bbox[1] > 19.42 && bbox[3] < 19.42, 'bbox va de arriba-izquierda a abajo-derecha');
  assert.equal(r.events.length, 1, 'el evento fuera del radio se descarta');
  assert.equal(r.events[0].id, 'EONET_1');
  assert.ok(r.events[0].distanceKm > 90 && r.events[0].distanceKm < 120, `distancia ${r.events[0].distanceKm}`);
  assert.equal(r.events[0].magnitudeValue, 75);
  assert.ok(r.disclaimer.includes('no es una fuente oficial'));
});

test('POWER: el grupo solar es opcional y no tumba la consulta', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.includes('ALLSKY_SFC_UV_INDEX')) return respond({ messages: ['parameter ALLSKY_SFC_UV_INDEX not found'] }, 422);
    if (url.includes('CLRSKY_SFC_SW_DWN')) return respond({ properties: { parameter: { CLRSKY_SFC_SW_DWN: { 20261101: 22.2 }, ALLSKY_KT: { 20261101: 0.62 } } } });
    return respond({ properties: { parameter: { T2M: { 20261101: 19 }, ALLSKY_SFC_SW_DWN: { 20261101: 18.1 } } } });
  });
  const r = await powerDaily(19.1, -102.1, 30);
  assert.equal(r.daily[0].t2m, 19);
  assert.equal(r.daily[0].radClear, 22.2);
  assert.equal(r.daily[0].kt, 0.62);
  assert.equal(r.daily[0].uv, undefined);
  assert.ok(r.notes[0].includes('ALLSKY_SFC_UV_INDEX'));
});
