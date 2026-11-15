import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Activity, AlertTriangle, Bell, Check, ChevronRight, CloudSun, Droplets, FileText, FlaskConical, House, Lightbulb, Map, MapPin, Menu, Mountain, Plus, RefreshCw, RotateCcw, Sprout, Thermometer, Trash2, Wheat, X } from 'lucide-react';

const MapView = lazy(() => import('./MapView.jsx'));
const ChartView = lazy(() => import('./ChartView.jsx'));
const API = '/api';
const PAGE_LIST = [
  { id: 'home', label: 'Resumen', icon: House }, { id: 'plots', label: 'Parcelas', icon: Map },
  { id: 'soil', label: 'Suelo', icon: FlaskConical }, { id: 'rotation', label: 'Rotación', icon: RotateCcw },
  { id: 'climate', label: 'Clima', icon: CloudSun }, { id: 'reports', label: 'Cultivos', icon: Wheat }, { id: 'alerts', label: 'Alertas', icon: Bell }
];
const emptySensors = { moisture25cm: '', rootTemperatureC: '', soilPh: '' };
const emptyPlotForm = { name: '', crop: '', coordinates: [{ lat: '', lon: '' }, { lat: '', lon: '' }, { lat: '', lon: '' }, { lat: '', lon: '' }], fineDataEnabled: false, soilPh: '', organicMatterPct: '', nitrogen: '', sensors: [] };
const NASA_PARAMETERS = 'T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS2M,RH2M,PS,EVPTRNS';

function Card({ children, className = '' }) { return <section className={`rounded-2xl border border-[#e7eee9] bg-white shadow-soft ${className}`}>{children}</section>; }
function Title({ eyebrow, title, description, action }) { return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div>{eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[.15em] text-leaf">{eyebrow}</p>}<h2 className="text-2xl font-extrabold tracking-tight text-[#173521] md:text-3xl">{title}</h2>{description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>}</div>{action}</div>; }
function Badge({ children, tone = 'green' }) { const c = { green: 'bg-[#e6f3e9] text-[#1e6b3b]', amber: 'bg-amber-50 text-amber-700', red: 'bg-rose-50 text-rose-700', gray: 'bg-slate-100 text-slate-600' }; return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${c[tone]}`}>{children}</span>; }
function Metric({ label, value, unit = '', icon: Icon, detail }) { return <Card className="p-4"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-2 text-3xl font-extrabold text-forest">{value ?? '—'}<span className="ml-1 text-base text-slate-500">{unit}</span></p></div><span className="rounded-xl bg-mist p-3 text-leaf"><Icon size={22}/></span></div><p className="mt-2 text-xs text-slate-500">{detail}</p></Card>; }
function numberOrDash(value, digits = 1) { return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits); }
function savedPlots() { try { const list = JSON.parse(localStorage.getItem('agroshift-plots') || '[]'); return Array.isArray(list) ? list : []; } catch { return []; } }
function pointValid(point) { const lat = Number(point.lat); const lon = Number(point.lon); return point.lat !== '' && point.lon !== '' && Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180; }
function buildAlerts(telemetry, sensorReadings) {
  const alerts = [];
  const rows = telemetry?.daily || [];
  const recentRain = rows.slice(-3).reduce((sum, row) => sum + (Number(row.precipitationMm) || 0), 0);
  if (rows.length && recentRain >= 20) alerts.push({ id: 'rain', tone: 'amber', title: 'Lluvia reciente en el producto NASA POWER', message: `${recentRain.toFixed(1)} mm acumulados en los últimos días disponibles. Es histórico/modelado, no un pronóstico.` });
  for (const reading of sensorReadings) {
    if (Number.isFinite(Number(reading.pressureHpa)) && Number(reading.pressureHpa) < 980) alerts.push({ id: `pressure-${reading.deviceId}`, tone: 'amber', title: `Presión baja · ${reading.deviceId}`, message: `${reading.pressureHpa} hPa informados por el dispositivo; verifique calibración y confirme con observación local.` });
  }
  if (!alerts.length) alerts.push({ id: 'none', tone: 'gray', title: 'Sin alertas calculables', message: 'Aún no hay suficientes datos reales para emitir alertas. Las alertas meteorológicas de NASA POWER son retrospectivas, no predicciones.' });
  return alerts;
}

export default function App() {
  const [page, setPage] = useState('home');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [plots, setPlots] = useState(savedPlots);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('agroshift-selected-plot') || '');
  const [form, setForm] = useState(emptyPlotForm);
  const [showForm, setShowForm] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryState, setTelemetryState] = useState('idle');
  const [telemetryError, setTelemetryError] = useState('');
  const [sensorReadings, setSensorReadings] = useState([]);
  const [sensorKey, setSensorKey] = useState(() => sessionStorage.getItem('agroshift-iot-key') || '');
  const [sensorInput, setSensorInput] = useState(emptySensors);
  const [fineEnabled, setFineEnabled] = useState(false);
  const [notice, setNotice] = useState('');
  const [loadingSensors, setLoadingSensors] = useState(false);

  const selectedPlot = plots.find((plot) => plot.id === selectedId) || null;
  const latestSensor = sensorReadings[0] || null;
  const alerts = useMemo(() => buildAlerts(telemetry, sensorReadings), [telemetry, sensorReadings]);
  const current = telemetry?.current || {};
  const latestSurface = current.surfaceMoisturePct;
  const delta = latestSensor && Number.isFinite(Number(latestSurface)) ? Number((Number(latestSensor.moisture25cm) - Number(latestSurface)).toFixed(1)) : null;

  const loadTelemetry = useCallback(async (plot, quiet = false) => {
    if (!plot || !Array.isArray(plot.coordinates) || !plot.coordinates.some(pointValid)) { setTelemetry(null); setTelemetryState('idle'); return; }
    const points = plot.coordinates.filter(pointValid);
    const latitude = points.reduce((sum, p) => sum + Number(p.lat), 0) / points.length;
    const longitude = points.reduce((sum, p) => sum + Number(p.lon), 0) / points.length;
    setTelemetryState('loading'); setTelemetryError('');
    try {
      const response = await fetch(`${API}/nasa-telemetry?latitude=${latitude}&longitude=${longitude}&parameters=${encodeURIComponent(NASA_PARAMETERS)}`);
      const payload = await response.json();
      if (!response.ok || payload.fallback) throw new Error(payload.error || payload.notice || `NASA POWER HTTP ${response.status}`);
      setTelemetry(payload); setTelemetryState('ready');
      if (!quiet) setNotice('Datos reales de NASA POWER actualizados para el centro de la parcela.');
    } catch (error) {
      setTelemetry(null); setTelemetryState('error'); setTelemetryError(error.message || 'NASA POWER no respondió.');
      if (!quiet) setNotice('No hay datos NASA disponibles para esta consulta; no se muestran valores de ejemplo.');
    }
  }, []);

  const loadSensors = useCallback(async (plot) => {
    if (!plot) { setSensorReadings([]); return; }
    setLoadingSensors(true);
    try {
      const response = await fetch(`${API}/iot-fusion?plotId=${encodeURIComponent(plot.id)}&limit=50`);
      if (!response.ok) throw new Error('API IoT no disponible');
      const result = await response.json(); setSensorReadings(result.readings || []);
    } catch { setSensorReadings([]); }
    finally { setLoadingSensors(false); }
  }, []);

  useEffect(() => { localStorage.setItem('agroshift-plots', JSON.stringify(plots)); }, [plots]);
  useEffect(() => { if (selectedPlot) { localStorage.setItem('agroshift-selected-plot', selectedPlot.id); loadTelemetry(selectedPlot, true); loadSensors(selectedPlot); } else { localStorage.removeItem('agroshift-selected-plot'); setTelemetry(null); setSensorReadings([]); } }, [selectedPlot?.id, loadTelemetry, loadSensors]);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);

  function updateCoordinate(index, field, value) { setForm((old) => ({ ...old, coordinates: old.coordinates.map((point, i) => i === index ? { ...point, [field]: value } : point) })); }
  function addCoordinate() { setForm((old) => ({ ...old, coordinates: [...old.coordinates, { lat: '', lon: '' }] })); }
  function removeCoordinate(index) { setForm((old) => old.coordinates.length <= 3 ? old : { ...old, coordinates: old.coordinates.filter((_, i) => i !== index) }); }
  function savePlot(event) {
    event.preventDefault();
    if (!form.name.trim()) { setNotice('Escribe un nombre para la parcela.'); return; }
    if (form.coordinates.length < 3 || form.coordinates.some((point) => !pointValid(point))) { setNotice('Agrega al menos 3 puntos con latitud y longitud válidas.'); return; }
    const coordinates = form.coordinates.map((p) => ({ lat: Number(p.lat), lon: Number(p.lon) }));
    const fineData = form.fineDataEnabled ? { soilPh: form.soilPh === '' ? null : Number(form.soilPh), organicMatterPct: form.organicMatterPct === '' ? null : Number(form.organicMatterPct), nitrogen: form.nitrogen === '' ? null : Number(form.nitrogen) } : null;
    const plot = { id: crypto.randomUUID(), name: form.name.trim(), crop: form.crop.trim() || null, coordinates, fineData, createdAt: new Date().toISOString(), areaHectares: null };
    setPlots((all) => [...all, plot]); setSelectedId(plot.id); setForm(emptyPlotForm); setShowForm(false); setPage('plots'); setNotice('Parcela creada. Consultando NASA POWER en su centroide.');
  }
  function deletePlot(id) {
    const plot = plots.find((item) => item.id === id); if (!plot || !window.confirm(`¿Eliminar la parcela “${plot.name}” de este navegador?`)) return;
    const remaining = plots.filter((item) => item.id !== id); setPlots(remaining); if (selectedId === id) setSelectedId(remaining[0]?.id || ''); setNotice('Parcela eliminada de este navegador.');
  }
  async function sendManualReading(event) {
    event.preventDefault();
    if (!selectedPlot) return;
    if (!sensorKey) { setNotice('Para guardar una lectura en el API, configura IOT_WRITE_KEY en Azure y pega aquí la clave del dispositivo.'); return; }
    const payload = { plotId: selectedPlot.id, moisture25cm: sensorInput.moisture25cm === '' ? undefined : Number(sensorInput.moisture25cm), rootTemperatureC: sensorInput.rootTemperatureC === '' ? undefined : Number(sensorInput.rootTemperatureC), soilPh: sensorInput.soilPh === '' ? undefined : Number(sensorInput.soilPh), surfaceMoisturePct: latestSurface };
      if (Object.values(emptySensors).every((key) => sensorInput[key] === '')) { setNotice('Introduce al menos una lectura numérica.'); return; }
    try {
      const response = await fetch(`${API}/iot-fusion`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-iot-key': sensorKey }, body: JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Error del API');
      setNotice('Lectura guardada en el backend.'); setSensorInput(emptySensors); await loadSensors(selectedPlot);
    } catch (error) { setNotice(`No se guardó: ${error.message}`); }
  }
  async function refreshAll() { if (selectedPlot) { await loadTelemetry(selectedPlot); await loadSensors(selectedPlot); } }
  const go = (id) => { setPage(id); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const nav = (mobile = false) => <nav className={mobile ? 'grid grid-cols-7 gap-0.5' : 'space-y-1'}>{PAGE_LIST.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)} className={`flex items-center rounded-xl font-semibold transition ${mobile ? 'min-h-[62px] flex-col justify-center gap-1 px-0.5 text-[9px]' : 'w-full gap-3 px-3 py-3 text-left text-sm'} ${page === id ? (mobile ? 'text-leaf' : 'bg-[#e7f2e9] text-forest') : 'text-slate-500 hover:bg-slate-50'}`}><Icon size={mobile ? 19 : 18}/><span>{label}</span>{id === 'alerts' && alerts.some((alert) => alert.tone !== 'gray') && <span className="rounded-full bg-amber-400 px-1.5 text-[9px] text-white">!</span>}</button>)}</nav>;

  return <div className="min-h-screen bg-canvas pb-20 md:pb-0">
    <header className="bg-forest text-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-8"><div className="flex items-center gap-3"><span className="rounded-2xl bg-white p-3 text-leaf"><Sprout size={25}/></span><div><p className="text-[10px] font-extrabold tracking-[.18em] text-[#bfdfc7]">AGROSMART MX</p><h1 className="text-lg font-extrabold">AgroShift Michoacán</h1><p className="text-xs text-[#d2e5d7]">Inteligencia para el campo</p></div></div><div className="hidden items-center gap-3 md:flex"><span className="text-sm text-[#e1eee4]">{selectedPlot ? selectedPlot.name : 'Sin parcela seleccionada'}</span><button onClick={refreshAll} disabled={!selectedPlot || telemetryState === 'loading'} className="rounded-xl border border-white/20 p-3 disabled:opacity-40" aria-label="Actualizar NASA"><RefreshCw size={18} className={telemetryState === 'loading' ? 'animate-spin' : ''}/></button></div><button className="rounded-xl border border-white/20 p-2 md:hidden" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Menú">{mobileMenu ? <X/> : <Menu/>}</button></div>{mobileMenu && <div className="px-4 pb-3 md:hidden">{nav()}</div>}</header>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_minmax(0,1fr)] md:px-8"><aside className="hidden md:block"><div className="sticky top-5"><p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">Navegación</p>{nav()}<Card className="mt-5 bg-mist p-4 shadow-none"><p className="font-bold text-forest">Datos sin inventar</p><p className="mt-2 text-xs leading-relaxed text-slate-600">Clima, suelo y sensores aparecen cuando hay parcela o dispositivo con datos disponibles.</p></Card></div></aside><main className="min-w-0">
      {page === 'home' && <Dashboard plots={plots} plot={selectedPlot} telemetry={telemetry} telemetryState={telemetryState} error={telemetryError} alerts={alerts} onGo={go}/>}
      {page === 'plots' && <PlotsPage plots={plots} selectedId={selectedId} setSelectedId={setSelectedId} showForm={showForm} setShowForm={setShowForm} form={form} setForm={setForm} onCoordinate={updateCoordinate} onAddPoint={addCoordinate} onRemovePoint={removeCoordinate} onSave={savePlot} onDelete={deletePlot} telemetry={telemetry} telemetryState={telemetryState} onRefresh={refreshAll} fineEnabled={fineEnabled} setFineEnabled={setFineEnabled} />}
      {page === 'soil' && <SoilPage plot={selectedPlot} telemetry={telemetry} telemetryState={telemetryState} latest={latestSensor} delta={delta} loading={loadingSensors} readings={sensorReadings} sensorInput={sensorInput} setSensorInput={setSensorInput} onSubmit={sendManualReading} sensorKey={sensorKey} setSensorKey={(v) => { setSensorKey(v); sessionStorage.setItem('agroshift-iot-key', v); }}/ >}
      {page === 'rotation' && <EmptyModule title="Rotación de cultivos" plot={selectedPlot} message="Se habilitará cuando exista una parcela seleccionada y datos observados suficientes. No mostramos puntuaciones de estrategia inventadas."/>}
      {page === 'reports' && <EmptyModule title="Requerimientos por cultivo" plot={selectedPlot} message="Las recomendaciones aparecerán cuando agregues análisis manuales o conectes sensores. No se calculan compatibilidades con valores supuestos."/>}
      {page === 'climate' && <ClimatePage plot={selectedPlot} telemetry={telemetry} state={telemetryState} error={telemetryError} onRefresh={refreshAll}/>}
      {page === 'alerts' && <AlertsPage alerts={alerts} telemetry={telemetry} readings={sensorReadings}/>}
    </main></div>
    <div className="fixed inset-x-0 bottom-0 z-[1000] border-t bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-lg backdrop-blur md:hidden">{nav(true)}</div>
    {notice && <div role="status" className="fixed bottom-24 left-1/2 z-[1100] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-start gap-2 rounded-xl bg-[#173521] px-4 py-3 text-sm font-medium text-white shadow-xl md:bottom-6"><Check size={18} className="mt-0.5 shrink-0 text-[#9cdaa9]"/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Cerrar"><X size={17}/></button></div>}
  </div>;
}

function Dashboard({ plots, plot, telemetry, telemetryState, error, alerts, onGo }) {
  if (!plots.length) return <><Title eyebrow="AgroShift Michoacán" title="Comienza agregando tu parcela" description="No hay parcelas ni lecturas guardadas. Los indicadores aparecerán solo después de registrar coordenadas o conectar un dispositivo."/><Card className="border-[#dcebe0] bg-mist p-6"><div className="flex items-start gap-4"><span className="rounded-xl bg-white p-3 text-leaf"><MapPin/></span><div><h3 className="font-extrabold text-forest">Sin datos todavía</h3><p className="mt-1 text-sm text-slate-600">Agrega los vértices reales de tu terreno. La aplicación consultará NASA POWER usando el centroide del polígono.</p><button onClick={() => onGo('plots')} className="mt-4 min-h-11 rounded-xl bg-forest px-4 font-bold text-white">Agregar parcela</button></div></div></Card></>;
  return <><Title eyebrow="Resumen" title={plot?.name || 'Parcela'} description="Los indicadores vacíos se completan cuando existe telemetría real." action={<Badge tone={telemetryState === 'ready' ? 'green' : telemetryState === 'loading' ? 'amber' : 'gray'}>{telemetryState === 'ready' ? 'NASA POWER disponible' : telemetryState === 'loading' ? 'Consultando NASA…' : 'Sin datos NASA'}</Badge>}/>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Mis parcelas" value={plots.length} icon={Mountain} detail="Registradas en este navegador"/><Metric label="Cultivo" value={plot?.crop || '—'} icon={Sprout} detail="Capturado por el usuario"/><Metric label="Temperatura" value={numberOrDash(telemetry?.current?.temperatureC)} unit="°C" icon={Thermometer} detail="NASA POWER · dato diario/modelado"/><Metric label="Precipitación" value={numberOrDash(telemetry?.current?.precipitationMm)} unit="mm" icon={Droplets} detail="NASA POWER · no es pronóstico"/></div>
    {telemetryState === 'error' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
    <Card className="mt-5 overflow-hidden"><div className="grid md:grid-cols-[1fr_1fr]"><div className="h-64"><Suspense fallback={<p className="p-6">Cargando mapa…</p>}><MapView plots={plot ? [plot] : []} satellite/></Suspense></div><div className="flex flex-col justify-center p-5"><p className="text-xs font-bold uppercase tracking-widest text-leaf">Parcela seleccionada</p><h3 className="mt-1 text-xl font-extrabold text-forest">{plot?.name}</h3><p className="mt-2 text-sm text-slate-600">{plot?.crop || 'Cultivo no indicado'} · {plot?.coordinates?.length || 0} vértices GPS</p><div className="mt-4 flex gap-2"><button onClick={() => onGo('plots')} className="min-h-11 rounded-xl bg-forest px-4 font-bold text-white">Ver parcela</button><button onClick={() => onGo('alerts')} className="min-h-11 rounded-xl border px-4 font-bold text-leaf">Alertas ({alerts.length})</button></div></div></div></Card>
    <Card className="mt-5 border-[#dcebe0] bg-mist p-5"><div className="flex gap-3"><Lightbulb className="shrink-0 text-leaf"/><div><p className="font-extrabold text-forest">Motor de recomendaciones en espera</p><p className="mt-1 text-sm text-slate-600">No se genera recomendación sin lecturas reales del suelo o sensores configurados.</p></div></div></Card>
  </>;
}

function PlotsPage({ plots, selectedId, setSelectedId, showForm, setShowForm, form, setForm, onCoordinate, onAddPoint, onRemovePoint, onSave, onDelete, telemetry, telemetryState, onRefresh, fineEnabled, setFineEnabled }) {
  const coords = form.coordinates.map((p) => [Number(p.lat), Number(p.lon)]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const selected = plots.find((p) => p.id === selectedId) || null;
  const [editSensor, setEditSensor] = useState(false);
  return <><Title eyebrow="Parcelas y GPS" title="Tus parcelas" description="Agrega vértices GPS reales para cerrar el polígono. Tus parcelas se guardan en este navegador." action={<button onClick={() => setShowForm(!showForm)} className="flex min-h-11 items-center gap-2 rounded-xl bg-forest px-4 font-bold text-white"><Plus size={18}/>Agregar parcela</button>}/>
    {showForm && <Card className="mb-5 p-5"><form onSubmit={onSave} className="space-y-5"><div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-bold">Nombre de parcela<input required value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border px-3" placeholder="Nombre que tú usas"/></label><label className="text-sm font-bold">Cultivo (opcional)<input value={form.crop} onChange={(e) => setForm((v) => ({ ...v, crop: e.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border px-3" placeholder="Escribe el cultivo"/></label></div><div><div className="flex items-center justify-between"><h3 className="font-extrabold text-forest">Vértices del límite</h3><button type="button" onClick={onAddPoint} className="rounded-lg border px-3 py-2 text-sm font-bold text-leaf">+ Agregar punto</button></div><p className="mt-1 text-xs text-slate-500">Ingresa latitud y longitud en grados decimales (ej. 19.4206, -102.0628). Agrega mínimo 3 puntos en orden alrededor del terreno.</p><div className="mt-3 space-y-2">{form.coordinates.map((point, index) => <div key={index} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2"><span className="text-sm font-bold text-slate-500">Punto {index + 1}</span><input aria-label={`Latitud punto ${index + 1}`} type="number" step="any" value={point.lat} onChange={(e) => onCoordinate(index, 'lat', e.target.value)} placeholder="Latitud" className="h-10 min-w-0 rounded-lg border px-2 text-sm"/><input aria-label={`Longitud punto ${index + 1}`} type="number" step="any" value={point.lon} onChange={(e) => onCoordinate(index, 'lon', e.target.value)} placeholder="Longitud" className="h-10 min-w-0 rounded-lg border px-2 text-sm"/><button type="button" disabled={form.coordinates.length <= 3} onClick={() => onRemovePoint(index)} className="rounded-lg p-2 text-slate-400 disabled:opacity-25" aria-label="Quitar punto"><Trash2 size={17}/></button></div>)}</div></div><Card className="overflow-hidden p-1 shadow-none"><div className="h-64"><Suspense fallback={<p className="p-4">Cargando mapa…</p>}><MapView plots={[]} draftPoints={coords} satellite/></Suspense></div></Card><div className="rounded-xl bg-mist p-4"><label className="flex cursor-pointer items-center gap-3 font-bold text-forest"><input type="checkbox" checked={form.fineDataEnabled} onChange={(e) => setForm((v) => ({ ...v, fineDataEnabled: e.target.checked }))}/>Activar datos finos / análisis manual</label>{form.fineDataEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-3">{[['soilPh','pH'],['organicMatterPct','Materia orgánica (%)'],['nitrogen','Nitrógeno medido']].map(([key,label]) => <label key={key} className="text-sm font-semibold">{label}<input type="number" step="any" value={form[key]} onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border px-2" placeholder="Sin dato"/></label>)}</div>}</div><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="min-h-11 rounded-xl border px-4 font-bold">Cancelar</button><button className="min-h-11 rounded-xl bg-forest px-5 font-bold text-white">Guardar parcela</button></div></form></Card>}
    {plots.length === 0 ? <Card className="p-8 text-center"><MapPin className="mx-auto text-leaf"/><h3 className="mt-3 font-extrabold text-forest">Todavía no hay parcelas</h3><p className="mt-1 text-sm text-slate-500">Agrega tu primera parcela con coordenadas reales.</p></Card> : <><div className="mb-4 flex flex-wrap gap-2">{plots.map((plot) => <button key={plot.id} onClick={() => { setSelectedId(plot.id); setEditSensor(false); }} className={`rounded-full px-4 py-2 text-sm font-bold ${plot.id === selectedId ? 'bg-forest text-white' : 'border bg-white text-slate-600'}`}>{plot.name}</button>)}</div><Card className="overflow-hidden p-1"><div className="h-[390px]"><Suspense fallback={<p className="p-5">Cargando mapa…</p>}><MapView plots={plots} satellite selectedId={selectedId}/></Suspense></div></Card>{selected && <Card className="mt-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-leaf">Datos de la parcela</p><h3 className="mt-1 text-xl font-extrabold text-forest">{selected.name}</h3><p className="text-sm text-slate-600">Cultivo: {selected.crop || 'No indicado'} · {selected.coordinates.length} puntos GPS</p></div><div className="flex gap-2"><button onClick={onRefresh} className="rounded-xl border px-3 py-2 text-sm font-bold text-leaf"><RefreshCw size={16} className="inline mr-1"/>NASA POWER</button><button onClick={() => onDelete(selected.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700"><Trash2 size={16} className="inline mr-1"/>Eliminar</button></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Elevación / altitud</p><p className="font-extrabold">{numberOrDash(telemetry?.current?.elevationM, 0)} m</p><p className="text-[10px] text-slate-500">Solo si NASA endpoint entrega la variable</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Radiación solar</p><p className="font-extrabold">{numberOrDash(telemetry?.current?.solarRadiation, 1)}</p><p className="text-[10px] text-slate-500">NASA POWER · kWh/m²/día</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Viento a 2 m</p><p className="font-extrabold">{numberOrDash(telemetry?.current?.windSpeed, 1)} m/s</p><p className="text-[10px] text-slate-500">NASA POWER · no presión de sensor</p></div></div><div className="mt-4 border-t pt-4"><label className="flex items-center gap-2 text-sm font-bold text-forest"><input type="checkbox" checked={editSensor} onChange={(e) => setEditSensor(e.target.checked)}/>Mostrar datos de sensor/manuales</label>{editSensor && <div className="mt-3 grid gap-3 sm:grid-cols-4"><DataCell label="pH" value={selected.fineData?.soilPh}/><DataCell label="Materia orgánica %" value={selected.fineData?.organicMatterPct}/><DataCell label="Dispositivo conectado" value={sensorReadiness(selected, telemetryState)}/><DataCell label="Última lectura sensor" value={latestTime(selected.id)}/></div>}</div><h4 className="mt-4 font-bold text-forest">Coordenadas</h4><ol className="mt-2 grid gap-1 sm:grid-cols-2">{selected.coordinates.map((point, i) => <li key={i} className="text-xs text-slate-600">Punto {i + 1}: {point.lat}, {point.lon}</li>)}</ol></Card>}</>}
    <div className="mt-4 rounded-xl bg-mist p-4 text-xs leading-relaxed text-slate-600">NASA POWER devuelve datos meteorológicos/modelados a escala de rejilla; no brinda fotografía satelital de alta resolución ni una medición puntual de cada parcela. La capa satelital del mapa es del servicio NASA GIBS (MODIS/Terra Corrected Reflectance, sujeto a disponibilidad), sobre un mapa base OpenStreetMap.</div>
  </>;
}
function sensorReadiness(plot, state) { return state === 'ready' ? 'NASA disponible; IoT sin conectar' : 'Sin dispositivo enlazado'; }
function latestTime() { return '—'; }
function DataCell({ label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-forest">{value ?? 'Sin dato real'}</p></div>; }

function SoilPage({ plot, telemetry, telemetryState, latest, delta, loading, readings, sensorInput, setSensorInput, onSubmit, sensorKey, setSensorKey }) {
  if (!plot) return <EmptyModule title="Análisis de suelo" message="Agrega y selecciona una parcela antes de consultar datos."/>;
  return <><Title eyebrow="Suelo y dispositivos" title={plot.name} description="Sin lecturas no se calcula Δ. NASA POWER no mide pH ni humedad a 25 cm." action={<Badge tone={telemetryState === 'ready' ? 'green' : 'gray'}>{telemetryState === 'ready' ? 'NASA POWER conectado' : 'Esperando datos'}</Badge>}/>
    <div className="grid gap-4 md:grid-cols-2">{[['Humedad sensor 25 cm', latest?.moisture25cm, '%'],['Temperatura radicular', latest?.rootTemperatureC, '°C'],['pH reportado', latest?.soilPh ?? plot.fineData?.soilPh, ''],['Humedad superficial POWER', telemetry?.current?.surfaceMoisturePct, '%']].map(([label,value,unit]) => <DataCell key={label} label={label} value={value === null || value === undefined ? 'Sin lectura' : `${numberOrDash(value)} ${unit}`}/>)}</div>
    <Card className="mt-4 p-5"><p className="text-xs font-bold uppercase tracking-widest text-leaf">Fusión Δ</p><p className="mt-2 text-3xl font-black text-forest">{delta === null ? 'Sin datos suficientes' : `Δ humedad: ${delta > 0 ? '+' : ''}${delta}%`}</p><p className="mt-2 text-sm text-slate-600">El cálculo solo aparece cuando hay una lectura real del sensor y un valor POWER disponible. POWER no equivale a SMAP directo ni al suelo de la parcela.</p></Card>
    <Card className="mt-4 p-5"><h3 className="font-extrabold text-forest">Introducir lectura manual</h3><p className="mt-1 text-xs text-slate-500">Los valores enviados se registrarán con etiqueta de origen manual, no como medición automática.</p><form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-3">{[['moisture25cm','Humedad a 25 cm (%)'],['rootTemperatureC','Temperatura radicular (°C)'],['soilPh','pH']].map(([key,label]) => <label key={key} className="text-sm font-semibold">{label}<input type="number" step="any" value={sensorInput[key]} onChange={(e) => setSensorInput((v) => ({ ...v, [key]: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border px-3" placeholder="Sin dato"/></label>)}<label className="text-sm font-semibold sm:col-span-2">Clave de dispositivo API<input type="password" autoComplete="off" value={sensorKey} onChange={(e) => setSensorKey(e.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3" placeholder="Configura IOT_WRITE_KEY en Azure"/></label><button className="min-h-11 self-end rounded-xl bg-forest px-4 font-bold text-white">Guardar lectura</button></form></Card>
    <Card className="mt-4 p-5"><h3 className="font-extrabold text-forest">ESP32 / visualizador conectado</h3><p className="mt-2 text-sm text-slate-600">{loading ? 'Consultando lecturas…' : latest ? `Último dispositivo: ${latest.deviceId || 'sin ID'} · ${latest.recordedAt || ''}` : 'No hay dispositivos ni lecturas conectados a esta parcela.'}</p><p className="mt-2 text-xs text-slate-500">Un ESP32 no puede conectarse directamente al navegador: debe enviar HTTPS al endpoint con la credencial secreta guardada en el firmware seguro. La clave no debe quedar embebida en una web pública.</p></Card>
  </>;
}

function sensorReadinessPlot() { return '—'; }
function EmptyModule({ title, plot, message }) { return <><Title eyebrow="Módulo" title={title}/><Card className="p-6"><p className="font-bold text-forest">{plot ? 'Faltan datos reales para este análisis' : 'Selecciona una parcela'}</p><p className="mt-2 text-sm text-slate-600">{message}</p></Card></>; }

function ClimatePage({ plot, telemetry, state, error, onRefresh }) {
  if (!plot) return <EmptyModule title="Clima y NASA POWER" message="Agrega una parcela con coordenadas GPS reales para consultar datos NASA."/>;
  const params = telemetry?.current || {};
  return <><Title eyebrow="NASA POWER · coordenadas del centroide" title={`Clima · ${plot.name}`} description="Series meteorológicas históricas/modeladas. NASA POWER no es un pronóstico horario ni una estación instalada en tu parcela." action={<button onClick={onRefresh} className="min-h-11 rounded-xl border bg-white px-4 font-bold text-leaf"><RefreshCw size={16} className="mr-2 inline"/>Actualizar</button>}/>
    {state === 'loading' && <Card className="p-5">Consultando NASA POWER…</Card>}{state === 'error' && <Card className="bg-amber-50 p-5 text-amber-800">No se recibió dato: {error}</Card>}
    {state === 'ready' && <><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['Temperatura',params.temperatureC,'°C'],['Precipitación',params.precipitationMm,'mm'],['Radiación solar',params.solarRadiation,'kWh/m²/día'],['Viento a 2 m',params.windSpeed,'m/s'],['Humedad relativa',params.relativeHumidity,'%'],['Presión superficial',params.surfacePressure,'kPa'],['Evapotranspiración',params.evapotranspiration,'mm/día'],['Elevación',params.elevationM,'m']].map(([label,value,unit]) => <DataCell key={label} label={label} value={value === null || value === undefined ? 'No disponible en POWER' : `${numberOrDash(value)} ${unit}`}/>)}</div><div className="mt-4"><Suspense fallback={<Card className="p-5">Cargando gráficas…</Card>}><ChartView daily={telemetry.daily || []}/></Suspense></div></>}
    <p className="mt-4 rounded-xl bg-mist p-4 text-xs leading-relaxed text-slate-600">Fuente: API NASA POWER Daily Point. Radiación, viento, humedad relativa y presión son variables de producto modelado; la presión no es un pronóstico de cambio meteorológico. Se muestran únicamente variables devueltas por API. No se usan servicios meteorológicos de terceros.</p>
  </>;
}

function AlertsPage({ alerts, telemetry, readings }) { return <><Title eyebrow="Notificaciones" title="Alertas disponibles" description="Las alertas se generan solo con datos recibidos. POWER diario no emite avisos de lluvia futura."/><div className="space-y-3">{alerts.map((alert) => <Card key={alert.id} className="p-5"><div className="flex gap-3"><AlertTriangle className={alert.tone === 'amber' ? 'text-amber-600' : 'text-slate-400'}/><div><h3 className="font-extrabold text-forest">{alert.title}</h3><p className="mt-1 text-sm text-slate-600">{alert.message}</p></div></div></Card>)}</div><p className="mt-4 text-xs text-slate-500">NASA POWER disponible: {telemetry ? 'sí' : 'no'} · Lecturas IoT: {readings.length}</p></>; }
