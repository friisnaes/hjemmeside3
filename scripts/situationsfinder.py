#!/usr/bin/env python3
"""Bygger situationsfinder-index.json: passager fra alle papers, som library linker til.
Kommende papers (release-schedule.json) udelades. Køres af den ugentlige Action."""
import json, os, re, sys
from datetime import datetime
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
today = os.environ.get('RELEASE_DATE') or datetime.now(ZoneInfo('Europe/Copenhagen')).date().isoformat()
sched = {k: v for k, v in json.load(open(os.path.join(ROOT, 'release-schedule.json'), encoding='utf-8')).items() if not k.startswith('_')}
future = {f for f, d in sched.items() if d > today}
SKIP = {'testimonials.html', 'blog.html', 'library.html', 'vaerktoejer.html', 'soeg.html', 'boeger.html', 'executive-sustainability-map.html',
        'eksekveringsserien.html', 'c-level-serien.html', 'executive-longevity.html', 'holdet-bag-strategien.html', 'struktur-saetter-fri.html',
        'strategien-sker-mellem-kvartalerne-serie.html', 'executive-coaching-2027.html'}
lib = BeautifulSoup(open(os.path.join(ROOT, 'library.html'), encoding='utf-8').read(), 'html.parser')
series = {}
cards = []
for card in lib.select('article.series-card'):
    t = card.select_one('.sc-title')
    cards.append((card, re.sub(r'\s+', ' ', t.get_text('')).strip() if t else ''))
for sel in ('.sc-papers a', '.sc-actions a', 'a'):  # egen liste først, krydslinks sidst
    for card, name in cards:
        for a in card.select(sel):
            u = (a.get('href') or a.get('data-e27-href') or '').lstrip('/')
            if u.endswith('.html'): series.setdefault(u, name)
order = []
for a in lib.select('a'):
    u = (a.get('href') or a.get('data-e27-href') or '').lstrip('/')
    if u.endswith('.html') and u not in order: order.append(u)
papers = [u for u in order if u not in SKIP and u not in future and os.path.exists(os.path.join(ROOT, u))]

def clean(t): return re.sub(r'\s+', ' ', t).strip()
DROP = '.wp-toc, nav, footer, .sources-block, .refl-sheet, .collection, .read-also, .fn-more, .next-grid, .cta-box, .sheet-card, .commit-box, script, style, .print-only, .pdf-cta, .site-nav, .vz, svg'
out = []
for u in papers:
    soup = BeautifulSoup(open(os.path.join(ROOT, u), encoding='utf-8').read(), 'html.parser')
    h1 = soup.find('h1'); title = clean(h1.get_text(' ')) if h1 else u
    body = soup.find('article') or soup.find('main') or soup.body
    for el in body.select(DROP): el.decompose()
    for d in body.select('details'):
        q = d.find('summary'); ans = clean(d.get_text(' ').replace(q.get_text(' ') if q else '', '', 1))
        anc = d.find_parent(id=True)
        if q and ans: out.append({'u': u, 'a': anc['id'] if anc else '', 't': title, 's': series.get(u, ''), 'h': clean(q.get_text(' ')).rstrip('+ ').strip(), 'x': ans[:700]})
        d.decompose()
    for h in body.find_all(['h2', 'h3']):
        head = clean(h.get_text(' '))
        hl = head.lower()
        if not head or hl in ('faq', 'ofte stillede spørgsmål', 'kilder') or re.search(r'vil du arbejde videre|commit|book |næste paper|næste skridt|læs også|om forfatteren|refleksionsark|kilder og|download|hent |del paperet|start en samtale|tag det videre', hl): continue
        parts = []
        for sib in h.find_next_siblings():
            if sib.name in ('h2', 'h3') or sib.find(['h2', 'h3']): break
            txt = clean(sib.get_text(' '))
            if txt: parts.append(txt)
            if sum(len(p) for p in parts) > 900: break
        text = ' '.join(parts)
        if len(text) < 80: continue
        anc = h if h.get('id') else h.find_parent(id=True)
        out.append({'u': u, 'a': anc['id'] if anc else '', 't': title, 's': series.get(u, ''), 'h': head, 'x': text[:900]})
json.dump({'generated': today, 'passages': out}, open(os.path.join(ROOT, 'situationsfinder-index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'Situationsfinder: {len(papers)} papers, {len(out)} passager')
