import { useCallback, useEffect, useMemo, useState } from 'react';
import { nasa } from './api.js';
import { enrichDaily, monthlyClimate, latestReadings } from './agro.js';

/** Carga NASA POWER (diario y climatología), MODIS y lecturas de sensores de una parcela. */
export function useParcelData(parcel, repo, { modis = false, climatology = true, readingsDays = 30 } = {}) {
  const [state, setState] = useState({});
  const [tick, setTick] = useState(0);
  const c = parcel?.centroid;
  const key = parcel ? `${parcel.id}:${c?.lat}:${c?.lon}` : null;

  useEffect(() => {
    if (!parcel || !c) { setState({}); return undefined; }
    let alive = true;
    const set = (patch) => alive && setState((s) => ({ ...s, ...patch }));
    setState({ powerLoading: true, climLoading: climatology, modisLoading: modis, readingsLoading: true });
    nasa('power', c, '&days=60').then((power) => set({ power, powerError: null })).catch((e) => set({ powerError: e.message })).finally(() => set({ powerLoading: false }));
    if (climatology) nasa('climatology', c).then((clim) => set({ clim, climError: null })).catch((e) => set({ climError: e.message })).finally(() => set({ climLoading: false }));
    if (modis) nasa('modis', c).then((modisData) => set({ modisData, modisError: null })).catch((e) => set({ modisError: e.message })).finally(() => set({ modisLoading: false }));
    repo.listReadings(parcel.id, readingsDays).then((readings) => set({ readings, readingsError: null })).catch((e) => set({ readings: [], readingsError: e.message })).finally(() => set({ readingsLoading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, readingsDays, modis, climatology]);

  const derived = useMemo(() => {
    const lat = c?.lat ?? 0;
    const daily = enrichDaily(state.power, lat);
    const months = monthlyClimate(state.clim, lat);
    const sensor = latestReadings(state.readings || []);
    return { ...daily, months, sensor };
  }, [state.power, state.clim, state.readings, c?.lat]);

  const reloadReadings = useCallback(async () => {
    if (!parcel) return;
    const readings = await repo.listReadings(parcel.id, readingsDays);
    setState((s) => ({ ...s, readings }));
  }, [parcel, repo, readingsDays]);

  return { ...state, ...derived, reload: () => setTick((t) => t + 1), reloadReadings };
}
