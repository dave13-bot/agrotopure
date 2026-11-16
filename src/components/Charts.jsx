import { useMemo, useState } from 'react';
import { Bar, Brush, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '../lib/i18n.js';
import { useFmt } from './ui.jsx';

const axisStyle = { fontSize: 11, fill: '#64748b' };
const RANGES = [
  { id: 7, key: 'chart.r7' }, { id: 14, key: 'chart.r14' }, { id: 30, key: 'chart.r30' },
  { id: 60, key: 'chart.r60' }, { id: 0, key: 'chart.rAll' }
];

/**
 * Gráfica de serie temporal con intervalo seleccionable: botones de rango,
 * barra inferior para acercar y series que se encienden o apagan desde la leyenda.
 */
export function TimeChart({ data, series, defaultRange = 30, height = 280, brush = true, yDomain, rightDomain }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const [range, setRange] = useState(defaultRange);
  const [hidden, setHidden] = useState([]);

  const options = RANGES.filter((r) => r.id === 0 || r.id < data.length);
  const shown = useMemo(() => (range && data.length > range ? data.slice(-range) : data), [data, range]);
  const rows = useMemo(() => shown.map((d) => ({ ...d, label: fmt.date(d.date) })), [shown, fmt]);
  const toggle = (key) => setHidden((h) => (h.includes(key) ? h.filter((x) => x !== key) : [...h, key]));
  const visible = series.filter((s) => !hidden.includes(s.key));
  const hasRight = visible.some((s) => s.axis === 'right');

  return (
    <div>
      {options.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('chart.range')}</span>
          {options.map((r) => (
            <button key={r.id} type="button" onClick={() => setRange(r.id)} aria-pressed={range === r.id}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${range === r.id ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t(r.key)}
            </button>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: hasRight ? 4 : 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#eef2f0" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} interval="preserveStartEnd" minTickGap={26} />
          <YAxis yAxisId="left" tick={axisStyle} domain={yDomain || ['auto', 'auto']} />
          <YAxis yAxisId="right" orientation="right" tick={axisStyle} domain={rightDomain || ['auto', 'auto']} hide={!hasRight} />
          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }} />
          {series.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 11, cursor: 'pointer' }} onClick={(e) => toggle(e.dataKey)}
              formatter={(value, entry) => <span style={{ opacity: hidden.includes(entry.dataKey) ? 0.35 : 1 }}>{value}</span>} />
          )}
          {series.map((s) => (s.type === 'bar'
            ? <Bar key={s.key} yAxisId={s.axis === 'right' ? 'right' : 'left'} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} hide={hidden.includes(s.key)} />
            : <Line key={s.key} yAxisId={s.axis === 'right' ? 'right' : 'left'} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={rows.length <= 20} connectNulls hide={hidden.includes(s.key)} />))}
          {brush && rows.length > 12 && <Brush dataKey="label" height={22} travellerWidth={8} stroke="#176b40" fill="#f3f6f4" tickFormatter={() => ''} />}
        </ComposedChart>
      </ResponsiveContainer>
      {brush && rows.length > 12 && <p className="mt-1 text-[10px] text-slate-400">{t('chart.hint')}</p>}
    </div>
  );
}

/** Climatología mensual: lluvia normal frente a ETo y temperatura. */
export function ClimateChart({ months }) {
  const { t } = useI18n();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={months} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f0" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} />
        <YAxis tick={axisStyle} />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="precip" name={t('chart.normalRain')} fill="#38bdf8" radius={[4, 4, 0, 0]} />
        <Line dataKey="eto" name={t('chart.etoMonth')} stroke="#f59e0b" strokeWidth={2} dot={false} />
        <Line dataKey="t2m" name={t('chart.temp')} stroke="#e11d48" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
