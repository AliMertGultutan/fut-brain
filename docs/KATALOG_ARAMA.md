# Kompakt oyuncu kataloğu

Adres: `http://127.0.0.1:3000/#fut-gallery`.

Önceki iki ayrı pazar/yerel galeri ekranı tek bir katalogda birleştirildi. Pazar ve gerçek kulüp kayıtları aynı tablo düzeninde, ayrı kaynak seçimleriyle gösterilir. Pazar kartları kulüpte bulunmuyor veya geçmişte hiç alınmamış varsayılmaz; sağlayıcılar arasında isim benzerliğinden sahiplik eşlemesi yapılmaz.

## Arama ve filtreler

- Mevki ve alternatif mevkileri dahil etme seçeneği.
- Kayıtlı kart sürümü, lig, ülke, kulüp, kart sınıfı ve adı bilinen oyun tarzı.
- Reyting ve fiyat için minimum/maksimum aralık.
- Altı saha oyuncusu özelliğinin her biri için alt sınır.
- Kaynak güncellemesi son 30 dakika içinde olan fiyatları gösterme seçeneği.
- Son kaynak sayfası veya yüklenmiş bütün pazar kartları arasında seçim.
- İsim, reyting, fiyat ve özellik sütunlarından sıralama. Eksik fiyat/özellik her iki sıralama yönünde de sona gider.

Bu filtreler **yalnız yüklenmiş kartlarda** çalışır ve Parse çağrısı yapmaz. Bunlar sağlayıcının bütün veritabanına iletilen lig/ülke filtreleri olarak sunulmaz. Yeni arama, kaynak sayfası veya ayrıntı okumalarının mevcut ücretleri düğmelerinde gösterilir. Katalog çağrısının kaynak minimum reytingi 40’tan düşük gönderilmez. Sayfada bulunmayan kartlar için daha fazla kaynak sayfası veya yeni ad araması gerekir.

## Satırlar ve ayrıntılar

Oyuncu satırında isim/sürüm, reyting, ana/alternatif mevki, fiyat durumu, kulüp/lig/ülke, altı özellik ve oyun tarzı sayısı birlikte gösterilir. Kompakt satır tercihi vardır. Her yerel sayfada 25 kayıt gösterilir; alttaki sayfalama ücretsizdir. Kaynakta Sonraki düğmesi bunun aksine yeni sağlayıcı sayfasını ister.

İncele, kayıtlı ayrıntıları satırın altında ücretsiz açar. Fiyat ve Özellikleri Yenile ayrı ve açık ücretli işlemdir. Kaynak vermezse özellik veya PlayStyle uydurulmaz; bilinmeyen değerler sıfır yerine çizgiyle gösterilir. Kalecilere saha oyuncusu özellikleri yazılmaz. Kullanılabilir resmî EA portresi yoksa başka oyuncunun fotoğrafı yerine baş harfler gösterilir. Boy, ayak tercihi, beceri/zayıf ayak yıldızı ve Item Score gibi doğrulanmış verisi bulunmayan ek sütunlar eklenmedi.

## Doğrulama

Yeni filtre testleri; aksanlı/Türkçe isimler, birleşik lig/kulüp/mevki koşulları, alternatif mevki tercihi, min/max çelişkileri, güncellik, eksik özellik, kaleci ve fiyat sıralamasını kapsar. Ürün çıktısı testi tek tablo, filtre adları, eksik veri etiketleri, ücretsiz inceleme ve ayrı güncelleme düğmesini doğrular. 170 otomatik senaryo ve üretim derlemesi geçti. Geliştirme sırasında yeni ücretli Parse çağrısı yapılmadı. Gerçek tarayıcı yerleşimi bu otomatik çıktı testleriyle doğrulanmış sayılmaz.
