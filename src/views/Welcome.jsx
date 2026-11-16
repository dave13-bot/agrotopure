import { Bell, Cpu, Leaf, Satellite, Sprout } from 'lucide-react';
import { loginUrl } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Logo } from '../App.jsx';
import LangSwitch from '../components/LangSwitch.jsx';

const GitHubIcon = () => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" /></svg>;
const MicrosoftIcon = () => <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#f25022" d="M2 2h9.5v9.5H2z" /><path fill="#7fba00" d="M12.5 2H22v9.5h-9.5z" /><path fill="#00a4ef" d="M2 12.5h9.5V22H2z" /><path fill="#ffb900" d="M12.5 12.5H22V22h-9.5z" /></svg>;

export default function Welcome({ session, onGuest }) {
  const { t } = useI18n();
  const canLogin = session.apiReachable;
  const features = [[Satellite, 'welcome.f1t', 'welcome.f1d'], [Bell, 'welcome.f2t', 'welcome.f2d'], [Sprout, 'welcome.f3t', 'welcome.f3d']];
  return (
    <div className="min-h-screen">
      <header className="border-b border-emerald-100 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"><Logo tagline={t('app.tagline')} /><LangSwitch /></div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-12">
        <section className="brand-gradient rounded-3xl p-6 text-white shadow-card sm:p-8 lg:col-span-5">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">{t('welcome.eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">{t('welcome.title')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-emerald-50">{t('welcome.lead')}</p>
          <div className="mt-6 space-y-3">
            <a href={loginUrl('github')} aria-disabled={!canLogin} className={`flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-3.5 text-sm font-extrabold text-emerald-950 shadow-md hover:bg-emerald-50 ${canLogin ? '' : 'pointer-events-none opacity-60'}`}><GitHubIcon />{t('welcome.github')}</a>
            <a href={loginUrl('aad')} aria-disabled={!canLogin} className={`flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-3.5 text-sm font-extrabold text-emerald-950 shadow-md hover:bg-emerald-50 ${canLogin ? '' : 'pointer-events-none opacity-60'}`}><MicrosoftIcon />{t('welcome.microsoft')}</a>
            <button onClick={onGuest} className="w-full rounded-2xl border border-white/30 bg-white/10 py-3 text-sm font-bold text-white hover:bg-white/20">{t('welcome.guest')}</button>
          </div>
          {!canLogin && <p className="mt-3 text-xs text-emerald-100">{t('welcome.offline')}</p>}
          <p className="mt-4 text-[11px] leading-relaxed text-emerald-100">{t('welcome.privacy')}</p>
        </section>
        <section className="space-y-4 lg:col-span-7">
          <div className="card p-6">
            <p className="eyebrow">{t('welcome.satFirst')}</p>
            <h2 className="mt-1 text-xl font-extrabold">{t('welcome.f1t')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('welcome.satFirstText')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {features.map(([Icon, title, desc]) => (
              <div key={title} className="card p-5"><Icon className="text-emerald-700" size={22} /><h3 className="mt-2 text-sm font-extrabold">{t(title)}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{t(desc)}</p></div>
            ))}
          </div>
          <div className="card flex items-center gap-3 p-5 text-sm text-slate-600"><Leaf className="shrink-0 text-emerald-700" />{t('welcome.extra')}</div>
          <div className="card flex items-center gap-3 p-5 text-xs text-slate-500"><Cpu className="shrink-0 text-slate-400" size={18} />{t('analysis.fineLead')}</div>
        </section>
      </main>
    </div>
  );
}
