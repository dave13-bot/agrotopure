import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap } from 'react-leaflet';

const BASE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const NASA_GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{Time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg';
const imageDate = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
function Fit({ points }) { const map = useMap(); useEffect(() => { if (points.length === 1) map.setView(points[0], 15); else if (points.length > 1) map.fitBounds(points, { padding: [32, 32], maxZoom: 16 }); }, [map, points]); return null; }
function Layer({ satellite }) { return <TileLayer url={satellite ? NASA_GIBS : BASE} attribution={satellite ? '&copy; NASA GIBS/MODIS Terra Corrected Reflectance' : '&copy; OpenStreetMap contributors'} subdomains={satellite ? undefined : 'abc'} maxZoom={satellite ? 9 : 19} bounds={satellite ? [[-85,-180],[85,180]] : undefined} time={imageDate} eventHandlers={{ tileerror: () => {} }} />; }
export default function MapView({ plots = [], draftPoints = [], satellite = true, selectedId }) {
  const pointSets = useMemo(() => plots.flatMap((plot) => plot.coordinates || []).map((point) => [Number(point.lat), Number(point.lon)]).filter((p) => p.every(Number.isFinite)), [plots]);
  const draft = draftPoints.filter((p) => p.every(Number.isFinite));
  const all = [...pointSets, ...draft];
  const center = all[0] || [20, -102];
  const rings = plots.map((plot) => ({ id: plot.id, name: plot.name, points: (plot.coordinates || []).map((p) => [Number(p.lat), Number(p.lon)]) }));
  return <MapContainer center={center} zoom={all.length ? 14 : 4} scrollWheelZoom className="h-full min-h-[300px] w-full"><Layer satellite={satellite}/><Layer satellite={false}/><Fit points={all}/>{rings.map(({ id, name, points }) => <Polygon key={id} positions={points} pathOptions={{ color: id === selectedId ? '#0f3b21' : '#32824d', fillColor: '#51a568', fillOpacity: 0.22, weight: 3 }}><Popup>{name}<br/>{points.length} vértices registrados por el usuario</Popup></Polygon>)}{draft.length >= 2 && <Polygon positions={draft} pathOptions={{ color: '#d17b00', fillColor: '#f2b544', fillOpacity: .22, dashArray: '6 5' }}/ >}{draft.map((point, i) => <CircleMarker key={`draft-${i}`} center={point} radius={5} pathOptions={{ color: '#fff', fillColor: '#d17b00', fillOpacity: 1 }}><Popup>Punto {i + 1}: {point[0]}, {point[1]}</Popup></CircleMarker>)}</MapContainer>;
}
