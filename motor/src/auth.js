// Login med magisk link. Ingen adgangskoder. Tokens gemmes kun som SHA-256-hash.
import { json, fail, readJson, HttpError, now, randomToken, sha256hex, parseCookies, normalizeEmail, isAdmin, newId } from './util.js';
import { sendMail, loginMail } from './mail.js';

const COOKIE = 'motor_session';

export async function requestLink(request, env) {
  const body = await readJson(request, 10_000);
  const email = normalizeEmail(body.email);
  if (!email) return fail(400, 'bad_email', 'Skriv en gyldig mailadresse.');
  const invite = String(body.invite || '').trim().toUpperCase().slice(0, 40);

  // Nye brugere skal have en invitation, medmindre de står i ADMIN_EMAILS.
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!existing && !isAdmin(env, email)) {
    if (!invite) return fail(403, 'invite_required', 'Abonnementet åbner efter invitation. Skriv din kode.');
    const inv = await env.DB.prepare('SELECT code, used_by FROM invites WHERE code = ?').bind(invite).first();
    if (!inv || (inv.used_by && inv.used_by !== email)) return fail(403, 'invite_invalid', 'Koden findes ikke eller er brugt.');
  }

  // Højst fem links pr. mail pr. kvarter.
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND expires_at > ?').bind(email, now()).first();
  if ((recent?.n || 0) >= 5) return fail(429, 'too_many', 'Der er sendt for mange links. Prøv om et kvarter.');

  const token = randomToken(32);
  const ttl = Number(env.LINK_TTL || 900);
  await env.DB.prepare('INSERT INTO login_tokens (hash, email, invite, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256hex(token), email, invite || null, now() + ttl).run();

  const link = `${new URL(request.url).origin}/auth/verify?token=${token}`;
  const mail = await sendMail(env, { to: email, ...loginMail(link) });
  const out = { ok: true, sent: !mail.dev };
  if (env.DEV === '1') out.devLink = link; // kun lokalt: linket vises i stedet for at blive sendt
  return json(out);
}

export async function verifyLink(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const appUrl = env.APP_URL || '/';
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return Response.redirect(appUrl + '?login=ugyldig', 302);
  const hash = await sha256hex(token);
  const row = await env.DB.prepare('SELECT hash, email, invite, expires_at, used_at FROM login_tokens WHERE hash = ?').bind(hash).first();
  if (!row || row.used_at || row.expires_at < now()) return Response.redirect(appUrl + '?login=udloebet', 302);
  await env.DB.prepare('UPDATE login_tokens SET used_at = ? WHERE hash = ?').bind(now(), hash).run();

  let user = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(row.email).first();
  if (!user) {
    user = { id: newId(), email: row.email };
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, created_at, last_seen_at) VALUES (?, ?, ?, ?)').bind(user.id, user.email, now(), now()),
      env.DB.prepare('INSERT INTO subscriptions (user_id, status, updated_at) VALUES (?, ?, ?)').bind(user.id, 'none', now()),
      ...(row.invite ? [env.DB.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL').bind(user.email, now(), row.invite)] : []),
    ]);
  }

  const session = randomToken(32);
  const ttl = Number(env.SESSION_TTL || 2592000);
  await env.DB.prepare('INSERT INTO sessions (hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256hex(session), user.id, now() + ttl, now()).run();

  const headers = new Headers({ Location: appUrl + '?login=ok' });
  headers.append('Set-Cookie', sessionCookie(session, ttl, env));
  return new Response(null, { status: 302, headers });
}

function sessionCookie(value, maxAge, env) {
  // SameSite=None, fordi appen ligger på friisnaes.com og motoren på workers.dev. Secure gælder også på localhost.
  return `${COOKIE}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=None`;
}

export async function requireUser(request, env) {
  const token = parseCookies(request)[COOKIE];
  if (!token) throw new HttpError(401, 'not_logged_in', 'Du er ikke logget ind.');
  const row = await env.DB.prepare(
    'SELECT u.id, u.email, s.hash, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ?'
  ).bind(await sha256hex(token)).first();
  if (!row || row.expires_at < now()) throw new HttpError(401, 'session_expired', 'Din session er udløbet. Log ind igen.');
  return { id: row.id, email: row.email, sessionHash: row.hash, admin: isAdmin(env, row.email) };
}

export async function me(request, env) {
  const user = await requireUser(request, env);
  const sub = await env.DB.prepare('SELECT status, current_period_end FROM subscriptions WHERE user_id = ?').bind(user.id).first();
  const store = await env.DB.prepare('SELECT version, updated_at FROM stores WHERE user_id = ?').bind(user.id).first();
  await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(now(), user.id).run();
  return json({
    email: user.email,
    admin: user.admin,
    subscription: { status: sub?.status || 'none', currentPeriodEnd: sub?.current_period_end || null, active: isActive(sub, user) },
    store: store ? { version: store.version, updatedAt: store.updated_at } : null,
  });
}

export function isActive(sub, user) {
  if (user?.admin) return true;
  return !!sub && ['active', 'trialing', 'past_due'].includes(sub.status);
}

export async function logout(request, env) {
  const token = parseCookies(request)[COOKIE];
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256hex(token)).run();
  const headers = new Headers();
  headers.append('Set-Cookie', `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None`);
  return json({ ok: true }, 200, Object.fromEntries(headers));
}
