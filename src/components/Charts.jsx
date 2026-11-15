import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDate } from './ui.jsx';

const axis = { fontSize: 11, fill: '#64748b' };

/** Serie diaria NASA POWER: lluvia (barras), ETo y humedad de zona radicular. */
export function PowerChart({ daily }) {
  const data = daily.map((d) => ({ ...d, label: fmtDate(d.date), gwetrootPct: d.gwetroot === null ? null : Math.round(d.gwetroot * 100), gwettopPct: d.gwettop === null ? null : Math.round(d.gwettop * 100) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f0" vertical={false} />
        <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" minTickGap={24} />
        <YAxis yAxisId="mm" tick={axis} />
        <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={axis} hide />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="mm" dataKey="precip" name="Lluvia (mm)" fill="#38bdf8" radius={[3, 3, 0, 0]} />
        <Line yAxisId="mm" dataKey="eto" name="ETo (mm)" stroke="#f59e0b" dot={false} strokeWidth={2} connectNulls />
        <Line yAxisId="pct" dataKey="gwetrootPct" name="Humedad radicular NASA (%)" stroke="#176b40" dot={false} strokeWidth={2} connectNulls />
        <Line yAxisId="pct" dataKey="gwettopPct" name="Humedad superficial NASA (%)" stroke="#86efac" dot={false} strokeWidth={2} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Climatología mensual: lluvia vs ETo. */
export function ClimateChart({ months }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={months} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f0" vertical={false} />
        <XAxis dataKey="label" tick={axis} />
        <YAxis tick={axis} />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="precip" name="Lluvia normal (mm/mes)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
        <Line dataKey="eto" name="ETo Hargreaves (mm/mes)" stroke="#f59e0b" strokeWidth={2} dot={false} />
        <Line dataKey="t2m" name="Temp. media (°C)" stroke="#e11d48" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Serie genérica (sensores, NDVI…). series: [{key, name, color}] */
export function SeriesChart({ data, series, height = 240, xKey = 'label', domain }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f0" vertical={false} />
        <XAxis dataKey={xKey} tick={axis} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={axis} domain={domain || ['auto', 'auto']} />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s) => <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={data.length < 30} connectNulls />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
