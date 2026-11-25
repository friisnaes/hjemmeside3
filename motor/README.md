# Motoren bag abonnementet

Én Cloudflare Worker foran tre tjenester: mail (Resend), betaling (Stripe) og AI-modellen (Anthropic).
Brugerens indhold krypteres i browseren med en nøgle afledt af en PIN; motoren gemmer og sender kun
ciffertekst. Planen står i værktøjskasse-dokumentet, fanen "Fase 2: Abonnementet".

Afprøvningssiden ligger på `/abonnement/` og peger på motoren via `MOTOR_URL` øverst i dens script.

## Ruter

| Rute | Hvad |
| --- | --- |
| `GET /` · `GET /health` | Version, kildekort, databasetjek |
| `POST /auth/request` `{email, invite?}` | Sender magisk link. Nye brugere skal have en invitationskode, medmindre de står i `ADMIN_EMAILS` |
| `GET /auth/verify?token=` | Bytter linket til en session-cookie og sender videre til `APP_URL` |
| `GET /me` · `POST /auth/logout` | Hvem er jeg, abonnementsstatus, lagerversion |
| `GET/PUT/DELETE /store` | Det krypterede lager `{v, salt, iv, ct}`, højst 512 KB, versioneret med `If-Match` |
| `DELETE /account` | Sletter bruger, lager, sessioner og forbrug |
| `POST /ai` `{kort, messages, names?}` | Modspil: grundinstruks + kildekort + brugerens tekst. Kræver aktivt abonnement (eller admin). Dagsgrænse `AI_DAILY_LIMIT` |
| `GET /kort` | De kildekort, der findes |
| `POST /billing/checkout` · `POST /billing/portal` | Stripe Checkout (abonnement) og kundeportal |
| `POST /stripe/webhook` | Stripe-hændelser, signatur tjekkes, idempotent |
| `POST /admin/invites` `{antal, note}` · `GET /admin/invites` | Invitationskoder (kun admin) |
| `POST /admin/reminders?dag=mandag|fredag` | Kør påmindelserne nu (kun admin) |

Cron: mandag 07:00 og fredag 15:00 dansk vintertid sender påmindelser til aktive abonnenter.

## Lokalt

```
cd motor
npm install
npm run migrate:local
npm run dev
```

`.dev.vars` (git-ignoreret) sætter `DEV=1` og `AI_MOCK=1`: det magiske link returneres i svaret i stedet for
at blive sendt, og AI'en svarer med et fast mock-svar. Afprøvningssiden serveres fra repoets rod på en
anden port, fx `python3 -m http.server 8767`, og åbnes på `http://localhost:8767/abonnement/`.

Enhedstest: `npm test`.

## Første udrulning (gøres én gang af Thomas)

1. Log ind: `npx wrangler login` (åbner browseren).
2. Opret databasen: `npx wrangler d1 create friisnaes-motor`, og skriv det `database_id`, kommandoen viser, ind i `wrangler.toml`.
3. Kør skemaet: `npm run migrate`.
4. Sæt hemmeligheder (hver kommando spørger efter værdien, så den aldrig står i en fil eller i terminalhistorikken):
   - `npx wrangler secret put ANTHROPIC_API_KEY`
   - `npx wrangler secret put RESEND_API_KEY` (Resend-konto med domænet friisnaes.com verificeret, så `MAIL_FROM` kan sende)
   - `npx wrangler secret put STRIPE_SECRET_KEY` (testnøglen først, `sk_test_...`)
   - `npx wrangler secret put STRIPE_PRICE_ID` (prisen på abonnementet i Stripe, `price_...`)
   - `npx wrangler secret put STRIPE_WEBHOOK_SECRET` (fra webhook-endpointet nedenfor, `whsec_...`)
5. Udrul: `npm run deploy`. Workeren får en adresse som `https://friisnaes-motor.<konto>.workers.dev`.
6. Skriv den adresse ind som `MOTOR_URL` i `abonnement/index.html`.
7. I Stripe: opret et webhook-endpoint på `<worker-adresse>/stripe/webhook` med hændelserne
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   Slå kundeportalen til under Billing. Slå dansk moms og momsnummer til under Tax, hvis fakturaerne skal bære det.
8. Log ind på `/abonnement/` med mailen fra `ADMIN_EMAILS`, og opret invitationskoder med `POST /admin/invites`
   (fx fra browserens konsol: `fetch(MOTOR_URL+'/admin/invites',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{"antal":5,"note":"afprøvning"}'}).then(r=>r.json()).then(console.log)`).

Senere ændringer: ret koden, `npm test`, `npm run deploy`. Skemaændringer lægges som nye filer i `migrations/` og køres med `npm run migrate`.

## Det, der med vilje ikke er her

- Ingen adgangskoder. Ingen klartekst fra brugeren i databasen. Ingen navne i AI-kald (mailadresser og de navne, klienten oplyser, erstattes med `[mail]` og `[navn]` før afsendelse).
- Ingen vektordatabase. Kildekortene i `src/kort/` er kurateret i hånden ud fra Thomas' papers og de bedstes praksis.
- Ingen hukommelse hos AI-leverandøren. Hukommelsen er det krypterede lager, som kun brugeren kan læse.

## Stemmen

`src/instruks.js` er grundinstruksen (versioneret). `src/kort/` er kildekortene, ét pr. tema. Ændringer i dem
bør køres mod et testbatteri på omkring 40 brugersvar med Thomas' egen vurdering, før de rulles ud. Batteriet
bygges i spring 2 under `test/batteri/`.
