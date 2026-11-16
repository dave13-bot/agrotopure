import { useMemo, useState } from 'react';
import { BookOpen, Droplets, FlaskConical, Search, Sprout, Thermometer, Timer, Waves } from 'lucide-react';
import { Badge, Card, Modal, Notice, SectionTitle, Spinner, useMsg } from '../components/ui.jsx';
import { useI18n } from '../lib/i18n.js';
import { CATEGORIES, GUIDE_COUNT, PLANTS, categoryLabel, localizedPlants, localizedSources, norm } from '../data/plants.js';
import { compatibility, scoreColor } from '../lib/agro.js';
import { useParcelData } from '../lib/useParcelData.js';

export default function Plants({ repo, selected, fine }) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [mich, setMich] = useState(false);
  const [open, setOpen] = useState(null);
  const [evaluate, setEvaluate] = useState(false);
  const data = useParcelData(evaluate ? selected : null, repo, { readingsDays: 365, readings: fine });
  const ph = fine ? data.sensor?.ph?.value ?? null : null;
  const ctx = { months: data.months || [], ph, ec: fine ? data.sensor?.ec?.value ?? null : null };
  const all = useMemo(() => localizedPlants(locale), [locale]);
  const scores = useMemo(() => (evaluate && ctx.months.length === 12 ? Object.fromEntries(all.map((p) => [p.id, compatibility(p, ctx)])) : {}), [evaluate, ctx.months, ctx.ph, ctx.ec, all]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = all.filter((p) => (!cat || p.cat === cat) && (!mich || p.mich) && (!q || norm(`${p.name} ${p.sci} ${p.family}`).includes(norm(q))));
  const sorted = evaluate && Object.keys(scores).length ? [...list].sort((a, b) => (scores[b.id]?.score ?? -1) - (scores[a.id]?.score ?? -1)) : list;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionTitle eyebrow={t('plants.eyebrow')} title={t('plants.title', { n: PLANTS.length })}
          text={t('plants.lead', { guide: GUIDE_COUNT, added: PLANTS.length - GUIDE_COUNT })}
          action={selected && <button className={evaluate ? 'btn-soft' : 'btn-primary'} onClick={() => setEvaluate((v) => !v)}><Sprout size={15} />{evaluate ? t('plants.evaluateOff') : t('plants.evaluate', { parcel: selected.name })}</button>} />
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative"><span className="sr-only">{t('common.search')}</span><Search size={16} className="absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate-400" /><input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('plants.searchPh')} /></label>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('plants.allCategories')}>
            <option value="">{t('plants.allCategories')}</option>
            {Object.keys(CATEGORIES).map((k) => <option key={k} value={k}>{categoryLabel(k, locale)}</option>)}
          </select>
          <button onClick={() => setMich((v) => !v)} aria-pressed={mich} className={`btn mt-1 border ${mich ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{t('plants.michoacan')}</button>
        </div>
        {evaluate && (data.climLoading
          ? <div className="mt-3"><Spinner label="NASA POWER…" /></div>
          : data.climError ? <div className="mt-3"><Notice tone="error">{data.climError}</Notice></div>
            : <p className="mt-3 text-xs text-slate-500">{t('plants.evaluating', { parcel: selected?.name, ph: ph !== null ? t('plants.withPh', { n: ph }) : t('plants.withoutPh') })}</p>)}
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
              <p className="mt-1 text-[11px] font-bold text-emerald-700">{categoryLabel(p.cat, locale)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <span className="rounded-lg bg-slate-50 px-2 py-1.5"><FlaskConical size={12} className="mr-1 inline" />pH {p.ph[0]}–{p.ph[1]}</span>
                <span className="rounded-lg bg-slate-50 px-2 py-1.5"><Thermometer size={12} className="mr-1 inline" />{p.temp[0]}–{p.temp[1]} °C</span>
                <span className="rounded-lg bg-slate-50 px-2 py-1.5"><Waves size={12} className="mr-1 inline" />{p.cee ? `${p.cee} dS/m` : t('plants.noCee')}</span>
                <span className="rounded-lg bg-slate-50 px-2 py-1.5"><Timer size={12} className="mr-1 inline" />{p.cycle ? `${p.cycle[0]}–${p.cycle[1]} d` : t('analysis.perennial')}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {p.mich && <Badge>Michoacán</Badge>}
                {p.legumeN && <Badge tone="blue">{t('plants.fixesNTag')}</Badge>}
                {p.added && <Badge tone="slate">{t('analysis.added')}</Badge>}
                {p.approx && <Badge tone="amber">{t('plants.generalRange')}</Badge>}
              </div>
            </button>
          );
        })}
      </div>
      {sorted.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">{t('plants.noMatch')}</Card>}

      <Card className="p-6">
        <p className="flex items-center gap-2 text-sm font-extrabold"><BookOpen size={16} />{t('plants.sourcesTitle')}</p>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">{localizedSources(locale).map((s) => <li key={s.id}>[{s.id}] {s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.text}</a> : s.text}</li>)}</ul>
        <p className="mt-3 text-[11px] text-slate-500">{t('plants.sourcesNote')}</p>
      </Card>

      {open && <PlantDetail plant={open} score={scores[open.id]} parcel={evaluate ? selected : null} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PlantDetail({ plant: p, score, parcel, onClose }) {
  const { t, locale } = useI18n();
  const msg = useMsg();
  const rows = [
    [FlaskConical, t('plants.ph'), `${p.ph[0]} – ${p.ph[1]}${p.approx ? ' *' : ''}`],
    [Thermometer, t('plants.temp'), p.tempText || `${p.temp[0]} – ${p.temp[1]} °C`],
    [Timer, t('plants.cycle'), p.cycle ? t('plants.cycleDays', { a: p.cycle[0], b: p.cycle[1] }) : t('analysis.perennial')],
    [Waves, t('plants.salinity'), p.salinity],
    [Droplets, t('plants.water'), p.waterText]
  ];
  return (
    <Modal title={p.name} onClose={onClose} wide>
      <p className="-mt-3 text-sm italic text-slate-500">{p.sci} · {p.family} · {categoryLabel(p.cat, locale)}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(([Icon, l, v]) => <div key={l} className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Icon size={13} />{l}</p><p className="mt-1 text-sm">{v}</p></div>)}
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{t('plants.rotation')}</p><p className="mt-1 text-sm">{p.legumeN ? t('plants.fixesN') : ''}{p.cover ? t('plants.coverUse') : ''}{t('plants.avoidFamily', { family: p.family })}</p></div>
      </div>
      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-xs font-bold text-emerald-800">{t('plants.soilCare')}</p>
        <p className="mt-1 text-sm text-emerald-950">{p.soil}</p>
        <p className="mt-2 text-sm text-emerald-950"><b>{t('plants.agroNote')}:</b> {p.notes}</p>
      </div>
      {score && parcel && (
        <div className="mt-3 rounded-xl border border-slate-100 p-4">
          <p className="text-xs font-bold text-slate-500">{t('plants.fitnessIn', { parcel: parcel.name })}: <span className={`rounded-full px-2 py-0.5 ${scoreColor(score.score)}`}>{score.score ?? '—'}</span>{score.window?.start ? ` · ${t('analysis.sowIn', { month: t(`months.${score.window.start}`) })}` : ''}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">{score.reasons.map((r, i) => <li key={i}>{msg(r)}</li>)}</ul>
        </div>
      )}
      {p.added && <p className="mt-3 text-[11px] text-amber-700">{t('plants.addedNote')}</p>}
    </Modal>
  );
}
