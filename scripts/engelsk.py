#!/usr/bin/env python3
"""Engelske sider og hreflang på friisnaes.com.

Gør to ting, og kan køres igen og igen (idempotent):

  1. Bygger /en/executive-coach.html ud fra index.html: teksten i data-en-attributterne
     skrives ind som sidens indhold (det, EN-knappen før gjorde med JavaScript), hoved,
     canonical og links rettes til, og siden får engelsk sprogkode. Den engelske forside
     kan dermed indekseres som en rigtig side.
  2. Sætter hreflang-par (da / en / x-default) i <head> på alle sider, der findes på begge
     sprog – se PAR nedenfor. Begge sider i et par peger på hinanden og på sig selv.

Køres af den ugentlige Action efter normalize.py, eller lokalt: python3 scripts/engelsk.py
"""
import html as H, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BASE = 'https://www.friisnaes.com'
DRY = '--dry-run' in sys.argv

# Dansk side -> engelsk side (stier fra roden). x-default peger på den danske.
PAR = {
    'index.html':                                     'en/executive-coach.html',
    'boeger.html':                                    'en/books.html',
    'om.html':                                        'en/about.html',
    'det-vigtigste-du-ikke-kan-koebe-til-dit-barn.html': 'en/index.html',
    'du-ansaetter-paa-cv-men-du-leder-paa-karakter.html': 'en/lead-on-character/index.html',
    'det-vigtigste-muskeltesten.html':                'en/the-most-important-thing-muscle-test.html',
}

def url_for(rel):
    rel = rel[:-len('index.html')] if rel.endswith('index.html') else rel
    return BASE + '/' + rel

# Links i den genererede engelske side, der skal pege på den engelske udgave
LINKS_EN = {('/' + ('' if da == 'index.html' else da)): '/' + (en[:-len('index.html')] if en.endswith('index.html') else en)
            for da, en in PAR.items()}

# ── 1) Den engelske forside ───────────────────────────────────────────────────────────────
FORSIDE = {
    'kilde': 'index.html',
    'ud': 'en/executive-coach.html',
    'title': 'Executive Coach Thomas Friisnæs – Confidential Sparring for CEOs and C-level Leaders',
    'description': "When the responsibility is yours, you need a place to think out loud. Executive coaching and confidential sparring for CEOs, owner-managers and executive teams – since 2003. Denmark and international, in English.",
    'og_title': 'Executive Coach Thomas Friisnæs | Sparring for C-level leaders',
    'twitter_description': 'Clarity and execution with an experienced executive coach. 22+ years with CEOs and owner-managers. Book a 20-minute conversation.',
    # Dansk tekst, der ikke har en data-en-attribut på forsiden (kun hele strenge, kun i <body>)
    'ekstra': [
        ('Det siger mine klienter', 'What my clients say'),
        ('Din browser understøtter ikke videoafspilning.', 'Your browser does not support video playback.'),
        ('Læs mere om formatet', 'Read more about the format'),
        ('Executive coaching i København og Holte', 'Executive coaching in Copenhagen and Holte, Denmark'),
        ("Sparringspartner for CEO's og ejerledere", 'Sparring partner for CEOs and owner-managers'),
        ('Også for ledergrupper', 'Also for leadership teams'),
        ('Team Retainer for ledelsesteams – 12 måneder, bygget omkring execution kadence og strategisk governance.',
         'Team Retainer for leadership teams – 12 months, built around execution cadence and strategic governance.'),
        ('Læs mere om SEG', 'Read more about SEG'),
        ('Aftal en 20-minutters samtale', 'Arrange a 20-minute conversation'),
        ('20 minutter. Ét problem. Én plan.', '20 minutes. One problem. One plan.'),
        ('Se min LinkedIn-profil', 'See my LinkedIn profile'),
        ('Se alle bøger og bestil →', 'See all books →'),
        ('>Poesi<', '>Poetry<'),
        ('>Kontor<', '>Office<'),
        ('>Telefon<', '>Phone<'),
        ('>Privatliv<', '>Privacy<'),
        ('>9 mdr<', '>9 mo.<'),
        ('Det vigtigste, du ikke kan købe til dit barn', "The Most Important Thing You Can't Buy Your Child"),
        ('Du ansætter på CV – men du leder på karakter', 'You Hire on the Résumé, but You Lead on Character'),
        ('Δ+ · Σ= (Digte101 – trilogi)', 'Δ+ · Σ= (Digte101 – poetry, in Danish)'),
        ('placeholder="Dit navn"', 'placeholder="Your name"'),
        ('placeholder="din@email.dk"', 'placeholder="you@company.com"'),
        ('value="Ny henvendelse fra friisnaes.com v3"', 'value="New enquiry from friisnaes.com/en"'),
        ('aria-label="Friisnæs – forside"', 'aria-label="Friisnæs – home"'),
        ('aria-label="Hovednavigation"', 'aria-label="Main navigation"'),
        ('aria-label="Sidefod"', 'aria-label="Footer"'),
        ('aria-label="Sprog"', 'aria-label="Language"'),
        ('aria-label="Nøgletal"', 'aria-label="Key figures"'),
        ('alt="Thomas Friisnæs – Executive Coach, Holte og København"', 'alt="Thomas Friisnæs – Executive Coach, Holte and Copenhagen"'),
        ('alt="Thomas Friisnæs – Executive Coach og strategisk sparringspartner, Holte"', 'alt="Thomas Friisnæs – Executive Coach and strategic sparring partner, Holte"'),
        ('aria-label="Thomas Friisnæs – 76 sekunder om executive coaching, CEO-sparring og de første 20 minutter"',
         'aria-label="Thomas Friisnæs – 76 seconds on executive coaching, CEO sparring and the first 20 minutes"'),
        ('aria-label="Afspil filmen (1 minut og 16 sekunder, dansk tale)"', 'aria-label="Play the film (1 minute 16 seconds, Danish with subtitles)"'),
        ('aria-label="Se Thomas Friisnæs på LinkedIn"', 'aria-label="See Thomas Friisnæs on LinkedIn"'),
        ('aria-label="Send email til info@friisnaes.com"', 'aria-label="Send an email to info@friisnaes.com"'),
        ('aria-label="Ring til Thomas Friisnæs"', 'aria-label="Call Thomas Friisnæs"'),
        ('aria-label="Thomas Friisnæs på LinkedIn"', 'aria-label="Thomas Friisnæs on LinkedIn"'),
        ('aria-label="Thomas Friisnæs på Instagram"', 'aria-label="Thomas Friisnæs on Instagram"'),
        ('aria-label="Thomas Friisnæs på Facebook"', 'aria-label="Thomas Friisnæs on Facebook"'),
        ('placeholder="Skriv gerne kort – et par linjer er nok."', 'placeholder="Keep it short – a few lines are enough."'),
        ('CVR-nr. 26569346', 'CVR no. 26569346'),
    ],
}

VOID = {'input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'track', 'wbr', 'area', 'base', 'col', 'embed', 'param'}
ATTRS = r'(?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s"\'>]+))?)*\s*/?'
TAG = re.compile(r'<(/?)([a-zA-Z][\w-]*)' + ATTRS + '>', re.S)
OPEN = re.compile(r'<([a-zA-Z][\w-]*)' + ATTRS + '>', re.S)

def match_close(s, start, tag):
    """Position af det afsluttende </tag>, der hører til åbningstagget, der slutter ved start."""
    depth, i = 1, start
    while depth:
        m = TAG.search(s, i)
        if not m:
            return None
        i = m.end()
        if m.group(2).lower() != tag:
            continue
        if m.group(1):
            depth -= 1
        elif not m.group(0).endswith('/>'):
            depth += 1
    return m.start(), m.end()

def apply_data_en(s):
    """Samme som setLang('en'): indholdet af hvert element med data-da/data-en bliver data-en."""
    out, pos, n = [], 0, 0
    while True:
        m = OPEN.search(s, pos)
        if not m:
            out.append(s[pos:]); break
        tag = m.group(1).lower()
        en = re.search(r'\sdata-en="([^"]*)"', m.group(0), re.S)
        if tag in VOID or m.group(0).endswith('/>') or not en or not re.search(r'\sdata-da="', m.group(0)):
            out.append(s[pos:m.end()]); pos = m.end(); continue
        en = en.group(1)
        close = match_close(s, m.end(), tag)
        if not close:
            out.append(s[pos:m.end()]); pos = m.end(); continue
        out.append(s[pos:m.end()]); out.append(H.unescape(en)); out.append(s[close[0]:close[1]])
        pos = close[1]; n += 1
    return ''.join(out), n

def absolutize(s):
    """Relative stier (hero-680.webp) virker ikke under /en/ – gør dem rod-absolutte."""
    def fix(v):
        v = v.strip()
        if not v or v[0] in '/#?' or re.match(r'^(https?:|mailto:|tel:|data:|javascript:)', v):
            return v
        return '/' + v
    def attr(m):
        return '%s="%s"' % (m.group(1), fix(m.group(2)))
    s = re.sub(r'\b(src|href|poster|action)="([^"]*)"', attr, s)
    def srcset(m):
        parts = [p.strip().split(None, 1) for p in m.group(2).split(',')]
        return '%s="%s"' % (m.group(1), ', '.join(' '.join([fix(p[0])] + p[1:]) for p in parts if p))
    s = re.sub(r'\b(srcset|imagesrcset)="([^"]*)"', srcset, s)
    s = re.sub(r"url\((['\"]?)(?!/|https?:|data:)([^)'\"]+)\1\)", lambda m: 'url(%s/%s%s)' % (m.group(1), m.group(2), m.group(1)), s)
    return s

def head_replace(s, pat, repl, must=True):
    new, n = re.subn(pat, repl, s, count=1, flags=re.S)
    if must and not n:
        print('  ADVARSEL: fandt ikke', pat[:60])
    return new

def build_forside(cfg):
    src = os.path.join(ROOT, cfg['kilde']); dst = os.path.join(ROOT, cfg['ud'])
    s = open(src, encoding='utf-8').read()
    head_end = s.find('</head>')
    head, body = s[:head_end], s[head_end:]
    en_url = url_for(cfg['ud']); da_url = url_for(cfg['kilde'])

    head = head.replace('<html lang="da">', '<html lang="en">', 1)
    head = head_replace(head, r'<title>.*?</title>', '<title>%s</title>' % cfg['title'])
    head = head_replace(head, r'(<meta name="description" content=")[^"]*(")', r'\g<1>%s\2' % cfg['description'])
    head = head_replace(head, r'(<link rel="canonical" href=")[^"]*(")', r'\g<1>%s\2' % en_url)
    head = head_replace(head, r'(<meta property="og:url" content=")[^"]*(")', r'\g<1>%s\2' % en_url)
    head = head_replace(head, r'(<meta property="og:title" content=")[^"]*(")', r'\g<1>%s\2' % cfg['og_title'])
    head = head_replace(head, r'(<meta property="og:description" content=")[^"]*(")', r'\g<1>%s\2' % cfg['description'])
    head = head_replace(head, r'(<meta property="og:locale" content=")[^"]*(")', r'\g<1>en_US\2')
    head = head_replace(head, r'(<meta name="twitter:title" content=")[^"]*(")', r'\g<1>%s\2' % cfg['og_title'])
    head = head_replace(head, r'(<meta name="twitter:description" content=")[^"]*(")', r'\g<1>%s\2' % cfg['twitter_description'])
    head = head.replace('"inLanguage":"da"', '"inLanguage":"en"')
    # Den engelske forside er en side under sitet – ikke sitet selv
    head = head.replace('{"@type":"WebSite","@id":"https://www.friisnaes.com/#website","url":"https://www.friisnaes.com/","name":"Friisnæs","description":"Executive Coach for C-level ledere"',
                        '{"@type":"WebSite","@id":"https://www.friisnaes.com/#website","url":"https://www.friisnaes.com/","name":"Friisnæs","description":"Executive coach for C-level leaders"')
    head = re.sub(r'<!-- hreflang -->.*?<!-- /hreflang -->\n?', '', head, flags=re.S)
    head = head.replace('<!-- engelsk-note -->', '')
    note = ('<!-- Genereret af scripts/engelsk.py ud fra %s – ret kildesiden (data-en-attributterne), ikke denne fil -->\n' % cfg['kilde'])
    head = head.replace('<head>', '<head>\n' + note, 1)

    body = body.replace('<html lang="da">', '<html lang="en">')
    body, n = apply_data_en(body)
    body = absolutize(body)
    for a, b in cfg['ekstra']:
        body = body.replace(a, b)
    # Links til sider, der findes på engelsk
    for da, en in sorted(LINKS_EN.items(), key=lambda kv: -len(kv[0])):
        body = re.sub(r'href="%s(#[^"]*)?"' % re.escape(da), lambda m: 'href="%s%s"' % (en, m.group(1) or ''), body)
    # Sprogvalget: links i stedet for knapper, så DA fører til den danske side
    body = re.sub(r'<span class="fn-ls ls"[^>]*>.*?</button>\s*</span>',
                  '<span class="fn-ls ls" aria-label="Language"><a href="%s" hreflang="da" lang="da" aria-label="DA – skift til dansk">DA</a><span aria-hidden="true">/</span><a href="%s" class="on" hreflang="en" aria-current="page" aria-label="EN – English">EN</a></span>'
                  % ('/', '/' + cfg['ud']), body, count=1, flags=re.S)
    s = head + body
    s = s.replace('<html lang="da">', '<html lang="en">', 1)
    s = s.replace('href="hero-680.webp" imagesrcset="hero-680.webp 680w, hero-1020.webp 1020w"', 'href="/hero-680.webp" imagesrcset="/hero-680.webp 680w, /hero-1020.webp 1020w"')
    s = set_hreflang(s, da_url, en_url)
    old = open(dst, encoding='utf-8').read() if os.path.exists(dst) else None
    if s != old and not DRY:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, 'w', encoding='utf-8').write(s)
    print('%s %s: %d tekster oversat%s' % ('ville skrive' if DRY else ('skrevet' if s != old else 'uændret'), cfg['ud'], n, ''))

# ── 2) hreflang ───────────────────────────────────────────────────────────────────────────
def set_hreflang(s, da_url, en_url):
    block = ('<!-- hreflang --><link rel="alternate" hreflang="da" href="%s">'
             '<link rel="alternate" hreflang="en" href="%s">'
             '<link rel="alternate" hreflang="x-default" href="%s"><!-- /hreflang -->' % (da_url, en_url, da_url))
    s = re.sub(r'\s*<!-- hreflang -->.*?<!-- /hreflang -->', '', s, flags=re.S)
    m = re.search(r'<link rel="canonical" href="[^"]*">', s)
    if not m:
        print('  ADVARSEL: ingen canonical – hreflang ikke sat'); return s
    return s[:m.end()] + '\n' + block + s[m.end():]

def hreflang_all():
    for da, en in PAR.items():
        for rel in (da, en):
            p = os.path.join(ROOT, rel)
            if not os.path.exists(p):
                print('  mangler:', rel); continue
            s = open(p, encoding='utf-8').read()
            new = set_hreflang(s, url_for(da), url_for(en))
            if new != s:
                if not DRY:
                    open(p, 'w', encoding='utf-8').write(new)
                print('hreflang sat:', rel)

if __name__ == '__main__':
    build_forside(FORSIDE)
    hreflang_all()
