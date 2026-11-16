import { HeartPulse, Pencil } from 'lucide-react';
import { Badge, Notice, Spinner, StatGrid, useFmt } from './ui.jsx';
import { TimeChart } from './Charts.jsx';
import { useI18n } from '../lib/i18n.js';

const TONE = {
  healthy: { badge: 'green', box: 'border-emerald-200 bg-emerald-50 text-emerald-900', bar: 'bg-emerald-600' },
  watch: { badge: 'amber', box: 'border-amber-200 bg-amber-50 text-amber-900', bar: 'bg-amber-500' },
  stress: { badge: 'red', box: 'border-rose-200 bg-rose-50 text-rose-900', bar: 'bg-rose-600' },
  idle: { badge: 'slate', box: 'border-slate-200 bg-slate-50 text-slate-700', bar: 'bg-slate-400' },
  unknown: { badge: 'slate', box: 'border-slate-200 bg-slate-50 text-slate-700', bar: 'bg-slate-400' }
};

/** Salud del cultivo: NDVI observado por MODIS frente al esperado para el cultivo y su etapa. */
export default function HealthCard({ health, modis, crop, loading, error, onEdit }) {
  const { t } = useI18n();
  const fmt = useFmt();
  if (loading) return <div className="py-10"><Spinner label="MODIS…" /></div>;
  if (error) return <div className="mt-4"><Notice tone="warn" title={t('analysis.modisError')}>{error}</Notice></div>;
  const h = health || { status: 'unknown', reason: 'noData' };
  const tone = TONE[h.status] || TONE.unknown;
  const ndvi = (modis?.ndvi || []).filter((x) => x.value !== null);
  const lst = (modis?.lstDayC || []).filter((x) => x.value !== null);
  const rows = ndvi.map((x) => ({ date: x.date, ndvi: x.value, lo: h.expected?.[0] ?? null, hi: h.expected?.[1] ?? null }));
  const signed = (v) => (v === null || v === undefined ? null : `${v > 0 ? '−' : v < 0 ? '+' : ''}${Math.abs(v).toFixed(2)}`);
  const statusText = h.status === 'unknown' ? t(`health.statusText.${h.reason || 'noData'}`) : t(`health.statusText.${h.status}`);
  const series = [{ key: 'ndvi', name: t('chart.ndvi'), color: '#176b40', type: 'line' }];
  if (h.expected) series.push({ key: 'lo', name: `${t('health.expected')} (min)`, color: '#d4af5a', type: 'line' }, { key: 'hi', name: `${t('health.expected')} (max)`, color: '#0f2a4a', type: 'line' });
  return (
    <div className="mt-4">
      <div className={`rounded-2xl border p-4 ${tone.box}`}>
        <div className="flex flex-wrap items-center gap-2">
          <HeartPulse size={18} />
          <p className="text-base font-extrabold">{t(`health.status.${h.status}`)}</p>
          {h.score !== null && h.score !== undefined && <Badge tone={tone.badge}>{t('health.score')}: {h.score}/100</Badge>}
        </div>
        <p className="mt-1 text-xs leading-relaxed">{statusText}</p>
        {h.score !== null && h.score !== undefined && <div className="mt-3 h-2 rounded-full bg-white/70"><div className={`h-2 rounded-full ${tone.bar}`} style={{ width: `${h.score}%` }} /></div>}
      </div>

      <div className="mt-3">
        <StatGrid cols="grid-cols-2" items={[
          { label: t('health.observed'), value: h.ndvi !== undefined ? h.ndvi.toFixed(2) : null, hint: h.date ? `MOD13Q1 · ${fmt.date(h.date)}` : null },
          { label: t('health.expected'), value: h.expected ? `${h.expected[0].toFixed(2)}–${h.expected[1].toFixed(2)}` : null, hint: h.stage ? t(`health.stage.${h.stage}`, { d: h.stageDays, c: h.cycleDays }) : null },
          { label: t('health.change16'), value: signed(h.drop), hint: h.prev ? fmt.date(h.prev.date) : null },
          { label: t('analysis.lstDay'), value: lst.length ? fmt.num(lst[lst.length - 1].value, 1) : null, unit: '°C', hint: lst.length ? `MOD11A2 · ${fmt.date(lst[lst.length - 1].date)}` : null }
        ]} />
      </div>

      {h.causes?.length > 0 && (
        <div className="mt-3 rounded-2xl border border-slate-100 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{t('health.causesTitle')}</p>
          <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-slate-700">
            {h.causes.map((c) => <li key={c.id}>{t(`health.cause.${c.id}`, c.vars)}</li>)}
          </ul>
        </div>
      )}

      {rows.length > 1 && <div className="mt-3"><TimeChart data={rows} height={180} brush={false} defaultRange={0} series={series} yDomain={[0, 1]} /></div>}

      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
        {t(`health.basis.${h.basis || 'trend'}`, { crop: crop?.name })}
        {h.marginal ? ` ${t('health.marginal')}` : ''}{h.cloudy ? ` ${t('health.cloudySkipped', { n: h.cloudy })}` : ''}
      </p>
      {(h.basis || 'trend') === 'trend' && onEdit && <button type="button" className="btn-soft mt-2" onClick={onEdit}><Pencil size={14} />{t('health.addCrop')}</button>}
      {modis?.errors?.length > 0 && <p className="mt-2 text-[11px] text-amber-700">{modis.errors.join(' · ')}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t('health.caveat')}</p>
    </div>
  );
}
