import { useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, CircleAlert, CircleCheck } from 'lucide-react';
import { useFmt } from './ui.jsx';
import { useI18n } from '../lib/i18n.js';
import { localized } from '../data/plants.js';

const doyIso = (doy) => new Date(Date.UTC(2025, 0, 1) + (((Math.round(doy) - 1) % 365 + 365) % 365) * 864e5).toISOString().slice(0, 10);

/** Calendario de una estrategia: siembra, cosecha, días libres entre cultivos, y el porqué y el cómo. */
export default function RotationPlan({ plan, open: initial }) {
  const { t, locale } = useI18n();
  const fmt = useFmt();
  const [open, setOpen] = useState(Boolean(initial));
  if (!plan) return null;
  const day = (doy) => fmt.date(doyIso(doy));
  const msg = (m) => {
    const v = { ...(m.vars || {}) };
    if (v.monthKey) v.month = t(`months.${v.monthKey}`);
    if (v.sowDoy) v.sow = day(v.sowDoy);
    if (v.h1Doy) { v.h1 = day(v.h1Doy); v.h2 = day(v.h2Doy); }
    return t(m.key, v);
  };
  const name = (p) => localized(p, locale).name.split(' / ')[0];
  return (
    <div className="mt-3 rounded-2xl border border-slate-100">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-extrabold text-navy">
        <span className="flex items-center gap-2"><CalendarClock size={15} />{t('plan.title')}</span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      <div className="space-y-1.5 px-3.5 pb-3">
        {plan.steps.filter((s) => s.next).map((s, i) => (
          <p key={i} className={`flex items-start gap-1.5 text-[11px] leading-snug ${s.next.ok ? 'text-slate-600' : 'font-bold text-rose-700'}`}>
            {s.next.ok ? <CircleCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" /> : <CircleAlert size={13} className="mt-0.5 shrink-0" />}
            <span>
              <b>{name(s.plant)}</b>: {t('plan.sow').toLowerCase()} {day(s.sowDoy)} → {t('plan.harvest').toLowerCase()} {day(s.harvestDoy[0])}–{day(s.harvestDoy[1])}. {s.next.overlapDays
                ? t('plan.overlap', { days: s.next.overlapDays, crop: name(s.next.plant) })
                : t(s.next.plant === s.plant ? 'plan.gapSelf' : 'plan.gap', { gap: s.next.gapDays, crop: name(s.next.plant), min: s.next.minDays })}
            </span>
          </p>
        ))}
        {plan.freeDays !== null && <p className="text-[11px] text-slate-500">{t('plan.summary', { occupied: plan.occupiedDays, free: plan.freeDays })}</p>}
      </div>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-3.5 py-3">
          {plan.steps.map((s, i) => (
            <div key={i}>
              <p className="text-xs font-extrabold text-ink">{name(s.plant)}{s.cycle ? <span className="font-normal text-slate-500"> · {t('plan.cycle', { a: s.cycle[0], b: s.cycle[1] })}</span> : null}</p>
              {s.why.length > 0 && <>
                <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">{t('plan.why')}</p>
                <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-slate-600">{s.why.map((w, k) => <li key={k}>{msg(w)}</li>)}</ul>
              </>}
              {s.how.length > 0 && <>
                <p className="mt-1.5 text-[10px] font-extrabold uppercase tracking-wide text-navy">{t('plan.how')}</p>
                <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-slate-600">{s.how.map((w, k) => <li key={k}>{msg(w)}</li>)}</ul>
              </>}
            </div>
          ))}
          {plan.families.length > 0 && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{t('plan.returnTitle')}</p>
              <ul className="mt-0.5 space-y-0.5 text-[11px] leading-relaxed">
                {plan.families.map((f) => <li key={f.family} className={f.ok ? 'text-slate-600' : 'text-amber-700'}>{t(f.ok ? 'plan.familyOk' : 'plan.familyShort', { family: f.family, months: f.months, rec: f.recommended })}</li>)}
              </ul>
            </div>
          )}
          <p className="text-[10px] leading-relaxed text-slate-400">{t('plan.note')}</p>
        </div>
      )}
    </div>
  );
}
