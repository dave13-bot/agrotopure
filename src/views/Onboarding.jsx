import { useState } from 'react';
import { Logo } from '../App.jsx';
import { Notice } from '../components/ui.jsx';
import ProfileForm from '../components/ProfileForm.jsx';

export default function Onboarding({ repo, session, error, onDone }) {
  const [err, setErr] = useState('');
  const suggested = session.principal?.userDetails?.split('@')[0] || '';
  return (
    <div className="min-h-screen">
      <header className="border-b border-emerald-100 bg-white"><div className="mx-auto flex h-16 max-w-3xl items-center px-4"><Logo /></div></header>
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="card p-6">
          <p className="eyebrow">Paso 1 de 2 · Tu perfil</p>
          <h1 className="mt-1 text-2xl font-extrabold">Bienvenido a AGROTOPURE</h1>
          <p className="mt-1 text-sm text-slate-500">Con estos datos personalizamos las estrategias de rotación. Después registrarás tu primera parcela.</p>
          {(error || err) && <div className="mt-4"><Notice tone="error">{error || err}</Notice></div>}
          <div className="mt-5">
            <ProfileForm initial={{ name: suggested, region: '', priorities: ['agua', 'suelo'] }} submitLabel="Crear mi perfil"
              onSubmit={async (p) => { try { onDone(await repo.saveProfile(p)); } catch (e) { setErr(e.message); } }} />
          </div>
        </div>
      </main>
    </div>
  );
}
