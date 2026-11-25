// Små hjælpere: svar, CORS, tokens, hashing, cookies.

export const now = () => Math.floor(Date.now() / 1000);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function fail(status, code, message) {
  return json({ error: code, message }, status);
}

export async function readJson(request, maxBytes = 1_000_000) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'too_large', 'For stor forespørgsel.');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large', 'For stor forespørgsel.');
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, 'bad_json', 'Kunne ikke læse JSON.'); }
}

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// CORS: kun de sider, der står i ALLOWED_ORIGINS (plus localhost under udvikling), og med cookies.
export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const dev = env.DEV === '1' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!origin || !(allowed.includes(origin) || dev)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,If-Match,Authorization',
    'Access-Control-Expose-Headers': 'ETag',
    'Vary': 'Origin',
  };
}

export function withCors(response, request, env) {
  const h = corsHeaders(request, env);
  if (!Object.keys(h).length) return response;
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(h)) r.headers.set(k, v);
  return r;
}

export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(a);
}

export function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sammenligning i konstant tid, så en angriber ikke kan måle sig frem.
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 200) return null;
  return e;
}

export function isAdmin(env, email) {
  return (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(email);
}

export function dayKey(ts = now()) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export function newId() {
  return 'u_' + randomToken(12);
}
