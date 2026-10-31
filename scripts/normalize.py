#!/usr/bin/env python3
"""Normalisering af alle sider på friisnaes.com.

Gør det samme hver gang og kan køres igen og igen (idempotent):
  1. Erstatter sidens hovedmenu med den fælles menu fra partials/nav.html
  2. Fjerner den gamle, indlejrede menu-CSS og det gamle menu-script
  3. Indsætter den fælles sidefod (partials/footer.html) – fuld udgave hvor siden kun havde
     en generisk ©-footer, slank udgave under sider med egen indholds-footer
  4. Linker assets/site.css og samler Google Fonts-URL'en (Playfair Display + Outfit) til én
  5. Pakker base64-billeder i laeseproever/*.html ud som rigtige filer

Sider uden en genkendelig hovedmenu (interaktive værktøjer, redirect-stubbe, præsentationer,
sandbox) rører scriptet ikke. Kør med --dry-run for kun at se, hvad der ville ske.
"""
import base64, hashlib, os, re, sys
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DRY = '--dry-run' in sys.argv
YEAR = str(datetime.now().year)

SKIP_DIRS = {'.git', 'pagefind', 'sandbox', 'scripts', 'assets', 'partials', 'node_modules'}

def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

NAV_TPL = read(os.path.join(ROOT, 'partials', 'nav.html'))
NAV_LANG = read(os.path.join(ROOT, 'partials', 'nav-lang.html')).rstrip('\n')
FOOT_TPL = read(os.path.join(ROOT, 'partials', 'footer.html'))
# HTML-kommentaren øverst i partials er dokumentation og skal ikke med ud på siderne
strip_comment = lambda s: re.sub(r'^\s*<!--.*?-->\s*', '', s, count=1, flags=re.S)
NAV_TPL, FOOT_TPL = strip_comment(NAV_TPL), strip_comment(FOOT_TPL)

# Hovedmenu-varianter, der findes på sitet (ældste nederst). Alle erstattes af den fælles.
NAV_PATTERNS = [
    ('fn',    re.compile(r'<nav class="fn-nav[^"]*"[^>]*>.*?</nav>', re.S)),
    ('fixed', re.compile(r'<nav role="navigation" aria-label="Hovednavigation"[^>]*>.*?</nav>', re.S)),
    ('fixed', re.compile(r'<nav class="nav">.*?</nav>', re.S)),
    ('css',   re.compile(r'<nav class="site-nav"[^>]*aria-label="Hovednavigation"[^>]*>.*?</nav>', re.S)),
]
FN_NAV_CSS = re.compile(r'\s*<style id="fn-nav-css">.*?</style>', re.S)
# Gammelt menu-script: fra "tg=getElementById('nt')" til og med luk-ved-klik-blokken
LEGACY_JS = [
    # Variant med vagt: if(tg && mn){ ... } – hele blokken inkl. if'ens afsluttende } skal væk, ellers står en løs } tilbage
    re.compile(r"(?:var|const|let)\s+tg\s*=\s*document\.getElementById\('nt'\)[^;]*;\s*if\s*\(\s*tg\s*&&\s*mn\s*\)\s*\{.*?mn\.querySelectorAll\('a'\)\.forEach\(.*?\}\);\s*\}\);\s*\}[ \t]*\n?", re.S),
    re.compile(r"(?:var|const|let)\s+tg\s*=\s*document\.getElementById\('nt'\).*?mn\.querySelectorAll\('a'\)\.forEach\(.*?\}\);\s*\}\);[ \t]*\n?", re.S),
    re.compile(r"(?:var|const|let)\s+tg\s*=\s*document\.getElementById\('nt'\).*?tg\.addEventListener\('click'.*?\}\);[ \t]*\n?", re.S),
]
LEGACY_ESC = re.compile(r"document\.addEventListener\('keydown',\s*function\s*\(e\)\s*\{\s*if\s*\(e\.key\s*===\s*'Escape'\s*&&\s*mn\.classList\.contains\('open'\)\)\s*tg\.click\(\);\s*\}\);[ \t]*\n?", re.S)
# Sider hvis egen CSS lægger menuen fast over indholdet (position:fixed) – så skal den fælles menu også ligge fast
FIXED_CSS = re.compile(r'(?:^|[\s};,])(?:nav|nav\.site-nav|nav\.nav|\.nav|\.site-nav)\s*\{[^}]*position\s*:\s*fixed', re.S)
GENERIC_FOOTER = re.compile(r'<footer[^>]*role="contentinfo"[^>]*>.*?</footer>', re.S)
FN_LEGAL = re.compile(r'<footer class="fn-legal[^"]*"[^>]*>.*?</footer>', re.S)
FONTS = re.compile(r'https://fonts\.googleapis\.com/css2\?family=Playfair\+Display[^"]*family=Outfit[^"]*')
FONTS_CANON = ('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;'
               '1,400;1,500;1,600&family=Outfit:wght@200;300;400;500;600;700&display=swap')
CSS_LINK = '<link rel="stylesheet" href="/assets/site.css">'

HUBS = {
    'ydelser':   {'executive-coaching.html', 'ceo-sparring.html', 'seg.html', 'partnerskab.html'},
    'om':        {'om.html'},
    'klienter':  {'testimonials.html'},
    'boeger':    {'boeger.html', 'boghylde.html'},
    'indsigter': {'blog.html', 'library.html', 'briefs.html', 'soeg.html', 'vaerktoejer.html'},
}
INSIGHT_MARKERS = ('class="wp-body"', 'class="wp-toc"', 'series-label', 'class="colophon"', 'c-level-brief')

def active_for(rel, html):
    for key, files in HUBS.items():
        if rel in files:
            return key
    if rel.startswith('laeseproever/'):
        return 'boeger'
    if any(m in html for m in INSIGHT_MARKERS):
        return 'indsigter'
    return None

def render_nav(fixed, lang, active, rel=''):
    out = NAV_TPL.replace('{{fixed}}', ' fn-nav--fixed' if fixed else '')
    out = out.replace('{{lang}}', NAV_LANG if lang else '')
    for key in HUBS:
        out = out.replace('{{a:%s}}' % key, ' active' if active == key else '')
    if rel == 'index.html':
        # På forsiden skal ankre blive på siden (ellers genindlæses den og sprogvalget EN tabes)
        out = out.replace('href="/#', 'href="#').replace('href="/" class="fn-brand"', 'href="#top" class="fn-brand"')
    return out.replace(' class=""', '').rstrip('\n')

def render_footer(slim):
    return FOOT_TPL.replace('{{slim}}', ' fn-legal--slim' if slim else '').replace('{{year}}', YEAR).rstrip('\n')

def extract_images(rel, html):
    """base64-billeder -> laeseproever/img/<hash>.<ext>; samme billede i to filer bliver én fil."""
    img_dir = os.path.join(ROOT, 'laeseproever', 'img')
    n = 0
    def repl(m):
        nonlocal n
        ext = {'jpeg': 'jpg', 'jpg': 'jpg', 'png': 'png', 'webp': 'webp', 'gif': 'gif'}.get(m.group(1).lower())
        if not ext:
            return m.group(0)
        try:
            data = base64.b64decode(m.group(2), validate=False)
        except Exception:
            return m.group(0)
        name = hashlib.sha1(data).hexdigest()[:12] + '.' + ext
        path = os.path.join(img_dir, name)
        if not DRY and not os.path.exists(path):
            os.makedirs(img_dir, exist_ok=True)
            with open(path, 'wb') as f:
                f.write(data)
        n += 1
        return 'src="/laeseproever/img/%s"' % name
    html = re.sub(r'src="data:image/([a-z]+);base64,([A-Za-z0-9+/=\s]+)"', repl, html)
    return html, n

def process(path):
    rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
    html = orig = read(path)
    notes = []

    # 1) hovedmenu
    kind = None
    for k, pat in NAV_PATTERNS:
        m = pat.search(html)
        if m:
            kind = k
            break
    if not kind:
        return rel, None, ['ingen hovedmenu – ikke rørt']
    old_nav = m.group(0)
    # fn-nav: klassen fortæller det; index-stil/.nav: altid fast; site-nav: sidens egen CSS afgør det
    if kind == 'fn':
        fixed = 'fn-nav--fixed' in old_nav
    elif kind == 'fixed':
        fixed = True
    else:
        fixed = bool(FIXED_CSS.search(html[:m.start()] + html[m.end():]))
    lang = 'setLang' in html.replace(old_nav, '')
    nav = render_nav(fixed, lang, active_for(rel, html), rel)
    html = html[:m.start()] + nav + html[m.end():]
    notes.append('menu' + (' (fast)' if fixed else '') + (' +DA/EN' if lang else ''))

    # 2) gammel menu-CSS og -script
    html, c = FN_NAV_CSS.subn('', html)
    if c: notes.append('fjernet indlejret menu-CSS')
    for pat in LEGACY_JS:
        html, c = pat.subn('', html)
        if c:
            notes.append('fjernet gammelt menu-script')
            break
    html = LEGACY_ESC.sub('', html)
    if "getElementById('nt')" in html or re.search(r"\b(mn|tg)\.(classList|querySelectorAll|addEventListener)", html):
        notes.append('ADVARSEL: rester af gammelt menu-script')

    # 3) sidefod
    if FN_LEGAL.search(html):
        slim = 'fn-legal--slim' in FN_LEGAL.search(html).group(0)
        html = FN_LEGAL.sub(lambda _: render_footer(slim), html, count=1)
    elif GENERIC_FOOTER.search(html):
        html = GENERIC_FOOTER.sub(lambda _: render_footer(False), html, count=1)
        notes.append('generisk footer -> fælles sidefod')
    else:
        i = html.rfind('</body>')
        if i < 0:
            notes.append('ADVARSEL: ingen </body>')
        else:
            html = html[:i] + render_footer(True) + '\n' + html[i:]
            notes.append('slank sidefod tilføjet')

    # 4) fonts og fælles CSS
    html, c = FONTS.subn(FONTS_CANON, html)
    if c and FONTS_CANON not in orig: notes.append('fonts samlet')
    if CSS_LINK not in html:
        i = html.find('</head>')
        if i < 0:
            notes.append('ADVARSEL: ingen </head>')
        else:
            html = html[:i] + CSS_LINK + '\n' + html[i:]
            notes.append('site.css linket')

    # 5) læseprøver: billeder ud af HTML
    if rel.startswith('laeseproever/'):
        html, n = extract_images(rel, html)
        if n: notes.append('%d billeder pakket ud' % n)

    changed = html != orig
    if changed and not DRY:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
    return rel, changed, notes

def main():
    pages = []
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if fn.endswith('.html'):
                pages.append(os.path.join(dp, fn))
    changed = skipped = 0
    warnings = []
    for p in sorted(pages):
        rel, ch, notes = process(p)
        if ch is None:
            skipped += 1
            print('  -  %-70s %s' % (rel, '; '.join(notes)))
            continue
        if ch: changed += 1
        if any(n.startswith('ADVARSEL') for n in notes):
            warnings.append(rel)
        if ch or DRY:
            print('  %s %-70s %s' % ('*' if ch else ' ', rel, '; '.join(notes)))
    print('\n%d sider gennemgået · %d ændret · %d uden hovedmenu (ikke rørt)%s'
          % (len(pages), changed, skipped, ' · TØRKØRSEL' if DRY else ''))
    if warnings:
        print('Advarsler på: ' + ', '.join(warnings))
        sys.exit(2)

if __name__ == '__main__':
    main()
