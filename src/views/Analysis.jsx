import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, CircleDot, Info, Leaf, RefreshCw, Satellite, Sprout, Sun, TriangleAlert } from 'lucide-react';
import { Badge, Card, Notice, SectionTitle, Spinner, StatGrid, useFmt, useMsg } from '../components/ui.jsx';
import { AlertList, AlertSettings } from '../components/Alerts.jsx';
import { ParcelHeader, NoParcels } from '../components/ParcelPicker.jsx';
import { ClimateChart, TimeChart } from '../components/Charts.jsx';
import ParcelMap from '../components/ParcelMap.jsx';
import { useI18n } from '../lib/i18n.js';
import { useParcelData } from '../lib/useParcelData.js';
import { ALERT_TYPES } from '../lib/alerts.js';
import { compatibility, fusion, rankCrops, rotationStrategies, scoreColor, textureOf, vulnerabilityCalendar } from '../lib/agro.js';
import { PLANTS, findPlantByName, localized, plantById } from '../data/plants.js';

const KEY_CROPS = ['maiz', 'aguacate', 'fresa', 'zarzamora', 'frambuesa', 'arandano', 'trigo', 'tomate', 'chile', 'brocoli', 'lechuga', 'frijol'];

export default function Analysis(ctx) {
  const { repo, parcels, selected, setSelectedId, go, profile, saveProfile, fine, alerts, alertsLoading, alertsError } = ctx;
  const { t, locale } = useI18n();
  const data = useParcelData(selected, repo, { modis: true, readingsDays: 30, readings: fine });
  if (!selected) return <NoParcels go={go} />;

  const L = data.latest || {};
  const crop = localized(findPlantByName(selected.crop), locale);
  const ph = fine ? data.sensor?.ph?.value ?? null : null;
  const ec = fine ? data.sensor?.ec?.value ?? null : null;
  const climCtx = { months: data.months, ph, ec };
  const loadingAll = data.powerLoading || data.climLoading;

  return (
    <div className="space-y-6">
      <ParcelHeader eyebrow={t('analysis.eyebrow')} parcels={parcels} selected={selected} setSelectedId={setSelectedId}>
        <button className="btn-primary" onClick={data.reload} disabled={loadingAll}><RefreshCw size={15} className={loadingAll ? 'animate-spin' : ''} />{t('common.refresh')}</button>
      </ParcelHeader>

      <AlertsSection alerts={alerts} loading={alertsLoading} error={alertsError} enabled={profile.alertTypes || ALERT_TYPES} onChange={(next) => saveProfile({ alertTypes: next }).catch(() => {})} />
      <NasaHero data={data} parcel={selected} />
      <SolarCard data={data} />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-7">
          <SectionTitle eyebrow={t('analysis.heroEyebrow')} title={t('analysis.climate60')} text={t('analysis.climateLead')} />
          {data.powerLoading ? <div className="py-10"><Spinner label="NASA POWER…" /></div> : data.powerError ? <div className="mt-4"><Notice tone="error" title={t('analysis.powerError')}>{data.powerError}</Notice></div> : (
            <div className="mt-4">
              <TimeChart data={data.daily} defaultRange={30} series={[
                { key: 'precip', name: t('chart.rain'), color: '#38bdf8', type: 'bar' },
                { key: 'eto', name: t('chart.eto'), color: '#f59e0b', type: 'line' },
                { key: 'gwetrootPct', name: t('chart.rootMoisture'), color: '#176b40', type: 'line', axis: 'right' },
                { key: 'gwettopPct', name: t('chart.topMoisture'), color: '#86efac', type: 'line', axis: 'right' }
              ].map((s) => s)} rightDomain={[0, 100]} />
              <p className="mt-2 text-[11px] text-slate-500">{t('analysis.lagNote', { date: data.latest?.gwetroot?.date || '—' })}</p>
            </div>
          )}
        </Card>
        <Card className="p-6 lg:col-span-5">
          <SectionTitle eyebrow={t('analysis.modisEyebrow')} title={t('analysis.modisTitle')} />
          {data.modisLoading ? <div className="py-10"><Spinner label="MODIS…" /></div> : data.modisError ? <div className="mt-4"><Notice tone="warn" title={t('analysis.modisError')}>{data.modisError}</Notice></div> : <ModisBlock modis={data.modisData} />}
          <div className="mt-5 overflow-hidden rounded-2xl"><ParcelMap parcels={[selected]} selectedId={selected.id} overlays={['ndvi']} height="h-[230px]" /></div>
        </Card>
      </div>

      <ImpactCard fine={fine} />
      <CompatibilitySection ctx={climCtx} loading={data.climLoading} error={data.climError} crop={crop} fine={fine} go={go} locale={locale} />
      <CalendarSection months={data.months} loading={data.climLoading} error={data.climError} period={data.clim?.period} />
      <RotationSection ctx={climCtx} crop={crop} profile={profile} saveProfile={saveProfile} loading={data.climLoading} locale={locale} />
      <FineSection fine={fine} saveProfile={saveProfile} data={data} parcel={selected} crop={crop} go={go} />
    </div>
  );
}

function AlertsSection({ alerts, loading, error, enabled, onChange }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const urgent = (alerts || []).filter((a) => a.severity >= 2).length;
  return (
    <Card className="p-6">
      <SectionTitle eyebrow="NASA EONET + NASA POWER" title={t('alerts.title')}
        action={<div className="flex items-center gap-2">{urgent > 0 && <Badge tone="red">{t('alerts.active', { n: alerts.length })}</Badge>}<button className="btn-ghost" onClick={() => setOpen((v) => !v)}>{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{t('alerts.settings')}</button></div>} />
      {open && <div className="mt-4 rounded-2xl bg-slate-50 p-4"><AlertSettings enabled={enabled} onChange={onChange} /></div>}
      <div className="mt-4"><AlertList alerts={alerts || []} loading={loading} error={error} /></div>
      <p className="mt-3 text-[11px] text-slate-500">{t('alerts.disclaimer')}</p>
    </Card>
  );
}

function NasaHero({ data, parcel }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const L = data.latest || {};
  if (data.powerLoading) return <Card className="p-6"><Spinner label="NASA POWER…" /></Card>;
  if (data.powerError) return <Card className="p-6"><Notice tone="error" title={t('analysis.powerError')}>{data.powerError}</Notice></Card>;
  return (
    <section className="brand-gradient rounded-3xl p-6 text-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">{t('analysis.heroEyebrow')}</span>
          <h2 className="mt-2 text-xl font-extrabold sm:text-2xl">{t('analysis.heroTitle')}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-emerald-100">{t('analysis.heroLead')}</p>
        </div>
        <Badge tone="dark"><CheckCircle2 size={12} />{t('analysis.complete')}</Badge>
      </div>
      <div className="mt-5">
        <StatGrid dark cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" items={[
          { label: t('analysis.temp'), value: fmt.num(L.t2m?.value, 1), unit: '°C', hint: `${fmt.num(L.tmin?.value, 0) ?? '—'} / ${fmt.num(L.tmax?.value, 0) ?? '—'} °C` },
          { label: t('analysis.rain30'), value: fmt.num(data.precip30, 0), unit: 'mm', hint: t('analysis.rain30Hint') },
          { label: t('analysis.etoLabel'), value: fmt.num(data.etoAvg7, 1), unit: `mm${t('common.perDay')}`, hint: t('analysis.etoHint') },
          { label: t('analysis.solarAll'), value: fmt.num(data.radAvg7, 1), unit: 'MJ/m²', hint: t('analysis.solarAllHint') },
          { label: t('analysis.rootMoisture'), value: L.gwetroot ? Math.round(L.gwetroot.value * 100) : null, unit: '%', hint: t('analysis.rootHint') },
          { label: t('analysis.topMoisture'), value: L.gwettop ? Math.round(L.gwettop.value * 100) : null, unit: '%', hint: t('analysis.topHint') },
          { label: t('analysis.rh'), value: fmt.num(L.rh?.value, 0), unit: '%', hint: t('analysis.rhHint') },
          { label: t('analysis.wind'), value: fmt.num(L.wind?.value, 1), unit: 'm/s', hint: t('analysis.windHint') },
          { label: t('analysis.surfaceTemp'), value: fmt.num(L.ts?.value, 1), unit: '°C', hint: t('analysis.surfaceHint') },
          { label: t('analysis.dew'), value: fmt.num(L.dew?.value, 1), unit: '°C', hint: t('analysis.dewHint') },
          { label: t('analysis.pressure'), value: fmt.num(L.ps?.value, 1), unit: 'kPa', hint: t('analysis.pressureHint') },
          { label: t('analysis.elevation'), value: fmt.num(data.power?.elevationM, 0), unit: 'm', hint: t('analysis.elevationHint') }
        ]} />
      </div>
      <p className="mt-4 text-[11px] text-emerald-100">{parcel.centroid.lat.toFixed(4)}, {parcel.centroid.lon.toFixed(4)} · {data.power?.source}</p>
    </section>
  );
}

function SolarCard({ data }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const L = data.latest || {};
  const rad = L.radMJ?.value ?? null;
  const kt = L.kt?.value ?? null;
  const reading = rad === null ? null : rad >= 24 ? 'solarReadHigh' : rad >= 14 ? 'solarReadMid' : 'solarReadLow';
  const series = [{ key: 'radMJ', name: t('chart.radiation'), color: '#f59e0b', type: 'line' }];
  if (data.daily?.some((d) => d.radClearMJ !== null && d.radClearMJ !== undefined)) series.push({ key: 'radClearMJ', name: t('chart.radiationClear'), color: '#fcd34d', type: 'line' });
  if (data.daily?.some((d) => d.uv !== null && d.uv !== undefined)) series.push({ key: 'uv', name: t('chart.uv'), color: '#7c3aed', type: 'line', axis: 'right' });
  return (
    <Card className="p-6">
      <SectionTitle eyebrow={t('analysis.solarEyebrow')} title={t('analysis.solarTitle')} text={t('analysis.solarLead')}
        action={<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Sun size={22} /></span>} />
      {data.powerLoading ? <div className="py-8"><Spinner label="NASA POWER…" /></div> : rad === null ? (
        <div className="mt-4"><Notice tone="warn">{t('analysis.solarMissing')}</Notice></div>
      ) : (
        <>
          <div className="mt-4">
            <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" items={[
              { label: t('analysis.solarAll'), value: fmt.num(rad, 1), unit: 'MJ/m²', hint: t('analysis.solarAllHint'), tone: 'text-amber-700', big: true },
              { label: t('analysis.solarKwh'), value: fmt.num(rad / 3.6, 2), unit: 'kWh/m²', hint: t('analysis.solarKwhHint') },
              { label: t('analysis.solarClear'), value: fmt.num(L.radClearMJ?.value, 1), unit: 'MJ/m²', hint: t('analysis.solarClearHint') },
              { label: t('analysis.solarKt'), value: fmt.num(kt, 2), hint: t('analysis.solarKtHint') },
              { label: t('analysis.solarCloud'), value: kt === null ? null : `${Math.round((1 - kt) * 100)}`, unit: '%', hint: t('analysis.solarCloudHint') },
              { label: t('analysis.solarUv'), value: fmt.num(L.uv?.value, 1), hint: t('analysis.solarUvHint') },
              { label: t('analysis.solarPar'), value: fmt.num(L.par?.value, 1), hint: t('analysis.solarParHint') }
            ]} />
          </div>
          {reading && <div className="mt-4"><Notice tone={reading === 'solarReadHigh' ? 'warn' : 'info'}>{t(`analysis.${reading}`)}</Notice></div>}
          <div className="mt-4">
            <p className="mb-1 text-sm font-extrabold">{t('analysis.solarChart')}</p>
            <TimeChart data={data.daily} series={series} defaultRange={30} height={240} />
          </div>
          {data.power?.notes?.length > 0 && <p className="mt-2 text-[11px] text-slate-400">{data.power.notes.join(' ')}</p>}
        </>
      )}
    </Card>
  );
}

function ModisBlock({ modis }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const ndvi = (modis?.ndvi || []).filter((x) => x.value !== null);
  const lst = (modis?.lstDayC || []).filter((x) => x.value !== null);
  const last = ndvi[ndvi.length - 1];
  const state = !last ? null : last.value < 0.2 ? ['analysis.ndviBare', 'amber'] : last.value < 0.4 ? ['analysis.ndviSparse', 'amber'] : last.value < 0.6 ? ['analysis.ndviModerate', 'green'] : ['analysis.ndviDense', 'green'];
  const rows = [...new Set([...ndvi, ...lst].map((x) => x.date))].sort().map((d) => ({ date: d, ndvi: ndvi.find((x) => x.date === d)?.value ?? null, lst: lst.find((x) => x.date === d)?.value ?? null }));
  return (
    <div className="mt-4">
      <StatGrid cols="grid-cols-2" items={[
        { label: t('analysis.ndviLast'), value: last ? last.value.toFixed(2) : null, hint: last ? `MOD13Q1 · ${fmt.date(last.date)}` : null },
        { label: t('analysis.lstDay'), value: lst.length ? fmt.num(lst[lst.length - 1].value, 1) : null, unit: '°C', hint: lst.length ? `MOD11A2 · ${fmt.date(lst[lst.length - 1].date)}` : null }
      ]} />
      {state && <div className="mt-3"><Badge tone={state[1]}>{t(state[0])}</Badge></div>}
      {rows.length > 1 && <div className="mt-3"><TimeChart data={rows} height={180} brush={false} defaultRange={0} series={[{ key: 'ndvi', name: t('chart.ndvi'), color: '#176b40', type: 'line' }]} yDomain={[0, 1]} /></div>}
      {modis?.errors?.length > 0 && <p className="mt-2 text-[11px] text-amber-700">{modis.errors.join(' · ')}</p>}
      <p className="mt-2 text-[11px] text-slate-500">{t('analysis.modisPixel')}</p>
    </div>
  );
}

/** Trazabilidad: qué variable de la NASA alimenta cada resultado. */
function ImpactCard({ fine }) {
  const { t } = useI18n();
  const rows = [
    ['impactEto', 'impactEtoIn', 'impactEtoHow'],
    ['impactCompat', 'impactCompatIn', 'impactCompatHow'],
    ['impactCalendar', 'impactCalendarIn', 'impactCalendarHow'],
    ['impactRotation', 'impactRotationIn', 'impactRotationHow'],
    ['impactAlerts', 'impactAlertsIn', 'impactAlertsHow'],
    ['impactVigor', 'impactVigorIn', 'impactVigorHow']
  ];
  return (
    <Card className="p-6">
      <SectionTitle eyebrow={t('analysis.impactEyebrow')} title={t('analysis.impactTitle')} text={t('analysis.impactLead')}
        action={<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Satellite size={22} /></span>} />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(([title, input, how]) => (
          <div key={title} className="rounded-2xl border border-slate-100 p-4">
            <p className="text-sm font-extrabold text-ink">{t(`analysis.${title}`)}</p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">{t('analysis.impactInputs')}</p>
            <p className="font-mono text-[11px] leading-relaxed text-slate-600">{t(`analysis.${input}`)}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{t(`analysis.${how}`)}</p>
            {title === 'impactCompat' && !fine && <p className="mt-2 text-[11px] font-bold text-slate-400">{t('compat.phMissing')}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompatibilitySection({ ctx, loading, error, crop, fine, go, locale }) {
  const { t } = useI18n();
  const msg = useMsg();
  const [all, setAll] = useState(false);
  const key = useMemo(() => KEY_CROPS.map((id) => compatibility(localized(plantById(id), locale), ctx)), [ctx.months, ctx.ph, ctx.ec, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranking = useMemo(() => (all ? rankCrops(ctx).map((r) => ({ ...r, plant: localized(r.plant, locale) })) : []), [all, ctx.months, ctx.ph, ctx.ec, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card className="p-6">
      <SectionTitle eyebrow={t('analysis.compatEyebrow')} title={t('analysis.compatTitle')} text={t('analysis.compatLead')} />
      {loading ? <div className="py-8"><Spinner label="NASA POWER…" /></div> : error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {key.map((r) => <CropScore key={r.plant.id} r={r} current={crop?.id === r.plant.id} />)}
          </div>
          <button className="btn-ghost mt-4" onClick={() => setAll((v) => !v)}>{all ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{all ? t('analysis.compatHide') : t('analysis.compatAll', { n: PLANTS.length })}</button>
          {all && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="text-slate-500"><tr><th className="py-2">{t('analysis.crop')}</th><th>{t('analysis.fitness')}</th><th>{t('analysis.sowing')}</th><th>{t('analysis.irrigation')}</th><th>{t('analysis.detail')}</th></tr></thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr key={r.plant.id} className="border-t border-slate-100">
                      <td className="py-2 font-bold">{r.plant.name}</td>
                      <td><span className={`rounded-full px-2 py-0.5 font-bold ${scoreColor(r.score)}`}>{r.score ?? '—'}</span></td>
                      <td>{r.plant.perennial ? t('analysis.perennial') : r.window?.start ? t(`months.${r.window.start}`) : '—'}</td>
                      <td>{r.window?.irrigationMm !== undefined ? `${r.window.irrigationMm} mm` : '—'}</td>
                      <td className="max-w-xs truncate text-slate-500">{msg(r.reasons[0])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!fine && <p className="mt-4 text-[11px] text-slate-400">{t('compat.phMissing')}</p>}
        </>
      )}
    </Card>
  );
}

function CropScore({ r, current }) {
  const { t } = useI18n();
  const msg = useMsg();
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border p-4 ${current ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-sm font-extrabold">{r.plant.name}</p><p className="text-[11px] italic text-slate-500">{r.plant.sci}</p></div>
        <span className={`rounded-xl px-2.5 py-1 text-sm font-extrabold ${scoreColor(r.score)}`}>{r.score ?? '—'}</span>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {r.plant.perennial ? t('analysis.perennial') : r.window?.start ? `${t('analysis.sowIn', { month: t(`months.${r.window.start}`) })} · ${t('analysis.irrigationMm', { n: r.window.irrigationMm ?? 0 })}` : t('analysis.noWindow')}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {current && <Badge>{t('analysis.currentCrop')}</Badge>}
        {r.plant.added && <Badge tone="slate">{t('analysis.added')}</Badge>}
        <Badge tone="slate">{t('analysis.confidence', { n: Math.round(r.confidence * 100) })}</Badge>
      </div>
      <button className="mt-2 text-[11px] font-bold text-emerald-700" onClick={() => setOpen((v) => !v)}>{open ? t('analysis.hideReasons') : t('analysis.reasons')}</button>
      {open && (
        <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
          {r.reasons.map((x, i) => (
            <li key={i} className="flex gap-1.5">
              <CircleDot size={11} className={`mt-0.5 shrink-0 ${x.key.startsWith('compat.ph') || x.key.startsWith('compat.ec') ? 'text-slate-400' : 'text-emerald-600'}`} />
              <span>{msg(x)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CalendarSection({ months, loading, error, period }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const msg = useMsg();
  const cal = useMemo(() => vulnerabilityCalendar(months), [months]);
  const [sel, setSel] = useState(new Date().getMonth());
  if (loading || error || months.length !== 12) return null;
  const color = ['bg-emerald-100 text-emerald-900', 'bg-amber-100 text-amber-900', 'bg-rose-200 text-rose-900'];
  const levels = ['common.low', 'common.medium', 'common.high'];
  const m = cal[sel];
  return (
    <Card className="p-6">
      <SectionTitle eyebrow={t('analysis.calendarEyebrow')} title={t('analysis.calendarTitle')} text={t('analysis.calendarLead', { period: period || '' })} />
      <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12">
        {cal.map((c, i) => (
          <button key={c.month} onClick={() => setSel(i)} aria-pressed={sel === i} className={`rounded-xl py-3 text-center text-xs font-extrabold transition ${color[c.level]} ${sel === i ? 'ring-2 ring-emerald-700 ring-offset-1' : ''}`}>
            {t(`months.${c.month}`)}<span className="mt-1 block text-[10px] font-semibold">{t(levels[c.level])}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4 text-sm">
          <p className="font-extrabold">{t('analysis.monthRisk', { month: t(`months.${sel + 1}`), level: t(levels[m.level]).toLowerCase() })}</p>
          <p className="mt-1 text-xs text-slate-600">
            {t('analysis.normalRain')} {months[sel].precip ?? '--'} mm · ETo {months[sel].eto ?? '--'} mm · {t('analysis.balance')} {months[sel].balance ?? '--'} mm · {t('analysis.extremes')} {fmt.num(months[sel].tmin, 1) ?? '--'} / {fmt.num(months[sel].tmax, 1) ?? '--'} °C
          </p>
          {m.risks.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">{m.risks.map((r) => <li key={r.id}>{msg(r)}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-800">{t('analysis.noRisk')}</p>}
          {m.advice.length > 0 && <p className="mt-2 text-xs font-bold text-emerald-800">{m.advice.map((a) => msg(a)).join(' ')}</p>}
        </div>
        <ClimateChart months={months.map((x) => ({ ...x, label: t(`months.${x.month}`) }))} />
      </div>
    </Card>
  );
}

function RotationSection({ ctx, crop, profile, saveProfile, loading, locale }) {
  const { t } = useI18n();
  const [priorities, setPriorities] = useState(profile.priorities || []);
  const [saving, setSaving] = useState(false);
  const strategies = useMemo(() => (ctx.months.length === 12 ? rotationStrategies(ctx, crop, priorities) : []), [ctx.months, ctx.ph, ctx.ec, crop, priorities]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading || !strategies.length) return null;
  const toggle = async (k) => {
    const next = priorities.includes(k) ? priorities.filter((x) => x !== k) : [...priorities, k];
    setPriorities(next);
    setSaving(true);
    try { await saveProfile({ priorities: next }); } catch { /* se mantiene local */ } finally { setSaving(false); }
  };
  return (
    <Card className="p-6">
      <SectionTitle eyebrow={t('analysis.rotationEyebrow')} title={t('analysis.rotationTitle')} text={t('analysis.rotationLead', { crop: crop ? crop.name : t('analysis.rotationFallback') })} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {['agua', 'suelo', 'plagas', 'mercado', 'clima'].map((k) => (
          <button key={k} onClick={() => toggle(k)} aria-pressed={priorities.includes(k)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${priorities.includes(k) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 text-slate-600'}`}>{t(`priorities.${k}`)}</button>
        ))}
        {saving && <Spinner />}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {strategies.map((s) => (
          <div key={s.id} className={`flex flex-col rounded-2xl border p-5 ${s.recommended ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-slate-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <div><p className="text-[11px] font-extrabold text-slate-400">{t('analysis.strategy')} {s.id}</p><h3 className="text-base font-extrabold">{t(s.nameKey, s.nameVars ? { crop: localized(s.seq[0]?.plant, locale)?.name || s.nameVars.crop } : undefined)}</h3></div>
              <span className={`rounded-xl px-2.5 py-1 text-lg font-extrabold ${scoreColor(s.score)}`}>{s.score}</span>
            </div>
            {s.recommended && <div className="mt-2"><Badge><Sprout size={12} />{t('analysis.recommended')}</Badge></div>}
            <ol className="mt-3 space-y-2">
              {s.seq.map((c, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs">
                  <Leaf size={14} className="shrink-0 text-emerald-700" />
                  <span className="font-bold">{localized(c.plant, locale).name}</span>
                  <span className="ml-auto text-right text-slate-500">{c.plant.perennial ? t('analysis.allYear') : c.window?.start ? t('analysis.sowMonth', { month: t(`months.${c.window.start}`) }) : ''}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-slate-600">{t(s.noteKey)}</p>
            <div className="mt-3 space-y-1.5">
              {['agua', 'suelo', 'plagas', 'mercado', 'clima'].map((k) => (
                <div key={k} className="text-[11px]">
                  <div className="flex justify-between"><span className={priorities.includes(k) ? 'font-extrabold' : 'text-slate-500'}>{t(`priorities.${k}`)}</span><span>{Math.round(s.metrics[k] * 100)}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${Math.round(s.metrics[k] * 100)}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">{t('analysis.irrigationOver', { mm: s.metrics.irrigationMm, m3: s.metrics.irrigationMm * 10 })}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-slate-500">{t('analysis.rotationNote')}</p>
    </Card>
  );
}

/** Análisis fino: opcional, al final, y claramente marcado como extra. */
function FineSection({ fine, saveProfile, data, parcel, crop, go }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const toggle = async (value) => { setBusy(true); try { await saveProfile({ fineAnalysis: value }); } finally { setBusy(false); } };
  return (
    <Card className="p-6">
      <SectionTitle eyebrow={t('analysis.fineEyebrow')} title={t('analysis.fineTitle')} />
      <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-emerald-900"><CheckCircle2 size={16} />{t('analysis.fineComplete')}</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-900">{t('analysis.fineLead')}</p>
        <p className="mt-2 text-[11px] text-emerald-800">{t('analysis.fineAdds')}</p>
        <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl bg-white p-3 text-sm font-extrabold text-ink">
          <input type="checkbox" checked={fine} disabled={busy} onChange={(e) => toggle(e.target.checked)} className="h-4 w-4 accent-emerald-700" />
          {fine ? t('analysis.fineOff') : t('analysis.fineToggle')}
        </label>
      </div>
      {fine && (
        <>
          <div className="mt-4"><Notice tone="ok" title={t('analysis.fineOn')} action={<button className="btn-ghost" onClick={() => go('sensores')}>{t('nav.sensors')}</button>}>{t('analysis.fineOnText')}</Notice></div>
          <div className="mt-4"><FusionPanel data={data} parcel={parcel} crop={crop} go={go} /></div>
        </>
      )}
    </Card>
  );
}

function FusionPanel({ data, parcel, crop, go }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const msg = useMsg();
  const L = data.latest || {};
  const f = useMemo(() => fusion({ sensor: data.sensor || {}, nasa: { ...L, etoAvg7: data.etoAvg7 }, texture: parcel.soilTexture, crop, readings: data.readings || [] }), [data.sensor, data.readings, data.etoAvg7, parcel.soilTexture, crop, L]);
  const icon = { ok: CheckCircle2, alert: TriangleAlert, warn: TriangleAlert, info: Info };
  const tone = { ok: 'border-emerald-100 bg-emerald-50 text-emerald-900', alert: 'border-rose-200 bg-rose-50 text-rose-900', warn: 'border-amber-200 bg-amber-50 text-amber-900', info: 'border-sky-100 bg-sky-50 text-sky-900' };
  const tx = textureOf(parcel.soilTexture);
  return (
    <section className="soil-gradient rounded-3xl p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">{t('analysis.fusionEyebrow')}</span>
          <h3 className="mt-2 text-lg font-extrabold">{t('analysis.fusionTitle')}</h3>
          <p className="text-xs text-emerald-100">{t('analysis.fusionTexture', { texture: t(`textures.${parcel.soilTexture || 'desconocido'}`), sat: tx.sat, fc: tx.fc, wp: tx.wp })}</p>
        </div>
        {!f.available && <button className="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-emerald-900" onClick={() => go('sensores')}>{t('analysis.fusionAddSensor')}</button>}
      </div>
      <div className="mt-5">
        <StatGrid dark cols="grid-cols-2 md:grid-cols-5" items={[
          { label: t('analysis.sensorMoisture'), value: f.vwc, unit: '%', hint: data.sensor?.moisture25 ? fmt.timeAgo(data.sensor.moisture25.ts) : t('analysis.noReading') },
          { label: t('analysis.rootMoisture'), value: L.gwetroot ? Math.round(L.gwetroot.value * 100) : null, unit: '%', hint: 'GWETROOT' },
          { label: t('analysis.topMoisture'), value: L.gwettop ? Math.round(L.gwettop.value * 100) : null, unit: '%', hint: 'GWETTOP' },
          { label: t('analysis.deltaRoot'), value: f.deltaRoot !== undefined ? `${f.deltaRoot > 0 ? '+' : ''}${f.deltaRoot}` : null, hint: t('analysis.deltaHint') },
          { label: t('analysis.nextIrrigation'), value: f.prediction?.daysToIrrigate, unit: t('common.days'), hint: f.prediction ? t(f.prediction.basisKey, f.prediction.basisVars) : null }
        ]} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {f.insights.map((i, n) => {
          const I = icon[i.level];
          return (
            <div key={n} className={`flex gap-3 rounded-2xl border p-4 text-sm ${tone[i.level]}`}>
              <I size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-extrabold">{msg({ key: i.titleKey, vars: i.titleVars })}</p>
                <p className="mt-0.5 text-xs leading-relaxed">{msg({ key: i.textKey, vars: i.textVars })}{i.extraKey ? msg({ key: i.extraKey, vars: i.extraVars }) : ''}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-emerald-100">
        {t(f.methodKey || 'fusion.method')} {t('analysis.fusionMethod')} {f.deltaTemp !== undefined ? t('analysis.deltaTemp', { n: f.deltaTemp }) : ''}
      </p>
    </section>
  );
}
