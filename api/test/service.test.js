import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/lib/storage.js';
import * as svc from '../src/lib/service.js';

const alice = { userId: 'u-alice', provider: 'github', userDetails: 'alice' };
const bob = { userId: 'u-bob', provider: 'aad', userDetails: 'bob@x.com' };
const square = [
  { lat: 19.42, lon: -102.065 }, { lat: 19.42, lon: -102.064 },
  { lat: 19.419, lon: -102.064 }, { lat: 19.419, lon: -102.065 }
];

test('perfil: crear, leer y validar', async () => {
  const s = new MemoryStore();
  assert.equal(await svc.getProfile(s, alice), null);
  await assert.rejects(svc.saveProfile(s, alice, { name: '' }), /nombre/);
  const p = await svc.saveProfile(s, alice, { name: 'Alicia', region: 'Uruapan', priorities: ['agua', 'xx', 'agua'] });
  assert.deepEqual(p.priorities, ['agua']);
  assert.equal((await svc.getProfile(s, alice)).name, 'Alicia');
});

test('parcelas: área, centroide, aislamiento entre cuentas', async () => {
  const s = new MemoryStore();
  const p = await svc.saveParcel(s, alice, { name: 'Norte', crop: 'Maíz', coordinates: square });
  assert.ok(p.areaHa > 1.1 && p.areaHa < 1.25, `área ${p.areaHa}`); // ~111 m x 105 m
  assert.ok(Math.abs(p.centroid.lat - 19.4195) < 1e-6);
  assert.equal((await svc.listParcels(s, alice)).length, 1);
  assert.equal((await svc.listParcels(s, bob)).length, 0);
  await assert.rejects(svc.saveParcel(s, bob, { name: 'x', coordinates: square }, p.id), /no encontrada/);
  const bow = [square[0], square[2], square[1], square[3]];
  await assert.rejects(svc.saveParcel(s, alice, { name: 'Moño', coordinates: bow }), /se cruzan/);
  await assert.rejects(svc.saveParcel(s, alice, { name: 'x', coordinates: square.slice(0, 2) }), /3 y 200/);
});

test('dispositivo: llave, ingesta, lecturas y rotación', async () => {
  const s = new MemoryStore();
  const p = await svc.saveParcel(s, alice, { name: 'Norte', coordinates: square });
  await assert.rejects(svc.createDevice(s, bob, { parcelId: p.id }), /no encontrada/);
  const d = await svc.createDevice(s, alice, { parcelId: p.id, kind: 'esp32', name: 'Sonda 1' });
  assert.equal(d.key.length, 48);
  await assert.rejects(svc.ingest(s, d.id, 'mala', { moisture25: 30 }), /inválidos/);
  const r = await svc.ingest(s, d.id, d.key, { readings: [
    { moisture25: 31.5, rootTempC: 21.2, ph: 6.3, ts: Date.now() - 3600e3 },
    { moisture25: 30.9, rootTempC: 21.8, ph: 6.3 }
  ] });
  assert.equal(r.stored, 2);
  await assert.rejects(svc.ingest(s, d.id, d.key, { ph: 20 }), /fuera de rango/);
  await assert.rejects(svc.ingest(s, d.id, d.key, {}), /ningún valor/);
  const list = await svc.listReadings(s, alice, p.id, 7);
  assert.equal(list.length, 2);
  assert.ok(list[0].ts < list[1].ts, 'orden cronológico');
  assert.equal(list[0].source, d.id);
  await assert.rejects(svc.listReadings(s, bob, p.id, 7), /no encontrada/);
  const rotated = await svc.rotateDeviceKey(s, alice, d.id);
  await assert.rejects(svc.ingest(s, d.id, d.key, { moisture25: 30 }), /inválidos/);
  assert.equal((await svc.ingest(s, d.id, rotated.key, { moisture25: 30 })).stored, 1);
  assert.ok((await svc.listDevices(s, alice))[0].lastSeen);
});

test('lecturas manuales y borrado de cuenta', async () => {
  const s = new MemoryStore();
  const p = await svc.saveParcel(s, alice, { name: 'Sur', coordinates: square });
  const m = await svc.addManualReading(s, alice, { parcelId: p.id, ph: 5.8, organicMatter: 3.1, texture: 'franco', notes: 'Análisis laboratorio' });
  assert.equal(m.source, 'manual');
  assert.equal((await svc.listReadings(s, alice, p.id, 30)).length, 1);
  await svc.deleteReading(s, alice, p.id, m.ts);
  assert.equal((await svc.listReadings(s, alice, p.id, 30)).length, 0);
  await svc.createDevice(s, alice, { parcelId: p.id });
  await svc.saveProfile(s, alice, { name: 'A' });
  await svc.deleteAccount(s, alice);
  assert.equal((await svc.listParcels(s, alice)).length, 0);
  assert.equal((await svc.listDevices(s, alice)).length, 0);
  assert.equal(await svc.getProfile(s, alice), null);
});

test('perfil: idioma, análisis fino y tipos de alerta', async () => {
  const s = new MemoryStore();
  const p = await svc.saveProfile(s, alice, { name: 'Ana' });
  assert.equal(p.locale, 'es');
  assert.equal(p.fineAnalysis, false);
  assert.equal(p.alertTypes.length, svc.ALERT_TYPES.length);
  const q = await svc.saveProfile(s, alice, { name: 'Ana', locale: 'en', fineAnalysis: true, alertTypes: ['storm', 'frost', 'inventado'] });
  assert.equal(q.locale, 'en');
  assert.equal(q.fineAnalysis, true);
  assert.deepEqual(q.alertTypes, ['storm', 'frost']);
  assert.equal((await svc.getProfile(s, alice)).locale, 'en');
  const r = await svc.saveProfile(s, alice, { name: 'Ana', locale: 'klingon' });
  assert.equal(r.locale, 'es');
});

test('las parcelas en el océano se rechazan y la fecha de siembra se guarda', async () => {
  const s = new MemoryStore();
  const sq = [{ lat: 19.42, lon: -102.07 }, { lat: 19.42, lon: -102.06 }, { lat: 19.41, lon: -102.06 }, { lat: 19.41, lon: -102.07 }];
  const u = { userId: 'u-land', provider: 'github', userDetails: 'x' };
  const water = async () => ({ checked: true, onLand: false, waterFraction: 1 });
  const land = async () => ({ checked: true, onLand: true, waterFraction: 0 });
  const down = async () => ({ checked: false, onLand: true });
  await assert.rejects(svc.saveParcel(s, u, { name: 'Mar', coordinates: sq }, undefined, { landCheck: water }), /océano/);
  const p = await svc.saveParcel(s, u, { name: 'Tierra', coordinates: sq, sowDate: '2026-06-10' }, undefined, { landCheck: land });
  assert.equal(p.sowDate, '2026-06-10');
  assert.ok((await svc.saveParcel(s, u, { name: 'Sin servicio', coordinates: sq }, undefined, { landCheck: down })).id);
  await assert.rejects(svc.saveParcel(s, u, { name: 'x', coordinates: sq, sowDate: 'ayer' }), /fecha de siembra/);
});

test('la alerta de salud del cultivo llega activada a perfiles anteriores', async () => {
  const s = new MemoryStore();
  const u = { userId: 'u-old', provider: 'github', userDetails: 'x' };
  await s.upsert('profiles', { partitionKey: 'profile', rowKey: 'u-old', name: 'Ana', region: '', priorities: '[]', alertTypes: '["frost","heat"]' });
  assert.deepEqual((await svc.getProfile(s, u)).alertTypes, ['frost', 'heat', 'health']);
  const saved = await svc.saveProfile(s, u, { name: 'Ana', alertTypes: ['frost'] });
  assert.deepEqual(saved.alertTypes, ['frost']);
  assert.deepEqual((await svc.getProfile(s, u)).alertTypes, ['frost']);
});

test('una parcela del tamaño de un continente se rechaza', async () => {
  const s = new MemoryStore();
  const u = { userId: 'u-big', provider: 'github', userDetails: 'x' };
  const huge = [{ lat: 30, lon: -115 }, { lat: 30, lon: -90 }, { lat: 15, lon: -90 }, { lat: 15, lon: -115 }];
  await assert.rejects(svc.saveParcel(s, u, { name: 'Continente', coordinates: huge }), /más de 5,000 ha/);
  const big = [{ lat: 19.5, lon: -102.2 }, { lat: 19.5, lon: -102.1 }, { lat: 19.4, lon: -102.1 }, { lat: 19.4, lon: -102.2 }]; // ≈ 11,600 ha
  await assert.rejects(svc.saveParcel(s, u, { name: 'Muy grande', coordinates: big }), /5,000 ha/);
  const ok = [{ lat: 19.45, lon: -102.15 }, { lat: 19.45, lon: -102.1 }, { lat: 19.4, lon: -102.1 }, { lat: 19.4, lon: -102.15 }]; // ≈ 2,900 ha
  assert.ok((await svc.saveParcel(s, u, { name: 'Rancho', coordinates: ok })).areaHa < 5000);
});
