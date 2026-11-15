import { useState } from 'react';
import { Cloud, HardDrive, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, Modal, Notice, SectionTitle } from '../components/ui.jsx';
import ProfileForm from '../components/ProfileForm.jsx';

export default function Account({ repo, session, profile, setProfile, parcels, devices, onLogout }) {
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const p = session.principal;
  const provider = p?.identityProvider === 'aad' ? 'Microsoft' : p?.identityProvider === 'github' ? 'GitHub' : p?.identityProvider;
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="p-6 lg:col-span-7">
        <SectionTitle eyebrow="Mi cuenta" title="Perfil" text="Tus prioridades ajustan el puntaje de las estrategias de rotación." />
        {msg && <div className="mt-4"><Notice tone="ok">{msg}</Notice></div>}
        {err && <div className="mt-4"><Notice tone="error">{err}</Notice></div>}
        <div className="mt-5">
          <ProfileForm initial={profile} submitLabel="Guardar perfil" onSubmit={async (f) => { setErr(''); setMsg(''); try { setProfile(await repo.saveProfile(f)); setMsg('Perfil guardado.'); } catch (e) { setErr(e.message); } }} />
        </div>
      </Card>
      <div className="space-y-6 lg:col-span-5">
        <Card className="space-y-3 p-6 text-sm">
          <p className="flex items-center gap-2 font-extrabold"><ShieldCheck size={17} className="text-emerald-700" />Sesión</p>
          {p ? <p>Conectado con <b>{provider}</b> como <b>{p.userDetails}</b>.</p> : <p>Sin cuenta (modo invitado).</p>}
          <p className="flex items-center gap-2">{repo.mode === 'cloud' ? <><Cloud size={16} className="text-emerald-700" />Datos guardados en la nube de AGROTOPURE.</> : <><HardDrive size={16} className="text-amber-600" />Datos guardados solo en este navegador.</>}</p>
          <p className="text-xs text-slate-500">{parcels.length} parcela(s) · {devices.length} dispositivo(s){profile.createdAt ? ` · desde ${new Date(profile.createdAt).toLocaleDateString('es-MX')}` : ''}</p>
          <button className="btn-ghost w-full" onClick={onLogout}><LogOut size={15} />{p ? 'Cerrar sesión' : 'Salir del modo invitado'}</button>
        </Card>
        <Card className="p-6 text-sm">
          <p className="font-extrabold text-rose-700">Eliminar cuenta</p>
          <p className="mt-1 text-xs text-slate-500">Borra tu perfil, parcelas, dispositivos y lecturas.</p>
          <button className="btn-danger mt-3" onClick={() => setDel(true)}><Trash2 size={15} />Eliminar mis datos</button>
        </Card>
      </div>
      {del && (
        <Modal title="Eliminar todos mis datos" onClose={() => setDel(false)}>
          <p className="text-sm text-slate-600">Escribe <b>ELIMINAR</b> para confirmar. No se puede deshacer.</p>
          <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Confirmación" />
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDel(false)}>Cancelar</button>
            <button className="btn-danger" disabled={confirmText !== 'ELIMINAR'} onClick={async () => { try { await repo.deleteAccount(); onLogout(); } catch (e) { setErr(e.message); setDel(false); } }}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
