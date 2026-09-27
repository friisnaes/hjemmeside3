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

# 2) Sitemap: tilføj udgivne filer, fjern kommende
sm_path = os.path.join(ROOT, 'sitemap.xml')
sm = open(sm_path, encoding='utf-8').read()
for f in future:
    sm = re.sub(r'\s*<url>\s*<loc>' + re.escape(BASE + f) + r'</loc>.*?</url>', '', sm, flags=re.S)
added = []
for f, d in sorted(released.items(), key=lambda x: x[1]):
    if BASE + f not in sm:
        sm = sm.replace('</urlset>', f'  <url>\n    <loc>{BASE}{f}</loc>\n    <lastmod>{d}</lastmod>\n  </url>\n</urlset>')
        added.append(f)
open(sm_path, 'w', encoding='utf-8').write(sm)
print('Tilføjet til sitemap:', added or 'intet')
