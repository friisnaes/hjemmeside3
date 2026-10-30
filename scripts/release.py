#!/usr/bin/env python3
"""Ugentlig udgivelse: bygger søgeindekset (Pagefind) og opdaterer sitemap.xml
ud fra release-schedule.json. Filer med en fremtidig dato holdes ude af begge."""
import json, os, re, shutil, subprocess, sys, tempfile
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BASE = 'https://www.friisnaes.com/'
today = os.environ.get('RELEASE_DATE') or datetime.now(ZoneInfo('Europe/Copenhagen')).date().isoformat()

sched = {k: v for k, v in json.load(open(os.path.join(ROOT, 'release-schedule.json'), encoding='utf-8')).items() if not k.startswith('_')}
released = {f: d for f, d in sched.items() if d <= today}
future = {f for f, d in sched.items() if d > today}
print(f'Dato: {today} · udgivet: {len(released)} · kommende: {len(future)}')

# 1) Pagefind: kun sider i roden, uden kommende filer (samme valg som hidtil: sandbox/ m.fl. indekseres ikke)
stage = tempfile.mkdtemp()
for name in os.listdir(ROOT):
    if name.endswith('.html') and name not in future:
        shutil.copy2(os.path.join(ROOT, name), stage)
out = os.path.join(ROOT, 'pagefind')
shutil.rmtree(out, ignore_errors=True)  # rydder også gamle, ubrugte fragmenter
r = subprocess.run(['npx', '-y', 'pagefind@1.5.2', '--site', stage, '--glob', '*.html', '--output-path', out, '--force-language', 'da', '--exclude-selectors', 'nav,.site-nav,footer,.site-footer,.wp-toc,.wp-collection,.pdf-cta,.read-also,.progress-bar,.ix-progress-wrap,.fnlyt-bar,.nav-links'], capture_output=True, text=True)
print(r.stdout[-600:]); 
if r.returncode != 0:
    print(r.stderr); sys.exit(1)

# 2) Sitemap: bygges ud fra virkeligheden, hver gang.
#    Med: alle sider i roden, der må indekseres (ingen noindex, kanonisk adresse = egen adresse).
#    Uden: kommende sider fra udgivelsesplanen, 404-siden og filer under "_ikke_i_sitemap" i planen.
#    lastmod bevares for sider, der allerede står i sitemappet; nye får udgivelsesdatoen eller dagens dato.
NOINDEX = re.compile(r'<meta\s+name="robots"\s+content="[^"]*noindex', re.I)
CANON = re.compile(r'<link\s+rel="canonical"\s+href="([^"]+)"', re.I)
plan_raw = json.load(open(os.path.join(ROOT, 'release-schedule.json'), encoding='utf-8'))
EXCLUDE = set(plan_raw.get('_ikke_i_sitemap', [])) | {'404.html'}
sm_path = os.path.join(ROOT, 'sitemap.xml')
sm_old = open(sm_path, encoding='utf-8').read() if os.path.exists(sm_path) else ''
old_lastmod = dict(re.findall(r'<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>', sm_old))
entries, skipped = [], []
for name in sorted(os.listdir(ROOT)):
    if not name.endswith('.html') or name in future or name in EXCLUDE:
        continue
    html = open(os.path.join(ROOT, name), encoding='utf-8').read()
    url = BASE if name == 'index.html' else BASE + name
    if NOINDEX.search(html):
        skipped.append((name, 'noindex')); continue
    m = CANON.search(html)
    if m and m.group(1).rstrip('/') != url.rstrip('/') and not (name == 'index.html' and m.group(1).rstrip('/') == BASE.rstrip('/')):
        skipped.append((name, 'kanonisk peger andetsteds')); continue
    entries.append((url, old_lastmod.get(url) or released.get(name) or today))
entries.sort(key=lambda e: (e[0] != BASE, e[0]))
added = [u.replace(BASE, '') or '/' for u, _ in entries if u not in old_lastmod]
removed = [u.replace(BASE, '') or '/' for u in old_lastmod if u not in {e[0] for e in entries}]
xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for url, d in entries:
    xml.append(f'  <url>\n    <loc>{url}</loc>\n    <lastmod>{d}</lastmod>\n  </url>')
xml.append('</urlset>\n')
open(sm_path, 'w', encoding='utf-8').write('\n'.join(xml))
print(f'Sitemap: {len(entries)} sider · tilføjet: {added or "intet"} · fjernet: {removed or "intet"}')
for name, why in skipped:
    print(f'  udeladt ({why}): {name}')
