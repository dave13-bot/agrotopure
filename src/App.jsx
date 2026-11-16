import { lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BookOpen, Cpu, House, LineChart, LogOut, Map as MapIcon, Satellite, UserRound, Users } from 'lucide-react';
import { TEAM } from './data/team.js';
import { cloudRepo, localRepo, loadSession, logoutUrl } from './lib/api.js';
import { I18nContext, translate } from './lib/i18n.js';
import { ALERT_TYPES } from './lib/alerts.js';
import { useParcelData } from './lib/useParcelData.js';
import { Notice, Spinner } from './components/ui.jsx';
import { AlertsBell } from './components/Alerts.jsx';
import LangSwitch from './components/LangSwitch.jsx';
import Welcome from './views/Welcome.jsx';
import Onboarding from './views/Onboarding.jsx';
import Home from './views/Home.jsx';

const Parcels = lazy(() => import('./views/Parcels.jsx'));
const Analysis = lazy(() => import('./views/Analysis.jsx'));
const Sensors = lazy(() => import('./views/Sensors.jsx'));
const Plants = lazy(() => import('./views/Plants.jsx'));
const Account = lazy(() => import('./views/Account.jsx'));
const About = lazy(() => import('./views/About.jsx'));

const BASE_NAV = [
  { id: 'inicio', key: 'nav.home', icon: House },
  { id: 'parcelas', key: 'nav.parcels', icon: MapIcon },
  { id: 'analisis', key: 'nav.analysis', icon: LineChart },
  { id: 'sensores', key: 'nav.sensors', icon: Cpu, fine: true },
  { id: 'plantas', key: 'nav.plants', icon: BookOpen },
  { id: 'nosotros', key: 'nav.about', shortKey: 'nav.aboutShort', icon: Users }
];

const readRoute = () => {
  const [view = 'inicio', ...rest] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { view: [...BASE_NAV.map((n) => n.id), 'cuenta'].includes(view) ? view : 'inicio', arg: rest.join('/') };
};

const storedLocale = () => { try { return localStorage.getItem('agrotopure:locale') || 'es'; } catch { return 'es'; } };

export function Logo({ light, tagline }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/icon.svg" alt="" className="h-10 w-10 rounded-xl shadow-sm" />
      <span>
        <span className={`block text-lg font-extrabold leading-none tracking-tight ${light ? 'text-white' : 'text-emerald-950'}`}><span className={light ? 'text-emerald-200' : 'text-emerald-700'}>AGRO</span><span className="text-gold">-</span><span className={light ? 'text-gold' : 'text-navy'}>TOPURE</span></span>
        <span className={`block text-[11px] font-medium leading-tight ${light ? 'text-emerald-100' : 'text-slate-500'}`}>{tagline}</span>
      </span>
    </span>
  );
}

/** Crédito del equipo al pie de todas las pantallas. */
export function TeamCredit({ onAbout }) {
  const { locale } = useContext(I18nContext);
  const t = (k) => translate(locale, k);
  const body = <><img src={TEAM.logo} alt="" className="h-9 w-9 rounded-full bg-white object-cover object-top" /><span className="text-left leading-tight"><span className="block text-xs font-extrabold text-navy">{t('credit.madeBy')}</span><span className="block">{t('credit.place')}</span></span></>;
  return (
    <span className="mt-3 flex flex-col items-center gap-1.5">
      {onAbout ? <button type="button" onClick={onAbout} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-4 hover:border-gold">{body}</button> : <span className="flex items-center gap-2">{body}</span>}
      <span>{t('credit.license')}</span>
    </span>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [guest, setGuest] = useState(() => { try { return localStorage.getItem('agrotopure:mode') === 'guest'; } catch { return false; } });
  const [profile, setProfile] = useState(undefined);
  const [parcels, setParcels] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(() => { try { return localStorage.getItem('agrotopure:parcel') || ''; } catch { return ''; } });
  const [route, setRoute] = useState(readRoute);
  const [error, setError] = useState('');
  const [locale, setLocaleState] = useState(storedLocale);

  useEffect(() => {
    loadSession().then(setSession);
    const onHash = () => { setRoute(readRoute()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const repo = useMemo(() => {
    if (!session) return null;
    if (session.principal && session.storage) return cloudRepo();
    if (session.principal) return localRepo(`user:${session.principal.userId}`);
    if (guest) return localRepo('guest');
    return null;
  }, [session, guest]);

  const refresh = useCallback(async () => {
    if (!repo) return;
    try {
      const [prof, list, devs] = await Promise.all([repo.getProfile(), repo.listParcels(), repo.listDevices()]);
      setProfile(prof || null);
      setParcels(list);
      setDevices(devs);
      setError('');
    } catch (e) {
      setError(e.message);
      setProfile((p) => (p === undefined ? null : p));
    }
  }, [repo]);

  useEffect(() => { setProfile(undefined); refresh(); }, [refresh]);
  useEffect(() => { if (profile?.locale && profile.locale !== locale) setLocaleState(profile.locale); }, [profile?.locale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem('agrotopure:locale', locale); } catch { /* sin almacenamiento */ } document.documentElement.lang = locale === 'en' ? 'en' : 'es-MX'; }, [locale]);
  useEffect(() => { if (parcels.length && !parcels.some((p) => p.id === selectedId)) setSelectedId(parcels[0].id); }, [parcels, selectedId]);
  useEffect(() => { try { localStorage.setItem('agrotopure:parcel', selectedId); } catch { /* sin almacenamiento */ } }, [selectedId]);

  const t = useCallback((key, vars) => translate(locale, key, vars), [locale]);
  const setLocale = useCallback(async (next) => {
    setLocaleState(next);
    if (repo && profile) { try { setProfile(await repo.saveProfile({ ...profile, locale: next })); } catch { /* se mantiene local */ } }
  }, [repo, profile]);
  const i18n = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  const go = useCallback((view, arg) => { window.location.hash = `/${view}${arg ? `/${arg}` : ''}`; }, []);
  const fine = profile?.fineAnalysis === true;
  const selected = parcels.find((p) => p.id === selectedId) || null;
  const alertTypes = profile?.alertTypes || ALERT_TYPES;
  const watch = useParcelData(selected, repo || { listReadings: async () => [] }, { readings: false, eonet: true, modis: true, alertTypes });

  useEffect(() => { if (route.view === 'sensores' && profile && !fine) go('analisis'); }, [route.view, fine, profile, go]);

  if (!session) return <I18nContext.Provider value={i18n}><div className="flex min-h-screen items-center justify-center"><Spinner label={t('status.loadingApp')} /></div></I18nContext.Provider>;
  if (!repo) {
    return (
      <I18nContext.Provider value={i18n}>
        <Welcome session={session} onGuest={() => { try { localStorage.setItem('agrotopure:mode', 'guest'); } catch { /* sin almacenamiento */ } setGuest(true); }} />
      </I18nContext.Provider>
    );
  }
  if (profile === undefined) return <I18nContext.Provider value={i18n}><div className="flex min-h-screen items-center justify-center"><Spinner label={t('status.openingAccount')} /></div></I18nContext.Provider>;
  if (profile === null) {
    return (
      <I18nContext.Provider value={i18n}>
        <Onboarding repo={repo} session={session} error={error} locale={locale} onDone={(p) => { setProfile(p); go('parcelas'); }} />
      </I18nContext.Provider>
    );
  }

  const nav = BASE_NAV.filter((n) => !n.fine || fine);
  const saveProfile = async (patch) => { const next = await repo.saveProfile({ ...profile, ...patch }); setProfile(next); return next; };
  const ctx = { repo, session, profile, setProfile, saveProfile, parcels, devices, selected, selectedId, setSelectedId, refresh, go, guest, fine, alerts: watch.alerts, alertsLoading: watch.eonetLoading, alertsError: watch.eonetError };
  const exitGuest = () => { try { localStorage.removeItem('agrotopure:mode'); } catch { /* sin almacenamiento */ } setGuest(false); };
  const initials = profile.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <I18nContext.Provider value={i18n}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-[600] border-b border-emerald-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <button onClick={() => go('inicio')} aria-label={t('nav.home')}><Logo tagline={t('app.tagline')} /></button>
            <nav className="hidden items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold lg:flex" aria-label={t('nav.main')}>
              {nav.map((n) => (
                <button key={n.id} onClick={() => go(n.id)} aria-current={route.view === n.id ? 'page' : undefined}
                  className={`rounded-full px-3.5 py-1.5 transition ${route.view === n.id ? 'brand-gradient text-white' : 'text-slate-600 hover:text-emerald-900'}`}>{t(n.key)}</button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block"><LangSwitch /></div>
              <AlertsBell alerts={watch.alerts || []} loading={watch.eonetLoading} error={watch.eonetError}
                enabled={alertTypes} onChange={(next) => saveProfile({ alertTypes: next }).catch(() => {})} onSeeAll={() => go('analisis')} />
              <button onClick={() => go('cuenta')} className={`flex h-10 items-center gap-2 rounded-full border pl-1 pr-3 text-xs font-bold ${route.view === 'cuenta' ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white'}`} aria-label={t('nav.account')}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-white">{initials || <UserRound size={16} />}</span>
                <span className="hidden max-w-[8rem] truncate xl:inline">{profile.name}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="pb-safe mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {repo.mode === 'local' && (
            <div className="mb-5">
              <Notice tone="warn" title={session.principal ? t('status.localTitleUser') : t('status.localTitleGuest')}
                action={!session.principal && <button onClick={exitGuest} className="btn-ghost"><LogOut size={15} />{t('status.login')}</button>}>
                {session.principal ? t('status.localUser') : t('status.localGuest')}
              </Notice>
            </div>
          )}
          {error && <div className="mb-5"><Notice tone="error" title={t('status.loadError')} action={<button className="btn-ghost" onClick={refresh}>{t('common.retry')}</button>}>{error}</Notice></div>}
          <Suspense fallback={<div className="py-16 text-center"><Spinner label={t('common.loading')} /></div>}>
            {route.view === 'inicio' && <Home {...ctx} />}
            {route.view === 'parcelas' && <Parcels {...ctx} arg={route.arg} />}
            {route.view === 'analisis' && <Analysis {...ctx} />}
            {route.view === 'sensores' && fine && <Sensors {...ctx} />}
            {route.view === 'plantas' && <Plants {...ctx} arg={route.arg} />}
            {route.view === 'nosotros' && <About />}
            {route.view === 'cuenta' && <Account {...ctx} onLogout={() => { if (session.principal) window.location.href = logoutUrl(); else exitGuest(); }} />}
          </Suspense>
          <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500">
            <Satellite size={12} className="mr-1 inline" />{t('footer')}
            <TeamCredit onAbout={() => go('nosotros')} />
            <span className="mt-2 flex justify-center sm:hidden"><LangSwitch /></span>
          </footer>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-[600] border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={t('nav.mobile')}>
          <div className={`grid ${nav.length === 6 ? 'grid-cols-6' : 'grid-cols-5'}`}>
            {nav.map((n) => (
              <button key={n.id} onClick={() => go(n.id)} aria-current={route.view === n.id ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${route.view === n.id ? 'text-emerald-800' : 'text-slate-500'}`}>
                <n.icon size={20} strokeWidth={route.view === n.id ? 2.4 : 1.8} />{t(n.shortKey || n.key)}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </I18nContext.Provider>
  );
}
