# Executive Library — Deployment & menu-opdatering

Kort, konkret guide til at få biblioteket live på friisnaes.com (GitHub Pages, repo: hjemmeside3).

---

## 1 · Nye filer der skal lægges op (i repo-roden)

Læg disse i roden ved siden af dine øvrige .html-filer:

**Biblioteket**
- `library.html`  ← den nye Executive Library-forside

**C-Level Serien (opdateret)**
- `c-level-serien.html`  ← oversigt (VIGTIGT: dette navn, ikke `c-level-serien_15_07_25.html`)
- `selvbedrag-i-toppen.html`  ← nu med PDF-knapper
- `karakter-under-pres.html`  ← nu med PDF-knapper

**Eksekveringsserien (allerede leveret, med PDF + krydsreferencer)**
- `eksekveringsserien.html` (oversigt — nu opdateret til at linke til biblioteket)
- `eksekveringsgabet.html`, `prioriteringsparalysen.html`, `den-bookede-kalender.html`,
  `kontekstskiftet.html`, `moedekulturen.html`, `beslutning-under-afbrydelse.html`,
  `forandringstraetheden.html`, `de-udskudte-samtaler.html`, `personligt-lederskab.html`,
  `ensomheden-i-toppen.html`

> Bemærk: De øvrige 8 C-Level papers (disciplin-er-ikke-vilkaarsstyrke, klarhed-som-konkurrencefordel,
> fra-manager-til-leder, modspillet-der-mangler, den-tavse-direktion, den-usynlige-ceo,
> bestyrelseskommunikation-som-disciplin, succession-som-strategi) linkes allerede fra biblioteket
> og C-Level-oversigten. Hvis de findes på sitet, virker linksene med det samme. Vil du have PDF-knapper
> på dem også, kan jeg tilføje det — send dem, eller sig til.

---

## 2 · Menu-opdatering på de eksisterende sider

Tilføj ét menupunkt — **Executive Library** — mellem "Indsigter" og "Bøger" i hovedmenuen.
Det skal gøres på hver af disse hånd-vedligeholdte sider:

- `index.html`
- `blog.html`
- `boeger.html`
- `testimonials.html`
- (og evt. øvrige undersider med samme menu: adhd-1..8, punktlighed, 17cm, partnerskab, lortekaldet, alkohol, karakter, seg, m.fl.)

### Find denne linje i menuen:
```html
<a href="/blog.html">Indsigter</a>
```

### Tilføj DENNE linje LIGE EFTER:
```html
<a href="/library.html">Executive Library</a>
```

Så menuen bliver:
```
Situationer · Format · Om · Klienter · Indsigter · Executive Library · Bøger · Book en samtale
```

> Din menu-markup kan variere lidt fra side til side (nogle bruger `href="https://www.friisnaes.com/blog.html"`).
> Uanset format: find "Indsigter"-linket og indsæt "Executive Library"-linket umiddelbart efter, i samme format.

---

## 3 · Navigation — sådan hænger det sammen

```
Hovedmenu (alle sider)
   └── Executive Library  (library.html)
         ├── Eksekveringsserien  (eksekveringsserien.html)
         │      └── 10 papers  ── hver linker "Se alle ti papers →" tilbage til oversigten
         └── C-Level Serien  (c-level-serien.html)
                └── 10 papers  ── hver linker "Se hele serien →" tilbage til oversigten
```

Begge serie-oversigter linker i footeren tilbage til **Executive Library**.
Hvert paper kan downloades som PDF (fuldt design + printvenlig) via knapperne i bunden.

---

## 4 · Test efter upload

- [ ] `friisnaes.com/library.html` viser begge serie-kort
- [ ] "Åbn serien" på begge kort virker
- [ ] "Se alle 10 papers" folder listen ud og linksene virker
- [ ] Menupunktet "Executive Library" er synligt på index/blog/boeger/testimonials
- [ ] PDF-knapperne i bunden af hvert paper åbner udskriv-dialogen
- [ ] C-Level-oversigten ligger på `c-level-serien.html` (ikke det gamle datonavn)
