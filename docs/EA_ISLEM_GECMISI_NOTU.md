# EA kart ve işlem geçmişi: erişim notu

İnceleme tarihi: 19 Ekim 2026. Bu not, herkese açık EA Web App istemci kodunun ve EA açıklamasının incelenmesine dayanır. Kullanıcının hesabından geçmiş işlem dökümü alınmadı.

## Okunabilir görünen alanlar

- Kulüpte veya açık listelerde hâlâ bulunan kartın `lastSalePrice` alanı, EA kart bilgilerinde alış bedeli olarak gösterilir. Kartın sahip sayısı da ayrı bir alandır. Bunlar tek başına bütün eski alışları, alış tarihlerini veya kârı göstermez.
- EA’nın transfer listesi okuma hizmeti `services.Item.requestTransferItems()`; sonuçta hâlâ listede duran aktif, satılmamış ve satılmış kayıtlar bulunur. İstemci, satılmış kayıtları `getAuctionData().isSold()` ile ayırır. Mevcut liste tam geçmiş kabul edilmemelidir; temizlenmiş satışların geri geleceği doğrulanmadı.
- EA Gallery, kulüpten çıkanlar dahil edinilmiş oyuncu kartlarını tutar. Kart koleksiyonu kaydı, işlem tarihi ve fiyatı bulunan bir alım-satım defteri anlamına gelmez. Gallery’nin özel okuma yöntemi bu incelemede doğrulanmadı ve uygulamaya eklenmedi.

EA’nın Gallery ve Item Score açıklaması: [FC 27 Launch Update](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-launch-update).

## Sonraki proje için uygulanabilir yaklaşım

Kullanıcı projenin kapsamını anlattığında, mevcut transfer listesini ve erişilebilen alış bedellerini salt okunur başlangıç kaydı olarak değerlendirebiliriz. Bundan sonraki görünür işlemler düzenli, tekilleştirilmiş kayıtlarla takip edilebilir. Bir satış listeden temizlenmeden yakalanırsa saklanabilir; geçmişte temizlenmiş bütün satışları geri getirme sözü verilemez. Fiyatı veya zamanı eksik olaylar kâr hesabına kesin veri olarak sokulmamalıdır.

Bu aşamada yeni bir takip sistemi kurulmadı; kayıt temizleme, kart satışa koyma, satın alma veya hesap üzerinde değişiklik yapılmadı.
