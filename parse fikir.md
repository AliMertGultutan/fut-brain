# Parse fikir

Tarih: 19 Ekim 2026

Bu dosya, ileride konuşulacak fikirleri kaydeder. Uygulama kararı verilmedi ve bu not kapsamında koda müdahale edilmedi.

## Amaç

Üyelik sisteminde kullanıcıya günlük sorgu sınırı koymadan Parse maliyetini yönetmek. Her kullanıcının aynı veriyi ayrı ayrı ücretli sorgulaması yerine merkezî veri deposu kullanmak.

## Merkezî yapı

Parse → Bizim merkezî veri deposu → Kullanıcılar

- Kullanıcı aramaları doğrudan Parse'a değil, bizim sunucumuza gider.
- Oyuncular, kart sürümleri, SBC koşulları ve ortak EVO program bilgileri merkezde tutulur.
- Aynı yıl, platform ve sorgu koşullarına ait güncel veri tüm kullanıcılara depodan sunulur.
- Kullanıcıların kişisel kulüp verileri ortak katalogla karıştırılmaz ve başka kullanıcılara sunulmaz.

## Örnek kullanım

1. Bir kullanıcı Messi'yi arar.
2. Güncel kayıt varsa sonuç bizim depomuzdan gelir; yeni Parse çağrısı yapılmaz.
3. Kayıt yoksa veya yenilenmesi gerekiyorsa merkez tek bir sorgu başlatır.
4. Aynı anda aynı veriyi isteyen diğer kullanıcılar bu sorgunun sonucunu paylaşır.
5. Sonuç depoya kaydedilir ve sonraki isteklere oradan sunulur.

Aynı veriyi isteyen 1.000 kişi için 1.000 ayrı dış çağrı yapılması gerekmez. Bu paylaşım, aynı sorgu ve güncellik dönemi için geçerlidir.

## Güncelleme yaklaşımı

- Arka planda çalışan merkezî güncelleme sistemi kurulur.
- Popüler oyuncuların fiyatları daha sık, az talep gören kartların fiyatları daha seyrek yenilenebilir.
- Oyuncu kimliği ve katalog bilgileri gibi az değişen alanlar uzun süre saklanabilir.
- SBC koşulları yeni görev geldiğinde veya değişiklik gerektiğinde güncellenir.
- Kullanıcıya verinin son güncelleme zamanı gösterilir.
- Kullanıcının yenile düğmesine basması her seferinde ayrı bir ücretli sorgu başlatmaz.
- Kesin yenileme aralıkları henüz belirlenmedi.

“Bir kere sorgulamak”, veriyi sonsuza kadar güncel tutmak anlamına gelmez. Her gerekli güncelleme döneminde yeniden okuma maliyeti oluşabilir.

## Kişiye özel SBC çözümleri

- Ortak oyuncu, fiyat ve koşul verileri kullanılarak kullanıcının kulübüne uygun kadroyu bizim çözücümüz hesaplar.
- Her kişisel çözüm için Parse'ın çözücü uç noktasına gitme ihtiyacı azaltılır.
- Mevcut yerel çözücünün desteklediği koşullar ve çözüm kalitesi geliştirilmelidir.
- Bu işlemin kendi sunucumuzda hesaplama ve işletim maliyeti vardır; tamamen ücretsiz değildir.

## EA üzerinden okunan bilgiler

- Kadro ve oyuncuya göre EVO kontrolü için geliştirilen EA okuma yolu Parse dışında tutulur.
- Ortak EVO program verisi merkezde tutulabilir; kullanıcının gerçek kartı ve hesabına bağlı uygunluk kontrolleri ayrıca ele alınır.
- EA okuma özelliklerinin gerçek oturum testleri tamamlanmadan üretim güvenilirliği varsayılmaz.

## Maliyeti belirleyen unsurlar

- Kaç farklı oyuncu, kart, platform ve görev verisinin gerektiği.
- Verilerin ne sıklıkta yenilendiği.
- Parse uç noktalarının işlem başına kredi tüketimi.
- Toplu katalog ve toplu fiyat alma desteği.
- Merkezî deponun ne kadar isteği dış çağrı yapmadan karşılayabildiği.
- Kendi sunucumuzun veri saklama ve çözüm hesaplama maliyeti.

Merkezî yapı aynı veriye yönelik tekrarları azaltır. Herkes farklı kartlar sorgularsa veri kapsamı ve ilk veri toplama maliyeti yine büyür.

## Parse görüşmesinde sorulacaklar

- Oyuncu arama, kart ayrıntısı, fiyat, SBC koşulları ve SBC çözümü için ayrı kredi maliyetleri nedir?
- Toplu oyuncu kataloğu ve toplu fiyat uç noktaları var mı?
- Veriyi kendi depomuzda saklama ve ücretli üyelerimize gösterme şartları nelerdir?
- Kaynak site verisinin ticari kullanımı ve gösterimi için hangi izinler ayrıca gerekir?
- Hacme göre indirim veya sabit ücretli veri akışı sunuluyor mu?
- Başarısız istekler ücretlendiriliyor mu?
- İstek hızı, eşzamanlılık ve harcamayı durduran kesin bütçe sınırları nasıl işliyor?

## Henüz kararlaştırılmayanlar

- Üyelik ücretleri ve paket kapsamı.
- Başlangıç oyuncu/kart kataloğunun kapsamı.
- Fiyatların yenilenme sıklığı ve kabul edilebilir gecikme.
- Parse'ın ana sağlayıcı mı, tamamlayıcı sağlayıcı mı olacağı.
- Üretim altyapısı ve alternatif lisanslı veri sağlayıcıları.

Kullanıcının tercihi: Kullanıcı başına günlük sorgu sınırı yerine merkezî veri paylaşımı üzerinde ilerlemek.

## Referanslar

- [Parse fiyatlandırması](https://parse.bot/pricing)
- [Parse kullanım koşulları](https://parse.bot/terms)

Fiyat ve sözleşme şartları uygulama kararı öncesinde yeniden doğrulanmalı.
