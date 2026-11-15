// Utilidades HTTP compartidas por las funciones.

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'error';
  }
}

export const json = (status, body, headers = {}) => ({
  status,
  jsonBody: body,
  headers: { 'Cache-Control': 'no-store', ...headers }
});

/** Usuario autenticado por Azure Static Web Apps (encabezado x-ms-client-principal). */
export function getPrincipal(request) {
  const raw = request.headers.get('x-ms-client-principal');
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (!p?.userId) return null;
    return {
      userId: String(p.userId),
      provider: p.identityProvider || '',
      userDetails: p.userDetails || '',
      roles: p.userRoles || []
    };
  } catch {
    return null;
  }
}

export function requireUser(request) {
  const user = getPrincipal(request);
  if (!user) throw new HttpError(401, 'Inicia sesión para continuar.', 'unauthenticated');
  return user;
}

export async function readJson(request, maxBytes = 64 * 1024) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Solicitud demasiado grande.', 'too_large');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'JSON inválido.', 'bad_json');
  }
}

/** Envuelve un handler para convertir errores en respuestas JSON. */
export function handle(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message, code: err.code });
      context?.error?.(err);
      return json(500, { error: 'Error interno del servidor.', code: 'internal' });
    }
  };
}

export const num = (v, min, max) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return undefined; // undefined = inválido
  return n;
};

export function coordsParam(request) {
  const lat = Number(request.query.get('lat'));
  const lon = Number(request.query.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new HttpError(400, 'Coordenadas inválidas (lat, lon).', 'bad_coords');
  }
  return { lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4 };
}
