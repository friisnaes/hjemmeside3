// Ugens perspektiv: ét nyt hver mandag, i Thomas' stemme, tidsrelevant. Listen vedligeholdes i repoet og deployes med motoren.
// Felter: uge (ISO-uge, YYYY-Www), titel, tekst (fem til ti linjer), spoergsmaal, kort (to eller tre id'er), paper {t,u,s}.
// Appen henter ugens via GET /perspektiv?uge=YYYY-Www. Findes ugen ikke, bruges den seneste før den.

export const PERSPEKTIVER = [
  {
    uge: '2026-W48',
    titel: 'Budgettet er lagt. Hvad holder du op med?',
    tekst: 'De fleste budgetter for næste år er på plads i denne uge. De har alle sammen det samme problem: der er lagt ting til, og der er ikke taget noget fra. Når alt er vigtigt, kan intet prioriteres. Det er ikke en fejl i din dømmekraft. Det er en overbelastning af den. Fravalget er halvdelen af klarhed, og det har en modtager, der mærker det. Budgettet siger, hvad I vil. Det siger ikke, hvad I holder op med.',
    spoergsmaal: 'Hvad i næste års plan holder du op med, og hvem mærker det?',
    kort: ['det-jeg-holder-op-med', 'kalenderen-som-bevis'],
    paper: { t: 'Prioriteringsparalysen', u: '/prioriteringsparalysen.html', s: 'Eksekveringsserien' },
  },
  {
    uge: '2026-W49',
    titel: 'Det, direktionen ikke sagde i år',
    tekst: 'Året er ved at være slut, og der er ting, der ikke blev sagt i direktionen. Ikke fordi nogen løj, men fordi tavshed er billigere i øjeblikket. Det, vi ikke siger i direktionen, koster mere end det, vi siger forkert. En direktion, der ikke stiller spørgsmål, er ikke enig. Den er tavs. Inden I lukker året, er der én samtale, du skylder. Du ved allerede hvilken.',
    spoergsmaal: 'Hvilken samtale i direktionen blev ikke taget i år, og hvad har tavsheden kostet?',
    kort: ['den-samtale-jeg-skylder', 'det-jeg-undgaar'],
    paper: { t: 'Den tavse direktion', u: '/den-tavse-direktion.html', s: 'C-Level Serien' },
  },
  {
    uge: '2026-W50',
    titel: 'Årets sidste bestyrelsesmøde',
    tekst: 'Årets sidste bestyrelsesmøde er en fortolkning af året, struktureret af dine valg: hvad der vises, i hvilken rækkefølge og med hvilken vægt. Valgene er sjældent bevidste. De er altid konsekvente. Det, der går godt, kommer først. Det tal, du nødigst vil forsvare, kommer sidst eller slet ikke. Formanden har læst materialet. Spørgsmålet, du håber ikke kommer, kommer.',
    spoergsmaal: 'Hvad i årets oplæg til bestyrelsen er pakket ind, og hvilket spørgsmål har du ikke et svar på?',
    kort: ['generalproeven', 'problemet-i-en-saetning'],
    paper: { t: 'Bestyrelseskommunikation som disciplin', u: '/bestyrelseskommunikation-som-disciplin.html', s: 'C-Level Serien' },
  },
  {
    uge: '2026-W51',
    titel: 'Kalenderen for januar er allerede bevis',
    tekst: 'Januar er booket, før året er slut. Se på den. Det, der ikke har en tid, er ikke prioriteret, uanset hvad du har sagt på strategiseminaret. Den fuldt bookede kalender er ikke effektivitet. Den er en flaskehals under opbygning, og flaskehalsen er dig. Hvor mange timer i januar har du valgt selv, og hvor mange har andre lagt ind?',
    spoergsmaal: 'Hvad i januar har en tid i din kalender, som ikke burde have det, og hvad har ingen tid, som burde?',
    kort: ['kalenderen-som-bevis', 'aftaler-med-mig-selv'],
    paper: { t: 'Din kalender har en ejer', u: '/struktur-saetter-fri-din-kalender-har-en-ejer.html', s: 'Struktur sætter fri' },
  },
  {
    uge: '2026-W52',
    titel: 'Mellem jul og nytår: det, der gentog sig',
    tekst: 'Ugen mellem jul og nytår er den eneste uge, hvor kalenderen ikke bestemmer. Brug den på det, der gentog sig i år. Ikke det, du sagde om dig selv i ro, men det, der skete under pres, igen og igen. Selvindsigt er en disciplin, ikke en følelse. Indsigt uden adfærdsændring er underholdning. Mønstret på tværs af situationer er den faktiske profil. Det er den, der går med ind i det nye år.',
    spoergsmaal: 'Hvad gentog sig i år under pres, og er det karakter, struktur eller en forklaring?',
    kort: ['det-der-gentager-sig', 'styrken-under-pres'],
    paper: { t: 'Selvbedrag i toppen', u: '/selvbedrag-i-toppen.html', s: 'C-Level Serien' },
  },
  {
    uge: '2027-W01',
    titel: 'De næste 90 dage begynder mandag',
    tekst: 'Nytårsforsætter er intentioner uden struktur. De falder i uge tre. Det, der holder, er én adfærd med en dag, en tid og et menneske, der kan se den. Organisationen kopierer ikke dine ord. Den kopierer din tilstand. Så spørgsmålet til januar er ikke, hvad du vil. Det er, hvad andre kan se i april, som de ikke kunne se i december.',
    spoergsmaal: 'Hvad kan dine nærmeste se om 90 dage, som de ikke kan se i dag? Én adfærd, én sætning.',
    kort: ['de-naeste-90-dage', 'aftaler-med-mig-selv', 'beslutningen-jeg-har-udskudt'],
    paper: { t: 'Tiden viser, hvilket job du faktisk har', u: '/executive-coaching-2027-tiden-viser-hvilket-job-du-faktisk-har.html', s: 'Executive Coaching 2027' },
  },
];

// ISO-uge for en dato, som 'YYYY-Www'.
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Ugens perspektiv: præcis uge, ellers den seneste før. Ingen før den første: null.
export function perspektivFor(uge) {
  const sorted = [...PERSPEKTIVER].sort((a, b) => (a.uge < b.uge ? -1 : 1));
  let hit = null;
  for (const p of sorted) { if (p.uge <= uge) hit = p; else break; }
  return hit;
}
