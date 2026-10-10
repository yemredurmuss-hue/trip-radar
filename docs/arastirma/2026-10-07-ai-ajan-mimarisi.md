# AI gezi asistanları nasıl kuruluyor (2026-10-07)

Soru: Layla, Mindtrip, Booking, Expedia, Google ve genel ajan rehberleri bir gezi asistanını nasıl kuruyor?
Katmanlar, hafıza, sohbet içinde web araması, açık uçlu niyet ve doğrulama. Etiketler: **[müh]** yayımlanmış
mühendislik (konuşma, makale, belge) · **[pazarlama]** basın bülteni ya da reklam · **[üçüncü]** başkasının yorumu.

## Kısa cevap

Kimse "yönlendirici → planlayıcı → yürütücü → eleştirmen" diye dört modelli bir yapı yayımlamamış. Belgelenen
yapı şu: **tek ana model + araçlar + önünde küçük sınıflandırıcılar + arkasında kod/hakem kontrolü + her turda
yeniden verilen küçük, yapılı bir gezi durumu.** Ajan rehberlerinin hepsi "önce tek model, katmanı ancak ölçülen
bir hata isterse ekle" diyor. Planı doğrulamada en güçlü kanıt: modelin kendi kendini eleştirmesi az işe yarıyor,
**kodla/araçla kontrol** çok işe yarıyor.

## 1. Katmanlar: tek model mi, çok model mi?

- **Booking.com [müh]:** girişte moderasyon ve niyet sınıflandırma, sonra diyaloğu yapılandırma ve veriye dayalı
  üretim; üretimde "hakem model" (judge LLM) ve araç seçimi doğruluğu ölçülüyor ("Paris, Fransa mı Teksas mı").
  Kaynak: https://cfp.pydata.org/pydata-tel-aviv-2025/talk/FZEQUJ ,
  https://www.zenml.io/llmops-database/ai-agent-evaluation-framework-for-travel-and-accommodation-platform
- **Airbnb [müh, üçüncü özet]:** tek düşünen model döngüsü: bağlamı topla → araç seç → sonucu bağlama ekle →
  tekrar → cevap. Hassas akışlar kod ile sabit. https://www.zenml.io/llmops-database/evolving-a-conversational-ai-platform-for-production-llm-applications
- **Expedia Romie [haber]:** kapatıldı. Ürün yöneticisinin dersi: cevaplar gerçek zamanlı stok ve rezervasyon
  verisine dayanmayınca güven kırılıyor. https://letsdatascience.com/news/expedia-group-shares-ai-chatbot-lessons-learned-239f348a
- **Expedia Layla'yı satın aldı [haber, Temmuz 2026]:** https://skift.com/2026/07/31/expedia-acquired-ai-trip-planner-layla-exclusive/ ,
  https://www.travolution.com/news/travel-sectors/intermediaries/expedia-group-acquires-layla-to-accelerate-ai-trip-planning/
- **Layla, Mindtrip, Wanderboat, TripGenie, Kayak:** teknik mimari yayımlamamışlar; elimizde yalnız pazarlama var
  (Layla "önce kimlik": hareket kısıtı, aile, diyet, bütçe, sonra yer — https://ipsnews.net/business/?p=248171).
- **Google AI Mode [müh]:** bir soruyu alt konulara bölüp birden çok arama yapıyor ("query fan-out"), sonra tek
  cevap yazıyor. https://developers.google.com/search/docs/appearance/ai-features
- **Anthropic, "Building effective agents" [müh]:** tek çağrıyı arama ve örneklerle güçlendirmek çoğu zaman yeter;
  yönlendirme, zincir, değerlendirici döngüsü yalnız gerekince. https://www.anthropic.com/engineering/building-effective-agents
- **OpenAI ajan rehberi [müh]:** önce tek ajanı sonuna kadar zorla; çok ajan yalnız araç/istem karmaşası zorlayınca.
  https://ibl.ai/blog/openai-a-practical-guide-to-building-agents
- **Cognition, "Don't build multi-agents" [müh]:** alt ajanlar yalnız özet görünce tutarsız karar veriyor; bağlam
  paylaşılmalı. https://cognition.ai/blog/dont-build-multi-agents
- **Anthropic çok ajanlı araştırma [müh]:** geniş araştırmada iyi ama sohbetin ~15 katı token; herkesin aynı bağlamı
  bilmesi gereken işlere uymuyor. https://www.anthropic.com/engineering/multi-agent-research-system

## 2. Hafıza

- **Google ADK [müh]:** `session.state` küçük bir not defteri, **her turda sistem istemine yeniden yazılıyor**;
  `user:` önekiyle kullanıcıya ait (geziler arası), `temp:` yalnız o tur. "Küçük, düz, serileşebilir tut."
  https://google.github.io/adk-docs/sessions/state/ · uzun süreli hafıza: https://google.github.io/adk-docs/sessions/memory/
- **LangGraph [müh]:** kısa süreli = sohbet ipliği; uzun süreli = profil (olgu), örnek (geçmiş başarılı çıktılar),
  yöntem. Uzun geçmiş modeli dağıtıyor. https://docs.langchain.com/oss/python/langgraph/memory
- **Anthropic bağlam mühendisliği [müh]:** bağlam sınırlı bir "dikkat bütçesi"; en az, en anlamlı token. Sıkıştırma,
  dışarıda not tutma, gerektiğinde getirme. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **Mindtrip [pazarlama, 30 Eyl 2026]:** tercihleri geziden geziye hatırlıyor, arkada fiyat izliyor.
  https://www.prnewswire.com/news-releases/mindtrip-launches-personal-travel-assistant-that-knows-the-traveler-not-just-the-trip-302893318.html
- **Ortak desen:** gezinin küçük yapılı durumu tek doğruluk kaynağı ve her turda verilir; ham sohbet geçmişi ikincil,
  kısaltılır; kullanıcı profili ayrı tutulur.

## 3. Sohbet içinde web araması (bizim "karavan kiralama" hatası)

- **Anthropic web arama aracı [müh]:** sonuç aynı turun içinde, konuşmanın **yanına** etiketli bir blok olarak
  ekleniyor, yerine geçmiyor; kaynak her zaman var. https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- **Gemini Google Search grounding [müh]:** model kendi sorgularını yazıyor, kaynaklı tek cevap sentezliyor.
  https://ai.google.dev/gemini-api/docs/google-search · Not: JSON şeması + arama birlikte olunca kaynak bilgisi boş
  dönebiliyor: https://discuss.ai.google.dev/t/grounding-metadata-grounding-chunks-grounding-supports-empty-when-using-structured-output-with-google-search-tool/113240
- **Sorguyu yeniden yazma [müh]:** aramadan önce soruyu sohbetten bağımsız, bağlamlı bir sorguya çevirmek çok turlu
  sohbette en iyi sonucu veriyor. https://docs.nvidia.com/rag/2.6.0/multiturn.html
- **Sıra önemli [müh]:** uzun belge (arama sonucu) başa, soru ve talimat sona; kaynak etiketli. ~%30'a varan fark.
  https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/long-context-tips · Bilgi ortada kalınca
  model kaçırıyor: https://arxiv.org/abs/2307.03172 · Bağlam uzadıkça ve tek bir dikkat dağıtıcıyla bile başarı
  düşüyor: https://research.trychroma.com/context-rot
- **Bizdeki kök neden (kodda doğrulandı):** arama 8 sn'yi geçince sonuç `landedText()` ile modelden geçmeden ham
  yazılıyor; sorgu kuralı yer adını bile engelliyor gibi okunuyor; gezi durumu bağlamın gerisinde kalıyor.
  Üçü de yukarıdaki kaynaklarla aynı teşhis: bağlamsız sorgu, sentez adımı yok, gezi özeti sona yakın değil.

## 4. Sabit liste olmadan niyet anlama

- **ChinaTravel (ICLR 2026) [müh]:** sabit kısıt menüsüyle slot doldurma, gerçek isteklerde ("bileşik, çeşitli,
  örtük") başarısız; doğal dili yapılı bir dile çevirip kodla aramak ~10 kat daha iyi. https://arxiv.org/abs/2412.13682
- **TripScore (Ekim 2025) [müh]:** gerçek kullanıcılar az ve serbest yazıyor; önce uygulanabilirlik kapısı, sonra
  tercih puanı. https://arxiv.org/abs/2510.09011
- **Ask-before-Plan (EMNLP 2024) [müh]:** ne zaman soru gerektiğini tahmin et, eksiği araçla topla, sonra planla.
  https://arxiv.org/abs/2406.12639
- **Google Research (Haziran 2025) [müh]:** model yumuşak hedefleri (ne, ne kadar önemli) önerir; algoritma sert
  kısıtları (açılış saati, yol süresi) karşılar. https://research.google/blog/optimizing-llm-based-trip-planning/
- **Expedia Romie [üçüncü]:** grup sohbetini yapılı arama filtrelerine çeviriyordu ("çatı manzarası, erken giriş").
- **Bulunamadı:** "oluşturmadan önce plan özeti onayı" ya da "en fazla N soru" diyen bir satıcı belgesi yok.
  Layla'da gözlediğimiz (bkz. `2026-10-07-layla-gezi-turu-denemesi.md`) ve Ask-before-Plan'den çıkan makul tasarım.

## 5. Doğrulama ve eleştirmen

- **TravelPlanner (ICML 2024):** GPT-4 %0,6 başarı; kısıtları takip edemiyor. https://arxiv.org/abs/2402.01622
- **LLM + kısıt çözücü (NAACL 2025):** en iyi model kendi kendini doğrulasa da %10; problemi kısıt kümesine çevirip
  çözücüye verince %93,9. https://aclanthology.org/2025.naacl-long.176
- **TREK (Temmuz 2026):** 15 ajan, kural tabanlı (hakem modelsiz) değerlendirme; en iyisi (GPT-5.6) çözülebilir
  görevlerin %46,2'sinde tam uygulanabilir plan, ortanca %6,6. Darboğaz: yolcunun söylemediği ihtiyaçlar.
  https://arxiv.org/abs/2607.26977
- **Sonuç:** ikinci bir "eleştirmen" model az şey katıyor; kısıtı kodla kontrol etmek ve ihlali modele bir kez geri
  vermek işe yarıyor.

## Trip Radar için çıkarımlar

1. Tek model, turda tek çağrı kalsın; çok ajan bu ölçekte gereksiz ve pahalı.
2. Gezi türü sabit liste değil: serbest "konsept" + yapılı kısıt listesi; model üretir, **kod doğrular**, bozuksa
   bugünkü sabit kalıba düşer. Sabit kalıplar örnek olarak isteme girer.
3. Kısıtlar tek yerde (Trip.intent) ve her tüketen (otel, transfer, öneri, sohbet) oradan okur. Layla'nın
   "VIP araç deyip paylaşımlı transfer koyması" böyle önlenir.
4. Pano sohbeti: gezi özeti her turda kullanıcı mesajının hemen önünde; arama sorgusuna gezinin yeri girer;
   arama sonucu etiketli veri olarak gelir ve cevap **bu gezi için** sentezlenir (yavaş sonuç dahil).
5. Hafıza: gezi durumu (var) + her turda kısa özet (yeni) + küçük, yerel, onaylı kullanıcı profili (sonra).
6. Sorular en fazla 3, yalnız planı değiştiren; oluşturmadan önce tek satırlık plan özeti.
