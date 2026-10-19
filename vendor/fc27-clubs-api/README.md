# Saklanan kaynak kopyası

Bu klasör, `1erkandogan/fc27-clubs-api` deposunun tam kaynak ZIP kopyasını, MIT lisansını ve indirme kaydını içerir. Kaynak commit: `26a5ff12ea793042bd776a858c74f3f44dd427f5`. Dosya bütünlüğü için SHA-256 değeri `source.json` içindedir.

- `upstream.zip`: Kaynağın o commit’teki tam kopyası. Açılıp incelenebilir; kendiliğinden çalıştırılmaz.
- `LICENSE.md`: Kaynak yazarın lisansı ve telif bildirimi; korunmalıdır.
- `source.json`: Kaynak URL’si, commit, tarih, boyut ve dosya özeti.

Uygulama bu Python paketini indirerek veya GitHub’dan çalıştırarak başlamaz. İlgili açık EA uç noktaları ve alan eşlemeleri, uygulamanın kendi TypeScript bağdaştırıcısında kullanılır: `server/clubsClient.ts` ve `src/services/clubsData.ts`. Böylece GitHub deposunun kaldırılması çalışan uygulamayı doğrudan kesmez. EA’nın kendi servislerini değiştirmesi veya kapatması durumunda uyumluluk güncellemesi gerekir.

Clubs istemcisinden uyarlanan uç nokta ve veri alanı bilgileri için MIT lisansı bu klasörde saklanır. Bu kaynak üçüncü taraf, gayriresmî bir istemcidir; gelen veri EA’nın `https://proclubs.ea.com/api/fc` hizmetindendir. MIT lisansı kaynak kodu kapsar; EA verisinin ayrı bir lisansı olarak sunulmaz.
