// Enhedstest af de rene funktioner. Kør: cd motor && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256hex, hmacHex, safeEqual, normalizeEmail, base64url, parseCookies } from '../src/util.js';
import { verifyStripeSignature } from '../src/billing.js';
import { makeScrubber, fixQuotes } from '../src/ai.js';
import { INSTRUKS } from '../src/instruks.js';
import { KORT } from '../src/kort/index.js';

test('sha256hex giver kendt hash', async () => {
  assert.equal(await sha256hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('safeEqual sammenligner korrekt', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'ab'), false);
});

test('normalizeEmail renser og afviser', () => {
  assert.equal(normalizeEmail('  Thomas@Example.COM '), 'thomas@example.com');
  assert.equal(normalizeEmail('ikke en mail'), null);
  assert.equal(normalizeEmail(''), null);
});

test('base64url er url-sikker', () => {
  const s = base64url(new Uint8Array([251, 255, 254, 0]));
  assert.ok(!/[+/=]/.test(s));
});

test('parseCookies læser flere cookies', () => {
  const req = new Request('https://x', { headers: { Cookie: 'a=1; motor_session=abc%20d; b=2' } });
  assert.deepEqual(parseCookies(req), { a: '1', motor_session: 'abc d', b: '2' });
});

test('Stripe-signatur accepteres, når HMAC passer, og afvises ellers', async () => {
  const secret = 'whsec_test';
  const payload = '{"id":"evt_1","type":"checkout.session.completed"}';
  const t = 1_700_000_000;
  const good = await hmacHex(secret, `${t}.${payload}`);
  assert.equal(await verifyStripeSignature(payload, `t=${t},v1=${good}`, secret, 300, t + 10), true);
  assert.equal(await verifyStripeSignature(payload, `t=${t},v1=${good}`, secret, 300, t + 1000), false, 'for gammel');
  assert.equal(await verifyStripeSignature(payload, `t=${t},v1=deadbeef`, secret, 300, t + 10), false, 'forkert signatur');
  assert.equal(await verifyStripeSignature(payload + ' ', `t=${t},v1=${good}`, secret, 300, t + 10), false, 'ændret payload');
});

test('scrubber fjerner mailadresser og oplyste navne', () => {
  const scrub = makeScrubber({ email: 'leder@firma.dk' }, ['Peter Hansen', 'Lone']);
  const out = scrub('Skriv til leder@firma.dk eller peter@x.com. Peter Hansen og lone kom ikke. Lonely er ok.');
  assert.equal(out, 'Skriv til [mail] eller [mail]. [navn] og [navn] kom ikke. Lonely er ok.');
});

test('fixQuotes erstatter franske og typografiske anførselstegn', () => {
  assert.equal(fixQuotes('»hej« og “hej”'), '"hej" og "hej"');
});

test('instruks og kildekort indeholder ingen franske anførselstegn i teksten, kun i reglen', () => {
  const re = /[»«]/g;
  // Reglen "Aldrig » eller «" er den eneste tilladte forekomst i instruksen.
  assert.equal((INSTRUKS.match(re) || []).length, 2);
  for (const k of Object.values(KORT)) assert.equal((k.text.match(re) || []).length, 0, k.id);
});

test('alle kildekort har id, navn, lag og tekst', () => {
  for (const [id, k] of Object.entries(KORT)) {
    assert.equal(k.id, id);
    assert.ok(k.navn && k.lag && k.text.length > 500, id);
  }
});

import { isoWeek, perspektivFor, PERSPEKTIVER } from '../src/perspektiver.js';
import { KORT as ALLE_KORT } from '../src/kort/index.js';
test('isoWeek: mandag 23. november 2026 er uge 48, 4. januar 2027 er uge 1', () => {
  assert.equal(isoWeek(new Date(Date.UTC(2026, 10, 23))), '2026-W48');
  assert.equal(isoWeek(new Date(Date.UTC(2027, 0, 4))), '2027-W01');
  assert.equal(isoWeek(new Date(Date.UTC(2027, 0, 1))), '2026-W53');
});
test('perspektivFor: præcis uge, ellers seneste før, ellers null', () => {
  assert.equal(perspektivFor('2026-W49').uge, '2026-W49');
  assert.equal(perspektivFor('2026-W53').uge, '2026-W52');
  assert.equal(perspektivFor('2026-W40'), null);
});
test('perspektiver peger kun på kendte kort og bruger kun " som anførselstegn', () => {
  for (const p of PERSPEKTIVER) {
    for (const k of p.kort) assert.ok(ALLE_KORT[k], `${p.uge}: ukendt kort ${k}`);
    assert.ok(!/[\u00BB\u00AB\u201C\u201D]/.test(p.tekst + p.titel + p.spoergsmaal), p.uge);
  }
});
