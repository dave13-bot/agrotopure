// Persistencia en Azure Table Storage.
// Requiere la variable de entorno AZURE_STORAGE_CONNECTION_STRING en la configuración
// de Azure Static Web Apps. Sin ella, la API responde 503 y la app trabaja en modo local.
import { TableClient } from '@azure/data-tables';
import { HttpError } from './http.js';

export const TABLES = ['profiles', 'parcels', 'devices', 'readings'];

class TableStore {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.clients = new Map();
    this.ready = new Map();
  }

  async client(name) {
    if (!this.clients.has(name)) {
      const c = TableClient.fromConnectionString(this.connectionString, `agrotopure${name}`, { allowInsecureConnection: this.connectionString.includes('UseDevelopmentStorage') });
      this.clients.set(name, c);
      this.ready.set(name, c.createTable().catch((e) => { if (e.statusCode !== 409) throw e; }));
    }
    await this.ready.get(name);
    return this.clients.get(name);
  }

  async get(table, pk, rk) {
    const c = await this.client(table);
    try {
      return clean(await c.getEntity(pk, rk));
    } catch (e) {
      if (e.statusCode === 404) return null;
      throw e;
    }
  }

  async upsert(table, entity) {
    const c = await this.client(table);
    await c.upsertEntity(entity, 'Replace');
    return entity;
  }

  async remove(table, pk, rk) {
    const c = await this.client(table);
    try {
      await c.deleteEntity(pk, rk);
    } catch (e) {
      if (e.statusCode !== 404) throw e;
    }
  }

  async list(table, pk, { top = 1000, rkFrom, rkTo } = {}) {
    const c = await this.client(table);
    const parts = [`PartitionKey eq '${escape(pk)}'`];
    if (rkFrom) parts.push(`RowKey ge '${escape(rkFrom)}'`);
    if (rkTo) parts.push(`RowKey le '${escape(rkTo)}'`);
    const out = [];
    for await (const e of c.listEntities({ queryOptions: { filter: parts.join(' and ') } })) {
      out.push(clean(e));
      if (out.length >= top) break;
    }
    return out;
  }
}

/** Implementación en memoria: solo para pruebas automatizadas. */
export class MemoryStore {
  constructor() { this.data = new Map(); }
  key(t, pk) { return `${t}|${pk}`; }
  async get(t, pk, rk) { return structuredClone(this.data.get(this.key(t, pk))?.get(rk) ?? null); }
  async upsert(t, e) {
    const k = this.key(t, e.partitionKey);
    if (!this.data.has(k)) this.data.set(k, new Map());
    this.data.get(k).set(e.rowKey, structuredClone(e));
    return e;
  }
  async remove(t, pk, rk) { this.data.get(this.key(t, pk))?.delete(rk); }
  async list(t, pk, { top = 1000, rkFrom, rkTo } = {}) {
    const m = this.data.get(this.key(t, pk));
    if (!m) return [];
    return [...m.values()]
      .filter((e) => (!rkFrom || e.rowKey >= rkFrom) && (!rkTo || e.rowKey <= rkTo))
      .sort((a, b) => (a.rowKey < b.rowKey ? -1 : 1))
      .slice(0, top)
      .map((e) => structuredClone(e));
  }
}

const escape = (s) => String(s).replace(/'/g, "''");
function clean(e) {
  const { etag, timestamp, 'odata.metadata': _m, ...rest } = e;
  return rest;
}

let singleton;
let override;
export function setStoreForTests(store) { override = store; }

export function getStore() {
  if (override) return override;
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!cs) return null;
  if (!singleton) singleton = new TableStore(cs);
  return singleton;
}

export function requireStore() {
  const s = getStore();
  if (!s) {
    throw new HttpError(503, 'El almacenamiento en la nube no está configurado (falta AZURE_STORAGE_CONNECTION_STRING).', 'storage_not_configured');
  }
  return s;
}
