# FUT Brain

Parse / FUTBIN kartlarını, güncel SBC koşullarını ve Evolution kayıtlarını gösteren yerel deneme prototipi. FC 27 klasik SBC'ler için PlayStation pazarından tokensız konsept kadro önerisi alınabilir. Chrome/Edge eklentisi aktif EA kadrosunu okuyabilir ve konsept SBC taslağını aktarabilir; tüm kulüp envanteri halen manuel içe aktarılır. Önceden bulunan demo kayıtları silinmez, ana akışta gizlenir.

## Çalıştırma

Node.js 24 kullanın.

```powershell
npm install
npm run dev
```

Tarayıcı adresi: http://127.0.0.1:3000

Bu komut arayüzü 3000, yerel veri sunucusunu 3001 numaralı bağlantı noktasında başlatır. İkisi de yalnızca bu bilgisayara açıktır. Derlenmiş sürüm için `npm run build` ardından `npm start` kullanın; adres `http://127.0.0.1:3001` olur. `npm run preview` veri sunucusunu başlatmaz.

## Parse bağlantısını açma

1. [Parse FUTBIN sayfasında](https://parse.bot/marketplace/1b6234f9-0dfb-4cca-99b4-2d6d37aec6a7/futbin-com-api) kendi hesabınızın API anahtarını ve erişim/kredi durumunu kontrol edin.
2. Uygulamada **Ayarlar → Parse bağlantısı** alanına anahtarı yazıp **Anahtarı Kaydet** düğmesine basın. Alternatif: `.env.example` dosyasını `.env.local` olarak kopyalayıp `PARSE_API_KEY` değerini doldurun. Sunucu ortamındaki `PARSE_API_KEY` dosyaya göre önceliklidir.
3. **Bağlantıyı Test Et** ilk katalog sayfasını getirir; yeni dış çağrı en fazla 1 kredidir. Sadece anahtar kaydetmek bağlı durumu oluşturmaz.
4. **FUT Gallery** üstündeki Oyuncu kataloğu panelinde oyun yılı/platform seçip oyuncu arayın veya katalog sayfası getirin. Her düğmede belgelenen çağrı bedeli gösterilir. Arama sonuçları son sorguya göre ayrı listelenir; tüm okunan kartlar çözücü havuzunda tutulur. Kart satırından fiyat/özellik ayrıntısını açabilirsiniz. Ayrıntı fiyatı, güncelleme zamanını, mevcut özellikleri ve PlayStyle listesini gösterir; sağlayıcıdan gelmeyen alanlar açıkça belirtilir. İlerleme ve hata mesajı arama alanının hemen altında görünür.

   Oyuncu adı alanında iki harften itibaren öneriler açılır: örneğin `gre` → Greenwood isimleri. Öneriler yaygın isim listesinden, okunan kartlardan ve bu tarayıcıya kaydedilmiş isimlerden üretilir; tam oyun kataloğu değildir. Yazarken veya öneri seçerken API çağrısı yapılmaz. Fareyle veya ok tuşları/Enter ile adı doldurun, ardından **Oyuncu Ara** düğmesine basın. Aksanlar ve Türkçe harfler aramada eşleştirilir.
5. **Overview → Verileri Güncelle**, ilk katalog sayfasını, ilk SBC sayfasının koşullarını ve EVO listesini getirir. FC 27 için en fazla 12, FC 26 için en fazla 3 kredi kullanır. Her bölümün okuma zamanı gösterilir; bakiyesi bilinmeyen kulüp için sahte sayı üretilmez.
6. **Evolutions** ekranında uygunluk koşullarını ve yükseltmeleri açın. EVO yıl seçimi oyuncu aramasıyla aynı oyun yılı bağlamını kullanır. Sağlayıcı başka oyun yılları döndürebilir; yalnızca URL'si seçilen yılı doğrulayan kayıtlar gösterilir. 18 Ekim 2026 gerçek çağrısında Parse 85 FC 26 kaydı döndürdü. FC 27 için [FUTBIN ana EVO kategorisinden](https://www.futbin.com/27/evolutions?category=3) aynı gün kontrol edilen 7 gerçek programın koşulları, yükseltmeleri ve kaynak bağlantıları tarihli kayıt olarak eklendi (`src/data/evolutionsSnapshot.ts`). Bu kayıt otomatik yenilenmez; diğer kategoriler dahil değildir. Doğrudan sunucu okuması HTTP 403 döndürdüğü için engel aşılmaz. Parse FC 27 kapsamına geçtiğinde canlı kaynak tarihli kaydın yerini alır. **EVO Verilerini Güncelle** yalnızca sağlayıcıyı sorgular; tarihli kayıt için yeni okuma zamanı üretmez.

## Güncel SBC görevleri

**SBC Solver → Güncel SBC görevleri** panelinde oyun yılı seçip **SBC Listesini Getir** düğmesine basın. FC 27'nin hafif listesi sayfa başına 1 kredi; **Bu Sayfanın Koşullarını Getir** aynı sayfadaki grupların alt görev koşullarını 10 krediyle getirir. FC 26 uç noktası liste ve koşulları tek çağrıda 1 krediyle döndürür. Çağrı fiyatları [Parse belgelerine](https://parse.bot/marketplace/1b6234f9-0dfb-4cca-99b4-2d6d37aec6a7/futbin-com-api) dayanır; 5 dakikalık önbellek ve mevcut oturum sınırı uygulanır.

Görev kartını seçince kaynağın süre metni, ödülleri, tahmini maliyeti ve tüm koşulları gösterilir. Kaynak metninden yalnızca eksiksiz desteklenen geleneksel kadro koşulları çevrilir. Oyuncu sayısı, minimum takım reytingi/TOTW, aynı ve farklı lig/ülke/kulüp sayı sınırları desteklenir. Kimya istenen görevler, gerçek slot dizilişi sağlanmadığı için otomatik çözücüye aktarılmaz. Kart seviyesi, nadirlik ve tanınmayan koşullar sessizce atlanmaz; görev görüntülenebilir ancak otomatik çözüm kapalıdır. Item Score/puan koşulları ayrı türde gösterilir, reyting veya jetona dönüştürülmez.

**PS Konsept Kadro Öner** aktif, kimliği doğrulanmış klasik FC 27 alt görevleri için sağlayıcının `fc27_sbc_solver` servisini çağırır (en fazla 10 kredi). Varsayılan fiyat yaşı 60 dakika; alternatif 3 saattir. Bu servis yalnızca PlayStation fiyatları kullanır. PC seçili olsa bile önerinin PS maliyeti olduğu açıkça gösterilir. Sahip olunan kart varsayımı veya `players_required` gönderilmez; bütün kartların alış maliyeti sayılır. Yanıtın görev kimliği/adı, kaynak koşullarının eksiksiz kontrolü, kart kimlikleri, kart seviyesi, slotlar, fiyat güncelliği, fiyat toplamı ve kimya toplamı doğrulanır. Sağlayıcı bazı kilitli slot düzenlerini desteklemeyebilir; arama başlatılmadı sonucu, süre sınırı veya bulunamadı sonucundan ayrı açıklanır. Puanlı görevler öneriye dahil edilmez.

Sonuç gerçek dizilişi, her kartın aynı sürümünü, PS fiyatını, kaynak fiyat zamanını ve sağlayıcının her koşul için kontrolünü gösterir. Tüm piyasa için en ucuz olduğu iddia edilmez; ancak sağlayıcı kanıtladıysa taranan havuz içindeki optimum etiketi kullanılabilir. CSV kart listesi ve tüm koşulları içeren JSON indirilebilir. **EA Web App'i Aç** resmî uygulamayı açar; hazır kadro eklentiyle konsept taslağa aktarılabilir. Kart satın alma veya SBC teslimi yapılmaz.

**Yerel Havuzda Dene** yalnızca koşulları tamamen desteklenen görevlerde kullanılabilir. Kaynak koşulları hesaplama sırasında tekrar doğrulanır; değiştirilmiş koşullar reddedilir. Demo kartları, başka oyun yılındaki kartlar ve doğrulanmamış jeton kuralları canlı görevlerde kullanılmaz. Gereken pazar havuzunu FUT Gallery'den, aynı oyun yılı ve platformla yükleyin. Kaynağın ödül değeri bilinmiyorsa uydurulmaz; grup maliyeti ve oyuncu alış maliyeti ayrı tahminlerdir.

Bu ekran hesabınızda SBC tamamlamaz, kart harcamaz veya ödül almaz. Takım reytingi topluluk modeliyle hesaplanır; oyun içi geçerlilik ayrıca kontrol edilmelidir. Kaynağın göreli süre metni okuma anına aittir.

Anahtar `.env.local` dosyasında düz metin olarak bu bilgisayarda saklanır; şifreli kasa değildir. Dosya Git tarafından yok sayılır; anahtar cevaplara, tarayıcı depolamasına ve arayüz derlemesine eklenmez. `VITE_PARSE_API_KEY` kullanmayın. Bu sürüm yerel kullanım içindir; herkese açık yayın için hesap/erişim denetimi gerekir.

Hiçbir pazar çağrısı otomatik başlamaz. Aynı dış istek 5 dakika önbelleğe alınır; eşzamanlı tekrarlar birleştirilir. Aynı başarısız isteğin 1 dakika içindeki tekrarında dış servise yeniden gidilmez ve yeni kredi ayrılmaz. Yerel sunucuda dakikada en fazla 5 yeni çağrı ve 24 saatlik dönemde 50 belgelenmiş kredi deneme sınırı vardır. Başarısız çağrılar da sayılır. Sunucu önbelleği ve kredi sayacı `node_modules/.cache/fut-brain/parse-responses.json` içinde korunur; yeniden başlatma sayacı sıfırlamaz. Anahtarın kendisi bu dosyaya yazılmaz. Sayaç Parse bakiyesi değildir. API anahtarı değişince önbellek temizlenir. Testlerde dış servis kullanılmaz ve izole istemciler varsayılan 20 kredi sınırını korur.

Oyuncu aramasında ana mevki ve alternatif mevkiler kaynakta bitişik veya ayrı yazılabilir; bu biçimler ayrıştırılır ve alternatif mevkiler korunur. Güvenli sayısal Evolution kart kimlikleri de desteklenir. Okunamayan kart yanıtı boş arama gibi sunulmaz.

Fiyatın okunma zamanı ile kaynağın güncelleme zamanı ayrıdır. Katalogda güncelleme yaşı bilinmeyen veya 30 dakikadan eski fiyatlar `STALE` olarak tahmini maliyetle gösterilir; eksik/sıfır fiyat satın alma adayına alınmaz. Xbox için PlayStation veya PC fiyatına otomatik geçiş yapılmaz. Konsept sonuçlarının fiyatları seçilen 60/180 dakika sınırına göre ayrıca izlenir. Okunan kartlar, son SBC sayfası, EVO listesi ve son konsept kadro bu tarayıcıda saklanır; yenilemede korunur, kaynak okuma zamanları değişmez ve yeniden sorgulanmış gibi gösterilmez. Kulüp envanteri değişmez. Tarayıcı depolamasında API anahtarı bulunmaz.

Entegrasyon [Parse'ın yayımladığı şema ve örneklerle](https://parse.bot/marketplace/1b6234f9-0dfb-4cca-99b4-2d6d37aec6a7/futbin-com-api) hazırlanmıştır. Otomatik testler sahte taşıma katmanı kullanır, gerçek Parse erişimini veya kaynak verisinin doğruluğunu kanıtlamaz. Gerçek çağrılarla oyuncu kataloğu, SBC koşulları ve Evolution kaynağı ayrıca denenmiştir. Parse üçüncü taraf sağlayıcıdır; resmî FUTBIN/EA bağlantısı olduğu iddia edilmez.

```powershell
npm test
npm run lint
npm run build
```

## Bu sürümde

- Sabit SBC kadrosu yerine doğrulanan kombinasyonlar aranır. Arama bir Web Worker içinde çalışır.
- Oyuncu sayısı, reyting, TOTW, özel kart, lig, ülke, kulüp, kimya ve tekrar oyuncu şartları denetlenir.
- Kulüp kartının referans değeri, yeni satın alma maliyetinden ayrı tutulur. Eksik fiyat ücretsiz kabul edilmez.
- Küçük havuzlarda tamamlanan arama seçilen hedef için optimumu gösterebilir. Sınırlandırılmış aramada yalnızca bulunan en iyi çözüm gösterilir. Kimya eşlemesi küresel optimum garantisi vermez.
- Jetonlar ancak SBC için kural tanımlanmışsa ve stok yeterliyse kullanılır. Demo örneklerinde 87/88/89 reyting ikameleri vardır. Bunlar FC 27 Item Score kuralları değildir.
- Parça dönüşümü yapılandırılmış orana göre yalnızca yerel envanteri günceller. SBC araması oyuncu veya jeton tüketmez.
- Kadro ve Evolution takip listesi bu tarayıcıda saklanır. Kaydedilmiş kadro SBC harcamalarından korunabilir.
- SBC sonucu JSON, eksik kart listesi CSV olarak indirilebilir. Hazır konsept önerisi Chrome/Edge eklentisiyle EA taslağına aktarılabilir; satın alma veya SBC teslimi yapılmaz.
- JSON/CSV içe aktarma: zorunlu alanlar `name`, `rating`, `position`; isteğe bağlı alanlar `id`, `basePlayerId`, `gameYear` (`"26"`/`"27"`), `club`, `league`, `nation`, `cardType`, `inClub`, `isUntradeable`, `price`, `stats`, `secondaryPositions`.
- `id` kart kaydını, `basePlayerId` futbolcuyu belirtir. Futbolcu kimliği yoksa tekrar futbolcu kontrolünde ad kullanılır. Aynı adlı farklı futbolcular için ayrı `basePlayerId` verin.
- İlk manuel içe aktarmada demo oyuncuları kaldırılır. Tekrarlanan kart kimlikleri birleştirilir; hatalı satırlar açıklanır. Dosya sınırı 2 MB / 10.000 satırdır.

## Hesaplama sınırları

Reyting, kesirli ortalama ve ortalamanın üzerindeki katkıları kullanan temkinli topluluk modeliyle hesaplanır. Resmî EA formülü olduğu iddia edilmez. Kimya FC25 temel profilini kullanır; teknik direktör ve kampanya bonusları kapsam dışıdır. FC27 uyumu, gerçek oyun örnekleriyle ayrıca doğrulanmalıdır.

Eski yerel Evolution örnekleri ve örnek görevler ana prototipte gösterilmez. Evolution ekranı gerçek kaynak koşullarını yıl filtresiyle listeler; EVO kartı kendi detay sayfasını açar; kart sürümü seçilerek katılım koşulları denetlenir. Eksik özellik, PlayStyle veya alternatif mevki varsa kesin uygunluk sonucu verilmez; otomatik yükseltme ve zincir hesabı yapılmaz. Gallery'nin yerel bölümü yalnızca manuel aktarılan katalogdaki sahipliği gösterir; Parse kataloğu sahiplik ve geçmiş sahiplik içermez. Ana açılış ekranı Overview'dur; SBC ekranı güncel görev akışıyla açılır.

Canlı veri için seçenekler ve gereksinimler: [Canlı veri planı](docs/CANLI_VERI_PLANI.md).

## EA konsept kadro eklentisi · prototip

SBC listesi yenilenince önceden alınan koşullar silinmez. Görev başlığına tıklamak kayıtlı koşulları ücretsiz açar; eksik koşullarda düğme üzerindeki belirtilen bedelle sayfanın koşulları getirilir. Koşullar tarayıcıda ve sunucuda 24 saate kadar korunur, kendi okuma tarihleriyle gösterilir. Sunucu kayıtlarını okumak ücretli Parse çağrısı başlatmaz; konsept hesabı için aynı 24 saatlik doğrulanmış kaynak koşulları kullanılır; beş dakikalık fiyat önbelleği görevi gereksiz yere kapatmaz. Sağlayıcının döndürdüğü her koşul yine denetlenir.

Varsayılan yerel harcama koruması 24 saatte 50 kredidir. Ayarlar → Parse bağlantısı → Yerel kredi sınırı bölümünden 20–1000 arasında düzenlenebilir. Sınır değişikliği kredi harcamaz, mevcut kullanım sayacını sıfırlamaz ve sunucu yeniden başlatıldığında korunur. Bu sınır gerçek Parse bakiyesi değildir. Koşulları getirmek ve yeni konsept önerisi almak ayrı ayrı en fazla 10 kredi kullanır. Sınırdan az kredi kalmışsa arayüz bunu işlemden önce açıklar ve Ayarlar'a yönlendirir.

`npm run build:extension` paketlenmemiş eklentiyi `extension/dist` içine, kurulabilir ZIP dosyasını `extension/fut-brain-extension.zip` içine üretir. `npm run build` bu adımı da içerir. Üretilen dosyalar Git'e eklenmez. Sunucu `/api/extension/download` üzerinden ZIP'i sunar; `/extension/index.html` Türkçe kurulum rehberidir.

Chrome'da `chrome://extensions`, Edge'de `edge://extensions` sayfasında geliştirici modunu açıp **Paketlenmemiş öğe yükle** ile `extension/dist` klasörünü seçin. Site erişimini tarayıcıda inceleyip onaylayın. EA Web App ve FUT Brain'i aynı tarayıcıda açın, kurulumdan sonra iki sekmeyi yenileyin. Yerel geliştirmede klasör: `C:\Users\mert2\Desktop\muho\extension\dist`.

0.2.0 sürümü FC 27 / PlayStation kaynaklı 11 standart kart önerilerini ve bir kilitli slotlu 10 altın kart görevlerini destekler. Kaynak FUTBIN kart kimlikleri EA kimliği sayılmaz: ad, reyting ve tekil EA katalog kaydıyla eşleştirilir; EA konsept aramasından yalnızca aynı standart kart seçilir. Görev ve alt görev adları tekil eşleşmelidir. Slotlar ve EA'nın tüm şartları kontrol edilmeden taslak kaydedilmez. Özel kartlar, belirsiz eşleşmeler ve değişmiş koşullar işlemi durdurur.

Site düğmesi EA'da üst bildirim açar ve boş taslağa otomatik yerleştirmeyi başlatır. Farklı taslak ancak EA bildirimindeki **Mevcut Taslağı Değiştir** düğmesiyle değişir; yedekler korunur. Aynı kadro tekrar kaydedilmez. Kaydetme sonucu belirsizse otomatik tekrar yapılmaz; EA ekranı kontrol edilmelidir. Eklenti veya sekme çalışma sırasında yeniden yüklenirse mükerrer kaydetme başlatılmaz. Böyle bir durumda EA taslağını kontrol edip gönderimi siteden yeniden başlatın.

İzinler `storage` ve `scripting`; sayfa erişimi yalnızca `www.ea.com` ve yerel FUT Brain içindir. Çerez, şifre ve oturum anahtarı okunmaz; Parse anahtarı taşınmaz. İş durumu `chrome.storage.session` içinde, tarayıcı kapanana kadar tutulur. Mesajlar uzantı kimliği, üst çerçeve, kaynak sekmesi ve izin verilen adreslerle sınırlandırılır. Yerel site portları yalnızca 3000/3001'dir; başka alan adına dağıtım için izin listesi ayrıca güncellenmelidir. Tarayıcı eklentisi EA'nın mevcut istemci arayüzlerine bağlıdır; resmi ve kararlı bir EA entegrasyonu değildir.

Otomatik testler sahte EA çalışma ortamını kullanır. 0.2.0 için eklentiyi tarayıcının Uzantılar sayfasından yenileyip EA ve site sekmelerini yeniden yüklemek gerekir; eski sürüm yeni alanları destekliyormuş gibi gösterilmez. Kullanıcının paylaştığı Juventus–Lazio ekranında 11 konsept kart aktarımı 7/7 koşul, 71 reyting ve 18 kimyayla görülüyor. 0.2.0 sürümündeki yeni aktif kadro okuması ve 10 altın kart yolu için gerçek EA testi henüz yapılmadı. Daha önce aynı Bayern–Leipzig kadrosu EA arayüzünde elle kurulup 6/6 koşul, 65 reyting ve 21 kimyayla doğrulandı; bu sonuç eklentinin canlı testinin yerine geçmez. [EA kuralları](https://help.ea.com/en/articles/ea-sports-fc/fc-rules/) üçüncü taraf eklenti ve otomasyondan kaçınılmasını ister; hesap riski olmadığı garanti edilmez.


### 0.2.0 ürün akışı

- Ürün ekranlarındaki FUTBIN marka etiketleri ve dış bağlantıları kaldırıldı. Kaynak kimlikleri doğrulama için arka planda korunur. Genel SBC çözümü Parse servisinden gelir; yerel çözümler ayrıca etiketlenir.
- Evolution programları `#evolutions/27/59` gibi site içi detay bağlantılarıyla açılır. Oyuncu adı araması ve kart sürümü seçimi vardır; reyting, temel özellik, PlayStyle sayısı, pozisyon ve yasak pozisyon kontrolleri gerçek bilinen alanlarla yapılır. Bilinmeyen koşul veya eksik veri uygun sayılmaz. FC 27 EVO listesi halen tarihli kayıttır, otomatik canlı liste iddiası yoktur.
- Yalnızca `Exactly Gold` ve `10 players` koşullu klasik görevlerde iki yerel yol vardır: kayıtlı platform fiyatlarıyla en düşük toplamı seçmek veya EA kataloğundaki düşük reytingli standart altın adayları ücretsiz seçmek. İkinci yol piyasa fiyatını taramaz; en ucuz maliyet garantisi yoktur. Kilitli slotun sayısı doğrulanır, slot korunur ve tüm gerçek EA koşulları geçmeden taslak kaydedilmez. Başarısız doğrulamada eski saha ve yedekler geri yüklenir.
- Eklenti EA açıldığında görünür sekmede aktif ana kadroyu okur; siteye ilk 11, yedekler, gerçek diziliş, reyting ve kimya gönderilir. EA'daki kadro değiştirilmez, tüm kulüp taranmaz. Başka yerel portlara veya dış alan adlarına yayın yapılmaz. Son görüntü site tarayıcısında en fazla 24 saatlik başlangıç kaydı olarak kullanılır; her zaman okuma tarihi gösterilir.
- Yeni özelliklerin gerçek EA testi eklenti 0.2.0 olarak yenilendikten sonra yapılmalıdır. Otomatik senaryolar gerçek tarayıcı testinin yerine geçmez.


### 0.2.1 kadro okuma düzeltmesi

Bu ara sürümde doğrudan `assetId` alanı yerine `getAssetId()` kullanıldı; bu alanın oyuncu kimliği olmadığı 0.2.2'de düzeltilmiştir. Konsept kartların envanter kimliği 0 olabilir; farklı kaynak kartları bu nedenle birbirinin tekrarı sayılmaz ve kulüp sahipliğine eklenmez. Tam isim `getFullName()` üzerinden alınır. Kart verisi veya sekme erişimi hataları genel bağlantı mesajıyla gizlenmez; yalnızca güvenli hata açıklamaları gösterilir. Geçici kayıt/bildirim hatası, doğru okunan kadronun isteyen sekmeye dönmesini engellemez.

0.2.0 kullanılıyorsa paketi 0.2.1 olarak yenileyip EA ve site sekmelerini yeniden yüklemek gerekir. Bu değişiklik için ek Parse çağrısı gerekmez.

### 0.2.2 kadro kimliği ve eklenti yenileme düzeltmesi

EA oyuncusu `databaseId` ile okunur; `definitionId` kart sürümünü korur. Önceki okuyucudaki `getAssetId()` oyuncu kimliği değil, kart türü alanıydı ve normal oyuncularda sıfır olabiliyordu. İsim tamamlama EA'nın `getStaticDataByDefId(databaseId)` kataloğunu kullanır. Kimlik doğrulaması gevşetilmez; eksik envanter, kart sürümü ve oyuncu kimliği ayrı hata kodlarıyla bildirilir.

Eklenti yenilenince eski sekmedeki `sendMessage` çağrısının hem anlık hatası hem Promise reddi yakalanır. Eski bağlantı işlem göndermeyi bırakır; EA okuma zamanlayıcısı ve odak dinleyicisi durur. Site iki sekmenin yenilenmesini ister; otomatik taslak aktarımı tekrarlanmaz. Kurulu klasörü güncelleyip eklentinin sürümünü 0.2.2 olarak kontrol etmek, ardından EA ve site sekmelerini yenilemek gerekir. Ek Parse çağrısı yapılmaz.

### 0.3.0 gerçek saha, EA görselleri ve oyuncuya göre canlı EVO

Ana kadro ekranı EA slot kimliklerini, sağdan sola numaralanan slotların doğru saha yerleşimini ve slot başına gerçek EA kimyasını kullanır. Bilinmeyen kimya sıfır sayılmaz. EA oyuncuları ayrıca manuel planlayıcıya yeniden dizilmez; manuel planlayıcı yalnız elle içe aktarılan oyuncuları kullanır. Ortak örnek fotoğraf kaldırıldı. Eklenti, EA'nın `AssetLocationUtils` üzerinden resmi kart arka planını ve mevcut kartın portresini okur; yalnız HTTPS EA alan adları kabul edilir, sorgulu ve kimlik bilgisi taşıyan URL'ler reddedilir. Başarısız görselde başka oyuncunun resmi yerine baş harfler görünür.

Oyuncuya tıklamak, aktif kadro veya yedeklerdeki aynı envanter kartıyla EA Academy programlarını okur. Kategori/sayfa taraması en fazla 12 çağrı ve sınırlı süreyle yapılır; kısmi kapsam açıkça belirtilir. Katılıma kapalı, başlayan, süresi dolmuş veya beklemedeki programlar önerilmez. EA'nın mevcut kart üzerinde çalışan uygunluk kuralları kullanılır; bilinmeyen koşul uygun sayılmaz. Tek yollu EVO'ların seviye reyting artışları üst sınırlarla hesaplanır; “EA’dan Son Kartı Göster” yalnız GET önizleme hizmetinden son reytingi ve özellikleri alır. Seçmeli EVO yollarında kesin sonuç uydurulmaz. Kartı EVO'ya kaydetme, coin harcama veya ödül alma çağrısı yoktur.

Bu oyuncu kontrolü Parse kredisi kullanmaz. EVO yanıtı en fazla bir dakika eklenti belleğinde tutulur; kart reytingi/sürümü değişince önbellek geçersizleşir. Genel Evolutions sayfasının tarihli kayıt listesi ayrı kalır; oyuncu panelindeki canlı sonuç yalnız başarılı EA yanıtıyla gösterilir. Gerçek oturumda görsel ve EVO doğrulaması için eklentiyi 0.3.0 olarak yenileyip EA ve site sekmelerini yenilemek gerekir.

### 0.3.1 EVO kimlik biçimi ve hata ayrıntısı

EA program kimliği yalnız sayı varsayılmaz; 80 karaktere kadar harf, sayı, alt çizgi ve tire kabul edilir. UUID kimlikler önizleme hizmetine sayıya dönüştürülmeden aktarılır. Yol/sorgu karakterleri reddedilir. EVO yanıtı doğrulama hataları güvenli `EVO-DATA` kodlarıyla, okuma hataları da aşamalarıyla gösterilir; ham hata, oturum bilgisi veya yanıt gövdesi açığa çıkarılmaz. Gerçek oturumda bu sürümün sonucu ayrıca kontrol edilmelidir.

### 0.3.2 EVO taşıma hatası ve resmi PlayStyle simgeleri

EVO liste çağrısında `chrome.scripting.executeScript` argümanlarına `[playerId, undefined]` veriliyordu. Chrome yalnız JSON ile taşınabilen argümanları kabul ettiğinden okuyucu başlamadan `EVO-EXEC` oluşuyordu. Liste isteği artık yalnız `[playerId]`, önizleme isteği `[playerId, programId]` gönderir. Hata Chrome'un argüman kısıtını uygulayan testte önce üretildi, düzeltmeden sonra geçti; yalnız okuyucu fonksiyonunu doğrudan çağıran önceki test bu taşıma hatasını kapsamıyordu.

PlayStyle adları `extendedPlayerInfo.signatureAbility.name.<id>`, etkileri `extendedPlayerInfo.signatureAbility.desc.<id>.baseTrait/iconTrait` anahtarlarıyla açık EA oturumunun güncel yerelleştirmesinden alınır. Resmi `images/traits/bio/basetrait<id>.png` ve `icontrait<id>.png` simgeleri kullanılır. Normal ve + ayrı gruplarda gösterilir, açıklamalar tıklamayla açılır. Eksik veri “yok” sayılmaz; eski kayıtta yalnız PS numaraları bulunuyorsa kadroyu güncelleme mesajı gösterilir. Aynı oyun tarzının + sürümü normal sürümün yerine geçer ve iki kez sayılmaz.

Kurulu eklenti 0.3.2'ye güncellenip EA ve site sekmeleri yenilenmelidir. Resmi normal/+ simge adresleri HTTP 200 ve PNG içeriğiyle doğrulandı; gerçek EA oturumundaki uçtan uca EVO sonucu kullanıcı testi gerektirir. Parse çağrısı eklenmedi.

### 0.3.3 oyuncu paneli temizliği, coin ve kompakt görünüm

Kullanıcının 19 Ekim 03:23 kaydında EVO listesinin 73 programı okuduğu ve uygun programları getirdiği görüldü. Aynı kayıtta oyuncu değiştikçe önceki oyuncuların PlayStyle listeleri birikiyordu. Seçili oyuncu alanındaki PlayStyle ve EVO kardeş bileşenlerine aynı React anahtarı verilmişti. Aynı anahtarlar kaldırıldı; tüm detay paneli seçili kartın kimliğiyle yeniden oluşturulur. Kart değişince önceki panelin içeriği ve bekleyen yanıt dinleyicileri temizlenir.

Coin alanı sabit `null` yerine EA üst çubuğunun kullandığı `services.User.getUser().getCurrencies()` kaydındaki COINS bakiyesine bağlandı. Ek ağ çağrısı yoktur. Bakiye bilinmiyorsa “Bakiye bekleniyor” gösterilir; gerçek sıfır bakiye sıfır olarak korunur. Bu alanın gerçek oturumda doğrulanması gerekir.

Kadro zeminine koyu site renkleriyle uyumlu hafif saha çizgileri ve ışık geçişleri eklendi. PlayStyle simgeleri 44 px yerine 32 px, satır boşlukları ve EVO kartları biraz daha küçük gösterilir. Adlar, açıklamalar ve klavye odak göstergeleri korunur. Eklentiyi 0.3.3'e güncelledikten sonra EA ve site sekmeleri yenilenmelidir.

### 0.3.4 EVO önizleme ve Item Score önerisi

Kullanıcının `fut brain.mp4` kaydında çalışan EVO listesine rağmen son kart önizlemesi boş dönüyordu. EA Academy deposu programları `Map` içinde kaynak kimliğinin türüyle tutar; önizleme DAO’su aynı kimlikle depoya bakar. Liste için metne çevrilen kimlik önizlemede artık kaynak nesnedeki sayı veya UUID olarak gönderilir. Sayısal kimlik ve UUID ayrı testlerle doğrulanır. Önizle düğmesi her programın sağ üstüne taşındı; kartlar ve özellik kutuları bir miktar küçültüldü, PlayStyle simgeleri 28 px oldu. Okunabilir etiketler ve odak göstergeleri korundu.

Johan Manzambi gibi Item Score görevleri klasik kadro reytingi veya 87/88/89 jeton modeliyle hesaplanmaz. Yeni `SCORE_GET` okuyucusu açık EA oturumundan görev hedefini, teslim edilmiş puanı ve konsept kartların sunucudan gelen `sbsScore` değerini okur. Oyuncular sağlayıcı kimliğiyle doğrudan EA’da aranmaz; EA kataloğunda ad ve reyting tekil eşleşmesiyle doğrulanır. Bilinmeyen veya sıfır kart puanı için formül uydurulmaz. Standart kartlar, desteklenen tek değerli minimum/maksimum/tam reyting koşullarıyla karşılaştırılır; tanınmayan veya OR ile birleşen ek koşullarda öneri durur.

Seçili platform ve yıl için son 30 dakikalık fiyatı bulunan standart adaylar karşılaştırılır. Reyting ve nadirlik çeşitliliğiyle en fazla 60 aday okunur. Yerel dinamik program, kalan puanı karşılayan en düşük maliyetli sepeti bu doğrulanmış havuzda bulur; tüm piyasayı kapsadığı veya gerekli adette kopya bulunacağı iddia edilmez. Aynı kartın tekrarları ayrı satın alma ve ayrı teslimler gerektirebilir. Özel kartlar desteklenmez. EA puan kontrolü ücretsizdir; fiyat sayfası getirme düğmeleri en fazla 1 Parse kredisi olarak ayrı gösterilir. Otomatik satın alma veya SBC teslimi yapılmaz. Seçili görev değişince ilgisiz eski konsept kadro gösterilmez.

Doğrulama: 157 otomatik senaryo, tip kontrolü ve üretim derlemesi geçti. Bunlar gerçek EA hesabındaki uçtan uca testi doğrulamaz. Yeni paket 0.3.4 olarak kurulup hem EA hem site sekmesi yenilenmelidir. Bu geliştirme sırasında ücretli Parse çağrısı yapılmadı.

Geçmiş alım-satım verisinin erişim sınırları `docs/EA_ISLEM_GECMISI_NOTU.md` içinde kaydedildi.

### Clubs takip bölümü

`/#clubs` adresi ve sol menüdeki Clubs bağlantısı; kulüp arama, takip tercihleri, takım özeti, sıralanabilir oyuncu tablosu, maç oyuncusu ayrıntıları, lig/hazırlık/play-off filtreleri ve PDF rapor indirmesini açar. Veriler doğrudan EA’nın herkese açık Clubs hizmetinden alınır; Parse veya yeni bir tarayıcı eklentisi kurulumu gerekmez. Bu prototip `common-gen5` platformunu kullanır.

Aynı isteğin eşzamanlı kopyaları birleştirilir, veri iki dakika merkezde saklanır. Sayfa açık ve görünürken otomatik yenileme açılıp kapatılabilir. Başarılı okumalar `data/clubs/` altında son kayıt ve tekilleştirilmiş maç arşivi olarak saklanır. EA kesintisinde mevcut son kayıt eski tarihiyle açıkça işaretlenir. Kaynağın son 10 maç sınırı nedeniyle görülmemiş bütün eski maçlar geri getirilemez.

Kaynak GitHub deposunun tam ZIP’i, MIT lisansı ve SHA-256 doğrulaması `vendor/fc27-clubs-api/` altında saklandı. Uygulama çalışma sırasında GitHub’a bağımlı değildir. Kullanım, saklama ve sınırlar: `docs/CLUBS_TAKIP.md`.

Doğrulama: 164 otomatik senaryo, tip kontrolü ve üretim derlemesi geçti. Canlı EA bağlantısı uygulamanın HTTP uç noktası üzerinden test edildi: Fenerbahçe adlı herkese açık 11715 numaralı kulüpte 28 üye, 7 lig, 6 hazırlık ve 10 play-off maçı okundu ve ayrı arşivlendi. Bunlar test anındaki değerlerdir. Gerçek tarayıcıda tıklama ve yerleşim kontrolü ayrıca yapılmalıdır.

### Kompakt FUT Gallery ve gelişmiş filtreler

Pazar ve kulüp galerisinin üst üste duran iki ayrı ekranı tek katalogda birleştirildi. Satırlarda kart adı/sürümü, reyting, mevkiler, fiyat durumu, kulüp/lig/ülke, altı özellik ve oyun tarzı bilgisi gösterilir. Mevki, sürüm, lig, ülke, kulüp, oyun tarzı, reyting/fiyat aralıkları, özellik alt sınırları ve güncel fiyat filtreleri yüklenmiş verilerde ücretsiz çalışır. İsim/reyting/fiyat/özellik sıralaması ve yerel sayfalama eklendi. Ücretsiz İncele işlemi, ücretli kaynak güncellemesinden ayrıdır. Kullanılabilir EA resmi olmayan oyuncuda sahte ortak fotoğraf kullanılmaz.

Bu değişiklik sağlayıcının bütün kataloğunda yeni bir sunucu filtre API’si sunmaz; filtre kapsamı ekranda son kaynak sayfası veya yüklenmiş pazar havuzu olarak seçilir. 170 otomatik senaryo, tip kontrolü ve derleme geçti. Ayrıntılar: `docs/KATALOG_ARAMA.md`.
