import { useMemo, useState } from 'react';
import { checkLand } from '../lib/api.js';
import { ArrowLeft, ClipboardPaste, Pencil, Plus, RotateCcw, Shuffle, Trash2, Undo2 } from 'lucide-react';
import ParcelMap from '../components/ParcelMap.jsx';
import { Badge, Card, Empty, Modal, Notice, SectionTitle } from '../components/ui.jsx';
import { useI18n } from '../lib/i18n.js';
import { formatHa, isSelfIntersecting, orderCorners, parseCoord, polygonAreaM2, centroid, MAX_PARCEL_HA, MIN_PARCEL_M2 } from '../lib/geo.js';
import { TEXTURES } from '../lib/agro.js';
import { localizedPlants } from '../data/plants.js';

export default function Parcels({ repo, parcels, selectedId, setSelectedId, refresh, go, arg }) {
  const editing = arg === 'nueva' ? 'new' : arg?.startsWith('editar/') ? arg.slice(7) : null;
  const { t } = useI18n();
  if (editing) {
    const parcel = editing === 'new' ? null : parcels.find((p) => p.id === editing);
    if (editing !== 'new' && !parcel) return <Empty title={t('parcels.notFound')} action={<button className="btn-ghost" onClick={() => go('parcelas')}>{t('common.back')}</button>} />;
    return <ParcelEditor key={editing} repo={repo} parcel={parcel} parcels={parcels} onDone={async (saved) => { await refresh(); if (saved) setSelectedId(saved.id); go('parcelas'); }} />;
  }
  return <ParcelList repo={repo} parcels={parcels} selectedId={selectedId} setSelectedId={setSelectedId} refresh={refresh} go={go} />;
}

function ParcelList({ repo, parcels, selectedId, setSelectedId, refresh, go }) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(null);
  const [err, setErr] = useState('');
  const selected = parcels.find((p) => p.id === selectedId);
  const remove = async () => {
    try { await repo.deleteParcel(confirm.id); setConfirm(null); await refresh(); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionTitle eyebrow={t('nav.parcels')} title={t('parcels.title')} text={t('parcels.lead')}
          action={<button className="btn-primary" onClick={() => go('parcelas', 'nueva')}><Plus size={16} />{t('parcels.new')}</button>} />
      </Card>
      {err && <Notice tone="error">{err}</Notice>}
      {parcels.length === 0 ? (
        <Empty icon={Plus} title={t('parcels.firstTitle')} text={t('parcels.firstText')} action={<button className="btn-primary" onClick={() => go('parcelas', 'nueva')}>{t('parcels.start')}</button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="overflow-hidden p-2 lg:col-span-8"><ParcelMap parcels={parcels} selectedId={selectedId} onSelect={setSelectedId} height="h-[460px]" /></Card>
          <div className="space-y-3 lg:col-span-4">
            {parcels.map((p, i) => (
              <Card key={p.id} className={`p-4 transition ${p.id === selectedId ? 'ring-2 ring-emerald-500' : ''}`}>
                <button className="w-full text-left" onClick={() => setSelectedId(p.id)}>
                  <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-slate-400">{t('parcels.terrain')} {String(i + 1).padStart(2, '0')}</span><Badge>{formatHa(p.areaHa)} {t('parcels.hectares')}</Badge></div>
                  <h3 className="mt-1 text-base font-extrabold">{p.name}</h3>
                  <p className="font-mono text-[11px] text-slate-500">{p.centroid.lat.toFixed(5)}, {p.centroid.lon.toFixed(5)} · {p.coordinates.length} {t('parcels.points')}</p>
                  <p className="mt-1 text-xs"><b>{t('parcels.crop')}:</b> <span className="font-bold text-emerald-700">{p.crop || t('parcels.noCrop')}</span> · <b>{t('parcels.texture')}:</b> {t(`textures.${p.soilTexture || 'desconocido'}`)}</p>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-soft" onClick={() => { setSelectedId(p.id); go('analisis'); }}>{t('parcels.analyze')}</button>
                  <button className="btn-ghost" onClick={() => go('parcelas', `editar/${p.id}`)}><Pencil size={14} />{t('common.edit')}</button>
                  <button className="btn-danger" onClick={() => setConfirm(p)} aria-label={`${t('common.delete')} ${p.name}`}><Trash2 size={14} /></button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {selected?.notes && <Notice tone="info" title={t('parcels.notesOf', { name: selected.name })}>{selected.notes}</Notice>}
      {confirm && (
        <Modal title={t('parcels.deleteTitle')} onClose={() => setConfirm(null)}>
          <p className="text-sm text-slate-600">{t('parcels.deleteText', { name: confirm.name })}</p>
          <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</button><button className="btn-danger" onClick={remove}><Trash2 size={15} />{t('common.delete')}</button></div>
        </Modal>
      )}
    </div>
  );
}

const blankCorner = () => ({ lat: '', lon: '' });

function ParcelEditor({ repo, parcel, parcels, onDone }) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState({ name: parcel?.name || '', crop: parcel?.crop || '', soilTexture: parcel?.soilTexture || 'desconocido', sowDate: parcel?.sowDate || '', notes: parcel?.notes || '' });
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

  const tooBig = Boolean(stats && stats.area > MAX_PARCEL_HA);
  const tooSmall = Boolean(stats && stats.area * 1e4 < MIN_PARCEL_M2);
  const fmtMax = MAX_PARCEL_HA.toLocaleString(locale === 'en' ? 'en-US' : 'es-MX');
  const setDraft = (pts) => setCorners(pts.map((p) => ({ lat: String(p.lat), lon: String(p.lon) })));
  const others = parcels.filter((p) => p.id !== parcel?.id);
  const cropList = localizedPlants(locale);

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (invalidRows.length) { setErr(`${t('parcels.corner')} ${invalidRows[0] + 1}`); return; }
    if (valid.length < 3) { setErr(t('parcels.min3')); return; }
    if (stats?.crossing) { setErr(t('parcels.crossing')); return; }
    if (tooBig) { setErr(t('parcels.tooBig', { max: fmtMax })); return; }
    if (tooSmall) { setErr(t('parcels.tooSmall')); return; }
    setBusy(true);
    try {
      // Máscara tierra/agua de NASA GIBS: no se aceptan parcelas en el océano ni en cuerpos de agua.
      const land = await checkLand(valid);
      if (land.checked && !land.onLand) { setErr(t('parcels.onWater')); return; }
      onDone(await repo.saveParcel({ ...form, coordinates: valid }, parcel?.id));
    } catch (ex) { setErr(ex.code === 'on_water' ? t('parcels.onWater') : ex.code === 'too_big' ? t('parcels.tooBig', { max: fmtMax }) : ex.message); } finally { setBusy(false); }
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
          <button type="button" className="btn-ghost" onClick={() => onDone(null)}><ArrowLeft size={16} />{t('nav.parcels')}</button>
          <div><p className="eyebrow">{parcel ? t('parcels.edit') : t('parcels.new')}</p><h2 className="text-lg font-extrabold">{form.name || '—'}</h2></div>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button type="button" onClick={() => setMode('draw')} className={`rounded-lg px-3 py-2 ${mode === 'draw' ? 'bg-white shadow' : 'text-slate-500'}`}>{t('parcels.drawMode')}</button>
          <button type="button" onClick={() => setMode('coords')} className={`rounded-lg px-3 py-2 ${mode === 'coords' ? 'bg-white shadow' : 'text-slate-500'}`}>{t('parcels.coordMode')}</button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Card className="overflow-hidden p-2">
            <ParcelMap parcels={others} draft={valid} onDraftChange={mode === 'draw' ? setDraft : undefined} height="h-[460px]" fitKey={mode} />
          </Card>
          {mode === 'draw' && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" disabled={!corners.length} onClick={() => setCorners(corners.slice(0, -1))}><Undo2 size={15} />{t('parcels.undo')}</button>
              <button type="button" className="btn-ghost" disabled={!corners.length} onClick={() => setCorners([])}><RotateCcw size={15} />{t('parcels.restart')}</button>
              <button type="button" className="btn-ghost" disabled={valid.length < 3} onClick={() => setDraft(orderCorners(valid))}><Shuffle size={15} />{t('parcels.order')}</button>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <Card className="space-y-4 p-5">
            <label className="label">{t('parcels.nameLabel')}<input className="input" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('parcels.namePh')} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="label">{t('parcels.crop')}<input className="input" list="crop-list" maxLength={60} value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value })} placeholder={t('parcels.cropPh')} />
                <datalist id="crop-list">{cropList.map((p) => <option key={p.id} value={p.name.split(' / ')[0]} />)}</datalist>
              </label>
              <label className="label">{t('parcels.texture')}
                <select className="input" value={form.soilTexture} onChange={(e) => setForm({ ...form, soilTexture: e.target.value })}>
                  {Object.keys(TEXTURES).map((k) => <option key={k} value={k}>{t(`textures.${k}`)}</option>)}
                </select>
              </label>
            </div>
            <label className="label">{t('parcels.sowDate')} <span className="font-normal normal-case text-slate-400">({t('common.optional')})</span><input type="date" className="input" value={form.sowDate} onChange={(e) => setForm({ ...form, sowDate: e.target.value })} /><span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-slate-500">{t('parcels.sowDateHelp')}</span></label>
            <label className="label">{t('common.notes')}<textarea className="input min-h-[70px] py-2" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('parcels.notesPh')} /></label>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold">{t('parcels.corners', { n: valid.length })}</h3>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => setPaste(corners.map((c) => `${c.lat}, ${c.lon}`).join('\n'))}><ClipboardPaste size={15} />{t('parcels.pasteList')}</button>
                <button type="button" className="btn-soft" onClick={() => { setMode('coords'); setCorners([...corners, blankCorner()]); }}><Plus size={15} />{t('parcels.corner')}</button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('parcels.coordHelp')}</p>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {corners.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{mode === 'draw' ? t('parcels.drawHelp') : t('parcels.min3')}</p>}
              {corners.map((c, i) => (
                <div key={i} className={`grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-xl p-1 ${invalidRows.includes(i) ? 'bg-rose-50' : ''}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold ${i === 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{i + 1}</span>
                  <input aria-label={`${t('parcels.latitude')} ${i + 1}`} className="input mt-0 font-mono text-xs" value={c.lat} placeholder={t('parcels.latitude')} onChange={(e) => setCorners(corners.map((x, j) => (j === i ? { ...x, lat: e.target.value } : x)))} />
                  <input aria-label={`${t('parcels.longitude')} ${i + 1}`} className="input mt-0 font-mono text-xs" value={c.lon} placeholder={t('parcels.longitude')} onChange={(e) => setCorners(corners.map((x, j) => (j === i ? { ...x, lon: e.target.value } : x)))} />
                  <button type="button" className="p-2 text-slate-400 hover:text-rose-600" aria-label={`${t('common.remove')} ${i + 1}`} onClick={() => setCorners(corners.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            {stats && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className={`rounded-xl p-3 ${tooBig || tooSmall ? 'bg-rose-50 text-rose-800' : 'bg-slate-50'}`}><p className={tooBig || tooSmall ? '' : 'text-slate-500'}>{t('parcels.area')}</p><p className="text-base font-extrabold">{stats.area < 1000 ? formatHa(stats.area) : Math.round(stats.area).toLocaleString(locale === "en" ? "en-US" : "es-MX")} {t('parcels.hectares')}</p><p className="text-[10px] opacity-70">{t('parcels.maxArea', { max: fmtMax })}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">{t('parcels.centroid')}</p><p className="font-mono font-bold">{stats.c.lat.toFixed(5)}, {stats.c.lon.toFixed(5)}</p></div>
              </div>
            )}
            {tooBig && <div className="mt-3"><Notice tone="error">{t('parcels.tooBig', { max: fmtMax })}</Notice></div>}
            {tooSmall && <div className="mt-3"><Notice tone="error">{t('parcels.tooSmall')}</Notice></div>}
            {stats?.crossing && <div className="mt-3"><Notice tone="warn" action={<button type="button" className="btn-ghost" onClick={() => setDraft(orderCorners(valid))}>{t('parcels.order')}</button>}>{t('parcels.crossing')}</Notice></div>}
          </Card>
          {err && <Notice tone="error">{err}</Notice>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => onDone(null)}>{t('common.cancel')}</button>
            <button className="btn-primary" disabled={busy || tooBig || tooSmall}>{busy ? t('common.saving') : parcel ? t('parcels.saveChanges') : t('parcels.saveParcel')}</button>
          </div>
        </div>
      </div>

      {paste !== null && (
        <Modal title={t('parcels.pasteTitle')} onClose={() => setPaste(null)}>
          <p className="text-sm text-slate-600">{t('parcels.pasteHelp')}</p>
          <textarea className="input mt-3 min-h-[180px] py-2 font-mono text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'19.4240, -102.0680\n19.4247, -102.0600\n19.4192, -102.0585'} />
          <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setPaste(null)}>{t('common.cancel')}</button><button type="button" className="btn-primary" onClick={applyPaste}>{t('parcels.pasteApply')}</button></div>
        </Modal>
      )}
    </form>
  );
}
