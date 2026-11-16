import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cropHealth, expectedNdvi, healthAlert, likelyCauses, peakRange } from '../src/lib/health.js';
import { buildAlerts } from '../src/lib/alerts.js';
import { rotationStrategies, rotationPlan, turnaround, MONTHS } from '../src/lib/agro.js';
import { findPlantByName } from '../src/data/plants.js';
import { DICT } from '../src/lib/i18n.js';

const maiz = findPlantByName('Maíz');
const aguacate = findPlantByName('Aguacate');
const series = (...v) => v.map((value, i) => ({ date: `2026-${String(7 + Math.floor(i / 2)).padStart(2, '0')}-${i % 2 ? '17' : '01'}`, value, reliability: 0 }));
const wet = Array.from({ length: 30 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, precip: 6, gwetroot: 0.7, tmin: 14, tmax: 27 }));
const dry = wet.map((d) => ({ ...d, precip: 0, gwetroot: 0.25 }));

test('el NDVI esperado depende del cultivo y de su etapa', () => {
  assert.deepEqual(peakRange(maiz), [0.65, 0.9]);
  assert.deepEqual(peakRange(findPlantByName('Fresa')), [0.4, 0.75]);
  assert.equal(expectedNdvi(maiz, '2026-06-01', '2026-06-10').stage, 'initial');
  assert.equal(expectedNdvi(maiz, '2026-06-01', '2026-08-20').stage, 'mid');
  assert.equal(expectedNdvi(maiz, '2026-06-01', '2026-12-20').stage, 'harvested');
  assert.equal(expectedNdvi(aguacate, '', '2026-08-20').stage, 'perennial');
  assert.equal(expectedNdvi(maiz, '', '2026-08-20'), null);
});

test('cultivo sano, cultivo bajo lo esperado y caída brusca', () => {
  const ok = cropHealth({ ndviSeries: series(0.5, 0.68, 0.78, 0.8), plant: maiz, sowDate: '2026-06-01', daily: wet });
  assert.equal(ok.status, 'healthy'); assert.equal(ok.score, 100); assert.equal(healthAlert(ok), null);

  const low = cropHealth({ ndviSeries: series(0.4, 0.42, 0.43, 0.42), plant: maiz, sowDate: '2026-06-01', daily: wet });
  assert.equal(low.status, 'stress'); assert.equal(low.kind, 'low'); assert.equal(low.causes[0].id, 'biotic');
  const a = healthAlert(low, 'Maíz');
  assert.equal(a.type, 'health'); assert.equal(a.key, 'alerts.health.low'); assert.equal(a.extraKey, 'health.cause.biotic'); assert.ok(a.severity >= 2);

  const thirsty = cropHealth({ ndviSeries: series(0.7, 0.8, 0.82, 0.6), plant: maiz, sowDate: '2026-06-01', daily: dry });
  assert.equal(thirsty.status, 'stress'); assert.equal(thirsty.causes[0].id, 'water');

  // Sin cultivo ni fecha: solo tendencia.
  const trend = cropHealth({ ndviSeries: series(0.7, 0.72, 0.71, 0.55), plant: null, sowDate: '', daily: wet });
  assert.equal(trend.basis, 'trend'); assert.equal(trend.status, 'stress'); assert.equal(healthAlert(trend).key, 'alerts.health.drop');
});

test('la maduración y las nubes no disparan falsas alarmas', () => {
  const late = cropHealth({ ndviSeries: series(0.8, 0.82, 0.8, 0.55), plant: maiz, sowDate: '2026-04-05', daily: wet });
  assert.equal(late.stage, 'late'); assert.equal(late.status, 'healthy');
  const cloudy = series(0.8, 0.82, 0.81, 0.3); cloudy[3].reliability = 3;
  const h = cropHealth({ ndviSeries: cloudy, plant: maiz, sowDate: '2026-06-01', daily: wet });
  assert.equal(h.ndvi, 0.81); assert.equal(h.cloudy, 1); assert.equal(h.status, 'healthy');
  assert.equal(cropHealth({ ndviSeries: [], plant: maiz, sowDate: '', daily: [] }).status, 'unknown');
  assert.equal(cropHealth({ ndviSeries: series(0.2), plant: maiz, sowDate: '2025-01-01', daily: wet }).status, 'idle');
  assert.deepEqual(likelyCauses([{ date: '2026-01-01', precip: 2, gwetroot: 0.6, tmin: 1, tmax: 20 }]).map((c) => c.id), ['frost']);
});

test('la alerta de salud respeta el selector de notificaciones', () => {
  const low = cropHealth({ ndviSeries: series(0.4, 0.42, 0.43, 0.42), plant: maiz, sowDate: '2026-06-01', daily: wet });
  const alert = healthAlert(low, 'Maíz');
  assert.equal(buildAlerts({ daily: [], months: [], health: alert }).length, 1);
  assert.equal(buildAlerts({ daily: [], months: [], health: alert, enabled: ['frost'] }).length, 0);
  for (const k of [alert.key, alert.extraKey, 'alerts.types.health']) { assert.ok(k in DICT.es, k); assert.ok(k in DICT.en, k); }
});

const months = [[16, 25, 4, 5], [17, 27, 5, 4], [19, 30, 7, 3], [21, 32, 9, 8], [22, 33, 11, 40], [21, 30, 13, 190], [20, 28, 13, 230], [20, 28, 13, 220], [20, 28, 12, 200], [19, 28, 9, 80], [17, 27, 6, 15], [16, 25, 4, 6]]
  .map(([t, x, n, p], i) => ({ month: i + 1, label: MONTHS[i], t2m: t, tmax: x, tmin: n, range: 12, precip: p, eto: 110, balance: p - 110 }));

test('la rotación respeta el tiempo entre cultivos y explica por qué y cómo', () => {
  assert.deepEqual(turnaround(maiz), { days: 21, why: 'cereal' });
  for (const crop of [maiz, null, findPlantByName('Tomate')]) {
    const st = rotationStrategies({ months, ph: null, ec: null }, crop, ['suelo']);
    assert.equal(st.length, 3);
    for (const s of st) {
      assert.equal(s.plan.conflict, false, `${s.id} tiene traslape`);
      for (const step of s.plan.steps) {
        assert.ok(step.why.length >= 2 && step.how.length >= 2, `${s.id}/${step.plant.id}`);
        assert.ok(step.next.gapDays >= step.next.minDays);
        assert.ok(step.harvestDoy[0] > step.sowDoy);
        for (const m of [...step.why, ...step.how]) { assert.ok(m.key in DICT.es, m.key); assert.ok(m.key in DICT.en, m.key); }
      }
      assert.ok(s.plan.occupiedDays + s.plan.freeDays <= 366 + 30);
    }
    // Cereal tras cereal: la misma familia vuelve antes de lo recomendado y se avisa.
    const a = st.find((s) => s.id === 'A');
    if (a.seq.every((x) => x.plant.family === 'Poaceae')) assert.equal(a.plan.repeat, true);
  }
  for (const why of ['cereal', 'legume', 'greenManure', 'brassica', 'root', 'general']) assert.ok(`plan.turn.${why}` in DICT.es && `plan.turn.${why}` in DICT.en);
});

test('un perenne conserva su plan sin fechas de siembra', () => {
  const st = rotationStrategies({ months, ph: null, ec: null }, aguacate, []);
  const base = st[0].plan.steps[0];
  assert.equal(base.perennial, true); assert.equal(base.next, undefined); assert.equal(base.why[0].key, 'plan.whyPerennial');
  assert.equal(rotationPlan([], []).steps.length, 0);
});
