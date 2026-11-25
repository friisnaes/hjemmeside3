// Mail: magisk link og påmindelser. Sendes gennem Resend, når RESEND_API_KEY findes.
// Under udvikling (DEV=1) sendes intet; teksten returneres, så den kan ses i svaret eller loggen.

export async function sendMail(env, { to, subject, text }) {
  if (!env.RESEND_API_KEY) {
    if (env.DEV === '1') {
      console.log(`[mail til ${to}] ${subject}\n${text}`);
      return { dev: true, to, subject, text };
    }
    throw new Error('RESEND_API_KEY mangler, og DEV er ikke sat.');
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Mail kunne ikke sendes (${r.status}): ${body.slice(0, 200)}`);
  }
  return { sent: true };
}

export function loginMail(link) {
  return {
    subject: 'Dit link til motoren',
    text: `Her er dit link. Det virker i 15 minutter og kun én gang.\n\n${link}\n\nHar du ikke bedt om det, kan du se bort fra denne mail. Ingen kan logge ind uden linket.\n\nThomas Friisnæs · friisnaes.com`,
  };
}

export function mondayMail(appUrl) {
  return {
    subject: 'Ugens tema er klar',
    text: `Mandag. Ugens tema ligger klar, og det tager 20 minutter at åbne det.\n\n${appUrl}\n\nDet, der ikke får en tid i kalenderen i dag, sker ikke i denne uge.\n\nThomas Friisnæs · friisnaes.com`,
  };
}

export function fridayMail(appUrl) {
  return {
    subject: 'Fredagens review: ti minutter',
    text: `Fredag. Tre spørgsmål, én aftale for næste uge, tre linjer i logbogen. Ti minutter.\n\n${appUrl}\n\nHold du aftalen fra mandag? Skriv det, som det er.\n\nThomas Friisnæs · friisnaes.com`,
  };
}
