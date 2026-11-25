// Krypteret lager. Motoren ser kun ciffertekst og et versionsnummer.
// Browseren krypterer med en nøgle afledt af brugerens PIN (PBKDF2 -> AES-GCM) og sender {v, salt, iv, ct}.
import { json, fail, readJson, now } from './util.js';
import { requireUser } from './auth.js';

const MAX_BYTES = 512 * 1024;

export async function getStore(request, env) {
  const user = await requireUser(request, env);
  const row = await env.DB.prepare('SELECT blob, version, updated_at FROM stores WHERE user_id = ?').bind(user.id).first();
  if (!row) return json({ blob: null, version: 0, updatedAt: null }, 200, { 'ETag': '"0"' });
  return json({ blob: JSON.parse(row.blob), version: row.version, updatedAt: row.updated_at }, 200, { 'ETag': `"${row.version}"` });
}

export async function putStore(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request, MAX_BYTES + 10_000);
  const blob = body.blob;
  if (!blob || typeof blob !== 'object' || !Array.isArray(blob.salt) || !Array.isArray(blob.iv) || !Array.isArray(blob.ct)) {
    return fail(400, 'bad_blob', 'Lageret skal være krypteret: {v, salt, iv, ct}.');
  }
  const text = JSON.stringify(blob);
  if (text.length > MAX_BYTES) return fail(413, 'too_large', 'Lageret er større end 512 KB.');

  // Optimistisk samtidighed: klienten sender den version, den byggede på. Er lageret nyere, afvises.
  const expected = Number((request.headers.get('If-Match') || '').replace(/"/g, '') || body.version || 0);
  const current = await env.DB.prepare('SELECT version FROM stores WHERE user_id = ?').bind(user.id).first();
  const have = current?.version || 0;
  if (expected !== have) return json({ error: 'conflict', message: 'Lageret er ændret fra en anden enhed. Hent det igen.', version: have }, 409);

  const next = have + 1;
  if (current) {
    await env.DB.prepare('UPDATE stores SET blob = ?, version = ?, updated_at = ? WHERE user_id = ? AND version = ?').bind(text, next, now(), user.id, have).run();
  } else {
    await env.DB.prepare('INSERT INTO stores (user_id, blob, version, updated_at) VALUES (?, ?, ?, ?)').bind(user.id, text, next, now()).run();
  }
  return json({ ok: true, version: next, updatedAt: now() }, 200, { 'ETag': `"${next}"` });
}

export async function deleteStore(request, env) {
  const user = await requireUser(request, env);
  await env.DB.prepare('DELETE FROM stores WHERE user_id = ?').bind(user.id).run();
  return json({ ok: true, version: 0 });
}

// Slet alt om brugeren: lager, sessioner, forbrug, abonnementsrække. Stripe-kunden opsiges i billing.js.
export async function deleteAccount(request, env) {
  const user = await requireUser(request, env);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM stores WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM usage WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM login_tokens WHERE email = ?').bind(user.email),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return json({ ok: true });
}
