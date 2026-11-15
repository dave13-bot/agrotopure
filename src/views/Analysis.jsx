import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Info, Leaf, RefreshCw, Sprout, TriangleAlert } from 'lucide-react';
import { Badge, Card, Notice, SectionTitle, Spinner, Stat, fmt, fmtDate, timeAgo } from '../components/ui.jsx';
import { ParcelHeader, NoParcels } from '../components/ParcelPicker.jsx';
import { ClimateChart, PowerChart, SeriesChart } from '../components/Charts.jsx';
import ParcelMap from '../components/ParcelMap.jsx';
import { useParcelData } from '../lib/useParcelData.js';
import { MONTHS, PRIORITY_LABELS, compatibility, fusion, rankCrops, rotationStrategies, scoreColor, vulnerabilityCalendar } from '../lib/agro.js';
import { PLANTS, findPlantByName, plantById } from '../data/plants.js';

const KEY_CROPS = ['maiz', 'aguacate', 'fresa', 'zarzamora', 'frambuesa', 'arandano', 'trigo', 'tomate', 'chile', 'brocoli', 'lechuga', 'frijol'];

export default function Analysis({ repo, parcels, selected, setSelectedId, go, profile, setProfile }) {
  const data = useParcelData(selected, repo, { modis: true, readingsDays: 30 });
  if (!selected) return <NoParcels go={go} />;
  const L = data.latest || {};
  const crop = findPlantByName(selected.crop);
  const ph = data.sensor?.ph?.value ?? null;
  const ec = data.sensor?.ec?.value ?? null;
  const ctx = { months: data.months, ph, ec };
  const loadingAll = data.powerLoading || data.climLoading;

  return (
    <div className="space-y-6">
      <ParcelHeader eyebrow="Análisis de parcela" parcels={parcels} selected={selected} setSelectedId={setSelectedId} go={go}>
        <button className="btn-primary" onClick={data.reload} disabled={loadingAll}><RefreshCw size={15} className={loadingAll ? 'animate-spin' : ''} />Actualizar</button>
      </ParcelHeader>

      <FusionPanel data={data} parcel={selected} crop={crop} go={go} />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-7">
          <SectionTitle eyebrow="NASA POWER · comunidad AG" title="Clima y humedad de los últimos 60 días" />
          {data.powerLoading ? <div className="py-10"><Spinner label="Consultando NASA POWER…" /></div> : data.powerError ? <div className="mt-4"><Notice tone="error" title="NASA POWER no respondió">{data.powerError}</Notice></div> : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Temperatura" value={fmt(L.t2m?.value)} unit="°C" hint={`${fmt(L.tmin?.value) ?? '--'} / ${fmt(L.tmax?.value) ?? '--'} °C`} />
                <Stat label="Radiación solar" value={fmt(L.radMJ?.value)} unit="MJ/m²" hint="ALLSKY_SFC_SW_DWN" />
                <Stat label="ETo FAO-56" value={fmt(data.etoAvg7, 1)} unit="mm/día" hint="Penman-Monteith, últimos días" tone="text-amber-700" />
                <Stat label="Lluvia 30 días" value={fmt(data.precip30, 0)} unit="mm" hint="PRECTOTCORR" tone="text-sky-700" />
                <Stat label="Humedad relativa" value={fmt(L.rh?.value, 0)} unit="%" />
                <Stat label="Viento a 2 m" value={fmt(L.wind?.value, 1)} unit="m/s" />
                <Stat label="Temp. de superficie" value={fmt(L.ts?.value)} unit="°C" hint="TS (piel terrestre)" />
                <Stat label="Elevación" value={fmt(data.power?.elevationM, 0)} unit="m" hint="Reportada por NASA POWER" />
              </div>
              <div className="mt-5"><PowerChart daily={data.daily} /></div>
              <p className="mt-2 text-[11px] text-slate-500">NASA POWER publica con algunos días de retraso; último dato de humedad: {fmtDate(L.gwetroot?.date) || 'sin publicar'}. GWET es fracción de saturación del modelo MERRA-2 (≈ 50 km), no humedad volumétrica.</p>
            </>
          )}
        </Card>
        <Card className="p-6 lg:col-span-5">
          <SectionTitle eyebrow="MODIS · ORNL DAAC" title="Vigor y calor de superficie" />
          {data.modisLoading ? <div className="py-10"><Spinner label="Consultando MODIS…" /></div> : data.modisError ? <div className="mt-4"><Notice tone="warn" title="MODIS no respondió">{data.modisError}</Notice></div> : <ModisBlock modis={data.modisData} />}
          <div className="mt-5 overflow-hidden rounded-2xl"><ParcelMap parcels={[selected]} selectedId={selected.id} overlays={['ndvi']} height="h-[230px]" /></div>
        </Card>
      </div>

      <CompatibilitySection ctx={ctx} loading={data.climLoading} error={data.climError} crop={crop} go={go} />
      <CalendarSection months={data.months} loading={data.climLoading} error={data.climError} period={data.clim?.period} />
      <RotationSection ctx={ctx} crop={crop} profile={profile} setProfile={setProfile} repo={repo} loading={data.climLoading} />
    </div>
  );
}

function FusionPanel({ data, parcel, crop, go }) {
  const L = data.latest || {};
  const f = useMemo(() => fusion({ sensor: data.sensor || {}, nasa: { ...L, etoAvg7: data.etoAvg7 }, texture: parcel.soilTexture, crop, readings: data.readings || [] }), [data.sensor, data.readings, data.etoAvg7, parcel.soilTexture, crop, L]);
  const icon = { ok: CheckCircle2, alert: TriangleAlert, warn: TriangleAlert, info: Info };
  const tone = { ok: 'border-emerald-100 bg-emerald-50 text-emerald-900', alert: 'border-rose-200 bg-rose-50 text-rose-900', warn: 'border-amber-200 bg-amber-50 text-amber-900', info: 'border-sky-100 bg-sky-50 text-sky-900' };
  return (
    <section className="soil-gradient rounded-3xl p-6 text-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">Motor de fusión Δ</span>
          <h2 className="mt-2 text-xl font-extrabold">Satélite NASA vs. sensor a 25 cm</h2>
          <p className="text-xs text-emerald-100">Textura: {f.texture.label} · saturación típica {f.texture.sat}% · capacidad de campo {f.texture.fc}% · marchitez {f.texture.wp}%</p>
        </div>
        {!f.available && <button className="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-emerald-900" onClick={() => go('sensores')}>Agregar sensor o lectura</button>}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Dark label="Humedad 25 cm (sensor)" value={f.vwc} unit="%" sub={data.sensor?.moisture25 ? timeAgo(data.sensor.moisture25.ts) : 'sin lectura'} />
        <Dark label="Zona radicular NASA" value={L.gwetroot ? Math.round(L.gwetroot.value * 100) : null} unit="%" sub="GWETROOT · saturación" />
        <Dark label="Superficie NASA" value={L.gwettop ? Math.round(L.gwettop.value * 100) : null} unit="%" sub="GWETTOP · 0-5 cm" />
        <Dark label="Δ zona radicular" value={f.deltaRoot !== undefined ? `${f.deltaRoot > 0 ? '+' : ''}${f.deltaRoot}` : null} sub="sensor − satélite" />
        <Dark label="Próximo riego" value={f.prediction?.daysToIrrigate} unit="días" sub={f.prediction?.basis} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {f.insights.map((i) => {
          const I = icon[i.level];
          return <div key={i.title} className={`flex gap-3 rounded-2xl border p-4 text-sm ${tone[i.level]}`}><I size={18} className="mt-0.5 shrink-0" /><div><p className="font-extrabold">{i.title}</p><p className="mt-0.5 text-xs leading-relaxed">{i.text}</p></div></div>;
        })}
      </div>
      <p className="mt-3 text-[11px] text-emerald-100">{f.method.join(' ')} Umbral de riego = 50% del agua disponible (FAO-56). {f.deltaTemp !== undefined ? `Δ temperatura raíz vs. superficie NASA: ${f.deltaTemp} °C.` : ''}</p>
    </section>
  );
}

const Dark = ({ label, value, unit, sub }) => (
  <div className="rounded-2xl bg-white/10 p-3">
    <p className="text-[11px] font-semibold text-emerald-100">{label}</p>
    <p className="text-xl font-extrabold">{value ?? '--'}{value !== null && value !== undefined && unit && <span className="ml-1 text-xs font-bold text-emerald-100">{unit}</span>}</p>
    {sub && <p className="truncate text-[10px] text-emerald-100" title={sub}>{sub}</p>}
  </div>
);

function ModisBlock({ modis }) {
  const ndvi = (modis?.ndvi || []).filter((x) => x.value !== null);
  const lst = (modis?.lstDayC || []).filter((x) => x.value !== null);
  const last = ndvi[ndvi.length - 1];
  const state = !last ? null : last.value < 0.2 ? ['Suelo desnudo o muy poca vegetación', 'amber'] : last.value < 0.4 ? ['Vegetación escasa', 'amber'] : last.value < 0.6 ? ['Vegetación moderada', 'green'] : ['Vegetación densa', 'green'];
  const data = [...new Set([...ndvi, ...lst].map((x) => x.date))].sort().map((d) => ({ label: fmtDate(d), ndvi: ndvi.find((x) => x.date === d)?.value ?? null, lst: lst.find((x) => x.date === d)?.value ?? null }));
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="NDVI más reciente" value={last ? last.value.toFixed(2) : null} hint={last ? `MOD13Q1 · ${fmtDate(last.date)}` : 'sin compuesto válido'} />
        <Stat label="Temp. superficie diurna" value={lst.length ? lst[lst.length - 1].value : null} unit="°C" hint={lst.length ? `MOD11A2 · ${fmtDate(lst[lst.length - 1].date)}` : 'nubes o sin dato'} />
      </div>
      {state && <div className="mt-3"><Badge tone={state[1]}>{state[0]}</Badge></div>}
      {data.length > 1 && <div className="mt-3"><SeriesChart data={data} height={180} series={[{ key: 'ndvi', name: 'NDVI', color: '#176b40' }]} domain={[0, 1]} /></div>}
      {modis?.errors?.length > 0 && <p className="mt-2 text-[11px] text-amber-700">Parcial: {modis.errors.join(' · ')}</p>}
      <p className="mt-2 text-[11px] text-slate-500">Píxel de 250 m (NDVI) y 1 km (temperatura) que contiene el centroide de la parcela.</p>
    </div>
  );
}

function CompatibilitySection({ ctx, loading, error, crop, go }) {
  const [all, setAll] = useState(false);
  const key = useMemo(() => KEY_CROPS.map((id) => compatibility(plantById(id), ctx)), [ctx.months, ctx.ph, ctx.ec]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranking = useMemo(() => (all ? rankCrops(ctx) : []), [all, ctx.months, ctx.ph, ctx.ec]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card className="p-6">
      <SectionTitle eyebrow="Compatibilidad del terreno" title="Cultivos clave de Michoacán en esta parcela"
        text="Temperatura y lluvia de la climatología NASA POWER, pH y CE de tus sensores o análisis, contra los rangos de la guía de cultivos." />
      {loading ? <div className="py-8"><Spinner label="Consultando climatología NASA…" /></div> : error ? <div className="mt-4"><Notice tone="error" title="Climatología no disponible">{error}</Notice></div> : (
        <>
          {ctx.ph === null && <div className="mt-4"><Notice tone="info" title="Falta pH" action={<button className="btn-ghost" onClick={() => go('sensores')}>Capturar</button>}>El pH no se mide desde satélite. Agrega una lectura del sensor o de tu análisis de suelo para afinar la compatibilidad.</Notice></div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {key.map((r) => <CropScore key={r.plant.id} r={r} current={crop?.id === r.plant.id} />)}
          </div>
          <button className="btn-ghost mt-4" onClick={() => setAll((v) => !v)}>{all ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{all ? 'Ocultar' : `Ver los ${PLANTS.length} cultivos ordenados`}</button>
          {all && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="text-slate-500"><tr><th className="py-2">Cultivo</th><th>Aptitud</th><th>Siembra sugerida</th><th>Riego estimado</th><th>Detalle</th></tr></thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr key={r.plant.id} className="border-t border-slate-100">
                      <td className="py-2 font-bold">{r.plant.name}</td>
                      <td><span className={`rounded-full px-2 py-0.5 font-bold ${scoreColor(r.score)}`}>{r.score ?? '—'}</span></td>
                      <td>{r.plant.perennial ? 'Perenne' : r.window?.start ? MONTHS[r.window.start - 1] : '—'}</td>
                      <td>{r.window?.irrigationMm !== undefined ? `${r.window.irrigationMm} mm` : '—'}</td>
                      <td className="max-w-xs truncate text-slate-500" title={r.reasons.join(' ')}>{r.reasons[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function CropScore({ r, current }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border p-4 ${current ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-sm font-extrabold">{r.plant.name}</p><p className="text-[11px] italic text-slate-500">{r.plant.sci}</p></div>
        <span className={`rounded-xl px-2.5 py-1 text-sm font-extrabold ${scoreColor(r.score)}`}>{r.score ?? '—'}</span>
      </div>
      <p className="mt-2 text-xs text-slate-600">{r.plant.perennial ? 'Cultivo perenne' : r.window?.start ? `Siembra: ${MONTHS[r.window.start - 1]} · riego ~${r.window.irrigationMm ?? 0} mm` : 'Sin ventana térmica'}</p>
      <div className="mt-2 flex flex-wrap gap-1">{current && <Badge>Cultivo actual</Badge>}{r.plant.added && <Badge tone="slate">Agregado</Badge>}<Badge tone="slate">Confianza {Math.round(r.confidence * 100)}%</Badge></div>
      <button className="mt-2 text-[11px] font-bold text-emerald-700" onClick={() => setOpen((v) => !v)}>{open ? 'Ocultar motivos' : 'Ver motivos'}</button>
      {open && <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-slate-600">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}
    </div>
  );
}

function CalendarSection({ months, loading, error, period }) {
  const cal = useMemo(() => vulnerabilityCalendar(months), [months]);
  const [sel, setSel] = useState(new Date().getMonth());
  if (loading || error || months.length !== 12) return null;
  const color = ['bg-emerald-100 text-emerald-900', 'bg-amber-100 text-amber-900', 'bg-rose-200 text-rose-900'];
  const m = cal[sel];
  return (
    <Card className="p-6">
      <SectionTitle eyebrow="Calendario anual" title="Vulnerabilidad del suelo mes a mes" text={`Climatología NASA POWER${period ? ` (${period})` : ''}: lluvia, ETo, heladas y calor.`} />
      <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12">
        {cal.map((c, i) => (
          <button key={c.month} onClick={() => setSel(i)} aria-pressed={sel === i} className={`rounded-xl py-3 text-center text-xs font-extrabold transition ${color[c.level]} ${sel === i ? 'ring-2 ring-emerald-700 ring-offset-1' : ''}`}>
            {c.label}<span className="mt-1 block text-[10px] font-semibold">{['Bajo', 'Medio', 'Alto'][c.level]}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4 text-sm">
          <p className="font-extrabold">{MONTHS[sel]} · riesgo {['bajo', 'medio', 'alto'][m.level]}</p>
          <p className="mt-1 text-xs text-slate-600">Lluvia normal {months[sel].precip ?? '--'} mm · ETo {months[sel].eto ?? '--'} mm · balance {months[sel].balance ?? '--'} mm · T {fmt(months[sel].tmin) ?? '--'}–{fmt(months[sel].tmax) ?? '--'} °C</p>
          {m.risks.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">{m.risks.map((r) => <li key={r.id}>{r.text}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-800">Sin riesgos climáticos relevantes.</p>}
          {m.advice.length > 0 && <p className="mt-2 text-xs font-bold text-emerald-800">{m.advice.join(' ')}</p>}
        </div>
        <ClimateChart months={months} />
      </div>
    </Card>
  );
}

function RotationSection({ ctx, crop, profile, setProfile, repo, loading }) {
  const [priorities, setPriorities] = useState(profile.priorities || []);
  const [saving, setSaving] = useState(false);
  const strategies = useMemo(() => (ctx.months.length === 12 ? rotationStrategies(ctx, crop, priorities) : []), [ctx.months, ctx.ph, ctx.ec, crop, priorities]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading || !strategies.length) return null;
  const toggle = async (k) => {
    const next = priorities.includes(k) ? priorities.filter((x) => x !== k) : [...priorities, k];
    setPriorities(next);
    setSaving(true);
    try { setProfile(await repo.saveProfile({ ...profile, priorities: next })); } catch { /* se mantiene local */ } finally { setSaving(false); }
  };
  return (
    <Card className="p-6">
      <SectionTitle eyebrow="Rotación de cultivos" title="Tres estrategias comparadas" text={`Ciclo primavera-verano (jun-oct) y otoño-invierno (nov-may) a partir de ${crop ? crop.name : 'el mejor cereal para tu parcela'}. Tus prioridades pesan doble.`} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => toggle(k)} aria-pressed={priorities.includes(k)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${priorities.includes(k) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 text-slate-600'}`}>{v}</button>
        ))}
        {saving && <Spinner />}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {strategies.map((s) => (
          <div key={s.id} className={`flex flex-col rounded-2xl border p-5 ${s.recommended ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-slate-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <div><p className="text-[11px] font-extrabold text-slate-400">Estrategia {s.id}</p><h3 className="text-base font-extrabold">{s.name}</h3></div>
              <span className={`rounded-xl px-2.5 py-1 text-lg font-extrabold ${scoreColor(s.score)}`}>{s.score}</span>
            </div>
            {s.recommended && <div className="mt-2"><Badge><Sprout size={12} />Recomendada</Badge></div>}
            <ol className="mt-3 space-y-2">
              {s.seq.map((c, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs">
                  <Leaf size={14} className="shrink-0 text-emerald-700" />
                  <span className="font-bold">{c.plant.name}</span>
                  <span className="ml-auto text-slate-500">{c.plant.perennial ? 'todo el año' : c.window?.start ? `siembra ${MONTHS[c.window.start - 1]}` : ''}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-slate-600">{s.note}</p>
            <div className="mt-3 space-y-1.5">
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <div key={k} className="text-[11px]">
                  <div className="flex justify-between"><span className={priorities.includes(k) ? 'font-extrabold' : 'text-slate-500'}>{v}</span><span>{Math.round(s.metrics[k] * 100)}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${Math.round(s.metrics[k] * 100)}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Riego estimado sobre la lluvia normal: <b>{s.metrics.irrigationMm} mm</b> ({s.metrics.irrigationMm * 10} m³/ha)</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-slate-500">Puntajes orientativos calculados con climatología NASA POWER y la guía de cultivos; valida fechas, variedad y mercado con un técnico local.</p>
    </Card>
  );
}
