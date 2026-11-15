import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
function label(date) { return String(date || '').slice(4, 6) + '/' + String(date || '').slice(6, 8); }
export default function ChartView({ daily }) {
  const data = daily.map((row) => ({ ...row, dateLabel: label(row.date) }));
  if (!data.length) return <div className="rounded-xl border bg-white p-5 text-sm text-slate-500">La API no entregó observaciones para graficar.</div>;
  const charts = [['Temperatura · °C', 'temperatureC', '#c27b16'], ['Precipitación · mm/día', 'precipitationMm', '#3583a8'], ['Radiación solar · kWh/m²/día', 'solarRadiation', '#d08b27'], ['Viento · m/s', 'windSpeed', '#557b9b'], ['Humedad relativa · %', 'relativeHumidity', '#1e6b3b'], ['Presión superficial · kPa', 'surfacePressure', '#7356a8']];
  return <div className="grid gap-4 md:grid-cols-2">{charts.map(([title, key, color]) => <section key={key} className="rounded-2xl border bg-white p-4 shadow-soft"><h3 className="font-bold text-forest">{title}</h3><div className="mt-3 h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><CartesianGrid strokeDasharray="4 4" stroke="#e8eee9"/><XAxis dataKey="dateLabel" tick={{ fontSize: 10 }}/><YAxis tick={{ fontSize: 10 }}/><Tooltip/><Area type="monotone" dataKey={key} name={title} stroke={color} fill={color} fillOpacity={.17} connectNulls/></AreaChart></ResponsiveContainer></div></section>)}</div>;
}
