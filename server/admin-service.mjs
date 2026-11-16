import { ENV } from '../js/env.js';

export class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

export function configuration(env = process.env) {
    const secret = env.SUPABASE_SERVICE_ROLE_KEY;
    const admins = (env.ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!secret || !admins.length) throw new HttpError(503, 'Falta configurar el acceso administrativo en Vercel.');
    return { url: ENV.SUPABASE_URL, publicKey: ENV.SUPABASE_ANON_KEY, secret, admins };
}

async function request(config, path, options = {}, transport = fetch) {
    const response = await transport(new URL(path, config.url), {
        ...options,
        headers: { apikey: config.secret, Authorization: `Bearer ${config.secret}`, 'Content-Type': 'application/json', ...options.headers },
        signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new HttpError(502, 'No se pudo completar la consulta a Supabase.');
    return response.status === 204 ? null : response.json();
}

export async function authorize(header, config, transport = fetch) {
    if (typeof header !== 'string' || !/^Bearer [^\s]+$/.test(header)) throw new HttpError(401, 'Iniciá sesión para continuar.');
    const response = await transport(new URL('/auth/v1/user', config.url), {
        headers: { apikey: config.publicKey, Authorization: header }, signal: AbortSignal.timeout(10000)
    });
    if (response.status === 401 || response.status === 403) throw new HttpError(401, 'La sesión venció. Ingresá nuevamente.');
    if (!response.ok) throw new HttpError(502, 'No se pudo verificar la sesión.');
    const user = await response.json();
    if (!user.id || user.is_anonymous || !user.email_confirmed_at || !config.admins.includes(user.id)) {
        throw new HttpError(403, 'Este usuario no tiene permiso para administrar la cartilla.');
    }
    return user;
}

export async function listRecords(config, table, select, transport = fetch) {
    const result = [];
    while (true) {
        const params = new URLSearchParams({ select, order: 'id.asc', limit: '100', offset: String(result.length) });
        const page = await request(config, `/rest/v1/${table}?${params}`, {}, transport);
        if (!Array.isArray(page)) throw new HttpError(502, 'Respuesta inesperada de la base.');
        if (!page.length) return result;
        result.push(...page);
    }
}

const beforeFields = ['name', 'address', 'phone', 'city', 'categoria_id'];
const editableFields = ['name', 'address', 'phone', 'categoria_id'];
const idPattern = /^\d{1,18}$/;
function validId(value) { return (typeof value === 'string' || Number.isSafeInteger(value)) && idPattern.test(String(value)); }

export function validateUpdate(body) {
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!object(body) || !validId(body.id) || !object(body.before) || !object(body.changes) ||
        Object.keys(body).some(key => !['id', 'before', 'changes'].includes(key))) throw new HttpError(400, 'Solicitud de actualización inválida.');
    if (Object.keys(body.before).length !== beforeFields.length || beforeFields.some(key => !(key in body.before))) {
        throw new HttpError(400, 'Faltan los datos originales del profesional.');
    }
    const keys = Object.keys(body.changes);
    if (!keys.length || keys.some(key => !editableFields.includes(key))) throw new HttpError(400, 'Seleccioná campos válidos para actualizar.');
    for (const [key, value] of Object.entries(body.before)) {
        if (key === 'categoria_id' ? value !== null && !validId(value) : value !== null && (typeof value !== 'string' || value.length > 2000)) {
            throw new HttpError(400, 'Los datos originales no son válidos.');
        }
    }
    for (const [key, value] of Object.entries(body.changes)) {
        if (key === 'categoria_id' ? !validId(value) : typeof value !== 'string' || !value.trim() || value.length > 2000) {
            throw new HttpError(400, 'Los valores nuevos no son válidos. No se permiten campos vacíos.');
        }
    }
    return body;
}

function equality(value) {
    if (value === null) return 'is.null';
    // Each condition is a separate URLSearchParams value. PostgREST's eq filter
    // expects the raw value, including for numeric IDs; quoted IDs fail to cast.
    return 'eq.' + String(value);
}

export async function applyUpdate(body, config, user, transport = fetch) {
    validateUpdate(body);
    if ('categoria_id' in body.changes) {
        const params = new URLSearchParams({ id: `eq.${body.changes.categoria_id}`, select: 'id' });
        const categories = await request(config, `/rest/v1/categorias?${params}`, {}, transport);
        if (!Array.isArray(categories) || categories.length !== 1) throw new HttpError(400, 'La especialidad seleccionada no existe.');
    }
    // All original values are conditions on the UPDATE itself: a concurrent edit
    // cannot be overwritten between a preliminary SELECT and the PATCH.
    const params = new URLSearchParams({ id: `eq.${body.id}`, select: 'id,name,address,city,phone,categoria_id,categorias(nombre)' });
    for (const field of beforeFields) params.set(field, equality(body.before[field]));
    const updated = await request(config, `/rest/v1/profesionales?${params}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body.changes)
    }, transport);
    if (!Array.isArray(updated) || updated.length !== 1) throw new HttpError(409, 'El profesional cambió desde que lo revisaste. Recargá los datos antes de guardar.');
    const receipt = { at: new Date().toISOString(), actor: user.id, id: body.id, before: body.before, changes: body.changes, after: updated[0] };
    return receipt;
}
