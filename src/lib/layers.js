// Capas de mapa. Las capas de datos provienen de NASA GIBS (WMS, versión "best", fecha más reciente).
// Los mapas base son solo referencia visual para dibujar la parcela.
export const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';

export const NASA_OVERLAYS = [
  { id: 'hls', name: 'Imagen HLS Landsat/Sentinel 30 m (NASA)', nameEn: 'HLS Landsat/Sentinel 30 m imagery (NASA)', layer: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance', opacity: 1, legend: 'Color verdadero armonizado Landsat + Sentinel-2. Puede tener nubes o huecos según la fecha.', legendEn: 'Harmonised Landsat + Sentinel-2 true colour. May show clouds or gaps depending on the date.' },
  { id: 'ndvi', name: 'NDVI MODIS 8 días (NASA)', nameEn: 'MODIS 8-day NDVI (NASA)', layer: 'MODIS_Terra_NDVI_8Day', opacity: 0.7, legend: 'Vigor de la vegetación: café = suelo desnudo, verde intenso = vegetación densa.', legendEn: 'Vegetation vigour: brown = bare soil, deep green = dense canopy.' },
  { id: 'smap_root', name: 'Humedad zona radicular SMAP L4 (NASA)', nameEn: 'SMAP L4 root-zone soil moisture (NASA)', layer: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', opacity: 0.6, legend: 'Humedad de 0-100 cm modelada con observaciones SMAP (9 km).', legendEn: '0-100 cm moisture modelled with SMAP observations (9 km).' },
  { id: 'smap_top', name: 'Humedad superficial SMAP L4 (NASA)', nameEn: 'SMAP L4 surface soil moisture (NASA)', layer: 'SMAP_L4_Analyzed_Surface_Soil_Moisture', opacity: 0.6, legend: 'Humedad de 0-5 cm modelada con observaciones SMAP (9 km).', legendEn: '0-5 cm moisture modelled with SMAP observations (9 km).' },
  { id: 'lst', name: 'Temperatura de superficie MODIS (NASA)', nameEn: 'MODIS land surface temperature (NASA)', layer: 'MODIS_Terra_Land_Surface_Temp_Day', opacity: 0.6, legend: 'Temperatura diurna de la superficie terrestre (1 km).', legendEn: 'Daytime land surface temperature (1 km).' },
  { id: 'lst8', name: 'Temperatura de superficie 8 días MODIS (NASA)', nameEn: 'MODIS 8-day land surface temperature (NASA)', layer: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day', opacity: 0.6, legend: 'Compuesto de 8 días: menos huecos por nubes que el diario.', legendEn: '8-day composite: fewer cloud gaps than the daily product.' },
  { id: 'relief', name: 'Elevación SRTM (NASA)', nameEn: 'SRTM elevation (NASA)', layer: 'SRTM_Color_Index', opacity: 0.55, legend: 'Modelo digital de elevación SRTM (pendientes y escurrimiento).', legendEn: 'SRTM digital elevation model (slope and runoff).' },
  { id: 'shade', name: 'Relieve sombreado ASTER GDEM (NASA)', nameEn: 'ASTER GDEM shaded relief (NASA)', layer: 'ASTER_GDEM_Color_Shaded_Relief', opacity: 0.55, legend: 'Relieve sombreado para ver laderas.', legendEn: 'Shaded relief to read hillsides.' }
];

// Mapas base: solo referencia visual para ubicar y dibujar la parcela; ningún cálculo los usa.
//  - Esri World Imagery: imagen de alta resolución, necesaria para ver linderos (30 m de Landsat no bastan).
//    Uso con atribución según los términos de Esri; se cita en README y en "Acerca de nosotros".
//  - Landsat WELD de NASA GIBS (30 m) y calles de OpenStreetMap (ODbL).
export const BASE_LAYERS = [
  { id: 'esri', name: 'Imagen satelital de alta resolución (Esri)', nameEn: 'High-resolution satellite imagery (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagen base: Esri, Maxar, Earthstar Geographics', maxZoom: 19 },
  { id: 'landsat', name: 'Imagen Landsat 30 m (NASA)', nameEn: 'Landsat 30 m imagery (NASA)', wms: 'Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual', attribution: 'NASA GIBS · Landsat WELD', maxZoom: 19 },
  { id: 'osm', name: 'Calles (OpenStreetMap)', nameEn: 'Streets (OpenStreetMap)', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', maxZoom: 19 }
];
