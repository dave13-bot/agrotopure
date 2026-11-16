import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANTS, GUIDE_COUNT, findPlantByName, plantById } from '../src/data/plants.js';
import * as agro from '../src/lib/agro.js';
import { polygonAreaM2, parseCoord, orderCorners, isSelfIntersecting } from '../src/lib/geo.js';

test('repositorio: 68 cultivos de la guía + agregados, sin ids repetidos', () => {
  assert.equal(GUIDE_COUNT, 68);
  assert.equal(new Set(PLANTS.map((p) => p.id)).size, PLANTS.length);
  for (const p of PLANTS) {
    assert.ok(p.ph[0] < p.ph[1] && p.temp[0] < p.temp[1], p.name);
    assert.ok(p.soil && p.salinity && p.waterText && p.notes, p.name);
  }
  assert.equal(findPlantByName('maiz').id, 'maiz');
  assert.equal(findPlantByName('Jitomate').id, 'tomate');
  assert.equal(plantById('frijol').cee, 1.0);
});

test('ETo Penman-Monteith ≈ ejemplo 18 de FAO-56 (3.9 mm/día)', () => {
  const v = agro.eto({ date: '2026-07-06', tmax: 21.5, tmin: 12.3, rh: 73.5, wind: 2.078, radMJ: 22.07 }, 50.8, 100);
  assert.ok(v > 3.6 && v < 4.2, `ETo=${v}`);
  assert.equal(agro.radToMJ(5, 'kW-hr/m^2/day'), 18);
});

// Climatología tipo Uruapan (valores redondos de prueba).
const clim = { months: [
  [17, 25, 9, 1.0], [18, 27, 9, 0.6], [20, 29, 11, 0.5], [22, 31, 13, 0.6], [23, 31, 15, 2.5], [22, 28, 16, 8.0],
  [21, 26, 16, 10.5], [21, 26, 16, 10.0], [21, 26, 16, 8.5], [20, 26, 14, 3.5], [19, 26, 11, 1.2], [17, 25, 9, 1.0]
].map(([t2m, tmax, tmin, precipDay], i) => ({ month: i + 1, t2m, tmax, tmin, precipDay })) };

test('climatología, calendario y compatibilidad', () => {
  const months = agro.monthlyClimate(clim, 19.42);
  assert.equal(months.length, 12);
  assert.ok(months[6].precip > 300 && months[6].balance > 0);
  const cal = agro.vulnerabilityCalendar(months);
  assert.ok(cal[6].risks.some((r) => r.id === 'erosion'));
  assert.ok(cal.some((c) => c.level < 2), 'no todo en riesgo alto');
  assert.ok(cal[3].risks.some((r) => r.id === 'sequia'));
  const maiz = agro.compatibility(plantById('maiz'), { months, ph: 6.4 });
  assert.ok(maiz.score >= 70, JSON.stringify(maiz.reasons));
  const lechuga = agro.compatibility(plantById('lechuga'), { months, ph: 6.4 });
  const arroz = agro.compatibility(plantById('arroz'), { months, ph: 6.4, ec: 0.5 });
  assert.ok(maiz.score > arroz.score);
  const acid = agro.compatibility(plantById('arandano'), { months, ph: 7.5 });
  assert.ok(acid.reasons.some((r) => r.key === 'compat.phOut'));
  assert.ok(lechuga.score !== null);
});

test('rotación: 3 estrategias con una recomendada; perennes usan coberturas', () => {
  const months = agro.monthlyClimate(clim, 19.42);
  const s = agro.rotationStrategies({ months, ph: 6.3 }, plantById('maiz'), ['agua', 'suelo']);
  assert.equal(s.length, 3);
  assert.equal(s.filter((x) => x.recommended).length, 1);
  assert.ok(s.find((x) => x.id === 'B').seq.some((c) => c.plant.legumeN));
  const p = agro.rotationStrategies({ months, ph: 6.0 }, plantById('aguacate'), []);
  assert.equal(p.length, 3);
});

test('fusión Δ y predicción de riego', () => {
  const now = Date.now();
  const readings = Array.from({ length: 6 }, (_, i) => ({ ts: new Date(now - (5 - i) * 864e5).toISOString(), moisture25: 30 - i * 0.8, rootTempC: 20 }));
  const sensor = agro.latestReadings(readings);
  assert.equal(sensor.moisture25.value, 26);
  const f = agro.fusion({ sensor, nasa: { gwetroot: { value: 0.35 }, gwettop: { value: 0.3 }, etoAvg7: 4 }, texture: 'franco', crop: plantById('frijol'), readings });
  assert.equal(f.available, true);
  assert.ok(f.deltaRoot > 0.15);
  assert.equal(f.prediction.slope, -0.8);
  assert.equal(f.prediction.daysToIrrigate, Math.round((26 - 19.5) / 0.8));
  assert.ok(f.hiddenWindow);
  const dry = agro.fusion({ sensor: { moisture25: { value: 15 } }, nasa: {}, texture: 'franco', readings: [] });
  assert.equal(dry.insights[0].titleKey, 'fusion.irrigateTitle');
  assert.equal(dry.insights[0].textVars.textureKey, 'franco');
});

test('geometría: área, coordenadas DMS y orden de esquinas', () => {
  const sq = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 }, { lat: 0.001, lon: 0.001 }, { lat: 0.001, lon: 0 }];
  assert.ok(Math.abs(polygonAreaM2(sq) - 12391) < 30);
  assert.equal(parseCoord('19.4206', 'lat'), 19.4206);
  assert.ok(Math.abs(parseCoord(`19°25'14.2"N`, 'lat') - 19.42061) < 1e-4);
  assert.ok(parseCoord(`102°3'46"W`, 'lon') < 0);
  assert.ok(Number.isNaN(parseCoord('abc', 'lat')));
  const bow = [sq[0], sq[2], sq[1], sq[3]];
  assert.ok(isSelfIntersecting(bow));
  assert.ok(!isSelfIntersecting(orderCorners(bow)));
});
