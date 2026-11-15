import { test } from 'node:test';
import assert from 'node:assert/strict';
import { powerDaily, powerClimatology, modis } from '../src/lib/nasa.js';

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
  let n = 0;
  t.mock.method(globalThis, 'fetch', async () => (++n === 1
    ? respond({ messages: ['parámetro inválido'] }, 422)
    : respond({ properties: { parameter: { T2M: { 20261101: 20 } } } })));
  const r = await powerDaily(10.1, 10.1, 15);
  assert.equal(n, 2);
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
    if (url.includes('/dates')) return respond({ dates: [{ modis_date: 'A2026289', calendar_date: '2026-10-16' }, { modis_date: 'A2026305', calendar_date: '2026-11-01' }] });
    if (url.includes('MOD13Q1')) return respond({ subset: [{ calendar_date: '2026-10-16', data: [6512] }, { calendar_date: '2026-11-01', data: [-3000] }] });
    return respond({ subset: [{ calendar_date: '2026-11-01', data: [15000] }] });
  });
  const r = await modis(19.5, -102.2);
  assert.equal(r.ndvi[0].value, 0.651);
  assert.equal(r.ndvi[1].value, null);
  assert.equal(r.lstDayC[0].value, 26.9);
});
