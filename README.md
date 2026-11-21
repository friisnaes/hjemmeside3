# friisnaes.com

Statisk site på GitHub Pages. Alle sider er almindelige HTML-filer i roden; der er ingen byggeproces,
der skal køres for at se en side – men **menu og sidefod er fælles** og skrives ind automatisk.

## Sådan hænger det sammen

| Hvad | Hvor |
|---|---|
| Hovedmenu (ét sted) | `partials/nav.html` |
| Sidefod med vilkår og CVR (ét sted) | `partials/footer.html` |
| Stil for menu og sidefod | `assets/site.css` |
| Script der skriver menu/sidefod ind på alle sider | `scripts/normalize.py` |
| Skabelon til en ny side | `scripts/skabelon-side.html` |
| Udgivelsesplan (sider, der først må findes i søgning/sitemap fra en dato) | `release-schedule.json` |
| Ugentlig udgivelse (mandag nat) | `.github/workflows/ugentlig-udgivelse.yml` |
| Engelsk forside og hreflang-par (dansk ↔ engelsk) | `scripts/engelsk.py` |

Den ugentlige Action gør tre ting: kører `normalize.py`, bygger søgeindekset (Pagefind) og
situationsfinderen, og bygger `sitemap.xml` forfra ud fra de sider, der faktisk må indekseres (minus kommende sider i udgivelsesplanen). Den kan også startes manuelt
under *Actions → Ugentlig udgivelse → Run workflow*.

## Engelsk

Sitet har rigtige engelske sider under `en/`, som søgemaskiner kan indeksere (sprogskiftet `?lang=en`
med JavaScript tæller ikke for Google):

| Dansk | Engelsk | Hvordan |
|---|---|---|
| `/` | `/en/executive-coach.html` | **Genereres** af `scripts/engelsk.py` ud fra `index.html` – ret `data-en`-attributterne i `index.html`, ikke den engelske fil |
| `boeger.html` | `en/books.html` | Skrevet i hånden |
| `om.html` | `en/about.html` | Skrevet i hånden |
| bogsiderne | `en/`, `en/lead-on-character/`, `en/the-most-important-thing-muscle-test.html` | Skrevet i hånden |

`scripts/engelsk.py` sætter desuden `hreflang` (da / en / x-default) i `<head>` på begge sider i hvert par
(listen `PAR` i scriptet), og `scripts/release.py` tager parrene med i `sitemap.xml` som `xhtml:link`.
Får en side en engelsk udgave: skriv parret ind i `PAR`, kør `python3 scripts/engelsk.py`. På `index.html`,
`boeger.html` og `om.html` er EN-knappen i menuen et link til den engelske side (`EN_TWIN` i `normalize.py`).

De engelske bøger sælges på Amazon.com. Produktsiderne (ASIN) står i bogsiderne og i `boeger.html`:
Kindle `B0HS721NQN` / paperback `878564708X` (The Most Important Thing …) og Kindle `B0HSF42QG6` /
paperback `8785647098` (You Hire on the Résumé …).

## Ny side

1. Kopiér `scripts/skabelon-side.html` til roden med et nyt filnavn (små bogstaver, bindestreger, aa/ae/oe).
2. Skriv indholdet. Lad `<nav class="fn-nav">` og `<footer class="fn-legal">` stå tomme – de fyldes.
3. Læg filen op. Menu og sidefod kommer på ved næste ugentlige kørsel, eller med det samme hvis du kører
   `python3 scripts/normalize.py` lokalt først.
4. Sitemappet passer sig selv: Hver mandag tages alle indekserbare sider i roden med (ingen noindex, egen kanonisk adresse), og kommende sider fra `release-schedule.json` holdes ude – fra søgning og sitemap – indtil deres dato. Skal en side først være synlig fra en bestemt dato, så tilføj den i `release-schedule.json`; skal den holdes ude af sitemappet uden noindex, så skriv den under `_ikke_i_sitemap`.
5. Lanceringssider (en ny bog, en ny serie): bed om indeksering i Search Console samme dag, de er oppe – det er det eneste manuelle skridt tilbage.

Sider lavet i en anden Claude-tråd kan uploades, som de er: har de en gammel menu, bliver den også
skiftet ud. Kun sider helt uden hovedmenu (værktøjer, redirect-stubbe, præsentationer, `sandbox/`)
rører scriptet ikke.

## Ændre menuen eller sidefoden

Ret `partials/nav.html` eller `partials/footer.html`, kør `python3 scripts/normalize.py`, og læg det
hele op. Ændringen slår igennem på alle sider på én gang. Udseendet rettes i `assets/site.css`.

## Lokalt

```bash
python3 scripts/normalize.py --dry-run   # vis hvad der ville ske
python3 scripts/normalize.py             # gør det
python3 scripts/engelsk.py               # engelsk forside + hreflang
python3 scripts/release.py --kun-sitemap # kun sitemap.xml (uden søgeindeks)
python3 -m http.server 8000              # se sitet på http://localhost:8000
```

`normalize.py` kan køres igen og igen uden at ændre noget, der allerede er på plads.
