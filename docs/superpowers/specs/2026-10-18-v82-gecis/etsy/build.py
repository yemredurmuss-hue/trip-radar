import html, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from data import *  # noqa

E = lambda s: html.escape(str(s), quote=True)
SHORT = {
    "T1": "Gezi dosyası (.html), internetsiz", "T2": "Alınmışlar tek .ics dosyasında", "T3": "Maddeler kendi gününü taşır",
    "T4": "Kayda ödeme bilgisi", "T5": "Yalnız kişi başı satırı", "T6": "Hazırlık içinde katlı Bavul",
    "T7": "Görüntüler dosyada, PDF'ler yanında", "T8": "Acil numara ve poliçe kodu", "T9": "Bu sürümde yok",
    "T10": "Gönderirken tek seçim", "T11": "Küçükler v82'ye, gerisi sonra",
}
MOCKNAME = {"m1": "Taslak 1", "m2": "Taslak 2", "m3": "Taslak 3", "m4": "Taslak 4"}
SIZECLS = {"küçük": "s", "orta": "m", "büyük": "l", "yok": "z", "": "z"}

counts = {k: 0 for k in STATUS}
for r in MAP:
    counts[r[4]] += 1

def flags_html(fl):
    return "".join('<span class="flag' + (" be" if f == "backend" else "") + '">' + E(FLAGS[f]) + '</span>' for f in fl)

def size_html(sz, pre=""):
    if not sz:
        return ""
    t = "iş yok" if sz == "yok" else pre + sz
    return '<span class="sz ' + SIZECLS[sz] + '">' + E(t) + '</span>'

# ---------- özet tablosu
ov = []
for d in D:
    rec = d["opts"][0]
    ov.append('<tr><td class="mono"><a href="#k-' + d["id"] + '">' + d["id"] + '</a></td><td><b>' + E(d["title"]) + '</b></td><td>' + E(SHORT[d["id"]]) + ' ' + flags_html(rec[3]) + '</td><td>' + size_html(d["size"]) + '</td></tr>')
OVERVIEW = "\n".join(ov)

# ---------- eşleme tablosu
rows, last = [], None
for g, talep, canli, tas, st, kanit, karar in MAP:
    if g != last:
        rows.append('<tr class="grp" data-g="1"><td colspan="6">' + E(g) + '</td></tr>')
        last = g
    kr = ""
    if karar:
        if karar.startswith("T"):
            kr = " ".join('<a class="mono" href="#k-' + x.strip() + '">' + x.strip() + '</a>' for x in karar.split(","))
        else:
            kr = '<span class="mut">' + E(karar) + '</span>'
    rows.append('<tr data-st="' + st + '"><td><b>' + E(talep) + '</b></td><td>' + E(canli) + '</td><td>' + E(tas) + '</td><td><span class="st st-' + st + '">' + E(STATUS[st]) + '</span></td><td class="mono small">' + E(kanit) + '</td><td>' + kr + '</td></tr>')
MAPROWS = "\n".join(rows)
FILTERS = '<button type="button" class="fchip on" data-f="all" aria-pressed="true">Hepsi <em>' + str(len(MAP)) + '</em></button>' + "".join(
    '<button type="button" class="fchip f-' + k + '" data-f="' + k + '" aria-pressed="false">' + E(v) + ' <em>' + str(counts[k]) + '</em></button>' for k, v in STATUS.items())

# ---------- format çubukları (53 ürün, ölçekli)
tot = sum(n for _, n in FORMATS)
mx = max(n for _, n in FORMATS)
BARS = "\n".join('<div class="fbar"><span>' + E(n) + '</span><span class="ft"><i style="width:' + ("%.1f" % (c / mx * 100)) + '%"></i></span><b class="mono">' + str(c) + '</b></div>' for n, c in FORMATS)

WANTH = "\n".join('<li><b>' + E(a) + '</b><span>' + E(b) + '</span></li>' for a, b in WANT)
USEH = "\n".join('<li>' + E(x) + '</li>' for x in USE)
STRH = "\n".join('<li><b>' + E(a) + '</b><span>' + E(b) + '</span></li>' for a, b in STRUGGLE)

# ---------- karar kartları
cards = []
for d in D:
    mk = " · ".join('<a href="#' + m + '">' + MOCKNAME[m] + '</a>' for m in d["mock"])
    opts = []
    for i, (k, txt, sz, fl) in enumerate(d["opts"]):
        idf = "o-" + d["id"] + "-" + k
        opts.append('<label class="opt" for="' + idf + '"><input type="radio" name="r-' + d["id"] + '" id="' + idf + '" value="' + k + '"><span class="dot" aria-hidden="true"></span><span class="otx"><span class="ok">' + k + '</span> ' + E(txt) + (' <b class="rec">(önerim)</b>' if i == 0 else '') + '<span class="ometa">' + size_html(sz) + flags_html(fl) + '</span></span></label>')
    cards.append('''<article class="card" id="k-%(id)s" data-id="%(id)s">
  <div class="ch"><span class="cid mono">%(id)s</span><h3>%(title)s</h3><span class="cst" aria-live="polite">boş</span></div>
  <dl class="cinfo">
    <div><dt>Neden</dt><dd>%(why)s</dd></div>
    <div><dt>Bugünkü altyapı</dt><dd>%(infra)s <span class="nowrap">Önerimin işi: %(size)s</span></dd></div>
    <div><dt>Yeni tasarımda yeri</dt><dd>%(place)s%(mk)s</dd></div>
  </dl>
  <div class="opts" role="radiogroup" aria-label="%(title)s">%(opts)s</div>
  <div class="nrow"><button type="button" class="nbtn" data-note="%(id)s">Not ekle</button><textarea id="n-%(id)s" hidden aria-label="%(id)s notu" placeholder="Notun"></textarea></div>
</article>''' % dict(id=d["id"], title=E(d["title"]), why=E(d["why"]), infra=E(d["infra"]), size=size_html(d["size"]), place=E(d["place"]),
                     mk=(' <span class="mklinks">' + mk + '</span>' if mk else ''), opts="".join(opts)))
CARDS = "\n".join(cards)

OUTH = "\n".join('<li><b>' + E(a) + '</b><span>' + E(b) + '</span></li>' for a, b in OUT)
UNSUREH = "\n".join('<li>' + E(x) + '</li>' for x in UNSURE)
SRCH = "\n".join('<li><a href="' + E(u) + '" target="_blank" rel="noreferrer">' + E(t) + '</a></li>' for t, u in SOURCES)
FILESH = "\n".join('<li class="mono small">' + E(f) + '</li>' for f in FILES)

JSDATA = json.dumps([{"id": d["id"], "title": d["title"], "rec": d["opts"][0][0], "opts": [[o[0], o[1]] for o in d["opts"]]} for d in D], ensure_ascii=False).replace("</", "<\\/")

page = open(os.path.join(HERE, "page.tpl.html"), encoding="utf8").read()
for k, v in dict(OVERVIEW=OVERVIEW, MAPROWS=MAPROWS, FILTERS=FILTERS, BARS=BARS, WANTH=WANTH, USEH=USEH, STRH=STRH, CARDS=CARDS,
                 OUTH=OUTH, UNSUREH=UNSUREH, SRCH=SRCH, FILESH=FILESH, JSDATA=JSDATA, NMAP=str(len(MAP)), NVAR=str(counts["var"]),
                 NTAS=str(counts["tasarim"]), NKIS=str(counts["kismen"]), NYOK=str(counts["yok"]), NDEC=str(len(D)), TOT=str(tot),
                 ETSY=ETSY_URL, PROTO=PROTO_URL).items():
    page = page.replace("__" + k + "__", v)
assert "__" not in page.replace("__delete__", ""), [l for l in page.splitlines() if "__" in l][:3]
assert "—" not in page, "uzun tire var"
open(os.path.join(HERE, "etsy-kararlar.html"), "w", encoding="utf8").write(page)

# ---------- Markdown
md = []
md.append("# Etsy araştırması ve bugünkü prototip: kararlar (18 Ekim 2026)\n")
md.append("Kaynak: [Trip Radar Etsy Analizi](" + ETSY_URL + ") (5 Ekim; 53 ürün, 16'sı ayrıntılı; tam metni okundu). Karşılaştırılan: canlı 0.37.1 (`plan-v46-kod`), v82 prototipi ([Katmanlı Plan](" + PROTO_URL + ")), v82 geçiş kararları (`01-kararlar.md`), v83 \"yolda\" listesi.\n")
md.append("Özet: çekirdekte (kaydet, oku, karşılaştır) öndeyiz. Eksikler planın dışarı çıktığı yerde (telefon, takvim, başka biri) ve parada (ne ödendi, ne kaldı). %d karar; her birinde önerim ilk sırada.\n" % len(D))
md.append("## 1. Bulgu\n")
md.append("### İnsanlar ne istiyor\n")
for a, b in WANT:
    md.append("- **%s.** %s" % (a, b))
md.append("\n### Ne kullanıyorlar\n")
md.append("Vitrinin ilk sayfasındaki %d ürün: " % tot + ", ".join("%s %d" % (n, c) for n, c in FORMATS) + ".\n")
for x in USE:
    md.append("- " + x)
md.append("\n### Nerede zorlanıyorlar\n")
for a, b in STRUGGLE:
    md.append("- **%s.** %s" % (a, b))
md.append("\nSayılar 5 Ekim analizinden; satış sayıları mağaza toplamı. Bugünkü kısa web taraması yeni ve güvenilir sayı vermedi.\n")
md.append("## 2. Eşleme\n")
md.append("%d talep: %d canlıda var, %d v82/v83 tasarımında var, %d kısmen, %d yok.\n" % (len(MAP), counts["var"], counts["tasarim"], counts["kismen"], counts["yok"]))
md.append("| Grup | Talep | Canlı 0.37.1 | v82/v83 | Durum | Kanıt | Karar |")
md.append("|---|---|---|---|---|---|---|")
for g, talep, canli, tas, st, kanit, karar in MAP:
    md.append("| %s | %s | %s | %s | %s | `%s` | %s |" % (g, talep, canli, tas, STATUS[st], kanit, karar))
md.append("\n## 3. Kararlar\n")
md.append("| # | Karar | Önerim | İş |")
md.append("|---|---|---|---|")
for d in D:
    fl = d["opts"][0][3]
    md.append("| %s | %s | %s%s | %s |" % (d["id"], d["title"], SHORT[d["id"]], (" (" + "; ".join(FLAGS[f] for f in fl) + ")") if fl else "", d["size"] if d["size"] != "yok" else "iş yok"))
md.append("")
for d in D:
    md.append("### %s %s\n" % (d["id"], d["title"]))
    md.append("- Neden: " + d["why"])
    md.append("- Bugünkü altyapı: " + d["infra"] + " Önerimin işi: " + (d["size"] if d["size"] != "yok" else "iş yok") + ".")
    md.append("- Yeni tasarımda yeri: " + d["place"] + ((" Taslak: " + ", ".join(MOCKNAME[m] for m in d["mock"]) + ".") if d["mock"] else ""))
    md.append("")
    for i, (k, txt, sz, fl) in enumerate(d["opts"]):
        meta = []
        if sz:
            meta.append("iş: " + sz)
        meta += [FLAGS[f] for f in fl]
        md.append("%s. %s%s%s" % (k, txt, " **(önerim)**" if i == 0 else "", (" _[" + "; ".join(meta) + "]_") if meta else ""))
    md.append("")
md.append("## 4. Taslaklar\n")
md.append("- **Taslak 1 · Telefonda gezi dosyası (T1, T7, T8).** Telefon çerçevesi. Gezi sırasında: Bugün (8 Nisan Perşembe, 8. gün / 16, Kyoto), Sıradaki (08:30 Fushimi Inari, Haritada aç), günün kalanı, yarın satırı, Acil kutusu. Gezi öncesi: geri sayım, B9 iki sayısı, şehir şehir günler, kişi başı. Dosya açıldığı güne göre kendisi seçer; altında \"hazırlandı\" saati.")
md.append("- **Taslak 2 · Hazırlık günleriyle ve Bavul (T3, T6, T4).** Kapalı satırda \"2/7 hazır · sıradaki 31 Mar\". Günlü maddeler güne göre (Visit Japan Web, online check-in, eSIM, otelde kalan ödeme), günsüzler altta, hazır olanlar en sonda; katlı \"Bavul · 4/22\".")
md.append("- **Taslak 3 · Para (T4, T5).** Alındı konaklama kutusunun yan sütununda \"€600 ödendi · €300 girişte\"; bütçe penceresinde Ödendi, Ödenecek (tarihli alt satır), Planlanan, Boşta; \"Kişi başı ~€3.450 · 2 kişi\".")
md.append("- **Taslak 4 · Gezi menüsü, Telefona gönder, .ics (T1, T2, T7, T10).** Canlı menüye iki satır: Telefona gönder, Takvime aktar. Gönder penceresinde üç seçim: kodlar ve adresler, bilet görüntüleri, PDF biletler. .ics önizlemesi.")
md.append("\nHepsinde örnek veri: v82 Japonya turu (1–16 Nisan, 2 kişi, Tokyo, Kyoto, Hakone, Osaka); kodlar A1B2C3 gibi yer tutucu.\n")
md.append("## 5. Yeni tasarımın ilkeleriyle uyum\n")
md.append("- Aynı boy kutular: hiçbir öneri kutuya satır eklemiyor; ödeme B10 satırının yerine geçiyor, Hazırlık günü satırın sağında, Bavul tek katlı satır.")
md.append("- Katmanlı gösterim: kısa hali K1'de, tam hali K2 Ayrıntı'da (ödeme, acil); yeni yüzey yok, çıktılar gezi ⋯ menüsünden.")
md.append("- C19: bilgi yoksa satır görünmez; \"tarih yok\", \"ödeme bilgisi yok\" yazılmaz.")
md.append("- IndexedDB şeması ve backend: önerilerin hiçbiri yeni depo ya da sunucu istemiyor. T4 a kayda isteğe bağlı bir alan ekler (DB_VERSION 5 kalır). Backend gerektirenler yalnız ikinci ya da üçüncü seçeneklerde: T1 b, T5 b, T7 c. Yeni depo: T9 b.")
md.append("- İki dil (A6): yeni metinlerin hepsi Türkçe ve İngilizce; satırlar iki dilde ölçülür.\n")
md.append("## 6. Bilinçli dışarıda bırakılanlar\n")
for a, b in OUT:
    md.append("- **%s.** %s" % (a, b))
md.append("\n## 7. Emin olmadıklarım\n")
for x in UNSURE:
    md.append("- " + x)
md.append("\n## 8. Kaynaklar\n")
for t, u in SOURCES:
    md.append("- [%s](%s)" % (t, u))
for f in FILES:
    md.append("- `%s`" % f)
md.append("")
mdt = "\n".join(md)
assert "—" not in mdt
open(os.path.join(HERE, "etsy-kararlar.md"), "w", encoding="utf8").write(mdt)
print("ok", len(page), len(mdt), counts)
