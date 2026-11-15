import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardPaste, Pencil, Plus, RotateCcw, Shuffle, Trash2, Undo2 } from 'lucide-react';
import ParcelMap from '../components/ParcelMap.jsx';
import { Badge, Card, Empty, Modal, Notice, SectionTitle, fmt } from '../components/ui.jsx';
import { formatHa, isSelfIntersecting, orderCorners, parseCoord, polygonAreaM2, centroid } from '../lib/geo.js';
import { TEXTURES } from '../lib/agro.js';
import { PLANTS } from '../data/plants.js';

export default function Parcels({ repo, parcels, selectedId, setSelectedId, refresh, go, arg }) {
  const editing = arg === 'nueva' ? 'new' : arg?.startsWith('editar/') ? arg.slice(7) : null;
  if (editing) {
    const parcel = editing === 'new' ? null : parcels.find((p) => p.id === editing);
    if (editing !== 'new' && !parcel) return <Empty title="Parcela no encontrada" action={<button className="btn-ghost" onClick={() => go('parcelas')}>Volver</button>} />;
    return <ParcelEditor key={editing} repo={repo} parcel={parcel} parcels={parcels} onDone={async (saved) => { await refresh(); if (saved) setSelectedId(saved.id); go('parcelas'); }} />;
  }
  return <ParcelList repo={repo} parcels={parcels} selectedId={selectedId} setSelectedId={setSelectedId} refresh={refresh} go={go} />;
}

function ParcelList({ repo, parcels, selectedId, setSelectedId, refresh, go }) {
  const [confirm, setConfirm] = useState(null);
  const [err, setErr] = useState('');
  const selected = parcels.find((p) => p.id === selectedId);
  const remove = async () => {
    try { await repo.deleteParcel(confirm.id); setConfirm(null); await refresh(); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionTitle eyebrow="Parcelas" title="Mis terrenos y parcelas" text="Cada parcela se analiza con las coordenadas de su centroide y su polígono real."
          action={<button className="btn-primary" onClick={() => go('parcelas', 'nueva')}><Plus size={16} />Nueva parcela</button>} />
      </Card>
      {err && <Notice tone="error">{err}</Notice>}
      {parcels.length === 0 ? (
        <Empty icon={Plus} title="Registra tu primera parcela" text="Puedes dibujarla tocando el mapa en cada esquina o escribir las coordenadas GPS de cada esquina." action={<button className="btn-primary" onClick={() => go('parcelas', 'nueva')}>Empezar</button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="overflow-hidden p-2 lg:col-span-8"><ParcelMap parcels={parcels} selectedId={selectedId} onSelect={setSelectedId} height="h-[460px]" /></Card>
          <div className="space-y-3 lg:col-span-4">
            {parcels.map((p, i) => (
              <Card key={p.id} className={`p-4 transition ${p.id === selectedId ? 'ring-2 ring-emerald-500' : ''}`}>
                <button className="w-full text-left" onClick={() => setSelectedId(p.id)}>
                  <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-slate-400">Terreno {String(i + 1).padStart(2, '0')}</span><Badge>{formatHa(p.areaHa)} ha</Badge></div>
                  <h3 className="mt-1 text-base font-extrabold">{p.name}</h3>
                  <p className="font-mono text-[11px] text-slate-500">{fmt(p.centroid.lat, 5)}, {fmt(p.centroid.lon, 5)} · {p.coordinates.length} esquinas</p>
                  <p className="mt-1 text-xs"><b>Cultivo:</b> <span className="font-bold text-emerald-700">{p.crop || 'sin registrar'}</span> · <b>Suelo:</b> {TEXTURES[p.soilTexture]?.label || 'Desconocido'}</p>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-soft" onClick={() => { setSelectedId(p.id); go('analisis'); }}>Analizar</button>
                  <button className="btn-ghost" onClick={() => go('parcelas', `editar/${p.id}`)}><Pencil size={14} />Editar</button>
                  <button className="btn-danger" onClick={() => setConfirm(p)} aria-label={`Eliminar ${p.name}`}><Trash2 size={14} /></button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {selected?.notes && <Notice tone="info" title={`Notas de ${selected.name}`}>{selected.notes}</Notice>}
      {confirm && (
        <Modal title="Eliminar parcela" onClose={() => setConfirm(null)}>
          <p className="text-sm text-slate-600">Se eliminará <b>{confirm.name}</b> junto con sus dispositivos y todas sus lecturas. Esta acción no se puede deshacer.</p>
          <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setConfirm(null)}>Cancelar</button><button className="btn-danger" onClick={remove}><Trash2 size={15} />Eliminar</button></div>
        </Modal>
      )}
    </div>
  );
}

const blankCorner = () => ({ lat: '', lon: '' });

function ParcelEditor({ repo, parcel, parcels, onDone }) {
  const [form, setForm] = useState({ name: parcel?.name || '', crop: parcel?.crop || '', soilTexture: parcel?.soilTexture || 'desconocido', notes: parcel?.notes || '' });
  const [corners, setCorners] = useState(parcel ? parcel.coordinates.map((c) => ({ lat: String(c.lat), lon: String(c.lon) })) : []);
  const [mode, setMode] = useState(parcel ? 'coords' : 'draw');
  const [paste, setPaste] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = corners.map((c) => ({ lat: parseCoord(c.lat, 'lat'), lon: parseCoord(c.lon, 'lon') }));
  const valid = parsed.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
  const invalidRows = parsed.map((c, i) => ((c.lat !== null && !Number.isFinite(c.lat)) || (c.lon !== null && !Number.isFinite(c.lon)) ? i : -1)).filter((i) => i >= 0);
  const stats = useMemo(() => {
    if (valid.length < 3) return null;
    return { area: polygonAreaM2(valid) / 1e4, c: centroid(valid), crossing: isSelfIntersecting(valid) };
  }, [JSON.stringify(valid)]); // eslint-disable-line react-hooks/exhaustive-deps

  const setDraft = (pts) => setCorners(pts.map((p) => ({ lat: String(p.lat), lon: String(p.lon) })));
  const others = parcels.filter((p) => p.id !== parcel?.id);

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (invalidRows.length) { setErr(`Revisa la coordenada de la esquina ${invalidRows[0] + 1}.`); return; }
    if (valid.length < 3) { setErr('Marca al menos 3 esquinas.'); return; }
    if (stats?.crossing) { setErr('Los lados se cruzan. Usa “Ordenar esquinas” o corrige el orden.'); return; }
    setBusy(true);
    try { onDone(await repo.saveParcel({ ...form, coordinates: valid }, parcel?.id)); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const applyPaste = () => {
    const rows = paste.split(/\n|;/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const parts = l.split(/[,\t]|\s{2,}|\s(?=[-+]?\d)/).map((s) => s.trim()).filter(Boolean);
      return { lat: parts[0] || '', lon: parts[1] || '' };
    });
    setCorners(rows);
    setPaste(null);
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-ghost" onClick={() => onDone(null)}><ArrowLeft size={16} />Parcelas</button>
          <div><p className="eyebrow">{parcel ? 'Editar parcela' : 'Nueva parcela'}</p><h2 className="text-lg font-extrabold">{form.name || 'Sin nombre'}</h2></div>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button type="button" onClick={() => setMode('draw')} className={`rounded-lg px-3 py-2 ${mode === 'draw' ? 'bg-white shadow' : 'text-slate-500'}`}>Dibujar en el mapa</button>
          <button type="button" onClick={() => setMode('coords')} className={`rounded-lg px-3 py-2 ${mode === 'coords' ? 'bg-white shadow' : 'text-slate-500'}`}>Coordenadas de esquinas</button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Card className="overflow-hidden p-2">
            <ParcelMap parcels={others} draft={valid} onDraftChange={mode === 'draw' ? setDraft : undefined} height="h-[460px]" fitKey={mode} />
          </Card>
          {mode === 'draw' && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" disabled={!corners.length} onClick={() => setCorners(corners.slice(0, -1))}><Undo2 size={15} />Quitar última esquina</button>
              <button type="button" className="btn-ghost" disabled={!corners.length} onClick={() => setCorners([])}><RotateCcw size={15} />Empezar de nuevo</button>
              <button type="button" className="btn-ghost" disabled={valid.length < 3} onClick={() => setDraft(orderCorners(valid))}><Shuffle size={15} />Ordenar esquinas</button>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <Card className="space-y-4 p-5">
            <label className="label">Nombre de la parcela<input className="input" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. La Loma" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="label">Cultivo actual<input className="input" list="crop-list" maxLength={60} value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value })} placeholder="Ej. Maíz" />
                <datalist id="crop-list">{PLANTS.map((p) => <option key={p.id} value={p.name.split(' / ')[0]} />)}</datalist>
              </label>
              <label className="label">Textura del suelo
                <select className="input" value={form.soilTexture} onChange={(e) => setForm({ ...form, soilTexture: e.target.value })}>
                  {Object.entries(TEXTURES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            </div>
            <label className="label">Notas<textarea className="input min-h-[70px] py-2" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Riego, pendiente, historial…" /></label>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold">Esquinas ({valid.length})</h3>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => setPaste(corners.map((c) => `${c.lat}, ${c.lon}`).join('\n'))}><ClipboardPaste size={15} />Pegar lista</button>
                <button type="button" className="btn-soft" onClick={() => { setMode('coords'); setCorners([...corners, blankCorner()]); }}><Plus size={15} />Esquina</button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">Grados decimales (19.4206, -102.0628) o GMS (19°25'14"N, 102°3'46"W). Recorre el terreno en orden.</p>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {corners.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{mode === 'draw' ? 'Toca el mapa en cada esquina de tu terreno.' : 'Agrega al menos 3 esquinas.'}</p>}
              {corners.map((c, i) => (
                <div key={i} className={`grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-xl p-1 ${invalidRows.includes(i) ? 'bg-rose-50' : ''}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold ${i === 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{i + 1}</span>
                  <input aria-label={`Latitud esquina ${i + 1}`} className="input mt-0 font-mono text-xs" value={c.lat} placeholder="Latitud" onChange={(e) => setCorners(corners.map((x, j) => (j === i ? { ...x, lat: e.target.value } : x)))} />
                  <input aria-label={`Longitud esquina ${i + 1}`} className="input mt-0 font-mono text-xs" value={c.lon} placeholder="Longitud" onChange={(e) => setCorners(corners.map((x, j) => (j === i ? { ...x, lon: e.target.value } : x)))} />
                  <button type="button" className="p-2 text-slate-400 hover:text-rose-600" aria-label={`Quitar esquina ${i + 1}`} onClick={() => setCorners(corners.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            {stats && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Área</p><p className="text-base font-extrabold">{formatHa(stats.area)} ha</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Centroide</p><p className="font-mono font-bold">{stats.c.lat.toFixed(5)}, {stats.c.lon.toFixed(5)}</p></div>
              </div>
            )}
            {stats?.crossing && <div className="mt-3"><Notice tone="warn" action={<button type="button" className="btn-ghost" onClick={() => setDraft(orderCorners(valid))}>Ordenar</button>}>Los lados del polígono se cruzan.</Notice></div>}
          </Card>
          {err && <Notice tone="error">{err}</Notice>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => onDone(null)}>Cancelar</button>
            <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : parcel ? 'Guardar cambios' : 'Guardar parcela'}</button>
          </div>
        </div>
      </div>

      {paste !== null && (
        <Modal title="Pegar coordenadas" onClose={() => setPaste(null)}>
          <p className="text-sm text-slate-600">Una esquina por línea: <span className="font-mono">latitud, longitud</span>. Sirve para copiar desde Google Earth, un GPS o una hoja de cálculo.</p>
          <textarea className="input mt-3 min-h-[180px] py-2 font-mono text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'19.4240, -102.0680\n19.4247, -102.0600\n19.4192, -102.0585'} />
          <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setPaste(null)}>Cancelar</button><button type="button" className="btn-primary" onClick={applyPaste}>Usar estas esquinas</button></div>
        </Modal>
      )}
    </form>
  );
}
