import { useState } from 'react';
import { PRIORITY_LABELS } from '../lib/agro.js';

export default function ProfileForm({ initial, onSubmit, submitLabel = 'Guardar' }) {
  const [form, setForm] = useState({ name: '', region: '', priorities: [], ...initial });
  const [busy, setBusy] = useState(false);
  const toggle = (k) => setForm((f) => ({ ...f, priorities: f.priorities.includes(k) ? f.priorities.filter((x) => x !== k) : [...f.priorities, k] }));
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); } finally { setBusy(false); } }}>
      <label className="label">Nombre<input className="input" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tu nombre o el de tu rancho" /></label>
      <label className="label">Municipio / región<input className="input" maxLength={80} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Ej. Uruapan, Michoacán" /></label>
      <fieldset>
        <legend className="label">Tus prioridades (pesan doble en la rotación)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
            <button type="button" key={k} onClick={() => toggle(k)} aria-pressed={form.priorities.includes(k)}
              className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${form.priorities.includes(k) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{v}</button>
          ))}
        </div>
      </fieldset>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
    </form>
  );
}
