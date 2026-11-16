import { useState } from 'react';
import { Logo } from '../App.jsx';
import { useI18n } from '../lib/i18n.js';
import { Notice } from '../components/ui.jsx';
import ProfileForm from '../components/ProfileForm.jsx';
import LangSwitch from '../components/LangSwitch.jsx';

export default function Onboarding({ repo, session, error, locale, onDone }) {
  const { t } = useI18n();
  const [err, setErr] = useState('');
  const suggested = session.principal?.userDetails?.split('@')[0] || '';
  return (
    <div className="min-h-screen">
      <header className="border-b border-emerald-100 bg-white"><div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4"><Logo tagline={t('app.tagline')} /><LangSwitch /></div></header>
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="card p-6">
          <p className="eyebrow">{t('onboarding.step')}</p>
          <h1 className="mt-1 text-2xl font-extrabold">{t('onboarding.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('onboarding.lead')}</p>
          {(error || err) && <div className="mt-4"><Notice tone="error">{error || err}</Notice></div>}
          <div className="mt-5">
            <ProfileForm initial={{ name: suggested, region: '', priorities: ['agua', 'suelo'] }} submitLabel={t('onboarding.submit')}
              onSubmit={async (p) => { try { onDone(await repo.saveProfile({ ...p, locale })); } catch (e) { setErr(e.message); } }} />
          </div>
        </div>
      </main>
    </div>
  );
}
