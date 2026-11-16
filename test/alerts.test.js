import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlerts, eonetAlerts, powerAlerts, ALERT_TYPES } from '../src/lib/alerts.js';
import { plantById } from '../src/data/plants.js';

const day = (i, over = {}) => ({
  date: new Date(Date.now() - i * 864e5).toISOString().slice(0, 10),
  t2m: 20, tmax: 28, tmin: 12, rh: 60, precip: 0, rad: 18, wind: 2, windMax: 4, gwetroot: 0.5, ...over
});
const normal = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, tmin: 10, tmax: 30, t2m: 20 }));

test('EONET: mapea categorías y gradúa la severidad por distancia', () => {
  const data = { events: [
    { id: 'a', title: 'Hurricane Nora', categories: ['severeStorms'], sources: [{ id: 'JTWC' }], distanceKm: 90, lastDate: '2026-11-14T00:00:00Z', magnitudeValue: 80, magnitudeUnit: 'kts' },
    { id: 'b', title: 'Fire', categories: ['wildfires'], sources: [], distanceKm: 300, lastDate: '2026-11-10T00:00:00Z', magnitudeValue: null },
    { id: 'c', title: 'Quake', categories: ['earthquakes'], sources: [], distanceKm: 20, lastDate: '2026-11-12T00:00:00Z' }
  ] };
  const out = eonetAlerts(data);
  assert.equal(out.length, 2, 'los sismos no son alerta agrícola');
  assert.equal(out[0].type, 'storm');
  assert.equal(out[0].severity, 3);
  assert.equal(out[0].key, 'alerts.storm.eonet');
  assert.equal(out[0].vars.magnitude, '80 kts');
  assert.equal(out[1].type, 'fire');
  assert.equal(out[1].severity, 2);
});

test('POWER: helada, frente frío y cultivo sensible', () => {
  const frost = powerAlerts([day(3), day(2), day(1, { tmin: -1.5 })], normal, null);
  const f = frost.find((a) => a.key === 'alerts.frost.freeze');
  assert.ok(f, 'helada detectada');
  assert.equal(f.severity, 3);
  assert.equal(f.vars.tmin, -1.5);

  const mild = powerAlerts([day(2), day(1, { tmin: 2.4 })], normal, null);
  assert.equal(mild.find((a) => a.type === 'frost').severity, 2);
  const sensitive = powerAlerts([day(2), day(1, { tmin: 2.4 })], normal, plantById('frijol'));
  assert.equal(sensitive.find((a) => a.type === 'frost').severity, 3, 'sube con cultivo sensible a helada');

  const cold = powerAlerts(
    [day(7, { t2m: 24 }), day(6, { t2m: 23 }), day(5, { t2m: 21 }), day(4, { t2m: 19 }), day(3, { t2m: 17, tmin: 8 }), day(2, { t2m: 16, tmin: 7 }), day(1, { t2m: 15, tmin: 6 })],
    normal, null
  );
  const cf = cold.find((a) => a.key === 'alerts.frost.coldFront');
  assert.ok(cf, 'frente frío detectado');
  assert.ok(cf.vars.drop >= 4);
});

test('POWER: calor, UV, radiación, lluvia, viento y racha seca', () => {
  assert.equal(powerAlerts([day(1, { tmax: 39 })], normal, null).find((a) => a.type === 'heat').severity, 3);
  assert.equal(powerAlerts([day(1, { tmax: 36 })], normal, null).find((a) => a.type === 'heat').severity, 2);

  const rad = powerAlerts([day(1, { rad: 27 })], normal, null).find((a) => a.type === 'uv');
  assert.equal(rad.key, 'alerts.uv.radiation');
  assert.equal(rad.severity, 2);
  assert.equal(powerAlerts([day(1, { rad: 30 })], normal, null).find((a) => a.type === 'uv').severity, 3);
  // El índice UV de POWER es media diaria con meses de retraso: no debe generar alerta por sí solo.
  assert.equal(powerAlerts([day(1, { uv: 11.5, rad: 18 })], normal, null).find((a) => a.type === 'uv'), undefined);

  const rain = powerAlerts([day(2), day(1, { precip: 85 })], normal, null).find((a) => a.type === 'rain');
  assert.equal(rain.severity, 3);
  assert.equal(rain.vars.mm, 85);

  const wind = powerAlerts([day(1, { windMax: 16 })], normal, null).find((a) => a.type === 'wind');
  assert.equal(wind.severity, 3);
  assert.equal(wind.vars.kmh, 58);

  const dry = powerAlerts(Array.from({ length: 30 }, (_, i) => day(30 - i, { gwetroot: 0.25 })), normal, null).find((a) => a.type === 'dry');
  assert.equal(dry.severity, 3);
  assert.equal(dry.vars.days, 30);
  assert.equal(dry.vars.root, 25);
});

test('sin condiciones de riesgo no hay alertas', () => {
  assert.deepEqual(powerAlerts([day(3), day(2), day(1, { precip: 4 })], normal, null), []);
  assert.deepEqual(powerAlerts([], normal, null), []);
});

test('buildAlerts filtra por preferencias y ordena por severidad', () => {
  const eonet = { events: [{ id: 'a', title: 'Storm', categories: ['severeStorms'], sources: [], distanceKm: 600, lastDate: '2026-11-01' }] };
  const daily = [day(2), day(1, { tmin: -2 })];
  const all = buildAlerts({ eonet, daily, months: normal, crop: null, enabled: ALERT_TYPES });
  assert.equal(all.length, 2);
  assert.equal(all[0].type, 'frost', 'la severidad alta va primero');
  const only = buildAlerts({ eonet, daily, months: normal, crop: null, enabled: ['storm'] });
  assert.equal(only.length, 1);
  assert.equal(only[0].type, 'storm');
  assert.deepEqual(buildAlerts({ eonet: null, daily: [], months: normal, crop: null, enabled: [] }), []);
});
