import { useEffect, useRef, useState } from 'react';
import { Bell, CloudRain, HeartPulse, Droplets, Flame, Mountain, ShieldCheck, Snowflake, Sun, Thermometer, TriangleAlert, Waves, Wind } from 'lucide-react';
import { useI18n } from '../lib/i18n.js';
import { ALERT_TYPES } from '../lib/alerts.js';
import { Badge, Notice, Spinner, useFmt } from './ui.jsx';

export const ALERT_ICON = {
  storm: Wind, fire: Flame, flood: Waves, drought: Droplets, volcano: Mountain,
  frost: Snowflake, heat: Thermometer, uv: Sun, rain: CloudRain, wind: Wind, dry: Droplets, health: HeartPulse
};

const TONE = {
  3: { box: 'border-rose-200 bg-rose-50 text-rose-900', chip: 'red', label: 'common.high' },
  2: { box: 'border-amber-200 bg-amber-50 text-amber-900', chip: 'amber', label: 'common.medium' },
  1: { box: 'border-slate-200 bg-slate-50 text-slate-700', chip: 'slate', label: 'common.low' }
};

export function AlertItem({ alert, compact }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const Icon = ALERT_ICON[alert.type] || TriangleAlert;
  const tone = TONE[alert.severity] || TONE[1];
  return (
    <div className={`rounded-2xl border p-3.5 ${tone.box}`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-extrabold">{t(`alerts.types.${alert.type}`)}</p>
            <Badge tone={tone.chip}>{t(tone.label)}</Badge>
            <Badge tone="slate">{alert.source}</Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed">{t(alert.key, alert.vars)}{alert.extraKey ? ` ${t(alert.extraKey, alert.extraVars)}` : ''}</p>
          {!compact && (
            <p className="mt-1 text-[11px] opacity-80">
              {alert.date ? fmt.date(String(alert.date).slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
              {alert.distanceKm !== undefined && alert.distanceKm !== null ? ` · ${t('alerts.distance', { km: alert.distanceKm })}` : ''}
              {alert.link ? <> · <a className="underline" href={alert.link} target="_blank" rel="noreferrer">{t('common.open')}</a></> : null}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlertList({ alerts, loading, error, compact }) {
  const { t } = useI18n();
  if (loading) return <div className="py-6 text-center"><Spinner label={t('alerts.loading')} /></div>;
  if (error) return <Notice tone="warn" title={t('alerts.error')}>{error}</Notice>;
  if (!alerts.length) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-extrabold"><ShieldCheck size={16} />{t('alerts.none')}</p>
        <p className="mt-1 text-xs">{t('alerts.noneLead')}</p>
      </div>
    );
  }
  return <div className="space-y-2.5">{alerts.map((a) => <AlertItem key={a.id} alert={a} compact={compact} />)}</div>;
}

/** Selector de notificaciones: qué alertas quiere recibir el usuario. */
export function AlertSettings({ enabled, onChange }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="text-sm font-extrabold">{t('alerts.settings')}</p>
      <p className="mt-0.5 text-xs text-slate-500">{t('alerts.settingsLead')}</p>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ALERT_TYPES.map((type) => {
          const Icon = ALERT_ICON[type];
          const on = enabled.includes(type);
          return (
            <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${on ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-500'}`}>
              <input type="checkbox" checked={on} onChange={() => onChange(on ? enabled.filter((x) => x !== type) : [...enabled, type])} />
              <Icon size={14} />{t(`alerts.types.${type}`)}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Campana del encabezado con el resumen de alertas y el selector. */
export function AlertsBell({ alerts, loading, error, enabled, onChange, onSeeAll }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, []);
  const urgent = alerts.filter((a) => a.severity >= 2).length;
  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={t('alerts.bell')}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition ${urgent ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'}`}>
        <Bell size={18} />
        {alerts.length > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white ${urgent ? 'bg-rose-600' : 'bg-slate-400'}`}>{alerts.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-[700] mt-2 max-h-[75vh] w-[min(94vw,24rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold">{t('alerts.title')}</p>
            {alerts.length > 0 && <Badge tone={urgent ? 'red' : 'slate'}>{t('alerts.active', { n: alerts.length })}</Badge>}
          </div>
          <div className="mt-3"><AlertList alerts={alerts} loading={loading} error={error} /></div>
          <p className="mt-3 text-[10px] leading-snug text-slate-500">{t('alerts.disclaimer')}</p>
          <div className="mt-3 border-t border-slate-100 pt-3"><AlertSettings enabled={enabled} onChange={onChange} /></div>
          {onSeeAll && <button className="btn-ghost mt-3 w-full" onClick={() => { setOpen(false); onSeeAll(); }}>{t('alerts.seeAll')}</button>}
        </div>
      )}
    </div>
  );
}
