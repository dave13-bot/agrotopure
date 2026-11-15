// Capas de mapa. Las capas de datos provienen de NASA GIBS (WMS, versión "best", fecha más reciente).
// Los mapas base (OpenStreetMap, Esri) son solo referencia visual para dibujar la parcela.
export const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';

export const NASA_OVERLAYS = [
  { id: 'hls', name: 'Imagen HLS Landsat/Sentinel 30 m (NASA)', layer: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance', opacity: 1, legend: 'Color verdadero armonizado Landsat + Sentinel-2. Puede tener nubes o huecos según la fecha.' },
  { id: 'ndvi', name: 'NDVI MODIS 8 días (NASA)', layer: 'MODIS_Terra_NDVI_8Day', opacity: 0.7, legend: 'Vigor de la vegetación: café = suelo desnudo, verde intenso = vegetación densa.' },
  { id: 'smap_root', name: 'Humedad zona radicular SMAP L4 (NASA)', layer: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', opacity: 0.6, legend: 'Humedad de 0-100 cm modelada con observaciones SMAP (9 km).' },
  { id: 'smap_top', name: 'Humedad superficial SMAP L4 (NASA)', layer: 'SMAP_L4_Analyzed_Surface_Soil_Moisture', opacity: 0.6, legend: 'Humedad de 0-5 cm modelada con observaciones SMAP (9 km).' },
  { id: 'lst', name: 'Temperatura de superficie MODIS (NASA)', layer: 'MODIS_Terra_Land_Surface_Temp_Day', opacity: 0.6, legend: 'Temperatura diurna de la superficie terrestre (1 km).' },
  { id: 'lst8', name: 'Temperatura de superficie 8 días MODIS (NASA)', layer: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day', opacity: 0.6, legend: 'Compuesto de 8 días: menos huecos por nubes que el diario.' },
  { id: 'relief', name: 'Elevación SRTM (NASA)', layer: 'SRTM_Color_Index', opacity: 0.55, legend: 'Modelo digital de elevación SRTM (pendientes y escurrimiento).' },
  { id: 'shade', name: 'Relieve sombreado ASTER GDEM (NASA)', layer: 'ASTER_GDEM_Color_Shaded_Relief', opacity: 0.55, legend: 'Relieve sombreado para ver laderas.' }
];

export const BASE_LAYERS = [
  { id: 'esri', name: 'Imagen satelital (referencia)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagen base © Esri, Maxar, Earthstar Geographics', maxZoom: 19 },
  { id: 'osm', name: 'Calles (OpenStreetMap)', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap', maxZoom: 19 }
];
