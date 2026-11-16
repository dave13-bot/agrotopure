import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DICT, translate } from '../src/lib/i18n.js';
import { PLANTS, localized, findPlantByName, localizedPlants } from '../src/data/plants.js';

test('los diccionarios español e inglés tienen exactamente las mismas claves', () => {
  const es = Object.keys(DICT.es).sort();
  const en = Object.keys(DICT.en).sort();
  assert.deepEqual(es.filter((k) => !(k in DICT.en)), []);
  assert.deepEqual(en.filter((k) => !(k in DICT.es)), []);
  assert.ok(es.length > 400);
  for (const [lang, table] of Object.entries(DICT)) {
    for (const [k, v] of Object.entries(table)) assert.ok(typeof v === 'string' && v.length, `${lang}.${k} vacío`);
  }
});

test('las claves y variables coinciden entre idiomas', () => {
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const k of Object.keys(DICT.es)) {
    assert.deepEqual(vars(DICT.en[k]), vars(DICT.es[k]), `variables distintas en ${k}`);
  }
});

test('toda clave usada por el motor existe en ambos idiomas', () => {
  const files = ['src/lib/agro.js', 'src/lib/alerts.js'];
  const used = new Set();
  for (const f of files) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/(?:key|titleKey|textKey|extraKey|noteKey|nameKey|basisKey|methodKey):\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/`alerts\.\$\{type\}\.eonet`/g)) ['storm', 'fire', 'flood', 'drought', 'volcano'].forEach((x) => used.add(`alerts.${x}.eonet`));
  }
  assert.ok(used.size > 25, `claves encontradas: ${used.size}`);
  for (const k of used) {
    assert.ok(k in DICT.es, `falta en español: ${k}`);
    assert.ok(k in DICT.en, `falta en inglés: ${k}`);
  }
});

test('interpolación y respaldo al español', () => {
  assert.equal(translate('en', 'alerts.heat.body', { tmax: 39 }), 'Extreme heat: 39 °C maximum. Risk of flower abortion and higher water demand.');
  assert.equal(translate('es', 'clave.inexistente'), 'clave.inexistente');
  assert.equal(translate('en', 'alerts.dry.body', { days: 20, root: null }), '20 days without meaningful rain. NASA root-zone moisture: %.');
});

test('los 73 cultivos están traducidos y se buscan en los dos idiomas', () => {
  const en = localizedPlants('en');
  assert.equal(en.length, PLANTS.length);
  for (const p of PLANTS) {
    const e = localized(p, 'en');
    assert.notEqual(e.name, undefined);
    for (const f of ['name', 'soil', 'salinity', 'waterText', 'notes']) {
      assert.ok(typeof e[f] === 'string' && e[f].length > 2, `${p.id}.${f}`);
      assert.notEqual(e[f], p[f] === undefined ? null : undefined);
    }
  }
  assert.equal(findPlantByName('Maize').id, 'maiz');
  assert.equal(findPlantByName('maíz').id, 'maiz');
  assert.equal(findPlantByName('Sweet potato').id, 'camote');
  assert.equal(localized(PLANTS.find((p) => p.id === 'ajo'), 'en').tempText.includes('early'), true);
});

test('las vistas no dejan textos en español fuera del diccionario', () => {
  const dir = new URL('../src/views/', import.meta.url);
  const offenders = [];
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    // Palabras acentuadas o signos de apertura fuera de claves de traducción delatan texto sin traducir.
    for (const line of src.split('\n')) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      // Se ignoran las claves de traducción y los nombres propios, iguales en ambos idiomas.
      const rest = line.replace(/t\('[^']*'[^)]*\)/g, '').replace(/Michoacán|España|México/g, '');
      if (/[¿¡]|[áéíóúñ]/i.test(rest)) offenders.push(`${f}: ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(offenders, []);
});
