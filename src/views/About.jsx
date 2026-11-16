import { Cpu, Github, Rocket, Satellite, ShieldCheck, Sprout, Users } from 'lucide-react';
import { Card, SectionTitle } from '../components/ui.jsx';
import { useI18n } from '../lib/i18n.js';
import { TEAM } from '../data/team.js';

/** Acerca de nosotros: quién hizo el proyecto, por qué, y la transparencia que pide el reto. */
export default function About() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <section className="brand-gradient overflow-hidden rounded-3xl text-white shadow-card">
        <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="text-xs font-bold uppercase tracking-widest text-gold">{t('about.eyebrow')}</p>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">{t('about.title')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-50">{t('about.intro')}</p>
            <p className="mt-4 text-sm font-bold text-gold">{t('about.closing')}</p>
          </div>
          <figure className="mx-auto w-44 lg:col-span-4 lg:w-56">
            <img src={TEAM.logo} alt={t('about.logoAlt')} className="w-full rounded-3xl bg-white p-2 shadow-lg" />
            <figcaption className="mt-2 text-center text-[11px] text-emerald-100">{t('about.logoCaption')}</figcaption>
          </figure>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-7">
          <img src={TEAM.photo} alt={t('about.photoAlt')} className="w-full" loading="lazy" />
          <p className="px-5 py-3 text-xs text-slate-500">{t('about.photoCaption')}</p>
        </Card>
        <Card className="p-6 lg:col-span-5">
          <SectionTitle eyebrow={TEAM.name} title={t('about.teamTitle')}
            action={<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Users size={22} /></span>} />
          <ul className="mt-4 space-y-2">
            {TEAM.members.map((m) => (
              <li key={m} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold text-ink">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full brand-gradient text-[11px] font-extrabold text-white">{m.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</span>{m}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle eyebrow={t('about.eyebrow')} title={t('about.whyTitle')}
            action={<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Rocket size={22} /></span>} />
          <p className="mt-3 flex gap-3 text-sm leading-relaxed text-slate-600"><Cpu size={18} className="mt-0.5 shrink-0 text-navy" />{t('about.why1')}</p>
          <p className="mt-3 flex gap-3 text-sm leading-relaxed text-slate-600"><Satellite size={18} className="mt-0.5 shrink-0 text-navy" />{t('about.why2')}</p>
        </Card>
        <Card className="p-6">
          <SectionTitle eyebrow="AGRO-TOPURE" title={t('about.whatTitle')}
            action={<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Sprout size={22} /></span>} />
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('about.what1')}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('about.what2')}</p>
        </Card>
      </div>

      <Card className="p-6">
        <SectionTitle eyebrow="NASA Space Apps Challenge 2026" title={t('about.complianceTitle')}
          action={<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck size={22} /></span>} />
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
          <li>{t('about.license')}</li>
          <li>{t('about.data')}</li>
          <li>{t('about.ai')}</li>
          <li className="font-bold text-slate-700">{t('about.disclaimer')}</li>
        </ul>
        <a className="btn-ghost mt-4" href={TEAM.repo} target="_blank" rel="noreferrer"><Github size={16} />{t('about.repo')}</a>
      </Card>
    </div>
  );
}
