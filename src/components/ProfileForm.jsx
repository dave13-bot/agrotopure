import { useState } from 'react';
import { useI18n } from '../lib/i18n.js';
import { PRIORITY_LABELS } from '../lib/agro.js';
import LangSwitch from './LangSwitch.jsx';

export default function ProfileForm({ initial, onSubmit, submitLabel, showLang }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', region: '', priorities: [], ...initial });
  const [busy, setBusy] = useState(false);
  const toggle = (k) => setForm((f) => ({ ...f, priorities: f.priorities.includes(k) ? f.priorities.filter((x) => x !== k) : [...f.priorities, k] }));
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); } finally { setBusy(false); } }}>
      <label className="label">{t('profile.name')}<input className="input" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('profile.namePh')} /></label>
      <label className="label">{t('profile.region')}<input className="input" maxLength={80} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder={t('profile.regionPh')} /></label>
      {showLang && <div><span className="label">{t('profile.language')}</span><div className="mt-1.5"><LangSwitch /></div></div>}
      <fieldset>
        <legend className="label">{t('profile.priorities')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.keys(PRIORITY_LABELS).map((k) => (
            <button type="button" key={k} onClick={() => toggle(k)} aria-pressed={form.priorities.includes(k)}
              className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${form.priorities.includes(k) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{t(`priorities.${k}`)}</button>
          ))}
        </div>
      </fieldset>
      <button className="btn-primary w-full" disabled={busy}>{busy ? t('common.saving') : submitLabel}</button>
    </form>
  );
}
