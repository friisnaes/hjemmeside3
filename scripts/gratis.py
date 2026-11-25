#!/usr/bin/env python3
"""Sætter gratis-rammen (assets/gratis.css + assets/gratis.js) ind i gratisværktøjerne under vaerktoejer/.
Idempotent: kør den igen, og den skifter kun det, der allerede står der. Kør fra repoets rod:
    python3 scripts/gratis.py          # skriver
    python3 scripts/gratis.py --dry    # viser kun, hvad der ville ske
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DRY = '--dry' in sys.argv

# slug -> (lag, visningsnavn). Lag 1 = Diagnose, lag 2 = Forståelse (jf. værktøjskassen).
TOOLS = {
    'personal-excellence-diagnostic': ('Diagnose', 'Personal Excellence Diagnostic'),
    'blinde-vinkler':                 ('Diagnose', 'Blinde vinkler'),
    'impostor-syndrom':               ('Diagnose', 'Impostor-syndrom'),
    'selvtillid':                     ('Diagnose', 'Selvtillid'),
    'selvvaerd':                      ('Diagnose', 'Selvværd'),
    'arbejdsglaeden':                 ('Diagnose', 'Arbejdsglæden'),
    'purpose':                        ('Diagnose', 'Purpose'),
    'jeg-er-blevet-leder':            ('Forståelse', 'Jeg er blevet leder'),
    'jeg-er-blevet-leders-leder':     ('Forståelse', 'Leders leder'),
    'saadan-leder-du-din-leder':      ('Forståelse', 'Sådan leder du din leder'),
    'selvledelse':                    ('Forståelse', 'Selvledelse'),
    'hvad-er-kultur':                 ('Forståelse', 'Hvad er kultur'),
    'coaching101':                    ('Forståelse', 'Coaching 101'),
    'coaching201':                    ('Forståelse', 'Coaching 201'),
    'commercial-excellence':          ('Forståelse', 'Commercial Excellence'),
    'kvaliteten-i-ledelsesdialoger':  ('Forståelse', 'Kvaliteten i ledelsesdialoger'),
    'den-gode-mus-leder':             ('Forståelse', 'Den gode MUS som leder'),
    'den-gode-mus-medarbejder':       ('Forståelse', 'Den gode MUS som medarbejder'),
    'den-gode-1-on-1':                ('Forståelse', 'Den gode 1:1'),
    'den-svaere-samtale':             ('Forståelse', 'Den svære samtale'),
    'strategi-for-dig-selv':          ('Forståelse', 'Strategi for dig selv'),
    'not-to-do':                      ('Forståelse', 'Not-to-do'),
}

LINK_RE = re.compile(r'\s*<link rel="stylesheet" href="/assets/gratis\.css"[^>]*>')
SCRIPT_RE = re.compile(r'\s*<script src="/assets/gratis\.js"[^>]*></script>')

def process(slug, lag, navn):
    p = ROOT / 'vaerktoejer' / slug / 'index.html'
    if not p.exists():
        print('  mangler:', slug); return False
    html = p.read_text(encoding='utf-8')
    new = LINK_RE.sub('', html)
    new = SCRIPT_RE.sub('', new)
    link = '\n<link rel="stylesheet" href="/assets/gratis.css">'
    script = '\n<script src="/assets/gratis.js" data-lag="%s" data-navn="%s"></script>' % (lag, navn.replace('"', '&quot;'))
    if '</head>' not in new or '</body>' not in new:
        print('  springer over (ingen head/body):', slug); return False
    new = new.replace('</head>', link + '\n</head>', 1)
    # Sidste </body>: nogle værktøjer har et </body> inde i en JavaScript-streng (printskabelon).
    head, sep, tail = new.rpartition('</body>')
    new = head + script + '\n' + sep + tail
    changed = new != html
    if changed and not DRY:
        p.write_text(new, encoding='utf-8')
    print('  %s %s · %s' % ('ændret ' if changed else 'uændret', slug, lag))
    return changed

def main():
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    n = 0
    for slug, (lag, navn) in TOOLS.items():
        if only and slug not in only: continue
        n += bool(process(slug, lag, navn))
    print('%d filer ændret%s' % (n, ' · TØRKØRSEL' if DRY else ''))

if __name__ == '__main__':
    main()
