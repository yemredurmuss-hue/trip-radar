import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from data import S

total = sum(len(s['items']) for s in S)
DATA = json.dumps(S, ensure_ascii=False).replace('</', '<\\/')

page = r'''<title>v82 Geçiş Kararları</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,750&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap">
<style>
/* Düzen: tek sütun karar listesi; üstte yapışkan ilerleme ve bölüm çipleri; her karar kendi kartı, seçenekler alt alta. Trip Radar moru tek eylem rengi. */
:root{
  --bg:#f6f5fa; --panel:#ffffff; --ink:#1d1a34; --mut:#615d7c; --line:#e6e3ef; --soft:#f0eef7;
  --acc:#5b45e0; --acc-ink:#ffffff; --acc-s:#ece8ff; --ok:#1f7a45; --ok-s:#e6f5ec; --amb:#9a6512; --amb-s:#fbf1df;
  --f-display:"Bricolage Grotesque","Figtree",system-ui,sans-serif; --f-body:"Figtree",system-ui,-apple-system,"Segoe UI",sans-serif; --f-mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#141221; --panel:#1d1a2e; --ink:#ece9fb; --mut:#a9a4c6; --line:#302c47; --soft:#24203a;
  --acc:#8f7dff; --acc-ink:#120f22; --acc-s:#2c2550; --ok:#5ccf8a; --ok-s:#173325; --amb:#e8b35a; --amb-s:#3a2c14; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#141221; --panel:#1d1a2e; --ink:#ece9fb; --mut:#a9a4c6; --line:#302c47; --soft:#24203a;
  --acc:#8f7dff; --acc-ink:#120f22; --acc-s:#2c2550; --ok:#5ccf8a; --ok-s:#173325; --amb:#e8b35a; --amb-s:#3a2c14; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:15px/1.5 var(--f-body)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--panel)}
.wrap{max-width:880px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 80px;display:grid;gap:22px}
header.top{display:grid;gap:8px}
h1{font:750 34px/1.1 var(--f-display);letter-spacing:-.02em;margin:0;text-wrap:balance}
.lead{margin:0;color:var(--mut);max-width:62ch}
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:12px 14px;display:grid;gap:10px;box-shadow:0 8px 24px -18px rgba(20,16,50,.35)}
.bar-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}
.prog{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 220px}
.prog b{font:700 15px var(--f-body);font-variant-numeric:tabular-nums;white-space:nowrap}
.track{flex:1;height:8px;border-radius:99px;background:var(--soft);overflow:hidden;display:flex}
.track i{display:block;height:100%}.track .me{background:var(--acc)}.track .au{background:color-mix(in srgb,var(--acc) 35%,var(--soft))}
.btn{appearance:none;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:600 13.5px var(--f-body);height:36px;padding:0 14px;border-radius:11px;cursor:pointer;white-space:nowrap}
.btn:hover{border-color:color-mix(in srgb,var(--acc) 45%,var(--line))}
.btn.pri{background:var(--acc);border-color:var(--acc);color:var(--acc-ink)}
.btn:focus-visible,.opt:focus-within,.chip:focus-visible,textarea:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.save{font-size:12px;color:var(--mut)}.save.ok{color:var(--ok)}.save.warn{color:var(--amb)}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.chip{flex:none;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:99px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:600 12px var(--f-body);text-decoration:none;white-space:nowrap}
.chip em{font-style:normal;font-family:var(--f-mono);font-size:11px;color:var(--mut)}
.chip.done{background:var(--ok-s);border-color:color-mix(in srgb,var(--ok) 40%,var(--line))}.chip.done em{color:var(--ok)}
section.sec{display:grid;gap:12px;scroll-margin-top:150px}
.sec-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding-top:8px}
.sec-h .k{font:700 13.5px var(--f-mono);color:var(--acc)}
.sec-h h2{font:750 22px/1.2 var(--f-display);margin:0;letter-spacing:-.01em}
.sec-h p{flex-basis:100%;margin:0;color:var(--mut);font-size:13.5px;max-width:70ch}
.sec-all{margin-left:auto}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px 12px;display:grid;gap:10px}
.card.set{border-color:color-mix(in srgb,var(--acc) 30%,var(--line))}
.card.auto{border-style:dashed}
.ch{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 12px;align-items:baseline}
.cid{font:700 12px var(--f-mono);color:var(--mut);padding-top:2px}
.cq{font:700 15px/1.35 var(--f-body);margin:0;min-width:0}
.cst{font-size:12px;font-weight:700;white-space:nowrap;color:var(--mut)}
.cst.me{color:var(--acc)}.cst.au{color:var(--mut)}
.ctx{grid-column:2/-1;margin:0;color:var(--mut);font-size:13.5px;min-width:0}
.opts{display:grid;gap:6px;margin-left:calc(12px + 3ch)}
.opt{position:relative;display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:10px;align-items:start;padding:9px 12px;border:1px solid var(--line);border-radius:12px;cursor:pointer;background:var(--panel)}
.opt:hover{background:var(--soft)}
.opt input{position:absolute;opacity:0;pointer-events:none}
.dot{width:18px;height:18px;margin-top:2px;border-radius:50%;border:2px solid color-mix(in srgb,var(--mut) 55%,transparent);display:grid;place-items:center}
.multi .dot{border-radius:6px}
.opt.on{border-color:var(--acc);background:var(--acc-s)}
.opt.on .dot{border-color:var(--acc);background:var(--acc)}
.opt.on .dot::after{content:"";width:6px;height:6px;border-radius:50%;background:var(--acc-ink)}
.multi .opt.on .dot::after{width:8px;height:5px;border-radius:0;background:none;border-left:2px solid var(--acc-ink);border-bottom:2px solid var(--acc-ink);transform:translateY(-1px) rotate(-45deg)}
.otx{font-size:14px;min-width:0}
.rec{font-size:11px;font-weight:700;color:var(--ok);background:var(--ok-s);border-radius:99px;padding:2px 8px;white-space:nowrap;margin-top:1px}
.nrow{margin-left:calc(12px + 3ch);display:grid;gap:6px}
.nbtn{appearance:none;border:0;background:none;color:var(--acc);font:600 12.5px var(--f-body);padding:2px 0;cursor:pointer;justify-self:start}
textarea{width:100%;min-height:64px;resize:vertical;border:1px solid var(--line);border-radius:12px;padding:9px 12px;font:14px/1.45 var(--f-body);color:var(--ink);background:var(--panel)}
.gnote{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:grid;gap:8px}
.gnote h2{font:750 19px var(--f-display);margin:0}
.toast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:12px;font-size:13.5px;font-weight:600;z-index:20;max-width:calc(100vw - 32px)}
.copy-out{white-space:pre-wrap;font:12px/1.45 var(--f-mono);background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:10px 12px;max-height:240px;overflow:auto}
@media (max-width:560px){h1{font-size:28px}.opts,.nrow{margin-left:0}.ch{grid-template-columns:auto minmax(0,1fr)}.cst{grid-column:1/-1}.ctx{grid-column:1/-1}}
@media (prefers-reduced-motion:no-preference){.opt,.card,.chip{transition:background .15s,border-color .15s}}
</style>
<div class="wrap">
  <header class="top">
    <h1>v82 geçiş kararları</h1>
    <p class="lead">Canlıda olup tasarımda olmayanlar, canlı kurallarla çatışanlar, gezi türleri, hareket dili, aşamalı gösterim ve spec planı. Her kararda önerim yeşil işaretli. Seçimlerin bu sayfada kaydedilir ve ben buradan okurum; boş bıraktıklarını tek düğmeyle önerimle doldurabilirsin.</p>
  </header>
  <div class="bar" id="bar">
    <div class="bar-row">
      <div class="prog"><b id="pnum">0 / __TOTAL__</b><span class="track" aria-hidden="true"><i class="me" id="pme"></i><i class="au" id="pau"></i></span></div>
      <button type="button" class="btn pri" id="fill">Boşları önerimle doldur</button>
      <button type="button" class="btn" id="copy">Özeti kopyala</button>
      <span class="save" id="save" role="status">Bağlanıyor…</span>
    </div>
    <nav class="chips" id="chips" aria-label="Bölümler"></nav>
  </div>
  <main id="list" class="wrap-in" style="display:grid;gap:26px"></main>
  <div class="gnote">
    <h2>Genel not</h2>
    <label for="gnote" class="lead" style="font-size:13.5px">Listede olmayan ya da bütünü ilgilendiren bir şey varsa buraya yaz.</label>
    <textarea id="gnote" placeholder="Örnek: Gün gün'ü de bu işe kat."></textarea>
  </div>
  <div id="copyBox" hidden><div class="copy-out" id="copyOut"></div></div>
</div>
<div class="toast" id="toast" hidden></div>
<script>
var DATA = __DATA__;
var ST = {}; // id -> {secim, not, oto}
var DB = null, COL = null, LOCAL = 'v82-kararlar', QW = Promise.resolve();
function $(s, e){ return (e || document).querySelector(s); }
function el(t, c, h){ var x = document.createElement(t); if (c) x.className = c; if (h != null) x.innerHTML = h; return x; }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
var ALL = []; DATA.forEach(function(s){ s.items.forEach(function(it){ it.sec = s.id; ALL.push(it); }); });
function chosen(it){ var v = ST[it.id] && ST[it.id].secim; return it.multi ? Array.isArray(v) : !!v; }
function isAuto(it){ return !!(ST[it.id] && ST[it.id].oto); }
var tt; function toast(m){ var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(function(){ t.hidden = true; }, 2600); }
function setSave(m, cls){ var s = $('#save'); s.textContent = m; s.className = 'save' + (cls ? ' ' + cls : ''); }

function render(){
  var list = $('#list'); list.innerHTML = '';
  DATA.forEach(function(s){
    var sec = el('section', 'sec'); sec.id = 'sec-' + s.id;
    var h = el('div', 'sec-h', '<span class="k">' + s.id + '</span><h2>' + esc(s.title) + '</h2><button type="button" class="btn sec-all" data-sec="' + s.id + '">Bu bölümde önerimi onayla</button><p>' + esc(s.intro) + '</p>');
    sec.appendChild(h);
    s.items.forEach(function(it){ sec.appendChild(card(it)); });
    list.appendChild(sec);
  });
  stats();
}
function card(it){
  var c = el('article', 'card' + (it.multi ? ' multi' : '')); c.id = 'k-' + it.id;
  c.innerHTML = '<div class="ch"><span class="cid">' + it.id + '</span><h3 class="cq">' + esc(it.q) + '</h3><span class="cst"></span>' + (it.ctx ? '<p class="ctx">' + esc(it.ctx) + '</p>' : '') + '</div>';
  var box = el('div', 'opts'); box.setAttribute('role', it.multi ? 'group' : 'radiogroup'); box.setAttribute('aria-label', it.q);
  it.opts.forEach(function(o){
    var rec = it.multi ? it.rec.indexOf(o[0]) > -1 : it.rec === o[0];
    var lab = el('label', 'opt');
    var idf = 'o-' + it.id + '-' + o[0];
    lab.innerHTML = '<input type="' + (it.multi ? 'checkbox' : 'radio') + '" name="r-' + it.id + '" id="' + idf + '" value="' + o[0] + '"><span class="dot" aria-hidden="true"></span><span class="otx">' + esc(o[1]) + '</span>' + (rec ? '<span class="rec">önerim</span>' : '<span></span>');
    $('input', lab).addEventListener('change', function(){ pick(it, o[0], this.checked); });
    box.appendChild(lab);
  });
  c.appendChild(box);
  var nr = el('div', 'nrow');
  var nb = el('button', 'nbtn', 'Not ekle'); nb.type = 'button';
  var ta = el('textarea'); ta.id = 'n-' + it.id; ta.hidden = true; ta.setAttribute('aria-label', it.id + ' notu');
  nb.addEventListener('click', function(){ ta.hidden = !ta.hidden; if (!ta.hidden) ta.focus(); });
  var deb; ta.addEventListener('input', function(){ clearTimeout(deb); var v = ta.value; deb = setTimeout(function(){ write(it.id, { not: v }); }, 600); });
  nr.appendChild(nb); nr.appendChild(ta); c.appendChild(nr);
  paint(it, c);
  return c;
}
function paint(it, c){
  c = c || document.getElementById('k-' + it.id); if (!c) return;
  var s = ST[it.id] || {}, v = s.secim;
  c.querySelectorAll('.opt').forEach(function(lab){
    var inp = $('input', lab), on = it.multi ? (Array.isArray(v) && v.indexOf(inp.value) > -1) : v === inp.value;
    inp.checked = on; lab.classList.toggle('on', on);
  });
  var st = $('.cst', c), has = chosen(it);
  c.classList.toggle('set', has); c.classList.toggle('auto', has && !!s.oto);
  st.className = 'cst' + (has ? (s.oto ? ' au' : ' me') : '');
  st.textContent = has ? (s.oto ? 'önerim geçerli' : 'seçtin') : 'boş';
  var ta = document.getElementById('n-' + it.id);
  if (ta && document.activeElement !== ta && s.not != null && ta.value !== s.not){ ta.value = s.not; }
  if (ta && s.not){ ta.hidden = false; $('.nbtn', c).textContent = 'Not'; }
}
function stats(){
  var me = 0, au = 0;
  ALL.forEach(function(it){ if (chosen(it)) { if (isAuto(it)) au++; else me++; } });
  var n = ALL.length;
  $('#pnum').textContent = (me + au) + ' / ' + n + (au ? ' · ' + au + ' önerimle' : '');
  $('#pme').style.width = (me / n * 100) + '%'; $('#pau').style.width = (au / n * 100) + '%';
  var ch = $('#chips'); ch.innerHTML = '';
  DATA.forEach(function(s){
    var d = s.items.filter(chosen).length;
    var a = el('a', 'chip' + (d === s.items.length ? ' done' : ''), esc(s.id + ' ' + s.title) + ' <em>' + d + '/' + s.items.length + '</em>');
    a.href = '#sec-' + s.id; ch.appendChild(a);
  });
}
function pick(it, key, on){
  var v;
  if (it.multi){
    var cur = (ST[it.id] && Array.isArray(ST[it.id].secim)) ? ST[it.id].secim.slice() : [];
    var i = cur.indexOf(key); if (on && i < 0) cur.push(key); if (!on && i > -1) cur.splice(i, 1);
    v = cur;
  } else v = key;
  write(it.id, { secim: v, oto: false });
}
function write(id, patch){
  var s = Object.assign({}, ST[id] || {}, patch, { t: Date.now() });
  ST[id] = s;
  var it = ALL.filter(function(x){ return x.id === id; })[0]; if (it) paint(it);
  stats();
  if (COL){
    setSave('Kaydediliyor…');
    var body = Object.assign({}, s);
    QW = QW.then(function(){ return COL.doc(id).set(body); }).then(function(){ setSave('Kaydedildi', 'ok'); }, function(e){ setSave('Kaydedilemedi: ' + ((e && e.code) || 'hata') + '. "Özeti kopyala" ile sohbete yapıştırabilirsin.', 'warn'); });
  } else {
    try { localStorage.setItem(LOCAL, JSON.stringify(ST)); } catch (e) {}
  }
}
function fillRec(secId){
  var n = 0;
  ALL.forEach(function(it){
    if (secId && it.sec !== secId) return;
    if (chosen(it)) return;
    write(it.id, { secim: it.multi ? it.rec.slice() : it.rec, oto: true }); n++;
  });
  toast(n ? n + ' karar önerimle dolduruldu' : 'Boş karar kalmadı');
}
function summary(){
  var out = [];
  DATA.forEach(function(s){
    out.push(s.id + ' ' + s.title);
    s.items.forEach(function(it){
      var st = ST[it.id] || {}, v = st.secim, txt;
      if (!chosen(it)) txt = '(boş)';
      else if (it.multi) txt = it.opts.filter(function(o){ return v.indexOf(o[0]) > -1; }).map(function(o){ return o[1]; }).join('; ');
      else txt = (it.opts.filter(function(o){ return o[0] === v; })[0] || ['', v])[1];
      out.push('  ' + it.id + ': ' + txt + (st.oto ? ' [önerim]' : '') + (st.not ? ' · not: ' + st.not : ''));
    });
  });
  var g = $('#gnote').value; if (g) out.push('Genel not: ' + g);
  return out.join('\n');
}
document.addEventListener('click', function(e){
  var b = e.target.closest('button'); if (!b) return;
  if (b.id === 'fill'){ fillRec(''); return; }
  if (b.dataset.sec){ fillRec(b.dataset.sec); return; }
  if (b.id === 'copy'){
    var t = summary(), box = $('#copyBox'), out = $('#copyOut');
    out.textContent = t;
    var done = function(){ toast('Özet kopyalandı'); }, fail = function(){ box.hidden = false; var r = document.createRange(); r.selectNodeContents(out); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Kopyalanamadı; metin aşağıda seçili'); };
    try { navigator.clipboard.writeText(t).then(done, fail); } catch (er) { fail(); }
  }
});
var gdeb; $('#gnote').addEventListener('input', function(){ clearTimeout(gdeb); var v = this.value; gdeb = setTimeout(function(){ ST._genel = { not: v, t: Date.now() }; if (COL) COL.doc('_genel').set(ST._genel).then(function(){ setSave('Kaydedildi', 'ok'); }, function(){ setSave('Not kaydedilemedi', 'warn'); }); else { try { localStorage.setItem(LOCAL, JSON.stringify(ST)); } catch (er) {} } }, 600); });

// ilk çizim, kayıt gelmeden
try { var L = JSON.parse(localStorage.getItem(LOCAL) || 'null'); if (L) ST = L; } catch (e) {}
render();
if (ST._genel && ST._genel.not) $('#gnote').value = ST._genel.not;
(window.claude && window.claude.use ? window.claude.use('db') : Promise.resolve(null)).then(function(db){
  if (!db){ setSave('Bu görünümde kayıt yok; seçimlerin yalnız bu tarayıcıda. Bitince "Özeti kopyala".', 'warn'); return; }
  DB = db; COL = db.collection('kararlar');
  setSave('Bağlandı', 'ok');
  COL.onSnapshot(function(snap){
    snap.docs.forEach(function(d){ if (!d.exists) return; var x = d.data(); ST[d.id] = Object.assign({}, x); });
    ALL.forEach(function(it){ paint(it); });
    if (ST._genel && document.activeElement !== $('#gnote')) $('#gnote').value = ST._genel.not || '';
    stats();
  }, function(e){ setSave('Kayıtlar okunamadı: ' + ((e && e.code) || 'hata'), 'warn'); });
});
</script>
'''
page = page.replace('__DATA__', DATA).replace('__TOTAL__', str(total))
open(os.path.join(HERE, 'kararlar.html'), 'w').write(page)
print('ok', total, len(page))
