# Paylaşım güvenliği — tasarım

Durum: onaylandı (mockup `docs/mockups/2026-10-05-paylasim-guvenligi-v1.png`), uygulanıyor (2026-10-05).

## Sorun

Paylaşılan gezide bugün ne gidip geliyor (kodda doğrulandı):

- **Ortak ayarlar** (`share/settings.ts` `SYNCED_FIELDS`): ad, tarihler, bütçe, öncelikler, kategori öncelikleri,
  istenen olanaklar, şartlar. Son yazan kazanır (`resolveSettings`).
- **Kayıtlar** (capture): yalnız eklenir, hiç silinmez.
- **Oylar**: iki yönde.
- **Profiller**: `syncProfiles`, oylardan sonra.
- Silme ve gizleme yerel: Sabine'nin silmesi Emre'nin panosuna gelmez.

Asıl risk: karşı tarafın ortak ayarı değiştirmesi; bu bugün **sessizce** benim panoma yazılıyor. İkinci risk: kendi
silmemle kendi verimi kaybetmem. Bugün kart silme yalnız 8 saniyelik bellek içi "Geri al" ile korunuyor, gezi
silme hiç korunmuyor.

## Çözüm (4 parça)

### 1. Sunucuda ayar geçmişi (`supabase/history.sql`, yeni dosya)

- `trip_radar.settings_history`: id, trip_id (→ shared_trips, cascade), author, prev, next, created_at.
  İndeks (trip_id, id desc).
- `shared_trips` üzerinde AFTER UPDATE tetikleyici: `trip` json'u gerçekten değiştiyse (eski, yeni, `updated_by`)
  yazar. `put_trip_settings`'e dokunulmaz: eski istemciler de geçmişi bedavaya alır. Gezi başına en çok 200 satır,
  fazlası tetikleyicide budanır.
- `public.settings_history_for(p_id, p_limit default 50)`: `security definer`, `_share_trip_exists`, anon +
  authenticated'a execute (diğer RPC'ler gibi). Tabloya doğrudan erişim yok.
- Geri yükleme için yeni RPC yok: istemci eski ayarı normal `put_trip_settings` yoluyla yazar; o da geçmişe düşer.
- `schema.sql` değişmez. SQL'i Emre gözden geçirip uygular. Uygulanmamış sunucuda istemci sessizce atlar.

### 2. Karşıdan gelen değişiklik bildirimi + "Geri al"

- `sync.ts` bir çekişte (pull) ortak ayarları uygularken önceki ve yeni hâli bir **bildirim** olarak saklar:
  kim (`updated_by`), ne zaman, önceki ayarlar, yeni ayarlar. Metin alan alan, TR/EN, gösterirken üretilir
  (`share/settingsDiff.ts`): "Tarihler: 7–18 Ekim → 8–18 Ekim", "Bütçe: ₺100.000 → ₺80.000", "Ad", "Öncelikler:
  Fiyat çok önemli → önemli", "Şartlar", "İstenen olanaklar".
- Kendi değişikliğim (aynı ad) bildirim olmaz. Aynı sunucu değişikliği iki kez gelmez (updated_at + yazar);
  en fazla 20 bildirim, eskiler düşer.
- Saklama: KV'de gezi başına ayrı anahtar `shareNotices:<tripId>` (sync state'in yanında). Sync state her turda
  baştan yazıldığı için bildirim ayrı anahtarda tutulur: panoda "Tamam"a basmak arka plandaki bir eşitlemeyle
  ezilmesin.
- Pano: sekmelerin üstünde sarı şerit (mockup panel 1). "Geri al" yalnız o bildirimin değiştirdiği alanları önceki
  hâline yazar (gezi `updatedAt` ilerler → sonraki eşitleme normal yoldan yukarı iter, sunucuda yeni bir değişiklik
  olur). "Tamam" panodan kaldırır; bildirim Geçmiş için saklı kalır.
- **O zamandan beri yine değişen alan geri alınmaz.** Alan yalnız şu anki değeri o değişikliğin bıraktığı değere
  eşitse geri yazılır; değilse "Tarihler o zamandan beri yine değişti; geri alınmadı." Aynı alanı değiştiren daha
  yeni bir bildirim gelince eskisinde o alan kapanır (Geri al yok).
- Geçmiş'ten yapılan "Geri al" panodaki şeridi de kapatır. Yazmalar tek kuyruktan ve sürüm kontrolüyle yapılır
  (pano ile service worker aynı anahtara yazar).

### 3. Yerel çöp kutusu, 30 gün

- IndexedDB'de iki yeni depo (DB sürüm 4 → 5): `trash` hafif satırlar (id, tripId, kind `item` | `trip` | `doc`,
  deletedAt, label, size, count; listeler yalnız bunu okur) ve `trashData` (aynı id, payload; yalnız geri getirirken
  okunur).
- **Belge silme** (Belgeler ve kartın belge listesi) de çöpe gider (`doc`); 8 saniyelik "Geri al" çöpteki kaydı da
  kaldırır.
- Her çöp satırında "Kalıcı sil" (onaylı), altta "Çöp kutusunu boşalt" (onaylı). Yedek (`exportAll`) çöpü de içerir
  (dosya içerikleri ve ekran görüntüleri hariç).
- Paylaşılan bir gezi geri gelirken aynı paylaşıma bağlı başka bir gezi varsa (yeniden katılınmışsa) `shareId`'siz
  döner: "Paylaşımdan ayrı bir kopya olarak geri geldi".
- **Kart silme** (`removal.deleteItem`): kart + belgeleri tek işlemde çöpe taşınır ve silinir. İmza ve 8 saniyelik
  "Geri al" aynen; "Geri al" çöpteki kaydı da kaldırır.
- **Gezi silme**: gezi + kayıtları + belgeleri + yalnız bu geziye ait capture'lar + sohbet/olaylar + analizler +
  geziye özel tercihler, tek işlemde çöpe. (Bugünkü silme capture ve analizleri yetim bırakıyordu.)
- Geri getirme kayıtları kendi id'leriyle koyar; aynı id artık varsa o kaydı atlar ve sayısını söyler.
- 30 günden eski kayıtlar açılışta ve listelerken temizlenir; geri getirme sırasında temizlik yapılmaz.
- Sürüm yükseltmesi: `blocked`/`blocking` davranışı aynen kalır; v4 → v5 veri kaybetmeden açılır (test).

### 4. Paylaşılan geziyi silerken uyarı

- ••• → "Bu geziyi sil". Gezi paylaşılıyorsa (`trip.shareId`) mockup panel 2'deki pencere: yalnız bu bilgisayardan
  silinir, Sabine'nin kopyası ve ortak kayıtlar sunucuda kalır, 30 gün Çöp kutusu'nda, paylaşım bu tarafta durur.
  Vazgeç / Sil (kırmızı).
- Paylaşılmayan gezi bugünkü onayla silinir, ama o da çöpe gider. Geri getirilen paylaşılan gezi `shareId`'siyle
  döner, eşitleme kaldığı yerden sürer.

### 5. Geçmiş paneli

- ••• → "Geçmiş ve çöp kutusu" (mockup panel 3). Bölmeler: Hepsi · <ortak yolcular> · Ben · Çöp kutusu (sayı).
- Satırlar güne göre (Bugün / Dün / tarih): baş harf · kalın fiil ("Tarihler:", "Bütçe:", "Silindi:",
  "Gizlendi:", "Eklendi:") + değişiklik · gri alt satır (kim · nasıl · saat) · eylem.
- Kaynaklar birleşir:
  - (a) sunucu `settings_history_for` (varsa) → "Geri al";
  - (b) yerel olaylar (`addEvent` satırları) → "Eklendi:" + "Panoda göster", diğerleri düz satır;
  - (c) çöp kutusu → "Geri getir";
  - (d) gizlenenler (elenen kayıtlar, "Gerek yok" denen transfer ve geceler) → "Geri getir" (`setItemStatus`,
    `setHidden`).
- Geri alınmış ayar satırı gri, "geri alındı" etiketiyle.
- Paylaşım yoksa yalnız yerel geçmiş + çöp kutusu.

## Kırılmaması gerekenler

- Eski sunucu (history.sql yok): geçmiş sunucu kısmı sessizce boş, eşitleme aynen.
- Eski istemci: tetikleyici sayesinde onların yazdığı değişiklik de geçmişe girer.
- `deleteItem` / `restoreItem` imzaları, mevcut çağıranlar ve testleri aynen çalışır.
- Dokunulmayanlar: Günlük akış, fikir havuzu, AI kapısı, `profiles.sql`, mevcut CSS blokları. Yeni CSS `hs-` önekli.
