import { useMemo, useState } from 'react';
import { Copy, Cpu, Download, FlaskConical, KeyRound, Plus, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { Badge, Card, Empty, Modal, Notice, SectionTitle, Spinner, Stat, fmt, fmtDate, fmtDateTime, timeAgo } from '../components/ui.jsx';
import { ParcelHeader, NoParcels } from '../components/ParcelPicker.jsx';
import { SeriesChart } from '../components/Charts.jsx';
import { useParcelData } from '../lib/useParcelData.js';
import { fusion, trend } from '../lib/agro.js';
import { findPlantByName } from '../data/plants.js';

export const FIELDS = [
  { key: 'moisture25', label: 'Humedad a 25 cm', unit: '%', color: '#176b40', sensor: true, hint: 'Humedad volumétrica (sonda capacitiva)' },
  { key: 'moistureSurface', label: 'Humedad superficial', unit: '%', color: '#86efac', sensor: true, hint: '0-5 cm' },
  { key: 'moistureDeep', label: 'Humedad profunda', unit: '%', color: '#0f766e', sensor: true, hint: '50 cm o más' },
  { key: 'rootTempC', label: 'Temperatura radicular', unit: '°C', color: '#e11d48', sensor: true, hint: 'DS18B20 a 10-25 cm' },
  { key: 'ph', label: 'pH del suelo', unit: '', color: '#7c3aed', sensor: true, hint: 'No medible por satélite' },
  { key: 'ec', label: 'Conductividad (CE)', unit: 'dS/m', color: '#f59e0b', sensor: true, hint: 'Salinidad' },
  { key: 'airTempC', label: 'Temperatura del aire', unit: '°C', color: '#fb7185', sensor: true },
  { key: 'airRh', label: 'Humedad del aire', unit: '%', color: '#38bdf8', sensor: true },
  { key: 'organicMatter', label: 'Materia orgánica', unit: '%', color: '#78350f', lab: true },
  { key: 'nitrogen', label: 'Nitrógeno', unit: 'mg/kg', color: '#15803d', lab: true },
  { key: 'phosphorus', label: 'Fósforo', unit: 'mg/kg', color: '#c2410c', lab: true },
  { key: 'potassium', label: 'Potasio', unit: 'mg/kg', color: '#4338ca', lab: true }
];

const isOnline = (d) => d.lastSeen && Date.now() - Date.parse(d.lastSeen) < (d.intervalSec || 900) * 2500;

export default function Sensors({ repo, parcels, devices, selected, setSelectedId, refresh, go }) {
  const [days, setDays] = useState(30);
  const data = useParcelData(selected, repo, { climatology: false, readingsDays: days });
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState(null);
  const [manual, setManual] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [err, setErr] = useState('');
  const [chartField, setChartField] = useState('moisture25');
  if (!selected) return <NoParcels go={go} />;

  const myDevices = devices.filter((d) => d.parcelId === selected.id);
  const readings = data.readings || [];
  const sensor = data.sensor || {};
  const crop = findPlantByName(selected.crop);
  const f = fusion({ sensor, nasa: { ...(data.latest || {}), etoAvg7: data.etoAvg7 }, texture: selected.soilTexture, crop, readings });
  const manualRows = readings.filter((r) => r.source === 'manual').slice().reverse();
  const chartData = readings.filter((r) => r[chartField] !== undefined).map((r) => ({ label: fmtDateTime(r.ts), value: r[chartField] }));
  const fieldMeta = FIELDS.find((x) => x.key === chartField);
  const t = trend(readings, chartField, 7);

  const act = async (fn) => { setErr(''); try { await fn(); } catch (e) { setErr(e.message); } };

  return (
    <div className="space-y-6">
      <ParcelHeader eyebrow="Sensores en piso" parcels={parcels} selected={selected} setSelectedId={setSelectedId} go={go}>
        <button className="btn-ghost" onClick={() => setManual(true)}><FlaskConical size={15} />Lectura manual</button>
        <button className="btn-primary" onClick={() => (repo.mode === 'cloud' ? setAdding(true) : setErr('Inicia sesión con una cuenta en la nube para conectar dispositivos.'))}><Plus size={15} />Dispositivo</button>
      </ParcelHeader>
      {err && <Notice tone="error">{err}</Notice>}

      <Card className="p-6">
        <SectionTitle eyebrow="Dispositivos" title="ESP32 y Raspberry Pi de esta parcela" text="Cada dispositivo tiene su propia llave. Lee los sensores automáticamente y envía lecturas a AGROTOPURE, que arma el histórico y las predicciones." />
        {myDevices.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            {repo.mode === 'cloud' ? 'Aún no hay dispositivos. Agrega uno para obtener su ID y llave.' : 'Los dispositivos requieren una cuenta con almacenamiento en la nube.'}
            <a href="https://github.com/dave13-bot/agrotopure/tree/main/firmware" target="_blank" rel="noreferrer" className="ml-1 font-bold text-emerald-700 underline">Ver firmware</a>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {myDevices.map((d) => (
              <div key={d.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isOnline(d) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><Cpu size={20} /></span>
                    <div><p className="font-extrabold">{d.name}</p><p className="font-mono text-[11px] text-slate-500">{d.id} · {d.kind === 'rpi' ? 'Raspberry Pi' : d.kind === 'esp32' ? 'ESP32' : 'Otro'}</p></div>
                  </div>
                  {isOnline(d) ? <Badge><Wifi size={12} />En línea</Badge> : <Badge tone="slate"><WifiOff size={12} />{d.lastSeen ? 'Sin señal' : 'Nunca conectado'}</Badge>}
                </div>
                <p className="mt-2 text-xs text-slate-500">Última lectura: {timeAgo(d.lastSeen)} · cada {Math.round(d.intervalSec / 60)} min</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-ghost" onClick={() => act(async () => setCreated(await repo.rotateDevice(d.id)))}><KeyRound size={14} />Nueva llave</button>
                  <button className="btn-danger" onClick={() => setConfirm(d)}><Trash2 size={14} />Quitar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <SectionTitle eyebrow="Últimos valores" title="Datos que el satélite no ve"
          action={<div className="flex items-center gap-2"><select className="input mt-0" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Periodo">{[7, 30, 90, 365].map((d) => <option key={d} value={d}>Últimos {d} días</option>)}</select><button className="btn-ghost" onClick={data.reloadReadings} aria-label="Recargar lecturas"><RefreshCw size={15} /></button></div>} />
        {data.readingsLoading ? <div className="py-8"><Spinner label="Cargando lecturas…" /></div> : readings.length === 0 ? (
          <div className="mt-4"><Empty icon={FlaskConical} title="Sin lecturas en este periodo" text="Conecta un ESP32/Raspberry Pi o captura los datos de tu análisis de suelo." action={<button className="btn-primary" onClick={() => setManual(true)}>Capturar lectura</button>} /></div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {FIELDS.filter((x) => sensor[x.key]).map((x) => (
                <button key={x.key} onClick={() => setChartField(x.key)} className={`text-left ${chartField === x.key ? 'ring-2 ring-emerald-500 rounded-2xl' : ''}`}>
                  <Stat label={x.label} value={fmt(sensor[x.key].value, x.key === 'ph' ? 2 : 1)} unit={x.unit} hint={`${sensor[x.key].source === 'manual' ? 'Manual' : 'Sensor'} · ${timeAgo(sensor[x.key].ts)}`} />
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="text-sm font-extrabold">Histórico: {fieldMeta?.label}</p>
                {chartData.length ? <SeriesChart data={chartData} series={[{ key: 'value', name: `${fieldMeta.label} ${fieldMeta.unit}`, color: fieldMeta.color }]} /> : <p className="mt-3 text-sm text-slate-500">Sin datos de esta variable en el periodo.</p>}
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <p className="font-extrabold">Tendencia de 7 días</p>
                  <p className="mt-1 text-xs text-slate-600">{t.slope === null ? `Se necesitan lecturas de al menos 3 días (hay ${t.n}).` : `${t.slope > 0 ? '+' : ''}${t.slope} ${fieldMeta?.unit}/día · r² ${t.r2} · ${t.n} días`}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-extrabold">Predicción de riego</p>
                  {f.available ? (
                    <p className="mt-1 text-xs leading-relaxed">{f.prediction.daysToIrrigate === 0 ? `La humedad a 25 cm (${f.vwc}%) ya está bajo el umbral de ${f.triggerVwc}%: regar.` : f.prediction.daysToIrrigate !== undefined ? `Bajará al umbral de ${f.triggerVwc}% en ~${f.prediction.daysToIrrigate} día(s), según ${f.prediction.basis}.` : `Humedad estable o en aumento (${f.prediction.basis}).`}{f.savedMm ? ` Riego evitable: ${f.savedMm} mm.` : ''}</p>
                  ) : <p className="mt-1 text-xs">Requiere humedad a 25 cm.</p>}
                </div>
                <button className="btn-ghost w-full" onClick={() => downloadCsv(selected, readings)}><Download size={15} />Descargar CSV</button>
              </div>
            </div>
          </>
        )}
      </Card>

      {manualRows.length > 0 && (
        <Card className="p-6">
          <SectionTitle eyebrow="Capturas manuales" title="Análisis de suelo y lecturas puntuales" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-slate-500"><tr><th className="py-2">Fecha</th><th>Valores</th><th>Notas</th><th /></tr></thead>
              <tbody>
                {manualRows.map((r) => (
                  <tr key={r.ts} className="border-t border-slate-100 align-top">
                    <td className="py-2 font-bold">{fmtDate(r.ts, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{FIELDS.filter((x) => r[x.key] !== undefined).map((x) => `${x.label}: ${r[x.key]}${x.unit ? ` ${x.unit}` : ''}`).join(' · ')}{r.texture ? ` · Textura: ${r.texture}` : ''}</td>
                    <td className="text-slate-500">{r.notes}</td>
                    <td><button className="p-1 text-slate-400 hover:text-rose-600" aria-label="Eliminar lectura" onClick={() => act(async () => { await repo.deleteReading(selected.id, r.ts); await data.reloadReadings(); })}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {adding && <AddDevice parcel={selected} onClose={() => setAdding(false)} onCreate={async (body) => { const d = await repo.createDevice(body); setAdding(false); setCreated(d); await refresh(); }} />}
      {created && <DeviceKey device={created} onClose={() => setCreated(null)} />}
      {manual && <ManualReading onClose={() => setManual(false)} onSave={async (body) => { await repo.addReading({ ...body, parcelId: selected.id }); setManual(false); await data.reloadReadings(); }} />}
      {confirm && (
        <Modal title="Quitar dispositivo" onClose={() => setConfirm(null)}>
          <p className="text-sm text-slate-600">El dispositivo <b>{confirm.name}</b> dejará de poder enviar lecturas. Las lecturas ya guardadas se conservan.</p>
          <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setConfirm(null)}>Cancelar</button><button className="btn-danger" onClick={() => act(async () => { await repo.deleteDevice(confirm.id); setConfirm(null); await refresh(); })}>Quitar</button></div>
        </Modal>
      )}
    </div>
  );
}

function downloadCsv(parcel, readings) {
  const cols = ['ts', 'source', ...FIELDS.map((f) => f.key), 'texture', 'notes'];
  const esc = (v) => (v === undefined || v === null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const csv = [cols.join(','), ...readings.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `agrotopure-${parcel.name.replace(/\W+/g, '-')}-lecturas.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function AddDevice({ parcel, onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', kind: 'esp32', intervalSec: 900 });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Nuevo dispositivo · ${parcel.name}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await onCreate({ ...form, parcelId: parcel.id }); } catch (ex) { setErr(ex.message); } finally { setBusy(false); } }}>
        <label className="label">Nombre<input className="input" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Sonda norte" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">Tipo<select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="esp32">ESP32</option><option value="rpi">Raspberry Pi</option><option value="otro">Otro</option></select></label>
          <label className="label">Enviar cada<select className="input" value={form.intervalSec} onChange={(e) => setForm({ ...form, intervalSec: Number(e.target.value) })}>{[[300, '5 min'], [900, '15 min'], [1800, '30 min'], [3600, '1 hora'], [10800, '3 horas']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy}>{busy ? 'Creando…' : 'Crear y obtener llave'}</button></div>
      </form>
    </Modal>
  );
}

function DeviceKey({ device, onClose }) {
  const [copied, setCopied] = useState('');
  const endpoint = `${window.location.origin}/api/ingest`;
  const snippet = device.kind === 'rpi'
    ? `AGROTOPURE_URL=${endpoint}\nAGROTOPURE_DEVICE_ID=${device.id}\nAGROTOPURE_DEVICE_KEY=${device.key}\nAGROTOPURE_INTERVAL=${device.intervalSec}`
    : `const char* AGROTOPURE_URL = "${endpoint}";\nconst char* DEVICE_ID = "${device.id}";\nconst char* DEVICE_KEY = "${device.key}";\nconst uint32_t INTERVAL_SEC = ${device.intervalSec};`;
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setCopied(''); } };
  return (
    <Modal title="Llave del dispositivo" onClose={onClose} wide>
      <Notice tone="warn" title="Copia la llave ahora">Por seguridad solo se muestra una vez. Si la pierdes, genera una nueva desde la tarjeta del dispositivo.</Notice>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3"><p className="label">ID</p><p className="mt-1 break-all font-mono text-sm font-bold">{device.id}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="label">Llave</p><p className="mt-1 break-all font-mono text-sm font-bold">{device.key}</p></div>
      </div>
      <p className="mt-4 text-sm font-extrabold">{device.kind === 'rpi' ? 'Archivo /etc/agrotopure.env de la Raspberry Pi' : 'Pega esto en config.h del firmware ESP32'}</p>
      <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-emerald-100">{snippet}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => copy(snippet, 'config')}><Copy size={15} />{copied === 'config' ? 'Copiado' : 'Copiar configuración'}</button>
        <button className="btn-ghost" onClick={() => copy(device.key, 'key')}><Copy size={15} />{copied === 'key' ? 'Copiada' : 'Copiar llave'}</button>
        <a className="btn-ghost" href={`https://github.com/dave13-bot/agrotopure/tree/main/firmware/${device.kind === 'rpi' ? 'raspberry-pi' : 'esp32'}`} target="_blank" rel="noreferrer">Ver firmware e instrucciones</a>
      </div>
    </Modal>
  );
}

function ManualReading({ onClose, onSave }) {
  const [form, setForm] = useState({ ts: new Date().toISOString().slice(0, 10), texture: '', notes: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => [['Sensor portátil o lectura puntual', FIELDS.filter((x) => x.sensor)], ['Análisis de laboratorio', FIELDS.filter((x) => x.lab)]], []);
  return (
    <Modal title="Lectura manual" onClose={onClose} wide>
      <form className="space-y-5" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr('');
        const body = { ts: new Date(`${form.ts}T12:00:00`).toISOString(), texture: form.texture, notes: form.notes };
        for (const fd of FIELDS) if (form[fd.key] !== undefined && form[fd.key] !== '') body[fd.key] = Number(form[fd.key]);
        try { await onSave(body); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
      }}>
        <label className="label w-48">Fecha<input type="date" className="input" value={form.ts} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, ts: e.target.value })} required /></label>
        {groups.map(([title, list]) => (
          <fieldset key={title}>
            <legend className="text-sm font-extrabold">{title}</legend>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {list.map((x) => (
                <label key={x.key} className="label normal-case tracking-normal">{x.label}{x.unit ? ` (${x.unit})` : ''}
                  <input type="number" step="any" inputMode="decimal" className="input" value={form[x.key] ?? ''} onChange={(e) => setForm({ ...form, [x.key]: e.target.value })} placeholder="—" />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">Textura (laboratorio)<input className="input" maxLength={40} value={form.texture} onChange={(e) => setForm({ ...form, texture: e.target.value })} placeholder="Ej. franco-arcilloso" /></label>
          <label className="label">Notas<input className="input" maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Laboratorio, profundidad de muestreo…" /></label>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar lectura'}</button></div>
      </form>
    </Modal>
  );
}
