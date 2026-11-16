import { useMemo, useState } from 'react';
import { Copy, Cpu, Download, FlaskConical, KeyRound, Plus, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { Badge, Card, Empty, Modal, Notice, SectionTitle, Spinner, StatGrid, useFmt } from '../components/ui.jsx';
import { ParcelHeader, NoParcels } from '../components/ParcelPicker.jsx';
import { TimeChart } from '../components/Charts.jsx';
import { useI18n } from '../lib/i18n.js';
import { useParcelData } from '../lib/useParcelData.js';
import { fusion, trend } from '../lib/agro.js';
import { findPlantByName, localized } from '../data/plants.js';

export const FIELDS = [
  { key: 'moisture25', unit: '%', color: '#176b40', sensor: true, hint: true },
  { key: 'moistureSurface', unit: '%', color: '#86efac', sensor: true, hint: true },
  { key: 'moistureDeep', unit: '%', color: '#0f766e', sensor: true, hint: true },
  { key: 'rootTempC', unit: '°C', color: '#e11d48', sensor: true, hint: true },
  { key: 'ph', unit: '', color: '#7c3aed', sensor: true, hint: true },
  { key: 'ec', unit: 'dS/m', color: '#f59e0b', sensor: true, hint: true },
  { key: 'airTempC', unit: '°C', color: '#fb7185', sensor: true },
  { key: 'airRh', unit: '%', color: '#38bdf8', sensor: true },
  { key: 'organicMatter', unit: '%', color: '#78350f', lab: true },
  { key: 'nitrogen', unit: 'mg/kg', color: '#15803d', lab: true },
  { key: 'phosphorus', unit: 'mg/kg', color: '#c2410c', lab: true },
  { key: 'potassium', unit: 'mg/kg', color: '#4338ca', lab: true }
];

const isOnline = (d) => d.lastSeen && Date.now() - Date.parse(d.lastSeen) < (d.intervalSec || 900) * 2500;

export default function Sensors({ repo, parcels, devices, selected, setSelectedId, refresh, go }) {
  const { t, locale } = useI18n();
  const fmt = useFmt();
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
  const crop = localized(findPlantByName(selected.crop), locale);
  const f = fusion({ sensor, nasa: { ...(data.latest || {}), etoAvg7: data.etoAvg7 }, texture: selected.soilTexture, crop, readings });
  const manualRows = readings.filter((r) => r.source === 'manual').slice().reverse();
  const chartData = readings.filter((r) => r[chartField] !== undefined).map((r) => ({ date: r.ts, value: r[chartField] }));
  const meta = FIELDS.find((x) => x.key === chartField);
  const tr = trend(readings, chartField, 7);
  const act = async (fn) => { setErr(''); try { await fn(); } catch (e) { setErr(e.message); } };

  return (
    <div className="space-y-6">
      <ParcelHeader eyebrow={t('sensors.eyebrow')} parcels={parcels} selected={selected} setSelectedId={setSelectedId}>
        <button className="btn-ghost" onClick={() => setManual(true)}><FlaskConical size={15} />{t('sensors.manual')}</button>
        <button className="btn-primary" onClick={() => (repo.mode === 'cloud' ? setAdding(true) : setErr(t('sensors.needCloud')))}><Plus size={15} />{t('sensors.device')}</button>
      </ParcelHeader>
      {err && <Notice tone="error">{err}</Notice>}

      <Card className="p-6">
        <SectionTitle eyebrow={t('nav.sensors')} title={t('sensors.devicesTitle')} text={t('sensors.devicesLead')} />
        {myDevices.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            {repo.mode === 'cloud' ? t('sensors.noDevices') : t('sensors.noCloud')}
            <a href="https://github.com/dave13-bot/agrotopure/tree/main/firmware" target="_blank" rel="noreferrer" className="ml-1 font-bold text-emerald-700 underline">{t('sensors.firmware')}</a>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {myDevices.map((d) => (
              <div key={d.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isOnline(d) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><Cpu size={20} /></span>
                    <div><p className="font-extrabold">{d.name}</p><p className="font-mono text-[11px] text-slate-500">{d.id} · {d.kind === 'rpi' ? 'Raspberry Pi' : d.kind === 'esp32' ? 'ESP32' : '—'}</p></div>
                  </div>
                  {isOnline(d) ? <Badge><Wifi size={12} />{t('sensors.online')}</Badge> : <Badge tone="slate"><WifiOff size={12} />{d.lastSeen ? t('sensors.offline') : t('sensors.neverSeen')}</Badge>}
                </div>
                <p className="mt-2 text-xs text-slate-500">{t('sensors.lastReading', { ago: fmt.timeAgo(d.lastSeen), min: Math.round(d.intervalSec / 60) })}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-ghost" onClick={() => act(async () => setCreated(await repo.rotateDevice(d.id)))}><KeyRound size={14} />{t('sensors.newKey')}</button>
                  <button className="btn-danger" onClick={() => setConfirm(d)}><Trash2 size={14} />{t('common.remove')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <SectionTitle eyebrow={t('sensors.latestEyebrow')} title={t('sensors.latestTitle')}
          action={<div className="flex items-center gap-2">
            <select className="input mt-0" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t('chart.range')}>{[7, 30, 90, 365].map((d) => <option key={d} value={d}>{t('sensors.period', { n: d })}</option>)}</select>
            <button className="btn-ghost" onClick={data.reloadReadings} aria-label={t('common.refresh')}><RefreshCw size={15} /></button>
          </div>} />
        {data.readingsLoading ? <div className="py-8"><Spinner label={t('common.loading')} /></div> : readings.length === 0 ? (
          <div className="mt-4"><Empty icon={FlaskConical} title={t('sensors.noReadings')} text={t('sensors.noReadingsText')} action={<button className="btn-primary" onClick={() => setManual(true)}>{t('sensors.capture')}</button>} /></div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {FIELDS.filter((x) => sensor[x.key]).map((x) => (
                <button key={x.key} onClick={() => setChartField(x.key)} className={`rounded-2xl text-left ${chartField === x.key ? 'ring-2 ring-emerald-500' : ''}`}>
                  <StatGrid cols="grid-cols-1" items={[{
                    label: t(`sensors.fields.${x.key}`),
                    value: fmt.num(sensor[x.key].value, x.key === 'ph' ? 2 : 1),
                    unit: x.unit,
                    hint: `${sensor[x.key].source === 'manual' ? t('sensors.manualTag') : t('sensors.sensorTag')} · ${fmt.timeAgo(sensor[x.key].ts)}`
                  }]} />
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="text-sm font-extrabold">{t('sensors.history', { field: t(`sensors.fields.${chartField}`) })}</p>
                {chartData.length ? <TimeChart data={chartData} defaultRange={0} series={[{ key: 'value', name: `${t(`sensors.fields.${chartField}`)} ${meta.unit}`, color: meta.color, type: 'line' }]} /> : <p className="mt-3 text-sm text-slate-500">{t('sensors.noField')}</p>}
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <p className="font-extrabold">{t('sensors.trend')}</p>
                  <p className="mt-1 text-xs text-slate-600">{tr.slope === null ? t('sensors.trendNeed', { n: tr.n }) : t('sensors.trendValue', { slope: tr.slope > 0 ? `+${tr.slope}` : tr.slope, unit: meta.unit, r2: tr.r2, n: tr.n })}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-extrabold">{t('sensors.prediction')}</p>
                  {f.available ? (
                    <p className="mt-1 text-xs leading-relaxed">
                      {f.prediction.daysToIrrigate === 0
                        ? t('sensors.predNow', { vwc: f.vwc, trigger: f.triggerVwc })
                        : f.prediction.daysToIrrigate !== undefined
                          ? t('sensors.predDays', { trigger: f.triggerVwc, days: f.prediction.daysToIrrigate, basis: t(f.prediction.basisKey, f.prediction.basisVars) })
                          : t('sensors.predStable', { basis: t(f.prediction.basisKey, f.prediction.basisVars) })}
                      {f.savedMm ? t('sensors.predSaved', { mm: f.savedMm }) : ''}
                    </p>
                  ) : <p className="mt-1 text-xs">{t('sensors.predNeeds')}</p>}
                </div>
                <button className="btn-ghost w-full" onClick={() => downloadCsv(selected, readings)}><Download size={15} />{t('sensors.csv')}</button>
              </div>
            </div>
          </>
        )}
      </Card>

      {manualRows.length > 0 && (
        <Card className="p-6">
          <SectionTitle eyebrow={t('sensors.manualEyebrow')} title={t('sensors.manualTitle')} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-slate-500"><tr><th className="py-2">{t('common.date')}</th><th>{t('common.values')}</th><th>{t('common.notes')}</th><th /></tr></thead>
              <tbody>
                {manualRows.map((r) => (
                  <tr key={r.ts} className="border-t border-slate-100 align-top">
                    <td className="py-2 font-bold">{fmt.date(r.ts, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{FIELDS.filter((x) => r[x.key] !== undefined).map((x) => `${t(`sensors.fields.${x.key}`)}: ${r[x.key]}${x.unit ? ` ${x.unit}` : ''}`).join(' · ')}{r.texture ? ` · ${t('sensors.textureLab')}: ${r.texture}` : ''}</td>
                    <td className="text-slate-500">{r.notes}</td>
                    <td><button className="p-1 text-slate-400 hover:text-rose-600" aria-label={t('common.delete')} onClick={() => act(async () => { await repo.deleteReading(selected.id, r.ts); await data.reloadReadings(); })}><Trash2 size={14} /></button></td>
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
        <Modal title={t('sensors.removeTitle')} onClose={() => setConfirm(null)}>
          <p className="text-sm text-slate-600">{t('sensors.removeText', { name: confirm.name })}</p>
          <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</button><button className="btn-danger" onClick={() => act(async () => { await repo.deleteDevice(confirm.id); setConfirm(null); await refresh(); })}>{t('common.remove')}</button></div>
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
  a.download = `agrotopure-${parcel.name.replace(/\W+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function AddDevice({ parcel, onClose, onCreate }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', kind: 'esp32', intervalSec: 900 });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const every = [[300, '5 min'], [900, '15 min'], [1800, '30 min'], [3600, '1 h'], [10800, '3 h']];
  return (
    <Modal title={t('sensors.newDevice', { parcel: parcel.name })} onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await onCreate({ ...form, parcelId: parcel.id }); } catch (ex) { setErr(ex.message); } finally { setBusy(false); } }}>
        <label className="label">{t('sensors.deviceName')}<input className="input" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('sensors.deviceNamePh')} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">{t('sensors.deviceKind')}<select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="esp32">ESP32</option><option value="rpi">Raspberry Pi</option><option value="otro">{t('common.none')}</option></select></label>
          <label className="label">{t('sensors.sendEvery')}<select className="input" value={form.intervalSec} onChange={(e) => setForm({ ...form, intervalSec: Number(e.target.value) })}>{every.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={busy}>{busy ? t('sensors.creating') : t('sensors.create')}</button></div>
      </form>
    </Modal>
  );
}

function DeviceKey({ device, onClose }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState('');
  const endpoint = `${window.location.origin}/api/ingest`;
  const snippet = device.kind === 'rpi'
    ? `AGROTOPURE_URL=${endpoint}\nAGROTOPURE_DEVICE_ID=${device.id}\nAGROTOPURE_DEVICE_KEY=${device.key}\nAGROTOPURE_INTERVAL=${device.intervalSec}`
    : `const char* AGROTOPURE_URL = "${endpoint}";\nconst char* DEVICE_ID = "${device.id}";\nconst char* DEVICE_KEY = "${device.key}";\nconst uint32_t INTERVAL_SEC = ${device.intervalSec};`;
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setCopied(''); } };
  return (
    <Modal title={t('sensors.keyTitle')} onClose={onClose} wide>
      <Notice tone="warn" title={t('sensors.keyWarn')}>{t('sensors.keyWarnText')}</Notice>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3"><p className="label">{t('sensors.keyId')}</p><p className="mt-1 break-all font-mono text-sm font-bold">{device.id}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="label">{t('sensors.keyKey')}</p><p className="mt-1 break-all font-mono text-sm font-bold">{device.key}</p></div>
      </div>
      <p className="mt-4 text-sm font-extrabold">{device.kind === 'rpi' ? t('sensors.keyConfigRpi') : t('sensors.keyConfigEsp')}</p>
      <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-emerald-100">{snippet}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => copy(snippet, 'config')}><Copy size={15} />{copied === 'config' ? t('common.copied') : t('sensors.copyConfig')}</button>
        <button className="btn-ghost" onClick={() => copy(device.key, 'key')}><Copy size={15} />{copied === 'key' ? t('common.copied') : t('sensors.copyKey')}</button>
        <a className="btn-ghost" href={`https://github.com/dave13-bot/agrotopure/tree/main/firmware/${device.kind === 'rpi' ? 'raspberry-pi' : 'esp32'}`} target="_blank" rel="noreferrer">{t('sensors.firmwareLink')}</a>
      </div>
    </Modal>
  );
}

function ManualReading({ onClose, onSave }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ ts: new Date().toISOString().slice(0, 10), texture: '', notes: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => [['sensors.groupSensor', FIELDS.filter((x) => x.sensor)], ['sensors.groupLab', FIELDS.filter((x) => x.lab)]], []);
  return (
    <Modal title={t('sensors.manualTitleModal')} onClose={onClose} wide>
      <form className="space-y-5" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr('');
        const body = { ts: new Date(`${form.ts}T12:00:00`).toISOString(), texture: form.texture, notes: form.notes };
        for (const fd of FIELDS) if (form[fd.key] !== undefined && form[fd.key] !== '') body[fd.key] = Number(form[fd.key]);
        try { await onSave(body); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
      }}>
        <label className="label w-48">{t('common.date')}<input type="date" className="input" value={form.ts} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, ts: e.target.value })} required /></label>
        {groups.map(([title, list]) => (
          <fieldset key={title}>
            <legend className="text-sm font-extrabold">{t(title)}</legend>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {list.map((x) => (
                <label key={x.key} className="label normal-case tracking-normal">{t(`sensors.fields.${x.key}`)}{x.unit ? ` (${x.unit})` : ''}
                  <input type="number" step="any" inputMode="decimal" className="input" value={form[x.key] ?? ''} onChange={(e) => setForm({ ...form, [x.key]: e.target.value })} placeholder="—" />
                  {x.hint && <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{t(`sensors.hints.${x.key}`)}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">{t('sensors.textureLab')}<input className="input" maxLength={40} value={form.texture} onChange={(e) => setForm({ ...form, texture: e.target.value })} placeholder={t('sensors.texturePh')} /></label>
          <label className="label">{t('common.notes')}<input className="input" maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('sensors.notesPh')} /></label>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={busy}>{busy ? t('common.saving') : t('sensors.saveReading')}</button></div>
      </form>
    </Modal>
  );
}
