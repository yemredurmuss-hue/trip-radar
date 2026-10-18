import re, sys, collections

base = sys.argv[1]
rows_src = open(base + '/tools/rows.txt', encoding='utf-8').read().strip().split('\n')
DUR = {'Y': 'yapılacak', 'A0': "Aşama 0'da yapıldı", 'ZC': 'zaten canlı', 'X': 'YAPILMIYOR'}
ORDER = ['0', '1', '2', '3a', '3b', '4', '5', '6', '7', '8', 'sonraki küçük sürüm', 'Track', 'backlog', 'yok']
rows = []
for line in rows_src:
    parts = line.split('@@')
    assert len(parts) == 6, (len(parts), line[:80])
    st, madde, kaynak, dur, note, kabul = [p.strip() for p in parts]
    assert st in ORDER, st
    assert dur in DUR, dur
    if dur == 'X':
        assert note, madde
    rows.append(dict(st=st, madde=madde, kaynak=kaynak, dur=DUR[dur], note=note, kabul=kabul))
# keep stage order as written, but verify it is sorted
idx = [ORDER.index(r['st']) for r in rows]
assert idx == sorted(idx), 'rows not in stage order'
for n, r in enumerate(rows, 1):
    r['no'] = n

def cell(s):
    return s.replace('|', '/').replace('\n', ' ')

# coverage checks
alltext = ' '.join(r['kaynak'] for r in rows)
missing = []
for g, n in [('A', 8), ('B', 16), ('C', 36), ('D', 17), ('E', 17), ('F', 5), ('G', 3), ('T', 11), ('H', 18)]:
    for i in range(1, n + 1):
        tok = f'{g}{i}'
        if not re.search(r'(?<![A-Za-z0-9§])' + tok + r'(?![0-9])', alltext):
            missing.append(tok)
o1 = [i for i in range(1, 27) if not re.search(r'A1 Özet1 \(([^)]*)\)', alltext) or not any(str(i) in [x.strip() for x in m.split(',')] for m in re.findall(r'A1 Özet1 \(([^)]*)\)', alltext))]
o2 = [i for i in range(1, 28) if not any(str(i) in [x.strip() for x in m.split(',')] for m in re.findall(r'A1 Özet2 \(([^)]*)\)', alltext))]
print('missing decisions:', missing)
print('missing A1 Özet1:', o1)
print('missing A1 Özet2:', o2)

cnt_st = collections.Counter(r['st'] for r in rows)
cnt_dur = collections.Counter(r['dur'] for r in rows)
total = len(rows)

STAGE_NAME = {
    '0': 'Aşama 0 · Temel (görünür değişiklik yok)',
    '1': 'Aşama 1 · Hero',
    '2': 'Aşama 2 · Plan başlığı ve kategori satırları',
    '3a': 'Aşama 3a · Konaklama, eSIM, sigorta ve ortak niyet kutusu',
    '3b': 'Aşama 3b · Uçuş, tren, transfer, diğer türler, gezi biçimi',
    '4': 'Aşama 4 · Etkinlik ve yapılacaklar',
    '5': 'Aşama 5 · Yolculuk sırasıyla',
    '6': 'Aşama 6 · Pano ve sohbet uyumu',
    '7': 'Aşama 7 · Hazırlık, sağlayıcılar, alışveriş',
    '8': 'Aşama 8 · Temizlik, denetim, yayın (ve korunan canlı yüzeyler)',
    'sonraki küçük sürüm': 'Sonraki küçük sürüm (0.38.0 sonrası)',
    'Track': 'Track (gezi sırası ve sonrası)',
    'backlog': 'Backlog',
    'yok': 'YAPILMIYOR (bu sürümde arayüze girmez)',
}
BITTI = {
    '0': [
        '`npx tsc -p .` temiz; `npx vitest run` yeşil (yeni `tests/intents.test.ts` 17, `tests/providers.test.ts` 11).',
        '`V82_SECTIONS` boşken `node scripts/e2e.mjs` 0.37.1 ile aynı sonucu verir.',
        'Açık iki iş: bilgi haritası tablosu (F1) spec ekine girer; v83 onayı kayda geçer (G3). İkisi bitmeden Aşama 1 PR #3\'e girmez.',
    ],
    '1': [
        'Hero mozaik, şerit, çipler, pencereler, küçült ve yapışkan şerit prototip v83 ile 1440, 1280 ve 860 px\'te eşleşir; 820 px\'te hero ilk ekranda.',
        'Hazırlık sayısı Japonya örneğinde %61 / %33, Ozora\'da %44 / %22; hero, şerit ve PDF aynı.',
        'Omurga yeni senaryosunda "yok" türü metin sıfır; vize, çok ülke, tarihsiz, bütçesiz ve JPY senaryoları geçer.',
        'Birim: yeni `heroMosaic.test.ts`, `preferences.test.ts`, Sıradaki kuralı testi. e2e: `.hx` satırları (yaklaşık 150), sihirli açılış (`openingOn`), Part 5 (kimler), 390 px yatay kaydırma yok.',
    ],
    '2': [
        'Plan başlığı, kapalı satır (78 px), tek açık akordiyon ve hatırlama, durum çizgisi, "+ Yeni ihtiyaç ekle" çalışır; TripShape, PlanKey ve plan başı "+ Ekle" DOM\'da yok.',
        'Kapalı satır sayıları `collectionSummary` ile aynı; "2 karar"a basınca ilk karara gider.',
        'Birim: `farkListeler`, `suggestions`, `safeToReload`. e2e: `.cat-` başlık satırları, paylaşım şeridi (Part 4).',
    ],
    '3a': [
        '`V82_SECTIONS` stay ve other içerir. Konaklama, eSIM, sigorta kutularının her durumu 1440 ve 860 px\'te 288 px; iki dilde aynı; taşma ve konsol hatası yok.',
        'Değiştir yerinde, Ayrıntı ve Tüm detaylar, ⋯ menüsü (Gerek yok, Ben hallettim, C21 ekleri), Gizlenenler · n, hata, iskelet ve "Yeni" halleri çalışır.',
        'Birim: yeni `regionHints.test.ts`, `offerSource.test.tsx`, intents testleri. e2e: Plan konaklama, belge ve Part 6b (otel taslağı) satırları; sabit boy ölçüm betiği.',
    ],
    '3b': [
        '`V82_SECTIONS` flight ve transport içerir. Bilet ailesinin (uçuş, tren, transfer, otobüs, vapur, kiralama, pass) her durumu 288 px.',
        'Dahil sayımı 18 Ekim kuralıyla; Aşama 0\'daki iki fark (`planShare`/`bookedShare` ve kategori çubuğu) kapanır.',
        'Gezi biçimi testleri (11 karışım, 3 adsız gezi, Dahil, `when`, geçersiz sinyal, asgari omurga, günübirlik, aktarmalı) yeşil; D raporu senaryoları (01a, 03, 04, 05, 08b, 13, 16a, 18, 22, 22b, g2e) beklenen çıktıyı verir.',
        'Birim: `board`, `draft`, `cardTime`, `ticketStub`, `cardPeek`, `bookingRows`. e2e: `.tk-` satırları, Part 6 (uçuş günü), Part 6b.',
    ],
    '4': [
        '`V82_SECTIONS` activity ve todo içerir. İki sabit sıra, 224 px kartlar, boş yuvalar, "+n Pano\'da", alınan etkinlik şeridi, Plana koy hareketi çalışır.',
        'Birim: `actsV30.test.ts`. e2e: `.ev` ve `.ac-` satırları (yaklaşık 43).',
    ],
    '5': [
        'Yolculuk sırasıyla bölümleri, tek eylem, iki görünüm arası anında yansıma, Bugün şeridi ve bugünden açılış, uçakta satırı çalışır; tarihsiz gezide görünüm kapalı.',
        'Birim: yeni `journeyChapters.test.ts`, `journeyFlow` aynen. e2e: Yolculuk adımları; 21a ve 21b senaryoları.',
    ],
    '6': [
        'Pano penceresi, kenar menü, 220 px kartlar, 280 px karşılaştırma, İlham, Belgeler, tek ♥, "Uyum puanı" adı ve sohbetten "Planda göster" çalışır.',
        'Birim: `pano.test.ts` aynen, `board`. e2e: `.pn-` satırları (yaklaşık 55), sohbet öneri kartı ve reveal hedefi.',
    ],
    '7': [
        'Hazırlık (Bilmen gerekenler, günlü maddeler, Bavul, ekler) prototip v83 ile eşleşir; sağlayıcı düğmeleri `providers.ts`\'den gelir; ortaklık yönlendirmesi geçer.',
        'Birim: `searchLinks`, `needSearchLinks`, `brands`, `affiliate`, `prepBuy`, `providers`. e2e: `.prep-` satırları.',
    ],
    '8': [
        'Bu tablonun her satırı "geçti" ya da "YAPILMIYOR"; bağımsız denetimde açık satır 0.',
        'Tam `npx vitest run`, tam `node scripts/e2e.mjs`, 1440 / 1280 / 860 / 390 px ve iki dilde ekran denetimi temiz; `dbUpgrade` yeşil; `supabase/` farksız.',
        'DESIGN.md, PRIVACY §8, mağaza metni ve 0.38.0 sürüm notu (düşen 5 özellik) yazılı; korunan canlı yüzeyler 0.37.1 gibi çalışır.',
    ],
    'sonraki küçük sürüm': ['0.38.0 içinde yok; 0.38.0 sonrası ayrı küçük sürümde ele alınır.'],
    'Track': ['0.38.0 içinde yok; gezi sırası ve sonrası (Track) işinde ele alınır.'],
    'backlog': ['0.38.0 içinde yok. Karar bekleyenler Emre\'ye sorulur; hata satırları ayrı iş listesine yazılır.'],
    'yok': ['0.38.0 arayüzünde yok. Spec §1.1 gereği düşenlerin kodu silinmez ve sürüm notunda listelenir.'],
}

out = []
w = out.append
w('# Trip Radar v82 geçişi · izlenebilirlik tablosu')
w('')
w('Tarih: 18 Ekim 2026. Hazırlayan: araştırma ajanı. Yalnız okuma yapıldı; hiçbir repoda dosya değişmedi.')
w('')
w('Kaynaklar: `/home/user/wt-v32` (dal `plan-v32-tasarim`) altında tasarım notu v77-v83 ve "v83 ek", `01-kararlar.md` ve `kararlar/okunan/*.json` (102 karar), `02-spec.md` (§1.1-1.5, §4, §7), `A1-plan-sayfasi.md` (Özet 1: 26, Özet 2: 27 madde), `A2-diger-yuzeyler.md` (§4), `D-gezi-turleri-ve-uc-durumlar.md` §4 (H1-H18), `etsy/etsy-kararlar.md` ve `etsy/okunan/*.json` (T1-T11), prototip `docs/mockups/plan-v83-turler/`. Destek için C, E, F raporları. Canlı kod kanıtı `/home/user/trip-radar` (dal `plan-v46-kod`, 0.37.1); Aşama 0 kanıtı worktree `agent-a75648626d56da63a` (dal `plan-v82-kod`).')
w('')
w('## Özet')
w('')
w(f'- Toplam satır: **{total}**.')
dist = ', '.join(f'{("Aşama " + s) if s not in ("sonraki küçük sürüm", "Track", "backlog", "yok") else s}: {cnt_st[s]}' for s in ORDER if cnt_st[s])
w(f'- Aşamalara dağılım: {dist}. ("yok" = YAPILMIYOR satırları.)')
w(f'- Duruma göre: yapılacak {cnt_dur["yapılacak"]}, Aşama 0\'da yapıldı {cnt_dur[DUR["A0"]]}, zaten canlı {cnt_dur["zaten canlı"]}, YAPILMIYOR {cnt_dur["YAPILMIYOR"]}.')
w(f'- Kapsama: 102 kararın, T1-T11\'in, H1-H18\'in ve A1 Özet 1 ile Özet 2\'nin her maddesi en az bir satırın Kaynak sütununda. Eksik: {", ".join(missing + [f"A1 Özet1 ({i})" for i in o1] + [f"A1 Özet2 ({i})" for i in o2]) or "yok"}.')
w('- Mükerrer maddeler tek satırda; Kaynak sütunu hepsini sayar. Bir notun sonraki sürümde değişen hali o satıra katıldı, değişim çelişki listesinde.')
w('- "Aşama 0\'da yapıldı" yalnız görünüm modeli, token, kayıt ve kural satırları için kullanıldı. Kutuda görünen işler, modeli Aşama 0\'da hazır olsa da görüneceği aşamada "yapılacak".')
w('- Kaynak kısaltmaları: "vNN · başlık" tasarım notu maddesi; A1-G3 karar; T Etsy kararı; H canlı hata; "A1 Özet1 (n)" A1 raporunun özet maddesi; "A1 §n" ve "A2 X" raporların bölümü; "spec §n" `02-spec.md`; "C §n", "D İn", "F §n" destek raporları; (Ç n) çelişki listesindeki madde.')
w('')
w('## Ana tablo')
w('')
w('| No | Madde | Kaynak | Aşama | Durum | Gerekçe ya da not | Kabul ölçütü |')
w('|---|---|---|---|---|---|---|')
for r in rows:
    w(f'| {r["no"]} | {cell(r["madde"])} | {cell(r["kaynak"])} | {r["st"]} | {r["dur"]} | {cell(r["note"])} | {cell(r["kabul"])} |')
w('')
w('## Aşama başına satırlar ve "bitti" tanımı')
w('')
def ranges(nums):
    out, start, prev = [], None, None
    for n in nums:
        if start is None:
            start = prev = n
        elif n == prev + 1:
            prev = n
        else:
            out.append(f'{start}-{prev}' if start != prev else f'{start}')
            start = prev = n
    if start is not None:
        out.append(f'{start}-{prev}' if start != prev else f'{start}')
    return ', '.join(out)
for s in ORDER:
    nums = [r['no'] for r in rows if r['st'] == s]
    if not nums:
        continue
    sub = collections.Counter(r['dur'] for r in rows if r['st'] == s)
    w(f'### {STAGE_NAME[s]}')
    w('')
    w(f'Satırlar: {ranges(nums)} ({len(nums)} satır; ' + ', '.join(f'{k} {v}' for k, v in sub.items()) + ').')
    w('')
    w('Bitti:')
    for b in BITTI[s]:
        w(f'- {b}')
    w('')
open(base + '/tools/body.md', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('total', total, dict(cnt_st), dict(cnt_dur))
