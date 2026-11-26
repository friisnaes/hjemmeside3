// Motoren bag abonnementet på friisnaes.com. Én Worker, få ruter, intet i klartekst.
import { json, fail, withCors, corsHeaders, HttpError, now, randomToken } from './util.js';
import { requestLink, verifyLink, me, logout, requireUser } from './auth.js';
import { getStore, putStore, deleteStore, deleteAccount } from './store.js';
import { ai } from './ai.js';
import { checkout, portal, webhook } from './billing.js';
import { runReminders } from './reminders.js';
import { KORT } from './kort/index.js';
import { INSTRUKS_VERSION } from './instruks.js';
import { perspektivFor, isoWeek } from './perspektiver.js';

const VERSION = '0.2.0';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    try {
      const res = await route(request, env, ctx, path, method);
      return withCors(res, request, env);
    } catch (e) {
      if (e instanceof HttpError) return withCors(fail(e.status, e.code, e.message), request, env);
      console.error('motor-fejl', path, e);
      return withCors(fail(500, 'internal', 'Noget gik galt i motoren. Prøv igen om lidt.'), request, env);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminders(env, event.cron));
  },
};

async function route(request, env, ctx, path, method) {
  // Sundhed og oversigt
  if (path === '/' && method === 'GET') {
    return json({ motor: 'friisnaes-motor', version: VERSION, instruks: INSTRUKS_VERSION, kort: Object.keys(KORT), time: now() });
  }
  if (path === '/health' && method === 'GET') {
    await env.DB.prepare('SELECT 1').first();
    return json({ ok: true });
  }

  // Login
  if (path === '/auth/request' && method === 'POST') return requestLink(request, env);
  if (path === '/auth/verify' && method === 'GET') return verifyLink(request, env);
  if (path === '/auth/logout' && method === 'POST') return logout(request, env);
  if (path === '/me' && method === 'GET') return me(request, env);

  // Lager
  if (path === '/store' && method === 'GET') return getStore(request, env);
  if (path === '/store' && method === 'PUT') return putStore(request, env);
  if (path === '/store' && method === 'DELETE') return deleteStore(request, env);
  if (path === '/account' && method === 'DELETE') return deleteAccount(request, env);

  // AI
  if (path === '/ai' && method === 'POST') return ai(request, env);
  if (path === '/kort' && method === 'GET') {
    return json({ kort: Object.values(KORT).map(k => ({ id: k.id, navn: k.navn, lag: k.lag })) });
  }

  // Ugens perspektiv: offentligt indhold, ingen persondata.
  if (path === '/perspektiv' && method === 'GET') {
    const q = new URL(request.url).searchParams.get('uge');
    const uge = /^\d{4}-W\d{2}$/.test(q || '') ? q : isoWeek();
    const p = perspektivFor(uge);
    return json({ uge, perspektiv: p });
  }

  // Betaling
  if (path === '/billing/checkout' && method === 'POST') return checkout(request, env);
  if (path === '/billing/portal' && method === 'POST') return portal(request, env);
  if (path === '/stripe/webhook' && method === 'POST') return webhook(request, env);

  // Invitationer (kun admin)
  if (path === '/admin/invites' && method === 'POST') return createInvites(request, env);
  if (path === '/admin/invites' && method === 'GET') return listInvites(request, env);
  if (path === '/admin/reminders' && method === 'POST') {
    const user = await requireUser(request, env);
    if (!user.admin) return fail(403, 'forbidden', 'Kun admin.');
    const which = new URL(request.url).searchParams.get('dag') === 'fredag' ? '0 14 * * 5' : '0 6 * * 1';
    return json(await runReminders(env, which));
  }

  return fail(404, 'not_found', 'Ingen rute her.');
}

async function createInvites(request, env) {
  const user = await requireUser(request, env);
  if (!user.admin) return fail(403, 'forbidden', 'Kun admin.');
  const body = await request.json().catch(() => ({}));
  const n = Math.min(Math.max(Number(body.antal || 1), 1), 25);
  const note = String(body.note || '').slice(0, 120);
  const codes = [];
  const stmts = [];
  for (let i = 0; i < n; i++) {
    // Læsbare koder: fire plus fire tegn uden 0/O/1/I.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const raw = [...bytes].map(b => alphabet[b % alphabet.length]).join('');
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    codes.push(code);
    stmts.push(env.DB.prepare('INSERT INTO invites (code, note, created_at) VALUES (?, ?, ?)').bind(code, note || null, now()));
  }
  await env.DB.batch(stmts);
  return json({ codes });
}

async function listInvites(request, env) {
  const user = await requireUser(request, env);
  if (!user.admin) return fail(403, 'forbidden', 'Kun admin.');
  const rows = await env.DB.prepare('SELECT code, note, created_at, used_by, used_at FROM invites ORDER BY created_at DESC LIMIT 200').all();
  return json({ invites: rows.results || [] });
}

// Undgå ubrugt import-advarsel i nogle bundlere.
void randomToken;
