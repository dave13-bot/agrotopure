import { useEffect } from 'react';
import { X } from 'lucide-react';

export const Card = ({ className = '', children, ...rest }) => <div className={`card ${className}`} {...rest}>{children}</div>;

export function Spinner({ label }) {
  return <span className="inline-flex items-center gap-2 text-sm text-slate-500"><span className="loader-spin" />{label}</span>;
}

export function Badge({ tone = 'green', children, className = '' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-800 border-emerald-100', amber: 'bg-amber-50 text-amber-800 border-amber-100',
    red: 'bg-rose-50 text-rose-700 border-rose-100', slate: 'bg-slate-100 text-slate-600 border-slate-200', blue: 'bg-sky-50 text-sky-800 border-sky-100'
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tones[tone]} ${className}`}>{children}</span>;
}

export function Stat({ label, value, unit, hint, tone = 'text-ink', icon: Icon }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="rounded-2xl bg-slate-50 p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">{Icon && <Icon size={14} />}{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${empty ? 'text-slate-300' : tone}`}>{empty ? 'Sin dato' : <>{value}{unit && <span className="ml-1 text-xs font-bold text-slate-500">{unit}</span>}</>}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p>}
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <Card className="p-8 text-center">
      {Icon && <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon size={22} /></span>}
      <h3 className="mt-3 text-base font-extrabold text-ink">{title}</h3>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}

export function Notice({ tone = 'info', title, children, action }) {
  const tones = { info: 'border-sky-100 bg-sky-50 text-sky-900', warn: 'border-amber-200 bg-amber-50 text-amber-900', error: 'border-rose-200 bg-rose-50 text-rose-900', ok: 'border-emerald-100 bg-emerald-50 text-emerald-900' };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${tones[tone]}`}>
      <div className="min-w-0 flex-1">{title && <p className="font-extrabold">{title}</p>}<div className="mt-0.5 leading-relaxed">{children}</div></div>
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Cerrar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const SectionTitle = ({ eyebrow, title, text, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-0.5 text-xl font-extrabold text-ink sm:text-2xl">{title}</h2>
      {text && <p className="mt-1 max-w-2xl text-sm text-slate-500">{text}</p>}
    </div>
    {action}
  </div>
);

export const fmt = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v).toFixed(d));
export const fmtDate = (iso, opts = { day: 'numeric', month: 'short' }) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-MX', opts) : '');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
export function timeAgo(iso) {
  if (!iso) return 'nunca';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 90) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}
