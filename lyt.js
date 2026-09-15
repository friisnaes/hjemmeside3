/*!
 * lyt.js — oplæsning af white papers på friisnaes.com
 * Bruger browserens indbyggede Web Speech API (SpeechSynthesis). Ingen eksterne kald,
 * ingen cookies, ingen data forlader browseren.
 *
 * Indsættes med én linje før </body>:  <script src="/lyt.js" defer></script>
 * Scriptet finder selv <span class="wp-readtime"> og lægger knappen ved siden af.
 *
 * Thomas Friisnæs / friisnaes.com — september 2026
 */
(function () {
  'use strict';

  var BODY_SEL = 'main.wp-body';
  var PICK = 'h2,h3,h4,p,li,summary,blockquote,figcaption';
  var SKIP = 'script,style,input,textarea,select,button,.wp-toc,.commit-actions,.pdf-btn-row,.fnlyt-bar';
  var RATES = [0.8, 1, 1.2, 1.5];
  var LS_RATE = 'fn_lyt_rate';
  var MAXLEN = 190;

  var host = document.querySelector(BODY_SEL);
  var slot = document.querySelector('.wp-readtime');
  if (!host || !slot) return;

  var synth = window.speechSynthesis;

  /* ---------------------------------------------------------------- styles */
  var css = document.createElement('style');
  css.textContent = [
    '.fnlyt-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:11px;',
    'letter-spacing:.14em;text-transform:uppercase;color:#e0a85c;color:rgba(255,255,255,.62);',
    'background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:2px;',
    'padding:3px 9px;cursor:pointer;transition:all .2s;line-height:1.6;font-family:inherit}',
    '.fnlyt-btn:hover{border-color:#c0392b;color:#fff}',
    '.fnlyt-btn[aria-expanded="true"]{border-color:#c0392b;color:#fff}',
    '.fnlyt-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:rgba(17,17,17,.97);',
    '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);',
    'border-top:1px solid rgba(255,255,255,.1);color:#fff;',
    'font-family:"Outfit",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    'padding:12px 20px calc(12px + env(safe-area-inset-bottom,0px));',
    'box-shadow:0 -8px 30px rgba(0,0,0,.28);transform:translateY(105%);transition:transform .32s cubic-bezier(.16,1,.3,1)}',
    '.fnlyt-bar.on{transform:translateY(0)}',
    '.fnlyt-in{max-width:980px;margin:0 auto;display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '.fnlyt-ctrl{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;',
    'border-radius:50%;border:1px solid rgba(255,255,255,.22);background:transparent;color:#fff;',
    'cursor:pointer;font-size:14px;line-height:1;transition:all .2s;flex-shrink:0;padding:0}',
    '.fnlyt-ctrl:hover{border-color:#c0392b;background:rgba(192,57,43,.16)}',
    '.fnlyt-ctrl.main{background:#c0392b;border-color:#c0392b;width:42px;height:42px;font-size:15px}',
    '.fnlyt-ctrl.main:hover{background:#e74c3c;border-color:#e74c3c}',
    '.fnlyt-meta{flex:1 1 180px;min-width:150px}',
    '.fnlyt-t{font-size:12.5px;color:rgba(255,255,255,.92);line-height:1.4;margin-bottom:6px;',
    'display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.fnlyt-track{height:3px;background:rgba(255,255,255,.14);border-radius:2px;overflow:hidden}',
    '.fnlyt-fill{height:100%;width:0;background:#c0392b;transition:width .3s linear}',
    '.fnlyt-rates{display:inline-flex;gap:4px;flex-shrink:0}',
    '.fnlyt-rate{font:inherit;font-size:11.5px;font-weight:500;color:rgba(255,255,255,.5);background:transparent;',
    'border:1px solid rgba(255,255,255,.18);border-radius:2px;padding:5px 9px;cursor:pointer;transition:all .2s}',
    '.fnlyt-rate:hover{color:#fff;border-color:rgba(255,255,255,.45)}',
    '.fnlyt-rate.on{color:#fff;border-color:#c0392b;background:rgba(192,57,43,.22)}',
    '.fnlyt-follow{font:inherit;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;',
    'color:rgba(255,255,255,.4);background:transparent;border:1px solid rgba(255,255,255,.16);',
    'border-radius:2px;padding:5px 10px;cursor:pointer;transition:all .2s;flex-shrink:0}',
    '.fnlyt-follow.on{color:#fff;border-color:rgba(255,255,255,.5)}',
    '.fnlyt-x{background:transparent;border:none;color:rgba(255,255,255,.4);font-size:20px;line-height:1;',
    'cursor:pointer;padding:6px 2px;flex-shrink:0;font-family:inherit}',
    '.fnlyt-x:hover{color:#fff}',
    '.fnlyt-note{max-width:980px;margin:8px auto 0;font-size:11.5px;color:rgba(255,255,255,.42);line-height:1.5}',
    '.fnlyt-hi{background:rgba(192,57,43,.11);box-shadow:-10px 0 0 rgba(192,57,43,.11),10px 0 0 rgba(192,57,43,.11);',
    'border-radius:1px;transition:background .3s}',
    '@media (max-width:640px){',
    '.fnlyt-in{gap:10px}.fnlyt-meta{order:5;flex-basis:100%}',
    '.fnlyt-rate{padding:5px 7px;font-size:11px}.fnlyt-follow{display:none}}',
    '@media print{.fnlyt-btn,.fnlyt-bar{display:none!important}.fnlyt-hi{background:none!important;box-shadow:none!important}}'
  ].join('');
  document.head.appendChild(css);

  /* ------------------------------------------------------------ knappen */
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fnlyt-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span aria-hidden="true">▶</span> Lyt til paperet';
  slot.insertAdjacentElement('afterend', btn);

  /* Ingen talesyntese i browseren: vis tippet i stedet for en knap, der ikke virker. */
  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') {
    btn.innerHTML = '<span aria-hidden="true">▶</span> Sådan får du paperet læst op';
    btn.addEventListener('click', function () {
      alert('Din browser har ikke indbygget oplæsning.\n\n' +
            'Microsoft Edge: tryk Ctrl + Shift + U, eller klik på "Læs højt"-ikonet i adresselinjen.\n' +
            'Safari (Mac): Rediger → Tale → Start tale.\n' +
            'iPhone/iPad: Indstillinger → Tilgængelighed → Talt indhold → Tal skærm, og stryg ned med to fingre.');
    });
    return;
  }

  /* ------------------------------------------------------- tekstudtrækning */
  function clean(t) {
    return t
      .replace(/­/g, '')
      .replace(/[»«“”„"]/g, '')
      .replace(/™|®/g, '')
      .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 til $2')
      .replace(/\s+[–—]\s+/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var blocks = [];
  (function collect() {
    var nodes = host.querySelectorAll(PICK);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest(SKIP)) continue;
      if (el.querySelector(PICK)) continue;          // tag altid det inderste element
      var t = clean(el.textContent || '');
      if (t.length < 2) continue;
      if (/^(h[2-4]|summary)$/i.test(el.tagName) && !/[.!?:]$/.test(t)) t += '.';
      blocks.push({ el: el, text: t });
    }
  })();
  if (!blocks.length) { btn.remove(); return; }

  /* Del op i bidder på højst ~190 tegn — korte ytringer er dem, browsere håndterer stabilt. */
  var chunks = [];
  blocks.forEach(function (b) {
    var parts = b.text.match(/[^.!?…]+[.!?…]*\s*/g) || [b.text];
    var buf = '';
    parts.forEach(function (p) {
      if ((buf + p).length > MAXLEN && buf) { chunks.push({ el: b.el, text: buf.trim() }); buf = ''; }
      buf += p;
      while (buf.length > MAXLEN) { chunks.push({ el: b.el, text: buf.slice(0, MAXLEN).trim() }); buf = buf.slice(MAXLEN); }
    });
    if (buf.trim()) chunks.push({ el: b.el, text: buf.trim() });
  });

  /* Titlen læses med, men markeres ikke — fremhævningen er lavet til brødtekst, ikke til hero'en. */
  var h1 = document.querySelector('.wp-header h1');
  if (h1) chunks.unshift({ el: null, text: clean(h1.textContent) + '.' });

  /* ---------------------------------------------------------------- stemme */
  var voice = null, voiceNote = '';
  function pickVoice() {
    var vs = synth.getVoices() || [];
    if (!vs.length) return;
    var da = vs.filter(function (v) { return /^da/i.test(v.lang || ''); });
    if (da.length) {
      var named = da.filter(function (v) { return /sara|magnus|helle|naja|jesper|dansk/i.test(v.name); });
      voice = named[0] || da[0];
      voiceNote = '';
    } else {
      voice = null;
      voiceNote = 'Din browser har ingen dansk stemme installeret, så oplæsningen bruger standardstemmen. ' +
                  'I Microsoft Edge og på iPhone/Mac er der en dansk stemme med fra start.';
    }
    if (note) note.textContent = voiceNote;
  }

  /* ------------------------------------------------------------ afspilleren */
  var rate = 1;
  try { rate = parseFloat(localStorage.getItem(LS_RATE) || '1') || 1; } catch (e) {}
  if (RATES.indexOf(rate) === -1) rate = 1;
  var idx = 0, playing = false, follow = true, current = null, suppress = false;
  var gen = 0;   // stopper forældede onend-kald efter synth.cancel()

  var bar = document.createElement('div');
  bar.className = 'fnlyt-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Oplæsning');
  bar.innerHTML =
    '<div class="fnlyt-in">' +
      '<button type="button" class="fnlyt-ctrl main" id="fnlytPlay" aria-label="Afspil oplæsning">▶</button>' +
      '<button type="button" class="fnlyt-ctrl" id="fnlytStop" aria-label="Stop og start forfra">■</button>' +
      '<div class="fnlyt-meta">' +
        '<span class="fnlyt-t" id="fnlytT">Klar til at læse paperet op</span>' +
        '<div class="fnlyt-track"><div class="fnlyt-fill" id="fnlytFill"></div></div>' +
      '</div>' +
      '<div class="fnlyt-rates" id="fnlytRates" role="group" aria-label="Lyttehastighed"></div>' +
      '<button type="button" class="fnlyt-follow on" id="fnlytFollow" aria-pressed="true">Følg tekst</button>' +
      '<button type="button" class="fnlyt-x" id="fnlytX" aria-label="Luk oplæsning">×</button>' +
    '</div>' +
    '<p class="fnlyt-note" id="fnlytNote"></p>';
  document.body.appendChild(bar);

  var elPlay = bar.querySelector('#fnlytPlay'),
      elStop = bar.querySelector('#fnlytStop'),
      elT    = bar.querySelector('#fnlytT'),
      elFill = bar.querySelector('#fnlytFill'),
      elFoll = bar.querySelector('#fnlytFollow'),
      note   = bar.querySelector('#fnlytNote');

  RATES.forEach(function (r) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fnlyt-rate' + (r === rate ? ' on' : '');
    b.textContent = (r === 1 ? '1' : String(r).replace('.', ',')) + '×';
    b.setAttribute('aria-label', 'Hastighed ' + b.textContent);
    b.addEventListener('click', function () {
      rate = r;
      try { localStorage.setItem(LS_RATE, String(r)); } catch (e) {}
      bar.querySelectorAll('.fnlyt-rate').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      if (playing) play();   // genstart den aktuelle bid i den nye hastighed
    });
    bar.querySelector('#fnlytRates').appendChild(b);
  });

  pickVoice();
  if (synth.onvoiceschanged !== undefined) synth.addEventListener('voiceschanged', pickVoice);

  function mark(el) {
    if (current && current !== el) current.classList.remove('fnlyt-hi');
    current = el;
    if (!el) return;
    el.classList.add('fnlyt-hi');
    if (!follow) return;
    var r = el.getBoundingClientRect();
    if (r.top < 90 || r.bottom > window.innerHeight - 140) {
      suppress = true;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(function () { suppress = false; }, 900);
    }
  }

  function status() {
    elFill.style.width = Math.round(idx / chunks.length * 100) + '%';
    elT.textContent = playing
      ? 'Læser op · afsnit ' + (idx + 1) + ' af ' + chunks.length
      : (idx ? 'Sat på pause · afsnit ' + (idx + 1) + ' af ' + chunks.length
             : 'Klar til at læse paperet op');
  }

  function speak(i, myGen) {
    if (myGen !== gen) return;
    if (i >= chunks.length) { stop(true); return; }
    idx = i;
    var u = new SpeechSynthesisUtterance(chunks[i].text);
    u.lang = 'da-DK';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1;
    u.onstart = function () { if (myGen === gen) { mark(chunks[i].el); status(); } };
    u.onend = function () { if (myGen === gen && playing) speak(i + 1, myGen); };
    u.onerror = function (e) {
      if (myGen !== gen) return;
      if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
      if (playing) speak(i + 1, myGen);
    };
    synth.speak(u);
  }

  function play() {
    gen++;
    synth.cancel();
    playing = true;
    elPlay.innerHTML = '‖';
    elPlay.setAttribute('aria-label', 'Pause oplæsning');
    var my = gen;
    setTimeout(function () { if (my === gen && playing) speak(idx, my); }, 60);
    status();
  }

  function pause() {
    gen++;
    playing = false;
    synth.cancel();
    elPlay.innerHTML = '▶';
    elPlay.setAttribute('aria-label', 'Afspil oplæsning');
    status();
  }

  function stop(done) {
    gen++;
    playing = false;
    synth.cancel();
    idx = 0;
    elPlay.innerHTML = '▶';
    elPlay.setAttribute('aria-label', 'Afspil oplæsning');
    mark(null);
    elFill.style.width = done ? '100%' : '0';
    elT.textContent = done ? 'Paperet er læst op' : 'Klar til at læse paperet op';
  }

  elPlay.addEventListener('click', function () { playing ? pause() : play(); });
  elStop.addEventListener('click', function () { stop(false); });
  elFoll.addEventListener('click', function () {
    follow = !follow;
    elFoll.classList.toggle('on', follow);
    elFoll.setAttribute('aria-pressed', String(follow));
  });
  bar.querySelector('#fnlytX').addEventListener('click', function () {
    stop(false);
    bar.classList.remove('on');
    btn.setAttribute('aria-expanded', 'false');
  });

  btn.addEventListener('click', function () {
    var open = bar.classList.toggle('on');
    btn.setAttribute('aria-expanded', String(open));
    if (open && !playing && !idx) play(); else if (!open) stop(false);
  });

  /* Slår "følg tekst" fra, hvis læseren selv scroller — så kæmper de to ikke om siden. */
  window.addEventListener('wheel', manual, { passive: true });
  window.addEventListener('touchmove', manual, { passive: true });
  function manual() {
    if (suppress || !follow) return;
    follow = false;
    elFoll.classList.remove('on');
    elFoll.setAttribute('aria-pressed', 'false');
  }

  /* Talesyntesen lever i browseren, ikke i fanen — stop den, når siden forlades. */
  window.addEventListener('pagehide', function () { synth.cancel(); });
  window.addEventListener('beforeunload', function () { synth.cancel(); });

  /* Chromium stopper lange oplæsninger af sig selv; et kort pause/resume holder køen i live.
     Safari har ikke fejlen og reagerer dårligt på kunstige pauser, så den holdes udenfor. */
  if (/Google/.test(navigator.vendor || '') && /Chrome|Chromium|Edg\//.test(navigator.userAgent)) {
    setInterval(function () {
      if (playing && synth.speaking && !synth.paused) { synth.pause(); synth.resume(); }
    }, 9000);
  }
})();
