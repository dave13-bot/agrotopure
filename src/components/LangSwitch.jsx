import { Languages } from 'lucide-react';
import { LOCALES, useI18n } from '../lib/i18n.js';

/** Selector de idioma español / inglés. */
export default function LangSwitch({ compact }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5" role="group" aria-label={t('profile.language')}>
      {!compact && <Languages size={14} className="ml-1.5 text-slate-400" aria-hidden="true" />}
      {Object.entries(LOCALES).map(([code, label]) => (
        <button key={code} type="button" onClick={() => setLocale(code)} aria-pressed={locale === code} title={label}
          className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase transition ${locale === code ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:text-emerald-800'}`}>
          {code}
        </button>
      ))}
    </div>
  );
}
