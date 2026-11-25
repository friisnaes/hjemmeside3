// Stripe: abonnement, kundeportal og webhook. Motoren ser aldrig kortoplysninger.
import { json, fail, now, hmacHex, safeEqual, HttpError } from './util.js';
import { requireUser } from './auth.js';

const STRIPE = 'https://api.stripe.com/v1';

async function stripe(env, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, 'stripe_unavailable', 'Betaling er ikke sat op.');
  const body = new URLSearchParams();
  const add = (k, v) => { if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) add(`${k}[${kk}]`, vv); else if (v != null) body.append(k, String(v)); };
  for (const [k, v] of Object.entries(params || {})) add(k, v);
  const r = await fetch(`${STRIPE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, 'stripe_error', data.error?.message || `Stripe svarede ${r.status}`);
  return data;
}

async function ensureCustomer(env, user) {
  const row = await env.DB.prepare('SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?').bind(user.id).first();
  if (row?.stripe_customer_id) return row.stripe_customer_id;
  const c = await stripe(env, '/customers', { email: user.email, metadata: { user_id: user.id } });
  await env.DB.prepare('INSERT INTO subscriptions (user_id, stripe_customer_id, status, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id, updated_at = excluded.updated_at')
    .bind(user.id, c.id, 'none', now()).run();
  return c.id;
}

export async function checkout(request, env) {
  const user = await requireUser(request, env);
  if (!env.STRIPE_PRICE_ID) return fail(503, 'no_price', 'Prisen er ikke sat op i Stripe endnu.');
  const customer = await ensureCustomer(env, user);
  const appUrl = env.APP_URL || '/';
  const s = await stripe(env, '/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    'line_items[0][price]': env.STRIPE_PRICE_ID,
    'line_items[0][quantity]': 1,
    success_url: `${appUrl}?betaling=ok`,
    cancel_url: `${appUrl}?betaling=afbrudt`,
    locale: 'da',
    allow_promotion_codes: 'true',
    billing_address_collection: 'required',
    'tax_id_collection[enabled]': 'true',
  });
  return json({ url: s.url });
}

export async function portal(request, env) {
  const user = await requireUser(request, env);
  const customer = await ensureCustomer(env, user);
  const p = await stripe(env, '/billing_portal/sessions', { customer, return_url: env.APP_URL || '/' });
  return json({ url: p.url });
}

// Webhook: signaturen tjekkes med HMAC-SHA256, som Stripe beskriver, før noget skrives.
export async function webhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return fail(503, 'no_webhook_secret', 'Webhook-hemmelighed mangler.');
  const payload = await request.text();
  const sig = request.headers.get('Stripe-Signature') || '';
  if (!(await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET))) return fail(400, 'bad_signature', 'Signaturen passer ikke.');

  let event;
  try { event = JSON.parse(payload); } catch { return fail(400, 'bad_json', 'Kunne ikke læse hændelsen.'); }

  // Samme hændelse to gange ændrer intet.
  const seen = await env.DB.prepare('SELECT id FROM stripe_events WHERE id = ?').bind(event.id).first();
  if (seen) return json({ ok: true, duplicate: true });
  await env.DB.prepare('INSERT INTO stripe_events (id, type, received_at) VALUES (?, ?, ?)').bind(event.id, event.type, now()).run();

  const obj = event.data?.object || {};
  if (event.type === 'checkout.session.completed') {
    await upsert(env, { userId: obj.client_reference_id, customer: obj.customer, subscription: obj.subscription, status: 'active' });
  } else if (event.type.startsWith('customer.subscription.')) {
    const status = event.type === 'customer.subscription.deleted' ? 'canceled' : obj.status;
    await upsert(env, { customer: obj.customer, subscription: obj.id, status, periodEnd: obj.current_period_end });
  } else if (event.type === 'invoice.payment_failed') {
    await upsert(env, { customer: obj.customer, status: 'past_due' });
  }
  return json({ ok: true });
}

async function upsert(env, { userId, customer, subscription, status, periodEnd }) {
  if (!customer && !userId) return;
  const row = userId
    ? await env.DB.prepare('SELECT user_id FROM subscriptions WHERE user_id = ?').bind(userId).first()
    : await env.DB.prepare('SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?').bind(customer).first();
  const uid = row?.user_id || userId;
  if (!uid) return; // ukendt kunde: ingen ændring, hændelsen er logget
  await env.DB.prepare(
    'INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id = COALESCE(excluded.stripe_customer_id, stripe_customer_id), ' +
    'stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, stripe_subscription_id), status = excluded.status, ' +
    'current_period_end = COALESCE(excluded.current_period_end, current_period_end), updated_at = excluded.updated_at'
  ).bind(uid, customer || null, subscription || null, status || 'none', periodEnd || null, now()).run();
}

export async function verifyStripeSignature(payload, header, secret, toleranceSec = 300, nowSec = now()) {
  const parts = Object.fromEntries(header.split(',').map(p => p.trim().split('=')).filter(p => p.length === 2));
  const t = Number(parts.t);
  const v1 = header.split(',').map(p => p.trim()).filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  if (!t || !v1.length || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = await hmacHex(secret, `${t}.${payload}`);
  return v1.some(s => safeEqual(s, expected));
}
