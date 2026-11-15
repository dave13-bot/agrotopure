import { Plus } from 'lucide-react';
import { Card, Empty } from './ui.jsx';
import { formatHa } from '../lib/geo.js';

/** Encabezado común con selector de parcela (Análisis y Sensores). */
export function ParcelHeader({ eyebrow, parcels, selected, setSelectedId, go, children }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="truncate text-xl font-extrabold sm:text-2xl">{selected.name}</h2>
        <p className="text-xs text-slate-500">{formatHa(selected.areaHa)} ha · {selected.crop || 'sin cultivo'} · Lat {selected.centroid.lat.toFixed(4)}, Lon {selected.centroid.lon.toFixed(4)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="parcel-picker">Parcela</label>
        <select id="parcel-picker" className="input mt-0 min-w-[200px]" value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
          {parcels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {children}
      </div>
    </Card>
  );
}

export const NoParcels = ({ go }) => (
  <Empty icon={Plus} title="Primero registra una parcela" text="El análisis y los sensores se organizan por parcela." action={<button className="btn-primary" onClick={() => go('parcelas', 'nueva')}><Plus size={16} />Registrar parcela</button>} />
);
