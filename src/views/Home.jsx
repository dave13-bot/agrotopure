import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Cpu, LineChart, Map as MapIcon, Plus, Satellite, Search, Sun } from 'lucide-react';
import { Badge, Card, Empty, Notice, SectionTitle, Spinner, StatGrid, useFmt, useMsg } from '../components/ui.jsx';
import { AlertList } from '../components/Alerts.jsx';
import ParcelShape from '../components/ParcelShape.jsx';
import { useI18n } from '../lib/i18n.js';
import { useParcelData } from '../lib/useParcelData.js';
import { fusion } from '../lib/agro.js';
import { findPlantByName, localized } from '../data/plants.js';
import { formatHa } from '../lib/geo.js';

export default function Home({ profile, parcels, selected, setSelectedId, go, repo, fine, alerts, alertsLoading, alertsError }) {
  const { t, locale } = useI18n();
  const fmt = useFmt();
  const msg = useMsg();
  const [q, setQ] = useState('');
  const data = useParcelData(selected, repo, { climatology: false, readingsDays: 7, readings: fine });
  const filtered = parcels.filter((p) => `${p.name} ${p.crop}`.toLowerCase().includes(q.toLowerCase()));
  const L = data.latest || {};
  const crop = localized(findPlantByName(selected?.crop), locale);
  const f = useMemo(() => (fine && selected ? fusion({ sensor: data.sensor || {}, nasa: { ...L, etoAvg7: data.etoAvg7 }, texture: selected.soilTexture, crop, readings: data.readings || [] }) : null), [fine, selected, data.sensor, data.readings, data.etoAvg7, L, crop]);
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? t('home.morning') : h < 19 ? t('home.afternoon') : t('home.evening'); })();

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section className="brand-gradient space-y-5 rounded-3xl p-6 text-white shadow-card lg:col-span-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{greeting}, {profile.name.split(' ')[0]}</h1>
          <p className="mt-0.5 text-xs font-medium text-emerald-200">{fmt.date(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{profile.region ? ` · ${profile.region}` : ''}</p>
        </div>
        <label className="relative block">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-100" />
          <span className="sr-only">{t('common.search')}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('home.searchPh')} className="w-full rounded-2xl border border-white/20 bg-white/10 py-3 pl-11 pr-4 text-sm text-white placeholder-emerald-100 outline-none focus:border-white/50" />
        </label>

        <div className="rounded-2xl bg-white p-5 text-ink shadow-md">
          {!selected ? <p className="text-sm text-slate-600">{t('home.noParcel')}</p> : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-emerald-800">📍 {selected.name}{selected.crop ? ` · ${selected.crop}` : ''}</p>
                <Badge>NASA POWER</Badge>
              </div>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('home.nasaNow')}</p>
              {data.powerLoading ? <div className="py-6"><Spinner label="NASA POWER…" /></div> : data.powerError ? (
                <p className="mt-3 text-sm text-rose-700">{data.powerError}</p>
              ) : (
                <>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-5xl font-extrabold tracking-tight">{fmt.num(L.t2m?.value, 0) ?? '--'}°</span>
                      <span className="mt-1 text-xs text-slate-500">{fmt.num(L.tmax?.value, 0) ?? '--'}° / {fmt.num(L.tmin?.value, 0) ?? '--'}°</span>
                    </div>
                    <p className="text-right text-[11px] text-slate-500">{t('home.lastPublished')}<br /><b className="text-slate-700">{fmt.date(L.t2m?.date, { day: 'numeric', month: 'long' })}</b></p>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <StatGrid cols="grid-cols-2 sm:grid-cols-3" items={[
                      { label: t('home.rain30'), value: fmt.num(data.precip30, 0), unit: 'mm' },
                      { label: t('home.eto'), value: fmt.num(data.etoAvg7, 1), unit: `mm${t('common.perDay')}` },
                      { label: t('analysis.solarAll'), value: fmt.num(L.radMJ?.value, 1), unit: 'MJ/m²', icon: Sun },
                      { label: t('analysis.rootMoisture'), value: L.gwetroot ? Math.round(L.gwetroot.value * 100) : null, unit: '%' },
                      { label: t('analysis.rh'), value: fmt.num(L.rh?.value, 0), unit: '%' },
                      { label: t('analysis.wind'), value: fmt.num(L.wind?.value, 1), unit: 'm/s' }
                    ]} />
                  </div>
                  <button onClick={() => go('analisis')} className="btn-soft mt-3 w-full">{t('home.analysisCta')}<ArrowRight size={15} /></button>
                </>
              )}
            </>
          )}
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-200">{t('home.shortcuts')}</p>
          <div className={`grid gap-2.5 ${fine ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {[[MapIcon, 'nav.parcels', 'parcelas'], [LineChart, 'nav.analysis', 'analisis'], ...(fine ? [[Cpu, 'nav.sensors', 'sensores']] : []), [BookOpen, 'nav.plants', 'plantas']].map(([Icon, key, v]) => (
              <button key={v} onClick={() => go(v)} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/15 bg-white/15 p-3 text-[11px] font-bold transition hover:bg-white/25"><Icon size={20} />{t(key)}</button>
            ))}
          </div>
        </div>
        <button onClick={() => go('parcelas', 'nueva')} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-extrabold text-emerald-900 shadow-md hover:bg-emerald-50"><Plus size={18} />{t('home.newParcel')}</button>
      </section>

      <section className="space-y-6 lg:col-span-7">
        {selected && (
          <Card className="p-6">
            <SectionTitle eyebrow="NASA EONET + NASA POWER" title={t('alerts.title')} />
            <div className="mt-4"><AlertList alerts={alerts || []} loading={alertsLoading} error={alertsError} compact /></div>
          </Card>
        )}

        {fine && f && (
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{t('analysis.fusionEyebrow')} · {selected.name}</p>
                <h2 className="mt-1 text-lg font-extrabold">{f.available ? msg({ key: f.insights[0]?.titleKey, vars: f.insights[0]?.titleVars }) : t('analysis.fusionNoSensor')}</h2>
              </div>
              <button onClick={() => go('sensores')} className="btn-soft">{t('nav.sensors')}<ArrowRight size={15} /></button>
            </div>
            {f.available && <p className="mt-2 text-sm text-slate-600">{msg({ key: f.insights[0]?.textKey, vars: f.insights[0]?.textVars })}</p>}
            <div className="mt-4">
              <StatGrid cols="grid-cols-2 sm:grid-cols-4" items={[
                { label: t('analysis.sensorMoisture'), value: f.vwc, unit: '%', hint: data.sensor?.moisture25 ? fmt.timeAgo(data.sensor.moisture25.ts) : null },
                { label: t('analysis.rootMoisture'), value: L.gwetroot ? Math.round(L.gwetroot.value * 100) : null, unit: '%', hint: 'GWETROOT' },
                { label: t('analysis.deltaRoot'), value: f.deltaRoot !== undefined ? `${f.deltaRoot > 0 ? '+' : ''}${f.deltaRoot}` : null, hint: t('analysis.deltaHint') },
                { label: t('analysis.nextIrrigation'), value: f.prediction?.daysToIrrigate, unit: t('common.days') }
              ]} />
            </div>
          </Card>
        )}

        <Card className="p-6">
          <SectionTitle eyebrow={t('home.myParcels')} title={t('home.monitoring')} action={<button onClick={() => go('parcelas')} className="btn-soft">{t('home.manage')}<ArrowRight size={15} /></button>} />
          {parcels.length === 0 ? (
            <div className="mt-4"><Empty icon={MapIcon} title={t('home.emptyTitle')} text={t('home.emptyText')} action={<button className="btn-primary" onClick={() => go('parcelas', 'nueva')}><Plus size={16} />{t('home.newParcel')}</button>} /></div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => setSelectedId(p.id)} className={`overflow-hidden rounded-2xl border text-left transition ${p.id === selected?.id ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-slate-100 hover:border-emerald-200'}`}>
                  <div className="relative h-28 soil-gradient">
                    <ParcelShape coordinates={p.coordinates} className="h-full w-full" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white">{formatHa(p.areaHa)} {t('parcels.hectares')}</span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-extrabold">{p.name}</p>
                    <p className="text-[11px] text-slate-500">{p.centroid.lat.toFixed(4)}, {p.centroid.lon.toFixed(4)}</p>
                    <p className="mt-1 text-xs font-bold text-emerald-700">{p.crop || t('parcels.noCrop')}</p>
                  </div>
                </button>
              ))}
              {!filtered.length && <p className="text-sm text-slate-500">{t('home.noMatch', { q })}</p>}
            </div>
          )}
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          {[['home.s1t', 'home.s1d'], ['home.s2t', 'home.s2d'], ['home.s3t', 'home.s3d']].map(([a, b]) => (
            <div key={a} className="card p-4"><p className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-800"><Satellite size={14} />{t(a)}</p><p className="mt-1 text-xs leading-relaxed text-slate-600">{t(b)}</p></div>
          ))}
        </div>
        {repo.mode === 'local' && parcels.length > 0 && <Notice tone="info">{t('home.localNotice')}</Notice>}
      </section>
    </div>
  );
}
