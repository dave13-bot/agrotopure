/** Silueta SVG del polígono de la parcela (miniatura sin cargar mapas). */
export default function ParcelShape({ coordinates = [], className = '' }) {
  if (coordinates.length < 3) return <div className={className} />;
  const lat0 = coordinates.reduce((s, c) => s + c.lat, 0) / coordinates.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = coordinates.map((c) => c.lon * k), ys = coordinates.map((c) => -c.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const pts = xs.map((x, i) => `${(((x - minX) / span) * 80 + 10 + (80 - ((maxX - minX) / span) * 80) / 2).toFixed(2)},${(((ys[i] - minY) / span) * 80 + 10 + (80 - ((maxY - minY) / span) * 80) / 2).toFixed(2)}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs><pattern id="rows" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="6" stroke="#bbf7d0" strokeWidth="1.2" /></pattern></defs>
      <polygon points={pts} fill="url(#rows)" stroke="#fde68a" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
