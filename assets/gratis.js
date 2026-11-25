/* Gratisniveauet på friisnaes.com: niveaumærke, kicker, "Begynd uden navn" og vejen videre.
   Lægges ind i hvert gratisværktøj af scripts/gratis.py. Rører ikke værktøjets egen logik. */
(function(){
  var me=document.currentScript||document.querySelector('script[src*="gratis.js"]');
  var lag=(me&&me.getAttribute('data-lag'))||'Diagnose';
  var navn=(me&&me.getAttribute('data-navn'))||document.title;
  function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}

  // Niveaumærke og kicker
  var mark=el('div','fg-mark','<i></i>');mark.setAttribute('aria-hidden','true');
  var kick=el('div','fg-kicker','Gratis · '+lag);
  document.body.appendChild(mark);document.body.appendChild(kick);
  if(document.querySelector('.topbar'))document.body.classList.add('fg-has-topbar');

  // Begynd uden navn: samme funktion som værktøjets egen knap, men uden friktion.
  var name=document.getElementById('cl-name'),consent=document.getElementById('gdpr-consent');
  if(name){
    var startBtn=null;
    document.querySelectorAll('button').forEach(function(b){var oc=b.getAttribute('onclick')||'';if(!startBtn&&/doClientLogin|startTest|startDiag/.test(oc))startBtn=b});
    if(!startBtn){var card0=name.closest('.login-card')||name.parentElement;startBtn=card0&&card0.querySelector('.btn-primary,.btn');}
    if(startBtn){
      var wrap=el('div','fg-start');
      var b=el('button',null,'Begynd uden at skrive navn');b.type='button';
      b.addEventListener('click',function(){
        if(!name.value.trim())name.value='Gæst';
        var email=document.getElementById('cl-email');if(email&&!email.value.trim())email.value='gaest@denne-browser.lokal';
        if(consent)consent.checked=true;
        startBtn.click();
      });
      wrap.appendChild(b);
      wrap.appendChild(el('small',null,'Dine svar gemmes kun i denne browser. Intet sendes.'));
      var card=name.closest('.login-card')||name.parentElement;
      card.appendChild(wrap);
    }
  }

  // Det næste niveau
  var next=el('aside','fg-next',
    '<div class="fg-next-in">'+
    '<div class="fg-lbl">Det næste niveau</div>'+
    '<h2>Det her er de første 40 procent.</h2>'+
    '<p>'+esc(navn)+' kan du bruge alene, gratis og uden konto. Er du i tvivl om, hvor du skal begynde, så start med placeringen. Det, der kommer efter, kræver enten en motor, der kender Thomas’ tankegang, eller Thomas.</p>'+
    '<div class="fg-tiers">'+
    '<div class="fg-tier"><div class="tm" aria-hidden="true"><i></i></div><h3>Gratis</h3><p>Hvor står du nu? Ti minutter, tre skridt, tre papers.</p><a href="/vaerktoejer/hvor-staar-du-nu/">Find din placering</a></div>'+
    '<div class="fg-tier"><div class="tm" aria-hidden="true"><i></i><i></i></div><h3>Abonnement</h3><p>Træning, beslutning og hukommelse. Sparring i Thomas’ tankegang, mellem dine møder.</p><span class="soon">Under opbygning</span></div>'+
    '<div class="fg-tier"><div class="tm" aria-hidden="true"><i></i><i></i><i></i></div><h3>Retainer</h3><p>Den personlige rejse med Thomas. Minimum ni måneder, fortroligt.</p><a class="fg-btn" href="/executive-coaching.html">Læs om executive coaching</a></div>'+
    '</div>'+
    '<div class="fg-src">Gratisniveauet bygger på best practice fra Egon Zehnder, Korn Ferry, Marshall Goldsmith, Hogan og McKinsey og på 59 papers i <a href="/library.html">Executive Library</a>. Kilderne står på din side i <a href="/vaerktoejer/hvor-staar-du-nu/">Hvor står du nu?</a>.</div>'+
    '</div>');
  document.body.appendChild(next);

  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
})();
