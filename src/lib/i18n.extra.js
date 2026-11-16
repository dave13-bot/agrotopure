// Textos añadidos: salud del cultivo (NDVI), tiempos entre cultivos, validación de tierra firme,
// "Acerca de nosotros" y créditos. Se fusionan con los diccionarios de i18n.js.

export const extraEs = {
  nav: { about: 'Acerca de nosotros', aboutShort: 'Nosotros' },
  parcels: {
    onWater: 'Esta parcela queda sobre el océano o un cuerpo de agua según la máscara tierra/agua de NASA GIBS. Mueve las esquinas a tierra firme para guardarla.',
    sowDate: 'Fecha de siembra',
    sowDateHelp: 'Con la fecha, la salud del cultivo se compara contra la etapa en que debería estar.'
  },
  layers: { landsat: 'Imagen Landsat 30 m (NASA)', streets: 'Calles (OpenStreetMap)' },
  alerts: {
    types: { health: 'Salud del cultivo' },
    health: {
      low: 'El cultivo refleja menos luz infrarroja de la esperada: NDVI {ndvi} frente a {lo}–{hi} para {crop} en esta etapa.',
      drop: 'El vigor del cultivo cayó {drop} puntos de NDVI (ahora {ndvi}) sin que la etapa del cultivo lo explique.'
    }
  },
  health: {
    eyebrow: 'NASA MODIS · luz reflejada',
    title: 'Salud del cultivo',
    lead: 'Una planta sana absorbe la luz roja y refleja mucho infrarrojo cercano. Con esas dos bandas, el satélite MODIS de la NASA calcula el NDVI = (NIR − Rojo) ÷ (NIR + Rojo) cada 16 días. Aquí se compara con lo que debería reflejar tu cultivo en su etapa actual.',
    status: { healthy: 'Saludable', watch: 'En observación', stress: 'Posible estrés', idle: 'Sin cultivo en pie', unknown: 'Sin lectura confiable' },
    statusText: {
      healthy: 'El NDVI coincide con lo esperado y no hay caídas anormales.',
      watch: 'Hay una diferencia moderada frente a lo esperado. Conviene revisar la parcela en los próximos días.',
      stress: 'El cultivo no refleja lo que debería. Revisa la parcela cuanto antes.',
      idle: 'Según la fecha de siembra y el ciclo del cultivo, no hay cultivo en pie que evaluar.',
      cloudy: 'Todos los compuestos recientes están nublados; no se puede evaluar sin arriesgar una falsa alarma.',
      noData: 'MODIS aún no devuelve NDVI para este punto.'
    },
    score: 'Índice de salud', observed: 'NDVI observado', expected: 'NDVI esperado', change16: 'Cambio en 16 días', fromPeak: 'Frente al máximo reciente',
    stageLabel: 'Etapa del cultivo',
    stage: { initial: 'Inicial (día {d} de ~{c})', development: 'Desarrollo (día {d} de ~{c})', mid: 'Media, dosel completo (día {d} de ~{c})', late: 'Final, maduración (día {d} de ~{c})', perennial: 'Perenne, todo el año', harvested: 'Ciclo terminado', presow: 'Aún no sembrado' },
    basis: {
      stage: 'Rango esperado para {crop} según su tipo de cultivo y los días desde la siembra.',
      perennial: 'Rango esperado para {crop}, cultivo perenne con dosel permanente.',
      trend: 'Sin cultivo o fecha de siembra registrados: solo se vigilan caídas bruscas. Agrega ambos en la parcela para comparar contra la etapa.'
    },
    causesTitle: 'Causa probable según NASA POWER',
    cause: {
      water: 'Falta de agua: humedad de zona radicular en {root}% y {days} días sin lluvia significativa. Riega y vuelve a revisar en el siguiente compuesto.',
      frost: 'Daño por frío: se registraron mínimas de {t} °C en las últimas tres semanas.',
      heat: 'Estrés por calor: se registraron máximas de {t} °C en las últimas tres semanas.',
      waterlogging: 'Exceso de agua: {mm} mm de lluvia en siete días o suelo saturado; revisa drenaje y enfermedades de raíz.',
      biotic: 'El clima no lo explica: agua y temperatura están en rango. Puede ser plaga, enfermedad o falta de nutrientes: recorre la parcela y revisa hojas, tallos y raíz.'
    },
    marginal: 'Compuesto de calidad marginal: tómalo con reserva.',
    cloudySkipped: 'Se descartaron {n} compuestos nublados.',
    caveat: 'Orientativo. El píxel MODIS mide 250 m: en parcelas pequeñas se mezcla con el terreno vecino. Los rangos son valores típicos por tipo de cultivo; el NDVI no identifica la plaga, solo avisa de que algo no coincide.',
    addCrop: 'Editar parcela'
  },
  plan: {
    title: 'Calendario y tiempo entre cultivos',
    sow: 'Siembra', harvest: 'Cosecha', cycle: 'ciclo de {a}–{b} días',
    gap: '{gap} días libres antes de sembrar {crop} (mínimo recomendado: {min})',
    gapSelf: '{gap} días libres antes de volver a sembrar (mínimo recomendado: {min})',
    overlap: 'Se traslapa {days} días con la siembra de {crop}',
    why: 'Por qué', how: 'Cómo',
    whyPerennial: 'Cultivo perenne ya establecido: se conserva y se mejora lo que ocurre entre las hileras.',
    whyWindow: 'La temperatura media de NASA POWER se mantiene entre {a} y {b} °C durante {len} meses seguidos a partir de {month}.',
    whyWaterOk: 'La lluvia normal de esos meses ({rain} mm) cubre la demanda del cultivo ({demand} mm): puede ir de temporal.',
    whyWaterShort: 'La lluvia normal ({rain} mm) no cubre la demanda ({demand} mm): se cuenta con {irrigation} mm de riego.',
    whyLegume: 'Es leguminosa: fija nitrógeno del aire y deja parte en el suelo para el cultivo siguiente.',
    whyCover: 'Funciona como cobertura: sus raíces sostienen el suelo y su rastrojo aporta materia orgánica.',
    whyFamily: 'Es de otra familia ({family}) que el cultivo anterior ({prev}): corta el ciclo de plagas y enfermedades que quedan en el suelo.',
    whyErosion: 'Mantiene el suelo cubierto en {n} de los meses con riesgo de erosión por lluvia.',
    howSow: 'Siembra hacia el {sow}. Con un ciclo de {a} a {b} días, la cosecha cae entre el {h1} y el {h2}.',
    howIrrigate: 'Programa unos {mm} mm de riego en el ciclo (≈ {m3} m³ por hectárea).',
    howGapOk: 'Quedan {gap} días entre la cosecha y la siguiente siembra: suficiente (mínimo {min}).',
    howTight: 'Solo quedan {gap} días y se recomiendan {min}: usa una variedad precoz o retrasa la siguiente siembra.',
    howOverlap: 'La cosecha se traslapa {days} días con la siguiente siembra: elige una variedad de ciclo corto o recorre la fecha.',
    howFallow: 'El terreno queda {gap} días sin cultivo: deja el rastrojo como cobertura para no perder suelo ni humedad.',
    turn: {
      cereal: 'Al cosechar, pica el rastrojo y espera al menos {days} días: mientras se descompone, la paja retiene nitrógeno que la plántula siguiente necesitaría.',
      legume: 'Deja las raíces en el suelo e incorpora el residuo; espera al menos {days} días para que libere el nitrógeno.',
      greenManure: 'Si lo incorporas como abono verde, hazlo en floración y espera al menos {days} días antes de sembrar.',
      brassica: 'Incorpora los residuos y espera al menos {days} días: sus compuestos pueden frenar la germinación del siguiente cultivo.',
      root: 'La cosecha remueve el suelo: nivela y deja asentar al menos {days} días.',
      general: 'Retira o incorpora los residuos y prepara la cama de siembra: al menos {days} días.'
    },
    familyOk: '{family}: vuelve cada {months} meses (recomendado: al menos {rec}).',
    familyShort: '{family}: vuelve cada {months} meses y se recomiendan al menos {rec}. No repitas esta secuencia todos los años: altérnala con otra estrategia.',
    returnTitle: 'Tiempo antes de repetir familia',
    summary: 'Terreno ocupado {occupied} días al año · {free} días libres entre cultivos',
    note: 'Fechas calculadas con el punto medio del ciclo de la guía de cultivos; los descansos y los años de retorno por familia son reglas agronómicas orientativas. Ajusta con tu variedad y tu técnico.'
  },
  analysis: {
    impactVigor: 'Salud del cultivo',
    impactVigorIn: 'MODIS MOD13Q1 (NDVI y confiabilidad del píxel) + T2M_MIN, T2M_MAX, PRECTOTCORR, GWETROOT',
    impactVigorHow: 'El NDVI observado se compara con el esperado para el cultivo y su etapa; NASA POWER acota la causa cuando no coinciden.',
    impactRotationHow: 'Determinan la ventana de siembra, el riego faltante, la fecha de cosecha y los días libres entre un cultivo y el siguiente.'
  },
  about: {
    eyebrow: 'Acerca de nosotros',
    title: 'Quiénes somos · Tesla Legacy',
    intro: 'Somos Tesla Legacy, un equipo orgullosamente de Uruapan, Michoacán, México, formado por seis estudiantes de Ingeniería en Mecatrónica.',
    teamTitle: 'El equipo',
    photoAlt: 'Los seis integrantes de Tesla Legacy con playeras de NASA Space Apps Challenge, entre dos lonas del evento en Guadalajara',
    photoCaption: 'Tesla Legacy en NASA Space Apps Challenge 2026, sede Guadalajara.',
    logoAlt: 'Emblema de Tesla Legacy',
    logoCaption: 'Emblema del equipo. Imagen generada con inteligencia artificial.',
    whyTitle: 'Nuestra motivación',
    why1: 'Nos motivó la oportunidad de unir nuestra formación en mecatrónica y sistemas embebidos con la ciencia espacial y los datos abiertos de la NASA. Diseñamos el firmware para microcontroladores ESP32 y Raspberry Pi que lee los sensores de suelo, y la plataforma que lo cruza con lo que ven los satélites.',
    why2: 'Participamos en NASA Space Apps Challenge 2026 con el reto “Cambio de rumbo: adaptando las granjas con datos de la NASA”, convencidos de que la tecnología debe transformar la realidad del campo.',
    whatTitle: 'Qué construimos',
    what1: 'AGRO-TOPURE permite al agricultor supervisar su parcela a distancia: clima, radiación solar, humedad del suelo, salud del cultivo y alertas de peligro, sin tener que estar físicamente en el terreno.',
    what2: 'Con esos datos calcula cuándo sembrar, cuánto regar y qué rotación conviene. Los sensores en parcela afinan el riego y son la base para automatizarlo a distancia.',
    closing: 'Hardware inteligente y telemetría satelital para una agricultura más resiliente y conectada, desde Michoacán para el mundo.',
    complianceTitle: 'Transparencia',
    license: 'Código abierto bajo licencia Apache 2.0.',
    data: 'Datos: NASA POWER, MODIS (ORNL DAAC), EONET y GIBS (SMAP, HLS, Landsat, SRTM, máscara tierra/agua). Mapa de calles: © colaboradores de OpenStreetMap.',
    ai: 'Uso de IA: el código y los textos de la plataforma se desarrollaron con asistencia de Claude (Anthropic) y fueron revisados por el equipo. El emblema del equipo se generó con IA.',
    disclaimer: 'Proyecto de estudiantes para NASA Space Apps Challenge. No está afiliado a la NASA ni respaldado por ella.',
    repo: 'Código en GitHub'
  },
  credit: { madeBy: 'Hecho por Tesla Legacy', place: 'Uruapan, Michoacán, México', license: 'Licencia Apache 2.0', notNasa: 'No afiliado a la NASA ni respaldado por ella.' }
};

export const extraEn = {
  nav: { about: 'About us', aboutShort: 'About' },
  parcels: {
    onWater: 'This field sits on the ocean or a water body according to the NASA GIBS land/water mask. Move its corners onto dry land to save it.',
    sowDate: 'Sowing date',
    sowDateHelp: 'With the date, crop health is compared against the stage the crop should be in.'
  },
  layers: { landsat: 'Landsat 30 m imagery (NASA)', streets: 'Streets (OpenStreetMap)' },
  alerts: {
    types: { health: 'Crop health' },
    health: {
      low: 'The crop reflects less near-infrared light than expected: NDVI {ndvi} against {lo}–{hi} for {crop} at this stage.',
      drop: 'Crop vigour fell by {drop} NDVI points (now {ndvi}) and the crop stage does not explain it.'
    }
  },
  health: {
    eyebrow: 'NASA MODIS · reflected light',
    title: 'Crop health',
    lead: 'A healthy plant absorbs red light and reflects a lot of near-infrared. From those two bands, NASA’s MODIS satellite computes NDVI = (NIR − Red) ÷ (NIR + Red) every 16 days. Here it is compared with what your crop should reflect at its current stage.',
    status: { healthy: 'Healthy', watch: 'Watch', stress: 'Possible stress', idle: 'No standing crop', unknown: 'No reliable reading' },
    statusText: {
      healthy: 'NDVI matches what is expected and there are no abnormal drops.',
      watch: 'There is a moderate gap against what is expected. Check the field in the coming days.',
      stress: 'The crop is not reflecting what it should. Check the field as soon as possible.',
      idle: 'Given the sowing date and crop cycle, there is no standing crop to assess.',
      cloudy: 'Every recent composite is cloudy; it cannot be assessed without risking a false alarm.',
      noData: 'MODIS has not returned NDVI for this point yet.'
    },
    score: 'Health index', observed: 'Observed NDVI', expected: 'Expected NDVI', change16: 'Change in 16 days', fromPeak: 'Against recent peak',
    stageLabel: 'Crop stage',
    stage: { initial: 'Initial (day {d} of ~{c})', development: 'Development (day {d} of ~{c})', mid: 'Mid-season, full canopy (day {d} of ~{c})', late: 'Late, ripening (day {d} of ~{c})', perennial: 'Perennial, all year', harvested: 'Cycle finished', presow: 'Not sown yet' },
    basis: {
      stage: 'Expected range for {crop} from its crop type and the days since sowing.',
      perennial: 'Expected range for {crop}, a perennial crop with a permanent canopy.',
      trend: 'No crop or sowing date on record: only sudden drops are watched. Add both to the field to compare against the stage.'
    },
    causesTitle: 'Likely cause according to NASA POWER',
    cause: {
      water: 'Water shortage: root-zone moisture at {root}% and {days} days without meaningful rain. Irrigate and check again at the next composite.',
      frost: 'Cold damage: minimums of {t} °C were recorded in the last three weeks.',
      heat: 'Heat stress: maximums of {t} °C were recorded in the last three weeks.',
      waterlogging: 'Excess water: {mm} mm of rain in seven days or saturated soil; check drainage and root diseases.',
      biotic: 'Weather does not explain it: water and temperature are in range. It may be a pest, a disease or a nutrient shortage: walk the field and check leaves, stems and roots.'
    },
    marginal: 'Marginal-quality composite: read it with caution.',
    cloudySkipped: '{n} cloudy composites were discarded.',
    caveat: 'Indicative. The MODIS pixel is 250 m wide: on small fields it blends with neighbouring land. Ranges are typical values per crop type; NDVI does not identify the pest, it only flags that something does not match.',
    addCrop: 'Edit field'
  },
  plan: {
    title: 'Calendar and time between crops',
    sow: 'Sowing', harvest: 'Harvest', cycle: '{a}–{b} day cycle',
    gap: '{gap} free days before sowing {crop} (recommended minimum: {min})',
    gapSelf: '{gap} free days before sowing again (recommended minimum: {min})',
    overlap: 'Overlaps the sowing of {crop} by {days} days',
    why: 'Why', how: 'How',
    whyPerennial: 'Established perennial crop: it stays, and what happens between the rows is improved.',
    whyWindow: 'NASA POWER mean temperature stays between {a} and {b} °C for {len} consecutive months starting in {month}.',
    whyWaterOk: 'Normal rainfall in those months ({rain} mm) covers crop demand ({demand} mm): it can be rainfed.',
    whyWaterShort: 'Normal rainfall ({rain} mm) does not cover demand ({demand} mm): {irrigation} mm of irrigation is planned.',
    whyLegume: 'It is a legume: it fixes nitrogen from the air and leaves part of it in the soil for the next crop.',
    whyCover: 'It works as a cover crop: its roots hold the soil and its residue adds organic matter.',
    whyFamily: 'It belongs to a different family ({family}) than the previous crop ({prev}): it breaks the cycle of soil-borne pests and diseases.',
    whyErosion: 'It keeps the soil covered during {n} of the months with rain-erosion risk.',
    howSow: 'Sow around {sow}. With a {a} to {b} day cycle, harvest falls between {h1} and {h2}.',
    howIrrigate: 'Plan about {mm} mm of irrigation over the cycle (≈ {m3} m³ per hectare).',
    howGapOk: '{gap} days remain between harvest and the next sowing: enough (minimum {min}).',
    howTight: 'Only {gap} days remain and {min} are recommended: use an early variety or delay the next sowing.',
    howOverlap: 'Harvest overlaps the next sowing by {days} days: choose a short-cycle variety or shift the date.',
    howFallow: 'The land stays {gap} days without a crop: leave the residue as cover so soil and moisture are not lost.',
    turn: {
      cereal: 'At harvest, chop the stubble and wait at least {days} days: while it decomposes, straw ties up nitrogen the next seedling would need.',
      legume: 'Leave the roots in the soil and incorporate the residue; wait at least {days} days for it to release nitrogen.',
      greenManure: 'If you incorporate it as green manure, do it at flowering and wait at least {days} days before sowing.',
      brassica: 'Incorporate the residue and wait at least {days} days: its compounds can slow germination of the next crop.',
      root: 'Harvesting disturbs the soil: level it and let it settle for at least {days} days.',
      general: 'Remove or incorporate residue and prepare the seedbed: at least {days} days.'
    },
    familyOk: '{family}: returns every {months} months (recommended: at least {rec}).',
    familyShort: '{family}: returns every {months} months and at least {rec} are recommended. Do not repeat this sequence every year: alternate it with another strategy.',
    returnTitle: 'Time before repeating a family',
    summary: 'Land occupied {occupied} days a year · {free} free days between crops',
    note: 'Dates computed from the cycle midpoint in the crop guide; rest periods and family return years are indicative agronomic rules. Adjust with your variety and your advisor.'
  },
  analysis: {
    impactVigor: 'Crop health',
    impactVigorIn: 'MODIS MOD13Q1 (NDVI and pixel reliability) + T2M_MIN, T2M_MAX, PRECTOTCORR, GWETROOT',
    impactVigorHow: 'Observed NDVI is compared with the value expected for the crop and its stage; NASA POWER narrows the cause when they do not match.',
    impactRotationHow: 'They set the sowing window, the missing irrigation, the harvest date and the free days between one crop and the next.'
  },
  about: {
    eyebrow: 'About us',
    title: 'Who we are · Tesla Legacy',
    intro: 'We are Tesla Legacy, a team proudly from Uruapan, Michoacán, Mexico, made up of six Mechatronics Engineering students.',
    teamTitle: 'The team',
    photoAlt: 'The six members of Tesla Legacy wearing NASA Space Apps Challenge T-shirts, between two event banners in Guadalajara',
    photoCaption: 'Tesla Legacy at NASA Space Apps Challenge 2026, Guadalajara local event.',
    logoAlt: 'Tesla Legacy emblem',
    logoCaption: 'Team emblem. AI-generated image.',
    whyTitle: 'Our motivation',
    why1: 'We were driven by the chance to combine our training in mechatronics and embedded systems with space science and NASA open data. We designed the firmware for ESP32 microcontrollers and Raspberry Pi that reads the soil sensors, and the platform that cross-checks it with what satellites see.',
    why2: 'We take part in NASA Space Apps Challenge 2026 under the “Field Shift: adapting farms with NASA data” challenge, convinced that technology must change the reality of farming.',
    whatTitle: 'What we built',
    what1: 'AGRO-TOPURE lets farmers monitor their field remotely: weather, solar radiation, soil moisture, crop health and hazard alerts, without having to be physically on the land.',
    what2: 'From that data it works out when to sow, how much to irrigate and which rotation fits. In-field sensors sharpen irrigation and are the basis for automating it remotely.',
    closing: 'Smart hardware and satellite telemetry for a more resilient, connected agriculture, from Michoacán to the world.',
    complianceTitle: 'Transparency',
    license: 'Open source under the Apache 2.0 license.',
    data: 'Data: NASA POWER, MODIS (ORNL DAAC), EONET and GIBS (SMAP, HLS, Landsat, SRTM, land/water mask). Street map: © OpenStreetMap contributors.',
    ai: 'AI use: the platform code and texts were developed with assistance from Claude (Anthropic) and reviewed by the team. The team emblem was generated with AI.',
    disclaimer: 'Student project for NASA Space Apps Challenge. Not affiliated with or endorsed by NASA.',
    repo: 'Code on GitHub'
  },
  credit: { madeBy: 'Made by Tesla Legacy', place: 'Uruapan, Michoacán, Mexico', license: 'Apache 2.0 License', notNasa: 'Not affiliated with or endorsed by NASA.' }
};
