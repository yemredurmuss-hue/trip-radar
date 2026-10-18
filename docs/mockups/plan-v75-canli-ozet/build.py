# v75: v74 + canlı özet (hx) + canlı bilet (pk-card) + seçeneklerde "Senin bulduğun / AI önerileri" grupları + hizalama.
import json, re, os
D = os.path.dirname(os.path.abspath(__file__))
S = os.path.dirname(D)
src = open(f"{S}/v74/src.html").read()
vals = json.load(open(f"{S}/v74/vals.json"))
live = json.load(open("/tmp/v31live/livedump.json"))
livecss = open("/tmp/v31live/live-sub.css").read()

def must(old, new, s, count=1):
    assert old in s, old[:90]
    return s.replace(old, new, count)

src = must("<title>Trip Radar Plan v74</title>", "<title>Trip Radar Plan v75</title>", src)

# ---------- 1) Üst özet: canlıdaki hx, Japonya verisiyle ----------
h = live["hero"]
h = re.sub(r'<img alt="Porto"[^>]*>', '<img alt="Tokyo" class="on" src="{{IMG_COVER}}">', h)
h = re.sub(r'<img alt="Lizbon"[^>]*>', '', h)
h = re.sub(r'(<div class="hx-cities"[^>]*>).*?(</div>)',
           lambda m: m.group(1) + '<button type="button" class="on">Tokyo</button><button type="button" class="">Kyoto</button><button type="button" class="">Hakone</button><button type="button" class="">Osaka</button>' + m.group(2), h, flags=re.S)
h = re.sub(r'(<span class="hx-credit-text">).*?(</span>)', r'\1Fotoğraf: örnek görsel\2', h, flags=re.S)
rep = [
    ("3 gün kaldı", "175 gün kaldı"), ("Portekiz (örnek)", "Japonya"), ("8–14 Ekim", "1–16 Nisan"), ("7 gün", "16 gün"),
    ("2 uçuş", "3 uçuş"), ("2 konaklama", "4 konaklama"), ("1 ulaşım", "2 ulaşım"), ("5 deneyim", "4 deneyim"),
    ("6 ihtiyaç karar bekliyor", "3 ihtiyaç karar bekliyor"), ("2 rezerve edilecek", "4 rezerve edilecek"),
    ("€1.500", "€9.000"), ("€552", "€3.240"), ("€56", "€2.410"), ("€892", "€3.350"), ("~€1.050", "~€8.100"),
    ("bütçeye sığar · €450 pay", "bütçeye sığar · €900 pay"),
    ("🇵🇹", "🇯🇵"), (">Portekiz<", ">Japonya<"), (">Porto<", ">Tokyo<"), (">Lizbon<", ">Kyoto<"), (">22°<", ">16°<"), (">27°<", ">17°<"),
    ("Euro", "Yen"), ("C/F priz", "A/B priz"), ("−2 saat", "+6 saat"), ("Portekizce", "Japonca"),
]
for a, b in rep:
    assert a in h, a
    h = h.replace(a, b)
h = re.sub(r'(<ul class="hx-ptags"[^>]*>).*?(</ul>)', r'\1<li class="hx-ptag">Sakin yerler</li><li class="hx-ptag">Tren</li>\2', h, flags=re.S)
h = h.replace('href="https://www.wikipedia.org/"', 'href="#"')
tabs = '<div class="view-tabs vt" role="tablist" aria-label="Görünüm"><button type="button" role="tab" aria-selected="true" class="on">Plan</button><button type="button" role="tab" aria-selected="false" class="">Pano<span class="tab-n" aria-hidden="true">16</span></button></div>'
pbar = '''<div class="pbar"><b>Plan</b><div class="vs" role="group" aria-label="Görünüm"><button type="button" aria-pressed="true">Kategoriye göre</button><button type="button" aria-pressed="false">Yolculuk sırasıyla</button><button type="button" aria-pressed="false">Gün gün</button></div><span class="lg"><i class="l1"></i>Arıyoruz<i class="l2"></i>Seçildi<i class="l3"></i>Rezerve</span></div>
  <ol class="jr" aria-label="Rota">
    <li class="j ok"><span class="jc"><img src="{{IMG_UCUS}}" alt=""></span><b>İstanbul</b><small>1 Nis</small></li>
    <li class="jl"><span>13 sa</span></li>
    <li class="j half"><span class="jc"><img src="{{IMG_OTEL}}" alt=""></span><b>Tokyo</b><small>3 gece</small></li>
    <li class="jl"><span>2 sa 15</span></li>
    <li class="j open"><span class="jc"><img src="{{IMG_OTEL}}" alt=""></span><b>Kyoto</b><small>4 gece</small></li>
    <li class="jl"><span>3 sa 45</span></li>
    <li class="j ok"><span class="jc"><img src="{{IMG_OTEL}}" alt=""></span><b>Hakone</b><small>3 gece</small></li>
    <li class="jl"><span>1 sa 10</span></li>
    <li class="j ok"><span class="jc"><img src="{{IMG_EV}}" alt=""></span><b>Osaka</b><small>4 gece</small></li>
    <li class="jl"><span>15 sa</span></li>
    <li class="j ok"><span class="jc"><img src="{{IMG_UCUS}}" alt=""></span><b>İstanbul</b><small>16 Nis</small></li>
  </ol>'''
src = re.sub(r'  <!-- ÜST ÖZET -->.*?</section>\s*<div class="views">.*?</div></div>\n',
             lambda m: "  <!-- ÜST ÖZET: canlıdaki özet (hx) -->\n  " + tabs + "\n  " + h + "\n  " + pbar + "\n", src, count=1, flags=re.S)

# ---------- 2) Bilet: canlıdaki pk-card ----------
PL = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" transform="rotate(90 12 12)" d="M21 15.5v-1.8l-7.5-4.6V4a1.5 1.5 0 0 0-3 0v5.1L3 13.7v1.8l7.5-2.3V18l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-4.8z"></path></svg>'
PLB = PL.replace('width="15" height="15"', 'width="18" height="18"')
TR = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9" cy="14" r=".8" fill="currentColor"/><circle cx="15" cy="14" r=".8" fill="currentColor"/></g></svg>'
TRB = TR.replace('width="15" height="15"', 'width="18" height="18"')
CHK = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"></path></g></svg>'
DOTS = '<span class="pk-menu-wrap"><button type="button" class="pk-ib" aria-label="Kart menüsü"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="5.5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="18.5" cy="12" r="1.8"></circle></g></svg></button></span>'

def ticket(tone, ring, kind_ic, kind, date, lab, a, a_sub, b, b_sub, dur, foot, mc="#6a4fe0", stop=False, big=PLB):
    ringc = {"half": "", "done": CHK, "open": ""}[ring]
    st = '<span class="pk-arc-stop"></span>' if stop else ""
    return (f'<article class="pk-card {tone} pk-r-{ring}" style="--mc:{mc}">'
            f'<div class="pk-top"><span class="pk-ring {ring}">{ringc}</span><span class="pk-kind">{kind_ic}{kind}</span><span class="pk-date">· {date}</span>'
            f'<span class="pk-end">{lab}{DOTS}</span></div>'
            f'<div class="pk-body"><div class="pk-mid"><div class="pk-stop"><b>{a}</b><span>{a_sub}</span></div>'
            f'<div class="pk-route"><span class="pk-arc" aria-hidden="true"><svg viewBox="0 0 160 44" preserveAspectRatio="none"><path d="M4 40 Q80 -8 156 40" vector-effect="non-scaling-stroke"></path></svg><i class="pk-arc-a"></i><i class="pk-arc-b"></i>{st}<span class="pk-arc-pl">{big}</span></span><small>{dur}</small></div>'
            f'<div class="pk-stop r"><b>{b}</b><span>{b_sub}</span></div></div></div>'
            f'<div class="pk-foot">{foot}</div></article>')

AI = '<span class="pk-lab ai">✦ AI seçti</span>'
# gidiş: AI seçti
src = re.sub(r'<div class="meta"><span class="st ai">✦ AI seçti</span><span>Turkish Airlines · TK 52</span></div>\s*<div class="tk">.*?<div class="c r">.*?</small></div></div>',
    lambda m: ticket("", "half", PL, "Uçuş", "1 Nisan · TK 52", AI, "İstanbul", 'IST · <strong>09:40</strong>', "Tokyo", 'HND · <strong>07:15</strong><sup class="pk-plus">+1</sup>', "13 sa · direkt",
                     '<span class="pk-state plain">Turkish Airlines<span class="pk-when"> · Skyscanner fiyatı · 2 saat önce</span></span>'), src, count=1, flags=re.S)
# dönüş: alındı
src = re.sub(r'<div class="meta"><span>Turkish Airlines · TK 49</span></div>\s*<div class="tk">.*?<div class="c r">.*?</small></div></div>',
    lambda m: ticket("pk-green pk-booked", "done", PL, "Uçuş", "16 Nisan · TK 49", '', "Osaka", 'KIX · <strong>11:00</strong>', "İstanbul", 'IST · <strong>17:40</strong>', "15 sa · direkt",
                     '<span class="pk-state plain">Turkish Airlines<span class="pk-when"> · bilet PDF\'i eklendi</span></span>'), src, count=1, flags=re.S)
# iç hat: boş, canlıdaki "arıyoruz" kartı
src = must('<div class="sel"><div class="meta"><span>Henüz seçilmedi</span></div><h4 class="muted">Tokyo\'dan Osaka\'ya uçuş</h4><div class="ln">Kendin ara: <a href="#">Skyscanner ↗</a> · <a href="#">Google Uçuşlar ↗</a> · ya da linki sohbete bırak</div></div>',
    '<div class="sel"><article class="pk-card pk-r-open"><div class="pk-top"><span class="pk-ring open"></span><span class="pk-kind">' + PL + 'Uçuş</span><span class="pk-date">· 12 Nisan</span><span class="pk-end"><span class="pk-lab open">Henüz seçilmedi</span>' + DOTS + '</span></div>'
    '<div class="pk-body"><div class="pk-mid"><div class="pk-stop"><b>Tokyo</b><span>HND</span></div><div class="pk-route"><img class="pk-routeimg" alt="" src="{{IMG_UCUS}}"></div><div class="pk-stop r"><b>Osaka</b><span>ITM · KIX</span></div></div></div>'
    '<div class="pk-foot"><span class="ek-find"><span class="ek-ara">Kendin ara</span><a class="ek-link" href="#"><span class="ek-lg" style="background:#4285f4">G</span><span class="ek-nm">Google Flights<span class="ek-up"> ↗</span></span></a><a class="ek-link" href="#"><span class="ek-lg" style="background:#0062e3">S</span><span class="ek-nm">Skyscanner<span class="ek-up"> ↗</span></span></a><a class="ek-link" href="#"><span class="ek-lg" style="background:#ff690f">K</span><span class="ek-nm">Kayak<span class="ek-up"> ↗</span></span></a></span><span class="pk-hint">ya da linki sohbete bırak</span></div></article></div>', src)
# tren: AI seçti, aktarmalı
src = re.sub(r'<div class="meta"><span class="st ai">✦ AI seçti</span><span class="brand" style="--bc:#2a7a46">JR</span><span>Shinkansen \+ Romancecar</span></div>\s*<div class="tk">.*?<div class="c r">.*?</small></div></div>',
    lambda m: ticket("", "half", TR, "Tren", "9 Nisan · JR", AI, "Kyoto", '<strong>08:30</strong>', "Hakone", '<strong>12:15</strong>', "3 sa 45 · Odawara'da aktarma",
                     '<span class="pk-state plain">Shinkansen + Romancecar<span class="pk-when"> · JR Pass geçerli değil</span></span>', mc="#b5761c", stop=True, big=TRB), src, count=1, flags=re.S)

# ---------- 3) Seçenekler: Senin bulduğun / AI önerileri ----------
ME = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></g></svg>'
PIN = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3h12v18l-6-4-6 4z"/></svg>'
LNK = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></g></svg>'

def fo(code, col, dep, dur, legtxt, arr, arrc, meta, price, tag=""):
    t = f'<span class="tag">{tag}</span>' if tag else ""
    return (f'<div class="fo"><span class="al" style="--alc:{col}">{code}</span><div class="fo-t"><div><b class="num">{dep}</b><small>IST</small></div>'
            f'<div class="leg"><span>{dur}</span><i></i><span>{legtxt}</span></div><div><b class="num">{arr}</b><small>{arrc}</small></div></div>'
            f'<div class="fo-m">{t}{meta}</div><div class="fo-p"><b class="num">{price}</b><small>kişi başı</small></div><button class="b sec" type="button">Seç</button></div>')

def grp(kind, title, n, sub, body, cls=""):
    ic = ME if kind == "me" else '<span aria-hidden="true">✦</span>'
    return (f'<section class="og {kind} {cls}"><div class="og-h"><span class="og-ic">{ic}</span><b>{title}</b><span class="og-n">{n}</span><small>{sub}</small></div>{body}</section>')

fl_me = (fo("TK", "#c8102e", "13:05", "12 sa 50", "direkt", '10:55<sup>+1</sup>', "NRT", f'<span class="from">{LNK}Sohbete attığın link · 12 Eki</span>', "€930")
         + fo("JL", "#00205b", "22:30", "16 sa", "1 aktarma", '21:30<sup>+1</sup>', "HND", f'<span class="from">{PIN}Pano\'dan · skyscanner.com</span>', "€870"))
fl_ai = (fo("QR", "#8a1538", "09:40", "15 sa", "1 aktarma", '07:15<sup>+1</sup>', "HND", "Qatar · Doha'da 2 sa", "€820", "En ucuz")
         + fo("NH", "#13448f", "21:55", "12 sa 30", "direkt", '18:25<sup>+1</sup>', "HND", "ANA · Haneda", "€960", "En hızlı"))
new_fl = ('<div class="opts">\n        <div class="opts-h"><b>İstanbul → Tokyo · diğer uçuşlar</b><span class="src">1 Nisan · 2 kişi</span><button class="x" type="button">Kapat</button></div>\n        '
          + grp("me", "Senin bulduğun", "2", "sohbete attığın linkler ve Pano'ya kaydettiklerin", fl_me)
          + grp("ai", "AI önerileri", "2", "canlı fiyat · 2 saat önce", fl_ai)
          + '\n        <div class="opts-f"><button class="more" type="button">✦ AI daha fazla bulsun</button><span>Kendin ara:</span><a href="#">Skyscanner ↗</a><a href="#">Google Uçuşlar ↗</a></div>\n      </div>')
src = re.sub(r'<div class="opts">\s*<div class="opts-h"><b>İstanbul → Tokyo için diğer uçuşlar</b>.*?<div class="opts-f">.*?</div>\s*</div>', lambda m: new_fl, src, count=1, flags=re.S)

def hbox(img, brand, bc, name, r1, r2, r2c, price, src_line="", pri=False):
    s = f'<div class="from">{src_line}</div>' if src_line else ""
    btn = "b pri" if pri else "b sec"
    return (f'<div class="box"><div class="ph"><img src="{img}" alt=""><span class="brand" style="--bc:{bc}">{brand}</span></div>'
            f'<div class="bb"><h5>{name}</h5><div class="r">{r1}</div><div class="r {r2c}">{r2}</div>{s}<div class="bf"><span><b class="num">{price}</b> <small>/ gece</small></span><button class="{btn}" type="button">Seç</button></div></div></div>')
st_me = (hbox("{{IMG_PH2}}", "Booking.com", "#003b95", "Hotel Kanra Kyoto", "9,2 · Shimogyo · istasyona 6 dk", "Ücretsiz iptal · 1 Nis'e kadar", "ok", "€230", f'{LNK}Sohbete attığın link', True)
         + hbox("{{IMG_PH6}}", "Booking.com", "#003b95", "Ryokan Yachiyo", "9,0 · Nanzen-ji", "Ücretsiz iptal", "ok", "€260", f'{PIN}Pano\'dan'))
st_ai = (hbox("{{IMG_PH3}}", "Airbnb", "#d6325f", "Gion Machiya, tüm ev", "★ 4,8 · Gion", "İade yok", "no", "€140", '<span class="tag">En ucuz</span>')
         + hbox("{{IMG_PH1}}", "Booking.com", "#003b95", "Sakura Terrace", "8,7 · istasyona 4 dk", "Ücretsiz iptal", "ok", "€125", '<span class="tag">İstasyona en yakın</span>'))
new_st = ('<div class="opts">\n        <div class="opts-h"><b>Kyoto · 4 gece · adaylar</b><span class="src">5–9 Nisan · 2 kişi</span><button class="x" type="button">Kapat</button></div>\n        <div class="og-split">'
          + grp("me", "Senin bulduğun", "2", "sohbetten ve Pano'dan", f'<div class="grid g2">{st_me}</div>')
          + grp("ai", "AI önerileri", "2", "sakin, merkeze yakın", f'<div class="grid g2">{st_ai}</div>')
          + '</div>\n        <div class="opts-f"><button class="more" type="button">✦ AI daha fazla bulsun</button><span>Kendin ara:</span><a href="#">Booking.com ↗</a><a href="#">Airbnb ↗</a></div>\n      </div>')
src = re.sub(r'<div class="opts">\s*<div class="opts-h"><b>Kyoto\'da 4 gece için adaylar</b>.*?<div class="opts-f">.*?</div>\s*</div>', lambda m: new_st, src, count=1, flags=re.S)
src = src.replace('Henüz seçilmedi · 3 aday', 'Henüz seçilmedi · 4 aday')

# Etkinlik/yer kutularında da aynı dil
src = src.replace('<span class="who me">Senin linkin</span>', '<span class="who me">Senin bulduğun</span>').replace('<span class="who ai">AI</span>', '<span class="who ai">✦ AI önerisi</span>')


# ---------- 3b) Uçuş dışındaki seçili/boş satırlar da aynı canlı kart çerçevesinde ----------
BED = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18V7M21 18v-5a3 3 0 0 0-3-3h-8v6M3 15h18"/><circle cx="6.5" cy="11.5" r="1.5"/></g></svg>'
SIM = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><rect x="9.5" y="11" width="6" height="6" rx="1"/></g></svg>'
SHD = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z"/></g></svg>'
def card(ring, kic, kind, date, lab, body, foot=""):
    ringc = CHK if ring in ("done", "arr") else ""
    f = f'<div class="pk-foot">{foot}</div>' if foot else ""
    return (f'<article class="pk-card pk-r-{ring}{" pk-green" if ring == "done" else ""}"><div class="pk-top"><span class="pk-ring {ring}">{ringc}</span><span class="pk-kind">{kic}{kind}</span><span class="pk-date">· {date}</span>'
            f'<span class="pk-end">{lab}{DOTS}</span></div><div class="pk-body">{body}</div>{f}</article>')
def item(thumb, meta, name, sub=""):
    sb = f'<span class="pk-sub">{sub}</span>' if sub else ""
    mt = f'<div class="pk-meta">{meta}</div>' if meta else ""
    return f'<div class="pk-item">{thumb}<div class="pk-tx">{mt}<b class="pk-name">{name}</b>{sb}</div></div>'
def find(*links):
    a = "".join(f'<a class="ek-link" href="#"><span class="ek-lg" style="background:{c}">{l}</span><span class="ek-nm">{n}<span class="ek-up"> ↗</span></span></a>' for l, c, n in links)
    return f'<span class="ek-find"><span class="ek-ara">Kendin ara</span>{a}</span><span class="pk-hint">ya da linki sohbete bırak</span>'
OPEN = '<span class="pk-lab open">Henüz seçilmedi</span>'
def put_sel(key, new):
    global src
    k = src.index(key)
    a = src.rindex('<div class="sel">', 0, k)
    b = src.index('<div class="act">', k)
    src = src[:a] + '<div class="sel">' + new + '</div>\n        ' + src[b:]
put_sel("Hyatt Centric Ginza", card("half", BED, "Konaklama", "2–5 Nisan · 3 gece", AI,
    item('<img class="pk-thumb" src="{{IMG_PH1}}" alt="">', '<span class="brand" style="--bc:#003b95">Booking.com</span><span>9,0 · Ginza</span>', "Hyatt Centric Ginza"),
    '<span class="pk-state okc">Ücretsiz iptal<span class="pk-when"> · 30 Mart\'a kadar</span></span>'))
put_sel("Kyoto'da 4 gece</h4>", card("open", BED, "Konaklama", "5–9 Nisan · 4 gece", OPEN,
    item('<img class="pk-thumb ill" src="{{IMG_OTEL}}" alt="">', "", "Kyoto'da 4 gece", "4 aday hazır: 2'si senin, 2'si AI'dan · aşağıda"),
    find(("B", "#003b95", "Booking.com"), ("A", "#d6325f", "Airbnb"))))
put_sel("Gora Kadan", card("done", BED, "Konaklama", "9–12 Nisan · 3 gece", '',
    item('<img class="pk-thumb" src="{{IMG_PH3}}" alt="">', '<span class="brand" style="--bc:#003b95">Booking.com</span><span>9,5 · Gora</span>', "Gora Kadan"),
    '<span class="pk-state plain">Onay e-postası eklendi</span>'))
put_sel("Arkadaşın evi", card("arr", BED, "Konaklama", "12–16 Nisan · 4 gece", '',
    item('<img class="pk-thumb ill" src="{{IMG_EV}}" alt="">', "", "Arkadaşın evi", "Sen hallettin · rezervasyon gerekmez")))
put_sel("Haneda → Shinagawa → Ginza", ticket("pk-green pk-booked", "done", TR, "Transfer", "2 Nisan · inişten sonra", '', "Haneda", 'HND', "Ginza", 'otel', "~40 dk · Keikyu",
    '<span class="pk-state plain">Keikyu + Asakusa hattı<span class="pk-when"> · Suica ile</span></span>', mc="#b5761c", big=TRB))
put_sel("Moshi Moshi · 10 GB", card("half", SIM, "eSIM", "1–16 Nisan", AI,
    item('<span class="pk-logo2">airalo</span>', '<span>Airalo</span>', "Moshi Moshi · 10 GB", "30 gün geçerli · 2 telefon")))
put_sel("Sağlık sigortası</h4>", card("open", SHD, "Sigorta", "1–16 Nisan", OPEN,
    item('<img class="pk-thumb ill" src="{{IMG_SIGORTA}}" alt="">', "", "Seyahat sağlık sigortası", "Japonya için zorunlu değil, önerilir"),
    find(("S", "#5b2fd6", "SafetyWing"), ("G", "#4285f4", "Google"))))

src = src.replace('<div class="price est"><b>—</b></div>', '<div class="price est"><b>Ücret yok</b></div>')
# ---------- 4) CSS ----------
extra = r'''
/* ===== v75 ===== */
.plan{container:panel / inline-size;gap:16px}
.vt{justify-self:center}
.hx{margin:0}
.pbar{display:flex;align-items:center;gap:14px;margin-top:6px}
.pbar>b{font-size:19px;letter-spacing:-.01em}
.pbar .lg{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.pbar .lg i{width:18px;height:12px;border-radius:4px;margin-left:8px}
.lg .l1{border:1.5px dashed var(--v-dash)}.lg .l2{background:var(--v-plan-bg);border:1px solid var(--v-plan-line)}.lg .l3{background:var(--v-book-bg);border:1px solid var(--v-book-line)}
.jr{list-style:none;margin:0;padding:4px 8px 2px;display:grid;grid-template-columns:auto 1fr auto 1fr auto 1fr auto 1fr auto 1fr auto;align-items:start}
.j{display:grid;justify-items:center;gap:1px;text-align:center;min-width:64px}
.jc{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--surface);border:2px solid var(--v-book-ink);overflow:hidden;margin-bottom:4px}
.jc img{width:34px;height:34px;object-fit:contain;mix-blend-mode:multiply}
.j.half .jc{border-color:var(--v-plan-dot)}.j.open .jc{border:2px dashed var(--v-dash)}
.j b{font-size:13px}.j small{font-size:11.5px;color:var(--muted)}
.jl{position:relative;height:44px;display:grid;place-items:center}
.jl::before{content:"";position:absolute;left:4px;right:4px;top:50%;border-top:1.5px dotted var(--v-dash)}
.jl span{position:relative;background:var(--bg);padding:0 6px;font-size:11.5px;color:var(--muted);margin-top:28px}

/* satır: dört sütun, içerik üstten hizalı, sütun çizgileri tam boy */
.row{grid-template-columns:72px 212px minmax(0,1fr) 172px;align-items:stretch;min-height:0}
.date,.int,.sel,.act{align-content:start;padding-top:16px;padding-bottom:16px}
.date{padding-left:16px;padding-right:0}
.int{align-items:start;padding-left:14px;padding-right:14px}
.int>div{padding-top:1px}
.sel{padding-left:16px;padding-right:16px;gap:6px}
.act{padding-left:16px;padding-right:16px}
.row.wide .date,.row.wide .int{padding-top:16px}
.tiles{padding:16px 16px 16px 16px}

/* canlı bilet satırın içinde: kenar boşluğu satırla aynı */
.sel .pk-card{margin:0;cursor:default}
.sel .pk-card:hover{box-shadow:none}
.pk-lab.ai{color:var(--v-accent-ink);background:var(--v-lav);border-radius:99px;padding:2px 8px;font-size:12px}
.pk-lab.open{font-size:12.5px}
.pk-end{margin-left:auto;display:inline-flex;align-items:center;gap:2px}
.pk-foot .pk-hint{font-size:12px;color:var(--v-muted);margin-left:auto}
.pk-foot{justify-content:flex-start}

/* seçenek grupları */
.og{padding:12px 14px 14px;border-top:1px solid var(--hair)}
.opts-h+.og{border-top:0}
.og-h{display:flex;align-items:center;gap:8px;margin:0 0 10px}
.og-ic{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:12px}
.og.me .og-ic{background:#fff3e2;color:#9a5b00}
.og.ai .og-ic{background:var(--accent-soft);color:var(--accent)}
.og-h b{font-size:13px}
.og-n{min-width:20px;height:18px;padding:0 6px;border-radius:99px;background:var(--sunk);color:var(--muted);font-size:11px;font-weight:700;display:inline-grid;place-items:center}
.og-h small{color:var(--muted);font-size:12px}
.og .fo{border:1px solid var(--line);border-radius:12px;margin-top:8px;padding:10px 12px}
.og .fo:first-of-type{border-top:1px solid var(--line);margin-top:0}
.og.me .fo{background:color-mix(in srgb,#fff3e2 35%,var(--surface))}
.fo{grid-template-columns:30px 210px minmax(0,1fr) 84px 76px}
.fo .b{height:32px}
.fo-m{flex-wrap:nowrap;white-space:nowrap;overflow:hidden}
.from{display:inline-flex;align-items:center;gap:5px;height:19px;font-size:11.5px;color:#9a5b00;font-weight:600}
.tag{display:inline-flex;align-items:center;height:19px;padding:0 7px;border-radius:99px;background:var(--accent-soft);color:var(--accent);font-size:11px;font-weight:700}
.og-split{display:grid;grid-template-columns:1fr 1fr}
.og-split .og{border-top:0}
.og-split .og+.og{border-left:1px solid var(--hair)}
.grid.g2{grid-template-columns:repeat(2,minmax(0,1fr));padding:0;gap:12px}
.og.me .box{border-color:color-mix(in srgb,#e9b46a 55%,var(--line))}
.box .bb .from,.box .bb .tag{margin-top:4px;justify-self:start}
.box .bf{margin-top:8px}
.need.bought{background:none}

/* v75 düzeltmeler */
.row,.row.wide{grid-template-columns:64px 228px minmax(0,1fr) 172px}
.row.wide{grid-template-columns:64px 228px minmax(0,1fr)}
.hx .hx-cities button{padding:0 13px;font-size:15px}
@container hxleft (max-width:580px){.hx .hx-cities button{padding:0 9px;font-size:14px}}
.hx-progress-head{flex-wrap:wrap}
.hx-progress-head>b{flex-basis:100%}
.pk-foot .ek-find{margin:0}
.pk-item{display:grid;grid-template-columns:72px minmax(0,1fr);gap:14px;align-items:center}
.pk-thumb{width:72px;height:54px;border-radius:10px;object-fit:cover;background:#fff;display:block}
.pk-thumb.ill{object-fit:contain;background:transparent;mix-blend-mode:multiply}
.pk-logo2{width:72px;height:54px;border-radius:10px;display:grid;place-items:center;background:#16151c;color:#fff;font-weight:800;font-size:14px;letter-spacing:-.02em}
.pk-tx{min-width:0}
.pk-meta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--v-muted)}
.pk-name{display:block;font-size:18px;font-weight:750;letter-spacing:-.015em;line-height:1.25;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--v-ink)}
.pk-sub{display:block;font-size:12.5px;color:var(--v-muted);margin-top:2px}
.pk-card.pk-r-arr{background:var(--sunk);border:1px solid var(--line)}
.pk-ring.arr{background:#8a879e;color:#fff}
.pk-lab.arr{color:var(--muted)}
.pk-state.okc{color:var(--ok)}
.box .ph .who{top:auto;bottom:8px;right:auto;left:8px}
.tiles .box .bb{display:flex;flex-direction:column}
.tiles .box .bf{flex-direction:column;align-items:stretch;flex-wrap:nowrap;margin-top:auto;padding-top:8px;gap:8px}
.tiles .box .bf .b{width:100%;height:34px}
.tiles .box .bf .done{height:34px;justify-content:center;border-radius:10px;background:var(--chosen-bg);box-shadow:inset 0 0 0 1px var(--chosen-line)}
.tiles .box .bf .done b{font-size:12.5px}
@media(max-width:1180px){.og-split{grid-template-columns:1fr}.og-split .og+.og{border-left:0;border-top:1px solid var(--hair)}}
@media(max-width:980px){.jr{overflow-x:auto}}
'''
src = src.replace("</style>", "\n/* ===== canlı uygulamadan (0.37.1): özet ve bilet ===== */\n" + livecss + "\n" + extra + "\n</style>", 1)
open(f"{D}/src.html", "w").write(src)
out = re.sub(r"\{\{([A-Z_0-9]+)\}\}", lambda m: vals[m.group(1)], src)
left = re.findall(r"\{\{[A-Z_0-9]+\}\}", out)
assert not left, left
open(f"{S}/plan-v75.html", "w").write(out)
print("ok", len(out))
