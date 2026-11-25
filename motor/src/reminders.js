// Påmindelser: mandag "ugens tema er klar", fredag "ti minutters review". Kun til aktive abonnenter.
import { sendMail, mondayMail, fridayMail } from './mail.js';

export async function runReminders(env, cron) {
  const monday = cron.startsWith('0 6');
  const mail = monday ? mondayMail(env.APP_URL) : fridayMail(env.APP_URL);
  const rows = await env.DB.prepare(
    "SELECT u.email FROM users u JOIN subscriptions s ON s.user_id = u.id WHERE s.status IN ('active','trialing','past_due')"
  ).all();
  let sent = 0, failed = 0;
  for (const r of rows.results || []) {
    try { await sendMail(env, { to: r.email, ...mail }); sent++; }
    catch (e) { failed++; console.error('påmindelse fejlede', r.email, e.message); }
  }
  console.log(`påmindelser (${monday ? 'mandag' : 'fredag'}): ${sent} sendt, ${failed} fejlede`);
  return { sent, failed };
}
