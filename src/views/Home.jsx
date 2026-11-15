import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CloudRain, Cpu, Droplets, Gauge, LineChart, Map as MapIcon, Plus, Search, Thermometer, Wind } from 'lucide-react';
import { Badge, Card, Empty, Notice, Spinner, fmt, fmtDate, timeAgo } from '../components/ui.jsx';
import ParcelShape from '../components/ParcelShape.jsx';
import { useParcelData } from '../lib/useParcelData.js';
import { fusion } from '../lib/agro.js';
import { findPlantByName } from '../data/plants.js';
import { formatHa } from '../lib/geo.js';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };

export default function Home({ profile, parcels, devices, selected, setSelectedId, go, repo }) {
  const [q, setQ] = useState('');
  const data = useParcelData(selected, repo, { climatology: false, readingsDays: 7 });
  const filtered = parcels.filter((p) => `${p.name} ${p.crop}`.toLowerCase().includes(q.toLowerCase()));
  const L = data.latest || {};
  const f = useMemo(() => (selected ? fusion({ sensor: data.sensor || {}, nasa: { ...L, etoAvg7: data.etoAvg7 }, texture: selected.soilTexture, crop: findPlantByName(selected.crop), readings: data.readings || [] }) : null), [selected, data.sensor, data.readings, data.etoAvg7, L]);
  const devCount = devices.filter((d) => d.parcelId === selected?.id).length;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section className="brand-gradient space-y-5 rounded-3xl p-6 text-white shadow-card lg:col-span-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{greeting()}, {profile.name.split(' ')[0]}</h1>
            <p className="mt-0.5 text-xs font-medium text-emerald-200">{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{profile.region ? ` · ${profile.region}` : ''}</p>
          </div>
        </div>
        <label className="relative block">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-100" />
          <span className="sr-only">Buscar parcela</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar parcela o cultivo…" className="w-full rounded-2xl border border-white/20 bg-white/10 py-3 pl-11 pr-4 text-sm text-white placeholder-emerald-100 outline-none focus:border-white/50" />
        </label>

        <div className="rounded-2xl bg-white p-5 text-ink shadow-md">
          {!selected ? (
            <p className="text-sm text-slate-600">Registra una parcela para ver su clima con datos de NASA POWER.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-emerald-800">📍 {selected.name}{selected.crop ? ` · ${selected.crop}` : ''}</p>
                <Badge>NASA POWER</Badge>
              </div>
              {data.powerLoading ? <div className="py-6"><Spinner label="Consultando NASA POWER…" /></div> : data.powerError ? (
                <p className="mt-3 text-sm text-rose-700">No se pudo consultar NASA POWER: {data.powerError}</p>
              ) : (
                <>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-5xl font-extrabold tracking-tight">{fmt(L.t2m?.value, 0) ?? '--'}°</span>
                      <span className="mt-1 text-xs text-slate-500">Máx {fmt(L.tmax?.value, 0) ?? '--'}°<br />Mín {fmt(L.tmin?.value, 0) ?? '--'}°</span>
                    </div>
                    <p className="text-right text-[11px] text-slate-500">Último día publicado<br /><b className="text-slate-700">{fmtDate(L.t2m?.date, { day: 'numeric', month: 'long' })}</b></p>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 border-t border-slate-100 pt-3 text-center">
                    {[[Droplets, 'Humedad', fmt(L.rh?.value, 0), '%'], [CloudRain, 'Lluvia', fmt(L.precip?.value, 1), 'mm'], [Gauge, 'Presión', fmt(L.ps?.value, 1), 'kPa'], [Wind, 'Viento', fmt(L.wind?.value, 1), 'm/s']].map(([Icon, l, v, u]) => (
                      <div key={l}><Icon size={14} className="mx-auto text-slate-400" /><p className="text-[10px] text-slate-500">{l}</p><p className="text-xs font-extrabold">{v ?? '--'} <span className="font-semibold text-slate-500">{u}</span></p></div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500">Lluvia acumulada 30 días: <b>{fmt(data.precip30, 0) ?? '--'} mm</b> · ETo media reciente: <b>{fmt(data.etoAvg7, 1) ?? '--'} mm/día</b> (Penman-Monteith FAO-56)</p>
                </>
              )}
            </>
          )}
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-200">Accesos</p>
          <div className="grid grid-cols-4 gap-2.5">
            {[[MapIcon, 'Parcelas', 'parcelas'], [LineChart, 'Análisis', 'analisis'], [Cpu, 'Sensores', 'sensores'], [BookOpen, 'Plantas', 'plantas']].map(([Icon, l, v]) => (
              <button key={v} onClick={() => go(v)} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/15 bg-white/15 p-3 text-[11px] font-bold transition hover:bg-white/25"><Icon size={20} />{l}</button>
            ))}
          </div>
        </div>
        <button onClick={() => go('parcelas', 'nueva')} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-extrabold text-emerald-900 shadow-md hover:bg-emerald-50"><Plus size={18} />Registrar parcela</button>
      </section>

      <section className="space-y-6 lg:col-span-7">
        {selected && f && (
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Motor de fusión Δ · {selected.name}</p>
                <h2 className="mt-1 text-lg font-extrabold">{f.available ? f.insights[0]?.title : 'Conecta un sensor para activar el Δ'}</h2>
              </div>
              <button onClick={() => go('analisis')} className="btn-soft">Ver análisis<ArrowRight size={15} /></button>
            </div>
            <p className="mt-2 text-sm text-slate-600">{f.available ? f.insights[0]?.text : `Esta parcela tiene ${devCount} dispositivo(s). Agrega un ESP32/Raspberry Pi o captura una lectura manual de humedad a 25 cm.`}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini label="Humedad 25 cm" value={f.vwc} unit="%" sub={data.sensor?.moisture25 ? timeAgo(data.sensor.moisture25.ts) : 'sensor'} />
              <Mini label="Zona radicular NASA" value={L.gwetroot ? Math.round(L.gwetroot.value * 100) : null} unit="%" sub="GWETROOT (saturación)" />
              <Mini label="Δ radicular" value={f.deltaRoot !== undefined ? (f.deltaRoot > 0 ? '+' : '') + f.deltaRoot : null} sub="sensor − satélite" />
              <Mini label="Regar en" value={f.prediction?.daysToIrrigate} unit="días" sub={f.prediction?.basis} />
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="eyebrow">Tus parcelas</p><h2 className="mt-0.5 text-xl font-extrabold">Monitoreo por parcela</h2></div>
            <button onClick={() => go('parcelas')} className="btn-soft">Administrar<ArrowRight size={15} /></button>
          </div>
          {parcels.length === 0 ? (
            <div className="mt-4"><Empty icon={MapIcon} title="Aún no tienes parcelas" text="Dibuja tu terreno en el mapa o escribe las coordenadas de cada esquina." action={<button className="btn-primary" onClick={() => go('parcelas', 'nueva')}><Plus size={16} />Registrar parcela</button>} /></div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => setSelectedId(p.id)} className={`overflow-hidden rounded-2xl border text-left transition ${p.id === selected?.id ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-slate-100 hover:border-emerald-200'}`}>
                  <div className="relative h-28 soil-gradient">
                    <ParcelShape coordinates={p.coordinates} className="h-full w-full" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white">{formatHa(p.areaHa)} ha</span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-extrabold">{p.name}</p>
                    <p className="text-[11px] text-slate-500">{fmt(p.centroid.lat, 4)}, {fmt(p.centroid.lon, 4)}</p>
                    <p className="mt-1 text-xs font-bold text-emerald-700">{p.crop ? `Cultivo: ${p.crop}` : 'Sin cultivo registrado'}</p>
                  </div>
                </button>
              ))}
              {!filtered.length && <p className="text-sm text-slate-500">Ninguna parcela coincide con “{q}”.</p>}
            </div>
          )}
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Source title="🛰️ NASA POWER" text="Clima diario, radiación, humedad de suelo modelada (GWET) y climatología de largo plazo." />
          <Source title="🌱 MODIS · SMAP · ECOSTRESS" text="NDVI y temperatura de superficie (ORNL DAAC) y capas de humedad y calor en el mapa (GIBS)." />
          <Source title="📡 Sensores de piso" text="ESP32 o Raspberry Pi: humedad a 25 cm, temperatura radicular, pH y CE." />
        </div>
        {repo.mode === 'local' && parcels.length > 0 && <Notice tone="info">Los datos de esta sesión viven en este navegador.</Notice>}
      </section>
    </div>
  );
}

const Mini = ({ label, value, unit, sub }) => (
  <div className="rounded-2xl bg-slate-50 p-3">
    <p className="text-[11px] font-semibold text-slate-500">{label}</p>
    <p className={`text-lg font-extrabold ${value === null || value === undefined ? 'text-slate-300' : ''}`}>{value ?? '--'}{value !== null && value !== undefined && unit && <span className="ml-1 text-xs text-slate-500">{unit}</span>}</p>
    {sub && <p className="truncate text-[10px] text-slate-500" title={sub}>{sub}</p>}
  </div>
);
const Source = ({ title, text }) => <div className="card p-4"><p className="text-sm font-extrabold text-emerald-800">{title}</p><p className="mt-1 text-xs leading-relaxed text-slate-600">{text}</p></div>;
