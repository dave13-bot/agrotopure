import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Cpu, House, LineChart, LogOut, Map as MapIcon, Satellite, UserRound } from 'lucide-react';
import { cloudRepo, localRepo, loadSession, logoutUrl } from './lib/api.js';
import { Notice, Spinner } from './components/ui.jsx';
import Welcome from './views/Welcome.jsx';
import Onboarding from './views/Onboarding.jsx';
import Home from './views/Home.jsx';

const Parcels = lazy(() => import('./views/Parcels.jsx'));
const Analysis = lazy(() => import('./views/Analysis.jsx'));
const Sensors = lazy(() => import('./views/Sensors.jsx'));
const Plants = lazy(() => import('./views/Plants.jsx'));
const Account = lazy(() => import('./views/Account.jsx'));

export const NAV = [
  { id: 'inicio', label: 'Inicio', icon: House },
  { id: 'parcelas', label: 'Parcelas', icon: MapIcon },
  { id: 'analisis', label: 'Análisis', icon: LineChart },
  { id: 'sensores', label: 'Sensores', icon: Cpu },
  { id: 'plantas', label: 'Plantas', icon: BookOpen }
];

const readRoute = () => {
  const [view = 'inicio', ...rest] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { view: [...NAV.map((n) => n.id), 'cuenta'].includes(view) ? view : 'inicio', arg: rest.join('/') };
};

export function Logo({ light }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/icon.svg" alt="" className="h-10 w-10 rounded-xl shadow-sm" />
      <span>
        <span className={`block text-lg font-extrabold leading-none tracking-tight ${light ? 'text-white' : 'text-emerald-950'}`}>AGROTO<span className={light ? 'text-emerald-200' : 'text-emerald-600'}>PURE</span></span>
        <span className={`block text-[11px] font-medium leading-tight ${light ? 'text-emerald-100' : 'text-slate-500'}`}>Datos NASA + sensores de suelo</span>
      </span>
    </span>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [guest, setGuest] = useState(() => { try { return localStorage.getItem('agrotopure:guest') === '1'; } catch { return false; } });
  const [profile, setProfile] = useState(undefined);
  const [parcels, setParcels] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(() => { try { return localStorage.getItem('agrotopure:parcel') || ''; } catch { return ''; } });
  const [route, setRoute] = useState(readRoute);
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (parcels.length && !parcels.some((p) => p.id === selectedId)) setSelectedId(parcels[0].id);
  }, [parcels, selectedId]);
  useEffect(() => { try { localStorage.setItem('agrotopure:parcel', selectedId); } catch { /* sin almacenamiento */ } }, [selectedId]);

  const go = useCallback((view, arg) => { window.location.hash = `/${view}${arg ? `/${arg}` : ''}`; }, []);

  if (!session) return <div className="flex min-h-screen items-center justify-center"><Spinner label="Cargando AGROTOPURE…" /></div>;
  if (!repo) return <Welcome session={session} onGuest={() => { try { localStorage.setItem('agrotopure:guest', '1'); } catch { /* */ } setGuest(true); }} />;
  if (profile === undefined) return <div className="flex min-h-screen items-center justify-center"><Spinner label="Abriendo tu cuenta…" /></div>;
  if (profile === null) return <Onboarding repo={repo} session={session} error={error} onDone={(p) => { setProfile(p); go('parcelas'); }} />;

  const selected = parcels.find((p) => p.id === selectedId) || null;
  const ctx = { repo, session, profile, setProfile, parcels, devices, selected, selectedId, setSelectedId, refresh, go, guest };
  const exitGuest = () => { try { localStorage.removeItem('agrotopure:guest'); } catch { /* */ } setGuest(false); };
  const initials = profile.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[600] border-b border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <button onClick={() => go('inicio')} aria-label="Ir al inicio"><Logo /></button>
          <nav className="hidden items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold md:flex" aria-label="Menú principal">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => go(n.id)} aria-current={route.view === n.id ? 'page' : undefined}
                className={`rounded-full px-3.5 py-1.5 transition ${route.view === n.id ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:text-emerald-900'}`}>{n.label}</button>
            ))}
          </nav>
          <button onClick={() => go('cuenta')} className={`flex h-10 items-center gap-2 rounded-full border pl-1 pr-3 text-xs font-bold ${route.view === 'cuenta' ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white'}`} aria-label="Mi cuenta">
            <span className="flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-white">{initials || <UserRound size={16} />}</span>
            <span className="hidden max-w-[9rem] truncate sm:inline">{profile.name}</span>
          </button>
        </div>
      </header>

      <main className="pb-safe mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {repo.mode === 'local' && (
          <div className="mb-5">
            <Notice tone="warn" title={session.principal ? 'La nube aún no está configurada' : 'Estás usando AGROTOPURE sin cuenta'}
              action={!session.principal && <button onClick={exitGuest} className="btn-ghost"><LogOut size={15} />Iniciar sesión</button>}>
              {session.principal
                ? 'Tu sesión es válida, pero el servidor no tiene base de datos conectada: por ahora tus parcelas se guardan solo en este navegador y los dispositivos ESP32/Raspberry Pi no pueden enviar lecturas.'
                : 'Tus parcelas se guardan solo en este navegador. Crea una cuenta para guardarlas en la nube, usarlas desde el celular y conectar sensores ESP32/Raspberry Pi.'}
            </Notice>
          </div>
        )}
        {error && <div className="mb-5"><Notice tone="error" title="No se pudieron cargar tus datos" action={<button className="btn-ghost" onClick={refresh}>Reintentar</button>}>{error}</Notice></div>}
        <Suspense fallback={<div className="py-16 text-center"><Spinner label="Cargando…" /></div>}>
          {route.view === 'inicio' && <Home {...ctx} />}
          {route.view === 'parcelas' && <Parcels {...ctx} arg={route.arg} />}
          {route.view === 'analisis' && <Analysis {...ctx} />}
          {route.view === 'sensores' && <Sensors {...ctx} />}
          {route.view === 'plantas' && <Plants {...ctx} arg={route.arg} />}
          {route.view === 'cuenta' && <Account {...ctx} onLogout={() => { if (session.principal) window.location.href = logoutUrl(); else exitGuest(); }} />}
        </Suspense>
        <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500">
          <Satellite size={12} className="mr-1 inline" />AGROTOPURE · NASA Space Apps 2026 · Reto Field Shift · Datos: NASA POWER, SMAP, MODIS (ORNL DAAC), ECOSTRESS, SRTM (GIBS)
        </footer>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-[600] border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Menú principal móvil">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} aria-current={route.view === n.id ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${route.view === n.id ? 'text-emerald-800' : 'text-slate-500'}`}>
              <n.icon size={20} strokeWidth={route.view === n.id ? 2.4 : 1.8} />{n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
