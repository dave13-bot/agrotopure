import { useState } from 'react';
import { Cloud, Cpu, HardDrive, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, Modal, Notice, SectionTitle } from '../components/ui.jsx';
import { AlertSettings } from '../components/Alerts.jsx';
import { useI18n } from '../lib/i18n.js';
import { ALERT_TYPES } from '../lib/alerts.js';
import ProfileForm from '../components/ProfileForm.jsx';

export default function Account({ repo, session, profile, setProfile, saveProfile, parcels, devices, fine, onLogout }) {
  const { t, locale } = useI18n();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const p = session.principal;
  const provider = p?.identityProvider === 'aad' ? 'Microsoft' : p?.identityProvider === 'github' ? 'GitHub' : p?.identityProvider;
  const word = t('account.deleteWord');
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="p-6 lg:col-span-7">
        <SectionTitle eyebrow={t('account.eyebrow')} title={t('account.profile')} text={t('account.lead')} />
        {msg && <div className="mt-4"><Notice tone="ok">{msg}</Notice></div>}
        {err && <div className="mt-4"><Notice tone="error">{err}</Notice></div>}
        <div className="mt-5">
          <ProfileForm initial={profile} showLang submitLabel={t('profile.save')}
            onSubmit={async (f) => { setErr(''); setMsg(''); try { setProfile(await repo.saveProfile({ ...profile, ...f, locale })); setMsg(t('profile.saved')); } catch (e) { setErr(e.message); } }} />
        </div>
      </Card>
      <div className="space-y-6 lg:col-span-5">
        <Card className="space-y-3 p-6 text-sm">
          <p className="flex items-center gap-2 font-extrabold"><ShieldCheck size={17} className="text-emerald-700" />{t('account.session')}</p>
          {p ? <p>{t('account.connectedAs', { provider, user: p.userDetails })}</p> : <p>{t('account.guest')}</p>}
          <p className="flex items-center gap-2">{repo.mode === 'cloud' ? <><Cloud size={16} className="text-emerald-700" />{t('account.cloudOn')}</> : <><HardDrive size={16} className="text-amber-600" />{t('account.cloudOff')}</>}</p>
          <p className="text-xs text-slate-500">{t('account.stats', { parcels: parcels.length, devices: devices.length })}{profile.createdAt ? t('account.since', { date: new Date(profile.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-MX') }) : ''}</p>
          <button className="btn-ghost w-full" onClick={onLogout}><LogOut size={15} />{p ? t('account.logout') : t('account.exitGuest')}</button>
        </Card>
        <Card className="p-6 text-sm">
          <p className="flex items-center gap-2 font-extrabold"><Cpu size={16} className="text-slate-500" />{t('account.fineTitle')}</p>
          <p className="mt-1 text-xs text-slate-500">{t('account.fineText')}</p>
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl bg-slate-50 p-3 font-extrabold">
            <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={fine} onChange={(e) => saveProfile({ fineAnalysis: e.target.checked }).catch((x) => setErr(x.message))} />
            {fine ? t('analysis.fineOff') : t('analysis.fineToggle')}
          </label>
        </Card>
        <Card className="p-6">
          <AlertSettings enabled={profile.alertTypes || ALERT_TYPES} onChange={(next) => saveProfile({ alertTypes: next }).catch((x) => setErr(x.message))} />
        </Card>
        <Card className="p-6 text-sm">
          <p className="font-extrabold text-rose-700">{t('account.deleteTitle')}</p>
          <p className="mt-1 text-xs text-slate-500">{t('account.deleteLead')}</p>
          <button className="btn-danger mt-3" onClick={() => setDel(true)}><Trash2 size={15} />{t('account.deleteBtn')}</button>
        </Card>
      </div>
      {del && (
        <Modal title={t('account.deleteModal')} onClose={() => setDel(false)}>
          <p className="text-sm text-slate-600">{t('account.deleteConfirm')}</p>
          <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label={t('common.confirm')} />
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDel(false)}>{t('common.cancel')}</button>
            <button className="btn-danger" disabled={confirmText !== word} onClick={async () => { try { await repo.deleteAccount(); onLogout(); } catch (e) { setErr(e.message); setDel(false); } }}>{t('common.delete')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
