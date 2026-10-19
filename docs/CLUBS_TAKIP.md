# Clubs takip prototipi

Adres: `http://127.0.0.1:3000/#clubs`. Sol menüdeki Clubs bağlantısından da açılır.

## Kullanım

1. Kulüp adını arat ve doğru kulübü kimliğiyle seç. Aynı adı taşıyan farklı takımlar olabilir. Fenerbahçe bağlantısı herkese açık gerçek bir kulüp aramasıdır; kullanıcının hesabı veya kulübü olduğu varsayılmaz.
2. Takım özetini, oyuncu tablosunu ve son maçları incele. Oyuncular gol, asist, maç ve ortalama puana göre sıralanabilir. Maça tıklayarak o maçın oyuncu performanslarını aç.
3. Kulübü takip et. En fazla 12 takip tercihi ve son seçilen kulüp/maç türü bu tarayıcıda saklanır. Clubs bölümüne döndüğünde son seçimin açılır; doğrudan kulüp bağlantısı varsa o seçim önceliklidir. Takipten çıkmak maç arşivini silmez.
4. Lig, hazırlık ve play-off maçları ayrı seçilir. Her maç türünün son listesi ve arşivi ayrıdır.
5. Kaydedilen Maçları Göster ile önceden bu bilgisayara kaydedilen maçları aç. PDF Raporunu İndir; kulüp özetini, oyuncu istatistiklerini, seçili türde kaydedilmiş maçları ve EA’nın son maç listesindeki oyuncu ayrıntılarını okunabilir bir PDF olarak indirir. İndirme, kaydedilmiş veriden yapılır; yeni EA veya Parse çağrısı başlatmaz. Veri okuma tarihi ve rapor oluşturma tarihi ayrı gösterilir.

## Kaynak ve güncellik

- Veriler doğrudan EA’nın herkese açık `https://proclubs.ea.com/api/fc` hizmetinden alınır. Parse kullanılmaz; EA şifresi veya oturum çerezi gerekmez.
- Bu prototip `common-gen5` ortak platformunu kullanır: PS5, Xbox Series ve PC. Diğer platformlar doğrulanmış gibi sunulmaz.
- Aynı kulüp ve maç türünü isteyen eşzamanlı çağrılar birleştirilir. Başarılı kaynak verisi iki dakika ortak kayıttan sunulur; Yenile düğmesi de bu kaydı kullanabilir. Kaynak istekleri merkezi sırada aralıklı işlenir.
- Ekran açık ve görünürken, otomatik kontrol açıksa iki dakikada bir yeniden kontrol edilir. Sayfa kapalıyken arka planda sürekli takip yapan ayrı bir hizmet kurulmadı.
- EA kesintisinde son başarılı kayıt varsa tarihi korunarak eski kayıt etiketiyle gösterilir. Başarı veya sıfır istatistik uydurulmaz. EA veriyi gecikmeli güncelleyebilir; bu ekran maç içi anlık telemetri değildir.
- API en fazla son 10 maçı verir; kaçırılmış eski maçların tamamı geri getirilemez. Arşiv yalnız başarılı kontrollerde görülen maçları biriktirir.

## Yerel dosyalar ve kaynak bağımsızlığı

`data/clubs/` altında kulüp kimliği ve maç türüyle isimlenen iki JSON kaydı bulunur:

- `*-snapshot.json`: En son başarılı takım, oyuncu ve son maç okuması.
- `*-archive.json`: Görülmüş maçların tekilleştirilmiş arşivi; maç oyuncuları da saklanır.

Yazımlar geçici dosya ve yeniden adlandırma ile yapılır. Bozuk arşiv sessizce silinmez; hata gösterilir. Gerçek kayıtlar kaynak depoya yanlışlıkla eklenmemeleri için Git dışında tutulur. Ayrı disk veya sunucu yedeği yoktur. PDF, paylaşılabilir bir okuma raporudur; uygulamaya geri yüklenen tam veri yedeği olarak sunulmaz. Tam kayıtların yedeği için `data/clubs/` klasörü ayrıca saklanmalıdır. Bu prototip tek sunucu süreci içindir; çoklu sunucuda ortak veritabanı ve kuyruk gerekir.

PDF üretimi sunucudaki PDFKit ile yapılır. Türkçe karakterleri destekleyen Noto Sans fontları ve lisansları `server/assets/fonts/` içinde saklanır; rapor indirmek için dış bir font servisine bağlanılmaz.

`vendor/fc27-clubs-api/` içinde upstream kaynak ZIP’i, MIT lisansı, sabit commit ve SHA-256 kaydı bulunur. Uygulama çalışma sırasında GitHub’a veya bu Python paketinin indirilmesine bağımlı değildir; kendi TypeScript bağdaştırıcısı EA’ya bağlanır. Kaynak deponun kaldırılması bağlantıyı doğrudan kesmez; EA hizmet değişiklikleri yine uyumluluk çalışması gerektirebilir.

## Doğrulama

Canlı testte Fenerbahçe adlı herkese açık `11715` numaralı kulüp EA’da bulunarak takım, üye ve lig maçı uç noktaları HTTP 200 ile okundu. Uygulamanın kendi HTTP uç noktası 173 maçlık takım toplamını, 28 üye kaydını ve 7 son lig maçını normalleştirip yerel arşive yazdı. Bunlar 19 Ekim 2026’daki okuma değerleridir; güncel sorguda değişebilir.

Hazırlık ve play-off filtreleri de canlı denendi: sırasıyla 6 ve 10 maç HTTP 200 ile alındı ve ayrı arşiv dosyalarına yazıldı. Aynı kulüp için eşzamanlı HTTP okumalarında kaynak okuma tarihinin aynı kaldığı ve ortak kayıt etiketinin döndüğü doğrulandı. Resmî EA kulüp arma adresi de HTTP 200 / PNG yanıtı verdi.

Otomatik senaryolar; veri doğrulama, hazırlık maçı sonucu, doğru takımın oyuncuları, eşzamanlı 30 aramanın tek kaynak isteğine birleşmesi, sunucu yeniden açılışında taze kayıt, maç tekilleştirme, kesintide eski kaydın tarihinin korunması, HTTP köken kontrolü ve kaynak ZIP bütünlüğünü kapsar. Gerçek tarayıcı etkileşimi bu senaryoların yerine geçmez.
