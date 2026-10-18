# v76: Niyet · Seçili · altta geniş Pano (Biriktirdiklerin | AI önerileri). Satır tek ızgara: tarih | niyet | seçili | eylem;
# hepsi aynı üç çizgiye oturur (üst 18 · ana 24 · alt 18), böylece niyet ile seçili hizalı. Özet canlıdaki (v75'ten).
import json, re, os
D = os.path.dirname(os.path.abspath(__file__)); S = os.path.dirname(D)
v74 = open(f"{S}/v74/src.html").read()
v75 = open(f"{S}/v75/src.html").read()
V = json.load(open(f"{S}/v74/vals.json"))
livecss = open("/tmp/v31live/live-sub.css").read()

base_css = v74[v74.index("<style>") + 7: v74.index("/* plan */")]
chat = v74[v74.index('<aside class="chat"'): v74.index("</aside>") + 8].replace('<img src="{{IMG_OTEL}}" alt="">', '<span class="lnd i-otel"></span>')
hero = v75[v75.index("  <!-- ÜST ÖZET"): v75.index("  <!-- UÇUŞ -->")]
hero = re.sub(r'<span class="jc"><img src="\{\{IMG_([A-Z]+)\}\}" alt=""></span>', lambda m: f'<span class="jc i-{m.group(1).lower()}"></span>', hero)
# v75'in kendi CSS'inden yalnız plan çubuğu ve rota şeridi
v75css = v75[v75.index("/* ===== v75 ===== */"): v75.index("/* satır: dört sütun")]

# ---------- ikonlar ----------
def ic(d, w=15, fill=False):
    if fill: return f'<svg width="{w}" height="{w}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="{d}"/></svg>'
    return f'<svg width="{w}" height="{w}" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{d}</g></svg>'
PLANE_D = "M21 15.5v-1.8l-7.5-4.6V4a1.5 1.5 0 0 0-3 0v5.1L3 13.7v1.8l7.5-2.3V18l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-4.8z"
PLANE = f'<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" transform="rotate(90 12 12)" d="{PLANE_D}"/></svg>'
TRAIN = ic('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4"/>', 13)
CHK = ic('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 12).replace('stroke-width="2"', 'stroke-width="3"')
LNK = ic('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', 12)
PIN = ic("M6 3h12v18l-6-4-6 4z", 11, True)
CHEV = ic('<path d="m6 9 6 6 6-6"/>', 13)
CAT = {
 "fly": ic(PLANE_D, 17, True), "stay": ic('<path d="M3 18V7M21 18v-5a3 3 0 0 0-3-3h-8v6M3 15h18"/>', 17),
 "move": ic('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4"/>', 17),
 "exp": ic('<path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2z"/><path d="M14 6v12"/>', 17),
 "todo": ic('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 17),
 "doc": ic('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h5M9.5 15.5h5"/>', 17),
}

# ---------- parçalar ----------
def date(mo, d, wd, to=""):
    t = f'<span class="to num">→ {to}</span>' if to else ""
    return f'<div class="dt"><span class="l1 mo">{mo}</span><span class="l2 d num">{d}</span><span class="l3 wd">{wd}</span>{t}</div>'

def niyet(ill, kind, name, meta):
    return (f'<div class="ny"><span class="ill i-{ill}"></span><div class="tx"><span class="l1 k">{kind}</span>'
            f'<b class="l2">{name}</b><span class="l3">{meta}</span></div></div>')

def ring(st):
    return {"half": '<i class="rg half"></i>', "done": f'<i class="rg done">{CHK}</i>', "open": '<i class="rg open"></i>', "arr": f'<i class="rg arr">{CHK}</i>'}[st]

def pick(st, top, main, sub, thumb=""):
    th = f'<span class="th">{thumb}</span>' if thumb else ""
    return (f'<div class="pk {st}">{th}<div class="tx"><span class="l1">{ring(st)}{top}</span>'
            f'<div class="l2">{main}</div><span class="l3">{sub}</span></div></div>')

def route(a, ta, b, tb, mode=PLANE, stop=False, plus=""):
    s = '<i class="rt-stop"></i>' if stop else ""
    p = f'<sup>{plus}</sup>' if plus else ""
    return (f'<span class="rt"><b>{a}</b><time class="num">{ta}</time>'
            f'<span class="rt-arc"><svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="M2 18 Q50 -6 98 18" vector-effect="non-scaling-stroke"/></svg><i class="rt-a"></i><i class="rt-b"></i>{s}<span class="rt-pl">{mode}</span></span>'
            f'<time class="num">{tb}{p}</time><b>{b}</b></span>')

AL = lambda code, col: f'<span class="al" style="--alc:{col}">{code}</span>'
BR = lambda name, col: f'<span class="br" style="--bc:{col}">{name}</span>'
AI_TOP = '<span class="ai">✦ AI seçti</span>'

def act(price, sub, left, n, opened=False, est=False):
    cls = "pr est" if est else "pr"
    tg = "tg on" if opened else "tg"
    lab = f"Pano · {n}" if n else "Pano"
    return (f'<div class="ac"><div class="{cls}"><b class="num">{price}</b><small class="num">{sub}</small></div>'
            f'<div class="bt">{left}<button class="{tg}" type="button" aria-expanded="{str(opened).lower()}">{lab}{CHEV}</button></div></div>')
BUY = '<button class="b pri" type="button">Satın al ↗</button>'
FIND = '<button class="b pri" type="button">✦ AI bulsun</button>'
DONE = lambda t: f'<span class="b ok">{CHK}{t}</span>'
ARR = '<span class="b arr">Ayarlandı</span>'

# Pano paneli: solda biriktirdiklerin, sağda AI önerileri
def panel(title, sub, me, ai, me_n, ai_n, me_hint, ai_hint, find, me_empty=""):
    me_body = me if me else f'<div class="empty">{me_empty}</div>'
    return (f'<div class="pp"><div class="pp-h"><b>Pano</b><span>{title}</span><small>{sub}</small><button class="x" type="button">Kapat</button></div>'
            f'<div class="pp-b"><section class="side me"><div class="sd-h"><span class="sd-ic">{LNK}</span><b>Biriktirdiklerin</b><span class="n">{me_n}</span><small>{me_hint}</small></div>{me_body}'
            f'<div class="sd-f">{LNK}Linki sohbete bırak ya da sayfadayken Pano\'ya kaydet</div></section>'
            f'<section class="side ai"><div class="sd-h"><span class="sd-ic">✦</span><b>AI önerileri</b><span class="n">{ai_n}</span><small>{ai_hint}</small></div>{ai}'
            f'<div class="sd-f"><button class="more" type="button">✦ Daha fazla bul</button><span class="kd">Kendin ara: {find}</span></div></section></div></div>')

def fr(code, col, dep, dur, leg, arr, arrc, price, src="", tag=""):
    s = f'<span class="src">{src}</span>' if src else ""
    t = f'<span class="tag">{tag}</span>' if tag else ""
    return (f'<div class="fr">{AL(code, col)}<div class="fr-t"><b class="num">{dep}</b><span class="lg"><small>{dur}</small><i></i><small>{leg}</small></span><b class="num">{arr}</b><small class="ap">{arrc}</small></div>'
            f'<div class="fr-p"><b class="num">{price}</b><small>kişi</small></div><button class="b sec" type="button">Seç</button><div class="fr-m">{t}{s}</div></div>')

def tile(img, brand, bc, name, r1, price, unit, src="", tag="", btn="Seç", on=False):
    s = f'<span class="src">{src}</span>' if src else ""
    t = f'<span class="tag">{tag}</span>' if tag else ""
    o = '<span class="on" aria-label="Planda">✓</span>' if on else ""
    return (f'<div class="tl"><div class="ph"><img src="{img}" alt="">{BR(brand, bc)}{o}</div><div class="tb"><h5>{name}</h5><span class="r">{r1}</span>'
            f'<div class="tf"><span><b class="num">{price}</b> <small>{unit}</small></span><button class="b sec" type="button">{btn}</button></div>{t}{s}</div></div>')

def need(row, extra="", cls=""):
    return f'<article class="nd {cls}"><div class="row">{row}</div>{extra}</article>'

def cat(k, title, cnt, bud, needs, add):
    b = f'<span class="bud">{bud}</span>' if bud else ""
    return (f'<section class="cat" style="--k:var(--c-{k})"><div class="cat-h"><span class="cat-ic">{CAT[k]}</span><div><h2>{title}</h2><span class="cnt">{cnt}</span></div>{b}</div>'
            f'{needs}<button class="cat-add" type="button">+ {add}</button></section>')
MINI = lambda w: f'<span class="mini"><i style="width:{w}%"></i></span>'

# ================= UÇUŞ =================
fl = need(date("NİS", "1", "Per") + niyet("ucus", "Gidiş", "İstanbul → Tokyo", "2 kişi · aktarma az")
        + pick("half", AI_TOP + '<span class="sep">·</span>Turkish Airlines · TK 52', route("İstanbul", "09:40", "Tokyo", "07:15", plus="+1"), "13 sa · direkt · IST → HND", AL("TK", "#c8102e"))
        + act("€905", "kişi · 2 kişi €1.810", BUY, 4, True),
        panel("İstanbul → Tokyo", "1 Nisan · 2 kişi",
              fr("TK", "#c8102e", "13:05", "12 sa 50", "direkt", "10:55⁺¹", "NRT", "€930", f"{LNK}Sohbete attığın link · 12 Eki")
              + fr("JL", "#00205b", "22:30", "16 sa", "1 aktarma", "21:30⁺¹", "HND", "€870", f"{PIN}Pano'dan · skyscanner.com"),
              fr("QR", "#8a1538", "09:40", "15 sa", "1 aktarma", "07:15⁺¹", "HND", "€820", "Doha'da 2 sa", "En ucuz")
              + fr("NH", "#13448f", "21:55", "12 sa 30", "direkt", "18:25⁺¹", "HND", "€960", "Haneda", "En hızlı"),
              2, 2, "linkler ve kayıtlar", "canlı fiyat · 2 sa önce", '<a href="#">Skyscanner ↗</a><a href="#">Google Flights ↗</a>'))
fl += need(date("NİS", "12", "Pzt") + niyet("ucus", "İç hat", "Tokyo → Osaka", "2 kişi")
        + pick("open", "Henüz seçilmedi", '<span class="muted">Tokyo → Osaka uçuşu</span>', 'Kendin ara: <a href="#">Skyscanner ↗</a> · <a href="#">Google Flights ↗</a>')
        + act("~€60–110", "kişi başı", FIND, 0, est=True))
fl += need(date("NİS", "16", "Cum") + niyet("ucus", "Dönüş", "Osaka → İstanbul", "2 kişi")
        + pick("done", "Rezerve<span class=\"sep\">·</span>Turkish Airlines · TK 49", route("Osaka", "11:00", "İstanbul", "17:40"), "15 sa · direkt · bilet PDF'i eklendi", AL("TK", "#c8102e"))
        + act("€790", "kişi · 2 kişi €1.580", DONE("Bilet alındı"), 5), cls="bought")
FL = cat("fly", "Uçuş", "1 alındı · 1 seçildi · 1 bekliyor", MINI(45) + '<b class="num">€3.390</b> / €3.500', fl, "Uçuş ekle")

# ================= KONAKLAMA =================
st = need(date("NİS", "2", "Cum", "5 Nis") + niyet("otel", "Konaklama", "Tokyo", "3 gece · 2 kişi · sakin")
        + pick("half", AI_TOP + '<span class="sep">·</span>' + BR("Booking.com", "#003b95") + "9,0 · Ginza", "Hyatt Centric Ginza", '<span class="ok">Ücretsiz iptal · 30 Mart\'a kadar</span>', '<img src="{{IMG_PH1}}" alt="">')
        + act("€213", "gece · 3 gece €640", BUY, 4))
st += need(date("NİS", "5", "Pzt", "9 Nis") + niyet("otel", "Konaklama", "Kyoto", "4 gece · 2 kişi · merkez")
        + pick("open", "Henüz seçilmedi", "<span class=\"muted\">4 aday Pano'da</span>", "2'si senin, 2'si AI'dan · aşağıda karşılaştır", "")
        + act("~€120–300", "gece", FIND, 4, True, est=True),
        panel("Kyoto · 4 gece", "5–9 Nisan · 2 kişi",
              '<div class="tls">' + tile("{{IMG_PH2}}", "Booking.com", "#003b95", "Hotel Kanra Kyoto", "9,2 · Shimogyo · ücretsiz iptal", "€230", "/ gece", f"{LNK}Sohbete attığın link")
              + tile("{{IMG_PH6}}", "Booking.com", "#003b95", "Ryokan Yachiyo", "9,0 · Nanzen-ji · ücretsiz iptal", "€260", "/ gece", f"{PIN}Pano'dan") + '</div>',
              '<div class="tls">' + tile("{{IMG_PH3}}", "Airbnb", "#d6325f", "Gion Machiya, tüm ev", "★ 4,8 · Gion · iade yok", "€140", "/ gece", tag="En ucuz")
              + tile("{{IMG_PH1}}", "Booking.com", "#003b95", "Sakura Terrace", "8,7 · istasyona 4 dk", "€125", "/ gece", tag="İstasyona yakın") + '</div>',
              2, 2, "sohbetten ve Pano'dan", "sakin, merkeze yakın", '<a href="#">Booking.com ↗</a><a href="#">Airbnb ↗</a>'))
st += need(date("NİS", "9", "Cum", "12 Nis") + niyet("otel", "Konaklama", "Hakone", "3 gece · 2 kişi · onsen")
        + pick("done", "Rezerve<span class=\"sep\">·</span>" + BR("Booking.com", "#003b95") + "9,5 · Gora", "Gora Kadan", "Onay e-postası eklendi", '<img src="{{IMG_PH3}}" alt="">')
        + act("€300", "gece · 3 gece €900", DONE("Rezerve"), 3), cls="bought")
st += need(date("NİS", "12", "Pzt", "16 Nis") + niyet("ev", "Konaklama", "Osaka", "4 gece · 2 kişi")
        + pick("arr", "Ayarlandı", "Arkadaşın evi", "Sen hallettin · rezervasyon gerekmez")
        + act("Ücret yok", "", ARR, 0, est=True))
ST = cat("stay", "Konaklama", "1 alındı · 1 seçildi · 1 ayarlandı · 1 bekliyor", MINI(40) + '<b class="num">€1.540</b> / €3.600', st, "Konaklama ekle")

# ================= ULAŞIM =================
mv = need(date("NİS", "2", "Cum") + niyet("taksi", "Transfer", "Haneda → otel", "inişten sonra")
        + pick("done", "Alındı<span class=\"sep\">·</span>Keikyu", route("Haneda", "08:10", "Ginza", "08:50", TRAIN), "~40 dk · Suica ile")
        + act("€8", "kişi", DONE("Alındı"), 1), cls="bought")
mv += need(date("NİS", "9", "Cum") + niyet("tren", "Şehir değişimi", "Kyoto → Hakone", "2 kişi · bagajlı")
        + pick("half", AI_TOP + '<span class="sep">·</span>' + BR("JR", "#2a7a46") + "Shinkansen + Romancecar", route("Kyoto", "08:30", "Hakone", "12:15", TRAIN, stop=True), "3 sa 45 · Odawara'da aktarma")
        + act("€60", "kişi · 2 kişi €120", BUY, 2))
MV = cat("move", "Ulaşım", "1 alındı · 1 seçildi", MINI(60) + '<b class="num">€136</b> / €300', mv, "Ulaşım ekle")

# ================= ETKİNLİK: seçili = planda olanlar =================
def chip(img, name, when, st):
    r = ring(st)
    return f'<span class="cp"><img src="{img}" alt=""><span><b>{name}</b><small>{r}{when}</small></span></span>'
ex = need(date("NİS", "2", "Cum", "5 Nis") + niyet("act", "Etkinlik", "Tokyo", "kültür · akşam")
        + f'<div class="pk multi"><div class="tx"><span class="l1">{ring("half")}Planda 2</span><div class="cps">'
          + chip("{{IMG_PH4}}", "teamLab Planets", "3 Nis · 19:00", "half") + chip("{{IMG_PH5}}", "Shibuya Sky", "4 Nis · 17:30", "done") + '</div></div></div>'
        + act("€96", "2 kişi · 1'i alındı", BUY, 4, True),
        panel("Tokyo · etkinlik", "2–5 Nisan · 2 kişi",
              '<div class="tls">' + tile("{{IMG_PH4}}", "Viator", "#0b7a6f", "Sumo antrenmanı izleme", "★ 4,7 · sabah", "€70", "kişi", f"{LNK}Sohbete attığın link", btn="+ Plana")
              + tile("{{IMG_PH5}}", "Klook", "#ff5b00", "Robot restoran gösterisi", "★ 4,2 · akşam", "€45", "kişi", f"{PIN}Pano'dan", btn="+ Plana") + '</div>',
              '<div class="tls">' + tile("{{IMG_PH5}}", "Viator", "#0b7a6f", "Asakusa gece yemek turu", "★ 4,9 · 3 sa", "€85", "kişi", tag="Çok sevilen", btn="+ Plana")
              + tile("{{IMG_PH4}}", "Klook", "#ff5b00", "Ghibli Müzesi", "★ 4,8 · bilet erken biter", "€8", "kişi", tag="Erken al", btn="+ Plana") + '</div>',
              2, 2, "linkler ve kayıtlar", "senin tarzına göre", '<a href="#">Viator ↗</a><a href="#">Klook ↗</a>'))
EX = cat("exp", "Etkinlik ve turlar", "2 planda · 1 bileti alındı", '<b class="num">€192</b> / €400', ex, "Etkinlik ekle")

td = need(date("NİS", "5", "Pzt", "9 Nis") + niyet("todo", "Yapılacak · yemek", "Kyoto", "yürüyüş · yerel yemek")
        + f'<div class="pk multi"><div class="tx"><span class="l1">{ring("half")}Planda 2</span><div class="cps">'
          + chip("{{IMG_PH7}}", "Fushimi Inari", "6 Nis · sabah 7", "half") + chip("{{IMG_PH8}}", "Nishiki pazarı", "7 Nis · öğle", "half") + '</div></div></div>'
        + act("ücretsiz", "yer ayırtma yok", '<button class="b sec" type="button">Haritada aç</button>', 5))
TD = cat("todo", "Yapılacaklar ve restoranlar", "2 planda · Pano'da 5", "", td, "Yer ekle")

dc = need(date("NİS", "1", "Per", "16 Nis") + niyet("esim", "İnternet", "Japonya eSIM", "16 gün · 2 telefon")
        + pick("half", AI_TOP + '<span class="sep">·</span>Airalo', "Moshi Moshi · 10 GB", "30 gün geçerli", '<span class="lg2">airalo</span>')
        + act("$32", "2 telefon", BUY, 3))
dc += need(date("NİS", "1", "Per", "16 Nis") + niyet("sigorta", "Sigorta", "Seyahat sağlık", "16 gün · 2 kişi")
        + pick("open", "Henüz seçilmedi", '<span class="muted">Sağlık sigortası</span>', 'Kendin ara: <a href="#">SafetyWing ↗</a>')
        + act("~€34", "kişi başı", FIND, 0, est=True))
DC = cat("doc", "Belgeler ve internet", "vize gerekmiyor · 1 seçildi · 1 bekliyor", "", dc, "Belge ekle")

# ---------- CSS ----------
css = r'''
.plan{padding-block:24px 80px;padding-inline:28px;display:grid;gap:16px;align-content:start;max-width:1000px;width:100%;container:panel / inline-size}
.lnd{width:34px;height:34px;border-radius:8px;background-size:contain;background-repeat:no-repeat;background-position:center;background-color:var(--sunk);flex:none}
/* kategori */
.cat{background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);overflow:hidden}
.cat-h{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--hair)}
.cat-ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;color:var(--k);background:color-mix(in srgb,var(--k) 13%,transparent)}
.cat-h h2{font-size:16px;letter-spacing:-.01em}.cat-h .cnt{display:block;color:var(--muted);font-size:12px}
.cat-h .bud{margin-left:auto;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted)}.cat-h .bud b{color:var(--ink);font-size:13.5px}
.mini{width:64px;height:4px;border-radius:99px;background:var(--hair);overflow:hidden}.mini i{display:block;height:100%;background:var(--ok-solid)}
.cat-add{display:block;width:100%;text-align:left;border:0;border-top:1px solid var(--hair);background:none;color:var(--muted);font-size:12px;font-weight:600;padding:10px 16px}

/* ===== satır: tek ızgara, üç çizgi (18 · 24 · 18) ===== */
.nd{border-top:1px solid var(--hair)}.nd:first-of-type{border-top:0}
.row{display:grid;grid-template-columns:52px 212px minmax(0,1fr) 196px;column-gap:14px;align-items:center;padding:12px 16px}
.l1,.l2,.l3{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.l1{height:18px;line-height:18px;font-size:12px}
.l2{height:24px;line-height:24px;font-size:16px;font-weight:700;letter-spacing:-.01em}
.l3{height:18px;line-height:18px;font-size:12px;color:var(--muted)}
/* tarih */
.dt{display:grid;justify-items:center;text-align:center}
.dt .mo{font-weight:800;letter-spacing:.05em;color:var(--k);font-size:11px}
.dt .d{font-size:22px;font-weight:800}
.dt .wd{font-size:11.5px}
.dt .to{font-size:10.5px;color:var(--faint);line-height:12px;margin-top:-2px}
/* niyet */
.ny{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:center;min-width:0}
.ill{width:44px;height:44px;border-radius:12px;background-color:color-mix(in srgb,var(--k) 10%,var(--surface));background-size:38px;background-repeat:no-repeat;background-position:center;background-blend-mode:multiply}
.ny .k{color:var(--k);font-weight:650}
.tx{min-width:0}
/* seçili: ayrı kart değil, satırın ortasında tonlu şerit; çizgileri niyetle aynı */
.pk{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center;min-width:0;border-radius:14px;padding:8px 12px;margin:-8px 0;min-height:76px}
.pk:not(:has(.th)){grid-template-columns:minmax(0,1fr)}
.pk.half{background:var(--v-plan-bg);box-shadow:inset 0 0 0 1px var(--v-plan-line)}
.pk.done{background:var(--v-book-bg);box-shadow:inset 0 0 0 1px var(--v-book-line)}
.pk.arr{background:var(--sunk);box-shadow:inset 0 0 0 1px var(--line)}
.pk.open{background:var(--surface);box-shadow:none;outline:1.5px dashed var(--v-dash);outline-offset:-1.5px}
.pk .l1{display:flex;align-items:center;gap:6px;color:var(--muted)}
.pk .l1 .sep{color:var(--faint)}
.pk .ai{color:var(--v-accent-ink);font-weight:700}
.pk.done .l1{color:var(--v-book-ink);font-weight:600}
.pk .muted{color:var(--muted);font-weight:600}
.th{width:60px;height:46px;border-radius:10px;overflow:hidden;display:grid;place-items:center;background:#fff}
.th img{width:100%;height:100%;object-fit:cover;display:block}
.th .al{width:36px;height:36px;border-radius:10px;font-size:12px}
.lg2{width:60px;height:46px;display:grid;place-items:center;background:#16151c;color:#fff;font-weight:800;font-size:13px;letter-spacing:-.02em}
.rg{flex:none;width:14px;height:14px;border-radius:50%;display:inline-grid;place-items:center}
.rg.half{border:2px solid var(--v-plan-dot)}.rg.open{border:1.5px dashed var(--v-dash)}
.rg.done{background:var(--v-book-ink);color:#fff}.rg.arr{background:#8a879e;color:#fff}
.rg svg{width:9px;height:9px}
.br{display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:5px;color:#fff;background:var(--bc);font-size:10.5px;font-weight:700}
.al{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:8px;color:#fff;font-size:10.5px;font-weight:800;background:var(--alc);flex:none}
/* canlıdaki bilet, tek çizgiye sığan hali: şehir saat ⌒✈⌒ saat şehir */
.rt{display:grid;grid-template-columns:auto auto minmax(56px,1fr) auto auto;align-items:center;gap:8px;height:24px}
.rt b{font-size:16px;font-weight:750}
.rt time{font-size:14px;font-weight:600;color:var(--ink)}
.rt sup{font-size:9.5px;font-weight:800;color:var(--v-accent-ink);margin-left:1px}
.rt-arc{position:relative;height:22px;color:var(--mc,#6a4fe0)}
.rt-arc svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rt-arc path{fill:none;stroke:currentColor;stroke-width:1.5;stroke-dasharray:3 4;stroke-linecap:round;opacity:.6}
.rt-a,.rt-b{position:absolute;top:86%;width:6px;height:6px;border-radius:50%;background:currentColor;transform:translate(-50%,-50%)}
.rt-a{left:2%}.rt-b{left:98%;background:#fff;border:1.5px solid currentColor}
.rt-stop{position:absolute;left:50%;top:22%;width:7px;height:7px;border-radius:50%;background:#fff;border:1.5px solid currentColor;transform:translate(-50%,-50%)}
.rt-pl{position:absolute;left:50%;top:22%;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.14);transform:translate(-50%,-50%) rotate(-6deg)}
.rt:has(.rt-stop) .rt-pl{left:30%}
.cat[style*="move"] .rt-arc{--mc:#b5761c}
/* çoklu seçili (etkinlik, yer) */
.pk.multi .l1{margin-bottom:4px}
.cps{display:flex;gap:8px;min-width:0}
.cp{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 0;background:#fff;border-radius:10px;padding:4px 10px 4px 4px;box-shadow:0 0 0 1px var(--v-plan-line)}
.cp img{width:40px;height:40px;border-radius:7px;object-fit:cover;flex:none}
.cp>span{min-width:0}.cp b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp small{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);white-space:nowrap}
.cp .rg{width:11px;height:11px}.cp .rg svg{width:7px;height:7px}
.pk.multi{min-height:76px;align-content:center}
/* eylem: fiyat + iki düğme yan yana, hep aynı yer ve boy */
.ac{display:grid;gap:8px;align-content:center}
.pr{display:flex;align-items:baseline;gap:6px;height:24px;white-space:nowrap}
.pr b{font-size:18px;letter-spacing:-.02em}.pr small{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis}
.pr.est b{font-size:15px;color:var(--muted);font-weight:650}
.bt{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.b{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:32px;padding:0 8px;border-radius:9px;font-size:12px;font-weight:650;white-space:nowrap;border:0}
.b.pri{background:var(--accent);color:var(--on-accent)}
.b.sec{background:var(--surface);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.b.ok{background:var(--v-book-bg);color:var(--v-book-ink);box-shadow:inset 0 0 0 1px var(--v-book-line)}
.b.arr{background:var(--sunk);color:var(--muted)}
.b svg{width:12px;height:12px}
.tg{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:32px;border-radius:9px;border:0;background:var(--sunk);color:var(--ink);font-size:12px;font-weight:650;box-shadow:inset 0 0 0 1px var(--line)}
.tg svg{transition:transform .2s}
.tg.on{background:var(--ink);color:var(--surface);box-shadow:none}.tg.on svg{transform:rotate(180deg)}
@media (prefers-reduced-motion:reduce){.tg svg{transition:none}}

/* ===== Pano paneli: satırın altında geniş; solda senin, sağda AI ===== */
.pp{margin:0 16px 14px;border-radius:16px;background:var(--sunk);box-shadow:inset 0 0 0 1px var(--line);overflow:hidden}
.pp-h{display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:13px}
.pp-h b{font-size:13px;background:var(--ink);color:var(--surface);border-radius:6px;padding:1px 7px;font-size:11.5px}
.pp-h span{font-weight:700}.pp-h small{color:var(--muted);font-size:12px}
.pp-h .x{margin-left:auto;border:0;background:none;color:var(--muted);font-size:12px}
.pp-b{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 10px 10px}
.side{background:var(--surface);border-radius:12px;box-shadow:0 0 0 1px var(--line);display:flex;flex-direction:column;min-width:0}
.sd-h{display:flex;align-items:center;gap:7px;padding:10px 12px 8px}
.sd-h b{font-size:13px}.sd-h small{color:var(--muted);font-size:11.5px;margin-left:auto;white-space:nowrap}
.sd-ic{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font-size:11px}
.side.me .sd-ic{background:#fff1dc;color:#9a5b00}.side.ai .sd-ic{background:var(--accent-soft);color:var(--accent)}
.side.me{box-shadow:0 0 0 1px #f0d9b5}
.n{min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:var(--sunk);color:var(--muted);font-size:11px;font-weight:700;display:inline-grid;place-items:center}
.sd-f{margin-top:auto;display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid var(--hair);font-size:11.5px;color:var(--muted)}
.sd-f .more{border:0;background:none;padding:0;color:var(--accent);font-weight:650;font-size:12px}
.sd-f .kd{margin-left:auto;display:flex;gap:8px;white-space:nowrap}
.side.me .sd-f svg{color:#9a5b00}
.empty{padding:14px 12px;color:var(--muted);font-size:12.5px}
/* uçuş satırı (Skyscanner gibi, yarım genişliğe sığar) */
.fr{display:grid;grid-template-columns:28px minmax(0,1fr) 62px 52px;column-gap:10px;row-gap:2px;align-items:center;padding:8px 12px;border-top:1px solid var(--hair)}
.fr-t{display:grid;grid-template-columns:auto minmax(40px,1fr) auto auto;align-items:center;gap:6px}
.fr-t b{font-size:14.5px}.fr-t .ap{font-size:11px;color:var(--muted)}
.lg{display:grid;justify-items:center;line-height:1.1}.lg i{display:block;width:100%;height:1px;background:var(--line);margin:2px 0}
.lg small{font-size:10.5px;color:var(--muted)}
.fr-p{text-align:right;line-height:1.1}.fr-p b{font-size:14.5px}.fr-p small{display:block;font-size:10.5px;color:var(--muted)}
.fr .b{height:28px;padding:0 10px}
.fr-m{grid-column:2/-1;display:flex;align-items:center;gap:6px;min-width:0;font-size:11px;color:var(--muted)}
.src{display:inline-flex;align-items:center;gap:4px;color:#9a5b00;font-weight:600;font-size:11px;white-space:nowrap}
.tag{display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:99px;background:var(--accent-soft);color:var(--accent);font-size:10.5px;font-weight:700;white-space:nowrap}
/* fotoğraflı kutular: her tarafta iki tane */
.tls{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 12px 12px}
.tl{border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px var(--line);display:flex;flex-direction:column;background:var(--surface)}
.tl .ph{position:relative;aspect-ratio:16/10;background:var(--sunk)}
.tl .ph img{width:100%;height:100%;object-fit:cover;display:block}
.tl .ph .br{position:absolute;left:7px;top:7px}
.tl .ph .on{position:absolute;right:7px;bottom:7px;width:22px;height:22px;border-radius:50%;background:var(--ok-solid);color:#fff;display:grid;place-items:center;font-size:12px}
.tb{padding:8px 10px 10px;display:flex;flex-direction:column;gap:2px;flex:1}
.tb h5{font-size:13px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb .r{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tf{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px}
.tf b{font-size:14px}.tf small{font-size:10.5px;color:var(--muted)}
.tf .b{height:28px;padding:0 10px}
.tb .tag,.tb .src{align-self:flex-start;margin-top:6px}
.nd.open-row{background:color-mix(in srgb,var(--sunk) 40%,var(--surface))}
.ok{color:var(--ok)}

/* özet ve plan çubuğu ayarları (v75'ten) */
.hx .hx-cities button{padding:0 13px;font-size:15px}
@container hxleft (max-width:580px){.hx .hx-cities button{padding:0 9px;font-size:14px}}
.hx-progress-head{flex-wrap:wrap}
.hx-progress-head>b{flex-basis:100%}
.vs{display:inline-flex;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:3px}
.vs button{border:0;background:none;color:var(--muted);font-size:12px;font-weight:600;padding:6px 11px;border-radius:8px}
.vs button[aria-pressed="true"]{background:var(--sunk);color:var(--ink)}
.tl .ph{aspect-ratio:2/1}

.pk{container-type:inline-size}
.rt{gap:6px;grid-template-columns:auto auto minmax(36px,1fr) auto auto}
@container (max-width:400px){.pk>.th:has(.al){display:none}}
@container (max-width:300px){.rt time{display:none}}
@media(max-width:1180px){.row{grid-template-columns:52px 190px minmax(0,1fr) 184px}}
@media(max-width:980px){.shell{grid-template-columns:1fr}.chat{position:static;height:auto}.plan{padding-inline:16px}.pp-b{grid-template-columns:1fr}}
@media(max-width:680px){.row{grid-template-columns:44px minmax(0,1fr);row-gap:10px}.pk,.ac{grid-column:1/-1}.pk{margin:0}}
'''
# görseller bir kez: CSS arka planı
imgs = {"ucus": "IMG_UCUS", "otel": "IMG_OTEL", "ev": "IMG_EV", "taksi": "IMG_TAKSI", "tren": "IMG_TREN", "act": "IMG_ACT", "todo": "IMG_TODO", "esim": "IMG_ESIM", "sigorta": "IMG_SIGORTA"}
img_css = "".join(f'.i-{k}{{background-image:url("{V[v]}")}}\n' for k, v in imgs.items())
img_css += ".jc{background-size:34px;background-repeat:no-repeat;background-position:center;background-blend-mode:multiply}\n"

body = ('<div class="shell">\n' + chat + '\n<main class="plan">\n' + hero + FL + ST + MV + EX + TD + DC + '\n</main>\n</div>')
page = ("<title>Trip Radar Plan v76</title>\n<style>\n" + base_css + "\n/* canlı uygulamadan (0.37.1): özet */\n" + livecss + "\n" + v75css + "\n" + css + img_css + "</style>\n" + body)
# kapalı satırlar: Pano düğmesindeki sayı; açık satırın zemini
page = page.replace('<article class="nd "><div class="row">', '<article class="nd"><div class="row">')
open(f"{D}/src.html", "w").write(page)
out = re.sub(r"\{\{([A-Z_0-9]+)\}\}", lambda m: V[m.group(1)], page)
assert not re.findall(r"\{\{[A-Z_0-9]+\}\}", out)
open(f"{S}/plan-v76.html", "w").write(out)
print("ok", len(out))
