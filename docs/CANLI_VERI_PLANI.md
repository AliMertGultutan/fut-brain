# Canlı veri bağlantısı: seçenekler ve gerekenler

18 Ekim 2026 tarihinde incelenen kaynaklara göre hazırlanmıştır. Bu belge bir entegrasyonun çalıştığı veya bir sağlayıcının erişim vereceği anlamına gelmez.

## Uygulanan Parse entegrasyonu

Yerel Node.js sunucusu, sunucuda API anahtarı saklama, 5 dakikalık önbellek, istek/kredi sınırı ve platform/oyun yılı ayrımı eklendi. Ayarlar ekranından kendi Parse anahtarı kaydedilebilir. FUT Gallery üzerinden oyuncu araması/katalog, tek kart fiyatı ve özellikleri; Evolutions üzerinden kaynağın program koşulları istenebilir. Örnek kulüp/pazar kartları gerçek Parse havuzuna otomatik karıştırılmaz. Ayrıntılı kurulum [README](../README.md) içindedir.

Gerçek hesap anahtarı yerel sunucuya eklenmiş, oyuncu araması ve fiyat/özellik çağrıları gerçek sağlayıcıyla doğrulanmıştır. Güncel SBC listesi ve kaynak koşulları için ayrı panel eklenmiştir; yalnızca eksiksiz desteklenen kadro görevleri çözücüye aktarılır. Puan/Item Score görevleri listelenebilir ancak otomatik hesaplanmaz. Yerel testler sağlayıcının belgelenmiş yanıt biçimlerini de taklit eder; tüm fiyatların doğruluğunu kanıtlamaz. Otomatik kulüp bağlantısı henüz yoktur.

Kaynak: [Parse FUTBIN API belgeleri](https://parse.bot/marketplace/1b6234f9-0dfb-4cca-99b4-2d6d37aec6a7/futbin-com-api).

## Önce oyun sürümü ve SBC türü

EA'nın FC27 açıklamasına göre yeni Simplified / Streamlined SBC'ler, geleneksel 11 kişilik kadro yerine uygun kartların Item Score katkısını kullanır. Bu katkı reyting, nadirlik ve holografik durumdan etkilenir; aynı sistem Gallery'de de kullanılır. Dolayısıyla mevcut örnek 87/88/89 jeton ikamelerini gerçek FC27 kuralı olarak kullanamayız.

FC27 hedefleniyorsa ayrı Item Score gereksinimi, mevcut ilerleme, kart uygunluğu, kart başına skor ve bonus modelleri gerekir. Oyundan alınmış örnekler ve sürümü belirtilmiş puan tablosuyla doğrulama yapılmalıdır. Mevcut hesaplama modeli ve FC25 kimyası sürüm kontrolünden geçirilmelidir.

Kaynaklar: [EA SBC açıklaması](https://help.ea.com/en/articles/ea-sports-fc/sbcs/), [FC27 Launch Update](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-launch-update).

## Pazar fiyatları

Önerilen yol: belgelenmiş ve kullanım izni olan bir fiyat sağlayıcısı veya veri lisansı. FUTBIN, FUT.GG ya da başka bir kaynağın API, lisans, platform kapsamı, güncelleme aralığı ve ücret koşulları doğrulanmalıdır. Parse için bağlantı altyapısı eklendi; hesap erişimi ve kaynak kullanım hakları ayrıca doğrulanmalıdır. Ücretsiz ve sınırsız bir API varsayılmamıştır.

FUTBIN koşullarının 13. bölümü genel olarak yazılı izin olmadan scraping/data mining'i yasaklıyor; öğrenci ve içerik üreticileri için ayrıca bir istisna belirtiyor. Bu istisnanın bu ürünün kullanımını kapsadığı varsayılmamalıdır. Ürün için sağlayıcıdan uygun erişim/lisans almak daha sağlam bir temeldir.

Kaynak: [FUTBIN kullanım koşulları](https://www.futbin.com/tos).

Parse bağlantısında Node.js sunucusu, sunucuda saklanan API anahtarı, önbellek, istek sınırları, platform ayrımı, kart kimliği eşlemesi ve zaman damgalı fiyatlar uygulanmıştır. Canlı, önbellek, eski ve kullanılamayan fiyatlar ayrı değerlendirilir. Fiyat servisi kulüp sahipliği bilgisinin yerine geçmez.

## Kulüp ve Gallery verileri

Bugün çalışan seçenek: kullanıcı tarafından sağlanan JSON/CSV ve yerel takip. Kullanıcı verileri örnek katalogla karıştırılmaz.

Otomatik kulüp okuma için EA tarafından izin verilen, belgelenmiş bir erişim yöntemi veya yetkilendirilmiş ortak entegrasyon gerekir. Projede bu erişim henüz doğrulanmış değildir. EA'nın kuralları sunuculara resmî istemcilerle erişilmesini ister ve üçüncü taraf uygulama/eklentiler konusunda uyarır. Bu yüzden sıradan bir tarayıcı eklentisini güvenli veya izinli bağlantı olarak vaat edemeyiz.

Kaynak: [EA FC kuralları](https://help.ea.com/en/articles/ea-sports-fc/fc-rules/).

Geçmiş Gallery sahipliği, mevcut kulüp listesinden çıkarılamaz. Ayrı bir geçmiş sahiplik kaydı veya kullanıcı tarafından içe aktarılmış geçmiş veri gerekir. Aynı şekilde güncel Evolution koşulları için program kuralları, kart özellikleri ve güncel oyun sürümü gerekir.

## Senden gereken bilgiler

1. Oyun sürümü: FC25 / FC26 / FC27; platform: PC / PlayStation / Xbox.
2. Uygulama kişisel kullanım için mi, herkese açık bir ürün mü olacak?
3. Hedef SBC'lerin oyun içindeki gereksinimleri, varsa Item Score ilerlemesi ve token/parça türleri.
4. İçe aktarılabilir kulüp/koleksiyon örneği; şifre, oturum çerezi veya erişim tokenı içermez.
5. Veri sağlayıcısı için bütçe tercihi, seçilen servis ve erişim/lisans koşulları. API anahtarı gerektiğinde güvenli sunucu ortamına eklenir.
6. Herkese açılacaksa barındırma, veritabanı ve kullanıcı hesabı ihtiyacı.

## Önerilen sıra

Oyun sürümü ve gerçek kurallar → gerçek kulüp örneğiyle yerel doğrulama → izinli fiyat kaynağı ve sunucu → izinli kulüp bağlantısının değerlendirilmesi → Gallery geçmişi ve güncel Evolution verileri.

Fiyat sağlayıcısı ve izinli hesap erişimi kesinleşmeden otomatik tarama, sürekli canlı fiyat veya Web App'e otomatik kadro aktarma sözü verilmemelidir.
