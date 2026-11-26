// AI-proxy: grundinstruks + ét kildekort + brugerens tekst. Uden navne, uden hukommelse hos leverandøren.
import { json, fail, readJson, now, dayKey } from './util.js';
import { requireUser, isActive } from './auth.js';
import { INSTRUKS } from './instruks.js';
import { KORT } from './kort/index.js';

const MAX_MESSAGES = 30;
const MAX_CHARS = 12_000;

export async function ai(request, env) {
  const user = await requireUser(request, env);
  const sub = await env.DB.prepare('SELECT status, current_period_end FROM subscriptions WHERE user_id = ?').bind(user.id).first();
  if (!isActive(sub, user)) return fail(402, 'no_subscription', 'Modspillet kræver et aktivt abonnement.');

  const body = await readJson(request, 200_000);
  const kort = KORT[body.kort];
  if (!kort) return fail(400, 'unknown_kort', `Ukendt kildekort. Kendte: ${Object.keys(KORT).join(', ')}.`);

  const messages = sanitizeMessages(body.messages, user, body.names);
  if (messages && messages.error) return fail(400, messages.error, messages.message);
  if (!messages) return fail(400, 'bad_messages', 'Samtalen kunne ikke sendes. Ryd samtalen, og prøv igen.');

  // Dagsgrænse pr. bruger.
  const day = dayKey();
  const limit = Number(env.AI_DAILY_LIMIT || 60);
  const used = await env.DB.prepare('SELECT calls FROM usage WHERE user_id = ? AND day = ?').bind(user.id, day).first();
  if ((used?.calls || 0) >= limit) return fail(429, 'daily_limit', `Dagens grænse på ${limit} svar er nået. Resten kan vente til i morgen.`);

  const system = `${INSTRUKS}\n\n${kort.text}`;
  const maxTokens = Math.min(Number(body.max_tokens || env.AI_MAX_TOKENS || 900), 2000);

  let result;
  if (env.AI_MOCK === '1' || !env.ANTHROPIC_API_KEY) {
    if (env.DEV !== '1') return fail(503, 'ai_unavailable', 'AI-modellen er ikke sat op.');
    result = mock(kort, messages);
  } else {
    result = await callAnthropic(env, system, messages, maxTokens);
  }

  await env.DB.prepare(
    'INSERT INTO usage (user_id, day, calls, input_tokens, output_tokens) VALUES (?, ?, 1, ?, ?) ' +
    'ON CONFLICT(user_id, day) DO UPDATE SET calls = calls + 1, input_tokens = input_tokens + excluded.input_tokens, output_tokens = output_tokens + excluded.output_tokens'
  ).bind(user.id, day, result.inputTokens, result.outputTokens).run();

  return json({ text: fixQuotes(result.text), kort: body.kort, remaining: limit - (used?.calls || 0) - 1, model: result.model });
}

// Kun role/content, skiftende roller, bundet længde. Mailadresser og oplyste navne erstattes før afsendelse.
function sanitizeMessages(list, user, names) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_MESSAGES) return null;
  const scrub = makeScrubber(user, names);
  const out = [];
  let total = 0;
  for (const m of list) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null;
    if (out.length && out[out.length - 1].role === m.role) return null;
    if (m.content.length > MAX_CHARS) return { error: 'too_long', message: `Beskeden er for lang: ${m.content.length.toLocaleString('da-DK')} tegn, højst ${MAX_CHARS.toLocaleString('da-DK')}. Skriv kortere, og brug roller i stedet for navne.` };
    const content = scrub(m.content.trim());
    total += content.length;
    if (!content) return null;
    out.push({ role: m.role, content });
  }
  if (total > MAX_CHARS * 2) return { error: 'too_long', message: 'Samtalen er blevet for lang til ét kald. Ryd samtalen, og begynd en ny.' };
  if (out[0].role !== 'user' || out[out.length - 1].role !== 'user') return null;
  return out;
}

export function makeScrubber(user, names) {
  const list = (Array.isArray(names) ? names : []).map(n => String(n || '').trim()).filter(n => n.length >= 2 && n.length <= 60).slice(0, 20);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRe = list.length ? new RegExp(`\\b(${list.map(esc).join('|')})\\b`, 'gi') : null;
  return text => {
    let t = String(text).replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[mail]');
    if (user?.email) t = t.split(user.email).join('[mail]');
    if (nameRe) t = t.replace(nameRe, '[navn]');
    return t;
  };
}

export const fixQuotes = s => String(s ?? '').replace(/[\u00BB\u00AB\u201E\u201C\u201D]/g, '"').replace(/[\u2018\u2019\u201A]/g, "'");

async function callAnthropic(env, system, messages, maxTokens) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.AI_MODEL, max_tokens: maxTokens, system, messages }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`AI-modellen svarede ${r.status}: ${JSON.stringify(data.error || data).slice(0, 200)}`);
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    return { text, model: data.model, inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 };
  } finally { clearTimeout(t); }
}

// Lokal udvikling uden nøgle: et fast, genkendeligt modspil.
function mock(kort, messages) {
  const last = messages[messages.length - 1].content;
  const text = `[mock · ${kort.id}] Du skriver: "${last.slice(0, 80)}". Det er en beskrivelse, ikke en handling. Hvem gør hvad, og hvilken dag?`;
  return { text, model: 'mock', inputTokens: 0, outputTokens: 0 };
}
