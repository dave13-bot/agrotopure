import { useMemo, useState } from 'react';
import { BookOpen, Droplets, FlaskConical, Search, Sprout, Thermometer, Timer, Waves } from 'lucide-react';
import { Badge, Card, Modal, SectionTitle, Spinner, Notice } from '../components/ui.jsx';
import { CATEGORIES, GUIDE_COUNT, PLANTS, SOURCES, norm } from '../data/plants.js';
import { MONTHS, compatibility, scoreColor } from '../lib/agro.js';
import { useParcelData } from '../lib/useParcelData.js';

export default function Plants({ repo, selected }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [mich, setMich] = useState(false);
  const [open, setOpen] = useState(null);
  const [evaluate, setEvaluate] = useState(false);
  const data = useParcelData(evaluate ? selected : null, repo, { readingsDays: 365 });
  const ctx = { months: data.months || [], ph: data.sensor?.ph?.value ?? null, ec: data.sensor?.ec?.value ?? null };
  const scores = useMemo(() => (evaluate && ctx.months.length === 12 ? Object.fromEntries(PLANTS.map((p) => [p.id, compatibility(p, ctx)])) : {}), [evaluate, ctx.months, ctx.ph, ctx.ec]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = PLANTS.filter((p) => (!cat || p.cat === cat) && (!mich || p.mich) && (!q || norm(`${p.name} ${p.sci} ${p.family}`).includes(norm(q))));
  const sorted = evaluate && Object.keys(scores).length ? [...list].sort((a, b) => (scores[b.id]?.score ?? -1) - (scores[a.id]?.score ?? -1)) : list;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionTitle eyebrow="Repositorio de plantas" title={`${PLANTS.length} cultivos: cuidados y condiciones`}
          text={`${GUIDE_COUNT} cultivos de la guía agronómica corregida (FAO 56, FAO 29, Kew) + ${PLANTS.length - GUIDE_COUNT} frutales y berries clave de Michoacán. Rangos orientativos: valida por variedad y localidad.`}
          action={selected && <button className={evaluate ? 'btn-soft' : 'btn-primary'} onClick={() => setEvaluate((v) => !v)}><Sprout size={15} />{evaluate ? 'Quitar evaluación' : `Evaluar en ${selected.name}`}</button>} />
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative"><span className="sr-only">Buscar cultivo</span><Search size={16} className="absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate-400" /><input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, especie o familia" /></label>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría"><option value="">Todas las categorías</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button onClick={() => setMich((v) => !v)} aria-pressed={mich} className={`btn mt-1 border ${mich ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Clave en Michoacán</button>
        </div>
        {evaluate && (data.climLoading ? <div className="mt-3"><Spinner label="Consultando climatología NASA de tu parcela…" /></div> : data.climError ? <div className="mt-3"><Notice tone="error">{data.climError}</Notice></div> : <p className="mt-3 text-xs text-slate-500">Ordenado por aptitud para <b>{selected?.name}</b> (climatología NASA POWER{ctx.ph !== null ? `, pH ${ctx.ph}` : ', sin pH medido'}).</p>)}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((p) => {
          const s = scores[p.id];
          return (
            <button key={p.id} onClick={() => setOpen(p)} className="card flex flex-col p-5 text-left transition hover:ring-2 hover:ring-emerald-200">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-base font-extrabold">{p.name}</p><p className="truncate text-[11px] italic text-slate-500">{p.sci}</p></div>
                {s ? <span className={`rounded-xl px-2 py-1 text-sm font-extrabold ${scoreColor(s.score)}`}>{s.score ?? '—'}</span> : null}
              </div>
              <p className="mt-1 text-[11px] font-bold text-emerald-700">{CATEGORIES[p.cat]}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <span className="rounded-lg bg-slate-50 px-2 py-1.5"><FlaskConical size={12} className="mr-1 inline" />pH {p.ph[0]}–{p.ph[1]}</span>
                <span className="rounded-lg bg-slate-50 px-2 py-1.5"><Thermometer size={12} className="mr-1 inline" />{p.temp[0]}–{p.temp[1]} °C</span>
                <span className="rounded-lg bg-slate-50 px-2 py-1.5"><Waves size={12} className="mr-1 inline" />{p.cee ? `CEe ${p.cee}` : 'CEe s/d'}</span>
                <span className="rounded-lg bg-slate-50 px-2 py-1.5"><Timer size={12} className="mr-1 inline" />{p.cycle ? `${p.cycle[0]}–${p.cycle[1]} d` : 'Perenne'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">{p.mich && <Badge>Michoacán</Badge>}{p.legumeN && <Badge tone="blue">Fija N</Badge>}{p.added && <Badge tone="slate">Agregado</Badge>}{p.approx && <Badge tone="amber">Rango general*</Badge>}</div>
            </button>
          );
        })}
      </div>
      {sorted.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">Ningún cultivo coincide con la búsqueda.</Card>}

      <Card className="p-6">
        <p className="flex items-center gap-2 text-sm font-extrabold"><BookOpen size={16} />Fuentes técnicas</p>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">{SOURCES.map((s) => <li key={s.id}>[{s.id}] {s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.text}</a> : s.text}</li>)}</ul>
        <p className="mt-3 text-[11px] text-slate-500">CEe = conductividad del extracto de saturación; el umbral indica dónde inicia la pérdida de rendimiento, no un valor óptimo. ETc = Kc × ETo.</p>
      </Card>

      {open && <PlantDetail plant={open} score={scores[open.id]} parcel={evaluate ? selected : null} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PlantDetail({ plant: p, score, parcel, onClose }) {
  const rows = [
    [FlaskConical, 'pH del suelo (orientativo)', `${p.ph[0]} – ${p.ph[1]}${p.approx ? ' *' : ''}`],
    [Thermometer, 'Temperatura (orientativa)', p.tempText || `${p.temp[0]} – ${p.temp[1]} °C`],
    [Timer, 'Ciclo', p.cycle ? `${p.cycle[0]} – ${p.cycle[1]} días (orientativo)` : 'Perenne'],
    [Waves, 'Salinidad (CEe)', p.salinity],
    [Droplets, 'Agua estacional', p.waterText]
  ];
  return (
    <Modal title={p.name} onClose={onClose} wide>
      <p className="-mt-3 text-sm italic text-slate-500">{p.sci} · {p.family} · {CATEGORIES[p.cat]}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(([Icon, l, v]) => <div key={l} className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Icon size={13} />{l}</p><p className="mt-1 text-sm">{v}</p></div>)}
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Rotación</p><p className="mt-1 text-sm">{p.legumeN ? 'Leguminosa: aporta nitrógeno al siguiente cultivo. ' : ''}{p.cover ? 'Útil como cobertura contra erosión. ' : ''}Evitar repetir la familia {p.family} en ciclos seguidos.</p></div>
      </div>
      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-800">Suelo y cuidados</p><p className="mt-1 text-sm text-emerald-950">{p.soil}</p><p className="mt-2 text-sm text-emerald-950"><b>Nota agronómica:</b> {p.notes}</p></div>
      {score && parcel && (
        <div className="mt-3 rounded-xl border border-slate-100 p-4">
          <p className="text-xs font-bold text-slate-500">Aptitud en {parcel.name}: <span className={`rounded-full px-2 py-0.5 ${scoreColor(score.score)}`}>{score.score ?? '—'}</span>{score.window?.start ? ` · siembra sugerida ${MONTHS[score.window.start - 1]}` : ''}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">{score.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {p.added && <p className="mt-3 text-[11px] text-amber-700">Registro agregado por AGROTOPURE (no forma parte de la guía de 68 cultivos); valida los rangos localmente.</p>}
    </Modal>
  );
}
