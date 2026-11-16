import { useCallback, useEffect, useMemo, useState } from 'react';
import { nasa } from './api.js';
import { enrichDaily, monthlyClimate, latestReadings } from './agro.js';
import { buildAlerts } from './alerts.js';
import { findPlantByName } from '../data/plants.js';

/** Carga NASA POWER (diario y climatología), MODIS y lecturas de sensores de una parcela. */
export function useParcelData(parcel, repo, { modis = false, climatology = true, readingsDays = 30, eonet = false, readings = true, alertTypes } = {}) {
  const [state, setState] = useState({});
  const [tick, setTick] = useState(0);
  const c = parcel?.centroid;
  const key = parcel ? `${parcel.id}:${c?.lat}:${c?.lon}` : null;

  useEffect(() => {
    if (!parcel || !c) { setState({}); return undefined; }
    let alive = true;
    const set = (patch) => alive && setState((s) => ({ ...s, ...patch }));
    setState({ powerLoading: true, climLoading: climatology, modisLoading: modis, readingsLoading: readings, eonetLoading: eonet });
    nasa('power', c, '&days=60').then((power) => set({ power, powerError: null })).catch((e) => set({ powerError: e.message })).finally(() => set({ powerLoading: false }));
    if (climatology) nasa('climatology', c).then((clim) => set({ clim, climError: null })).catch((e) => set({ climError: e.message })).finally(() => set({ climLoading: false }));
    if (modis) nasa('modis', c).then((modisData) => set({ modisData, modisError: null })).catch((e) => set({ modisError: e.message })).finally(() => set({ modisLoading: false }));
    if (eonet) nasa('eonet', c, '&radiusKm=800&days=30').then((eonetData) => set({ eonetData, eonetError: null })).catch((e) => set({ eonetError: e.message })).finally(() => set({ eonetLoading: false }));
    if (readings) repo.listReadings(parcel.id, readingsDays).then((rows) => set({ readings: rows, readingsError: null })).catch((e) => set({ readings: [], readingsError: e.message })).finally(() => set({ readingsLoading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, readingsDays, modis, climatology, eonet, readings]);

  const types = Array.isArray(alertTypes) ? alertTypes.join(',') : '';
  const derived = useMemo(() => {
    const lat = c?.lat ?? 0;
    const daily = enrichDaily(state.power, lat);
    const months = monthlyClimate(state.clim, lat);
    const sensor = latestReadings(state.readings || []);
    const alerts = buildAlerts({
      eonet: state.eonetData, daily: daily.daily, months,
      crop: findPlantByName(parcel?.crop),
      enabled: types ? types.split(',') : undefined
    });
    return { ...daily, months, sensor, alerts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.power, state.clim, state.readings, state.eonetData, c?.lat, types, parcel?.crop]);

  const reloadReadings = useCallback(async () => {
    if (!parcel) return;
    const readings = await repo.listReadings(parcel.id, readingsDays);
    setState((s) => ({ ...s, readings }));
  }, [parcel, repo, readingsDays]);

  return { ...state, ...derived, reload: () => setTick((t) => t + 1), reloadReadings };
}
