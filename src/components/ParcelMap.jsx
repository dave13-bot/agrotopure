import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, LocateFixed } from 'lucide-react';
import { BASE_LAYERS, GIBS_WMS, NASA_OVERLAYS } from '../lib/layers.js';
import { useI18n } from '../lib/i18n.js';

const MICHOACAN = [19.57, -101.71];

/**
 * Mapa de parcelas.
 * - parcels: [{id, name, coordinates:[{lat,lon}]}]; selectedId; onSelect(id)
 * - draft: [{lat,lon}] y onDraftChange(points): activa el modo dibujo (clic = nueva esquina, arrastrar = mover).
 */
export default function ParcelMap({ parcels = [], selectedId, onSelect, draft, onDraftChange, overlays: initialOverlays = [], height = 'h-[420px]', fitKey }) {
  const { t, locale } = useI18n();
  const el = useRef(null);
  const map = useRef(null);
  const groups = useRef({});
  const overlayLayers = useRef({});
  const baseLayers = useRef({});
  const draftRef = useRef(draft);
  const changeRef = useRef(onDraftChange);
  const [base, setBase] = useState('landsat');
  const [overlays, setOverlays] = useState(initialOverlays);
  const [panel, setPanel] = useState(false);
  const [geoError, setGeoError] = useState('');
  const cornerLabel = useRef(t('parcels.corner'));
  cornerLabel.current = t('parcels.corner');
  draftRef.current = draft;
  changeRef.current = onDraftChange;
  const drawing = Boolean(onDraftChange);

  useEffect(() => {
    const m = L.map(el.current, { center: MICHOACAN, zoom: 8, zoomControl: true, attributionControl: true });
    map.current = m;
    for (const b of BASE_LAYERS) {
      baseLayers.current[b.id] = b.wms
        ? L.tileLayer.wms(GIBS_WMS, { layers: b.wms, format: 'image/jpeg', attribution: b.attribution, maxZoom: b.maxZoom })
        : L.tileLayer(b.url, { attribution: b.attribution, maxZoom: b.maxZoom });
    }
    for (const o of NASA_OVERLAYS) {
      overlayLayers.current[o.id] = L.tileLayer.wms(GIBS_WMS, { layers: o.layer, format: 'image/png', transparent: true, opacity: o.opacity, attribution: 'NASA GIBS / EOSDIS', maxZoom: 19 });
    }
    groups.current.parcels = L.layerGroup().addTo(m);
    groups.current.draft = L.layerGroup().addTo(m);
    m.on('click', (e) => {
      if (!changeRef.current) return;
      changeRef.current([...(draftRef.current || []), { lat: +e.latlng.lat.toFixed(6), lon: +e.latlng.lng.toFixed(6) }]);
    });
    const ro = new ResizeObserver(() => { if (map.current) m.invalidateSize({ animate: false }); });
    ro.observe(el.current);
    return () => { ro.disconnect(); m.off(); m.stop(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    Object.entries(baseLayers.current).forEach(([id, l]) => (id === base ? l.addTo(m) : m.removeLayer(l)));
    baseLayers.current[base].bringToBack();
  }, [base]);

  useEffect(() => {
    const m = map.current;
    Object.entries(overlayLayers.current).forEach(([id, l]) => (overlays.includes(id) ? l.addTo(m) : m.removeLayer(l)));
  }, [overlays]);

  // Parcelas guardadas.
  useEffect(() => {
    const g = groups.current.parcels;
    g.clearLayers();
    for (const p of parcels) {
      if (!p.coordinates?.length) continue;
      const selected = p.id === selectedId;
      const poly = L.polygon(p.coordinates.map((c) => [c.lat, c.lon]), {
        color: selected ? '#facc15' : '#34d399', weight: selected ? 3 : 2, fillOpacity: drawing ? 0.05 : selected ? 0.25 : 0.12, interactive: !drawing
      }).bindTooltip(p.name, { sticky: true });
      if (onSelect && !drawing) poly.on('click', () => onSelect(p.id));
      poly.addTo(g);
    }
  }, [parcels, selectedId, drawing, onSelect]);

  // Encuadre.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const sel = parcels.find((p) => p.id === selectedId);
    const pts = (draft?.length ? draft : sel?.coordinates?.length ? sel.coordinates : parcels.flatMap((p) => p.coordinates || []));
    if (pts.length >= 2) m.fitBounds(L.latLngBounds(pts.map((c) => [c.lat, c.lon])).pad(0.25), { maxZoom: 18, animate: false });
    else if (pts.length === 1) m.setView([pts[0].lat, pts[0].lon], 17, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, fitKey, parcels.length]);

  // Borrador (dibujo / edición por esquinas).
  useEffect(() => {
    const g = groups.current.draft;
    g.clearLayers();
    if (!draft?.length) return;
    const latlngs = draft.map((c) => [c.lat, c.lon]);
    if (draft.length >= 3) L.polygon(latlngs, { color: '#f59e0b', weight: 3, fillOpacity: 0.2, dashArray: '6 4', interactive: false }).addTo(g);
    else if (draft.length === 2) L.polyline(latlngs, { color: '#f59e0b', weight: 3, dashArray: '6 4', interactive: false }).addTo(g);
    draft.forEach((c, i) => {
      const mk = L.marker([c.lat, c.lon], {
        draggable: drawing,
        icon: L.divIcon({ className: '', html: `<div class="vertex-marker${i === 0 ? ' first' : ''}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] }),
        title: `${cornerLabel.current} ${i + 1}`
      }).bindTooltip(`${cornerLabel.current} ${i + 1}`, { direction: 'top', offset: [0, -6] });
      mk.on('dragend', (e) => {
        const ll = e.target.getLatLng();
        changeRef.current?.(draftRef.current.map((p, j) => (j === i ? { lat: +ll.lat.toFixed(6), lon: +ll.lng.toFixed(6) } : p)));
      });
      mk.addTo(g);
    });
  }, [draft, drawing]);

  const locate = () => {
    setGeoError('');
    if (!navigator.geolocation) { setGeoError(t('parcels.myLocation')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => map.current.setView([pos.coords.latitude, pos.coords.longitude], 17),
      () => setGeoError(t('parcels.myLocation')),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className={`relative ${height} w-full`}>
      <div ref={el} className="h-full w-full" aria-label={t('nav.parcels')} />
      <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
        <button type="button" onClick={() => setPanel((v) => !v)} className="flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-slate-700 shadow-md" aria-expanded={panel}><Layers size={16} />{t('parcels.nasaLayers')}</button>
        <button type="button" onClick={locate} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-md" title={t('parcels.myLocation')} aria-label={t('parcels.myLocation')}><LocateFixed size={17} /></button>
        {panel && (
          <div className="w-72 rounded-2xl bg-white p-3 text-xs shadow-xl">
            <p className="mb-1 font-extrabold text-slate-700">{t('parcels.baseMap')}</p>
            {BASE_LAYERS.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2 py-1"><input type="radio" name="base" checked={base === b.id} onChange={() => setBase(b.id)} />{locale === 'en' ? b.nameEn : b.name}</label>
            ))}
            <p className="mb-1 mt-2 font-extrabold text-slate-700">{t('parcels.nasaData')}</p>
            {NASA_OVERLAYS.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-start gap-2 py-1" title={locale === 'en' ? o.legendEn : o.legend}>
                <input type="checkbox" className="mt-0.5" checked={overlays.includes(o.id)} onChange={(e) => setOverlays((v) => (e.target.checked ? [...v, o.id] : v.filter((x) => x !== o.id)))} />
                <span>{locale === 'en' ? o.nameEn : o.name}</span>
              </label>
            ))}
            <p className="mt-2 text-[10px] leading-snug text-slate-500">{t('parcels.layerNote')}</p>
          </div>
        )}
      </div>
      {drawing && <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow">{t('parcels.mapHint')}</div>}
      {geoError && <div className="absolute bottom-3 right-3 z-[500] rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 shadow">{geoError}</div>}
    </div>
  );
}
