import React, { useEffect, useState } from 'react';
import type { AppSettings } from '../../types/index.ts';
import type { ParseStatus } from '../../services/parseAdapter.ts';
import { ClubDataProvider } from '../../services/providers.ts';
import { downloadText } from '../../services/export.ts';

interface SettingsViewProps {
  settings: AppSettings; onUpdateSettings: (settings: AppSettings) => void; onOpenImport: () => void;
  onResetData: () => void; clubPlayerCount: number; parseStatus: ParseStatus | null;
}
const button = 'min-h-11 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-bold cursor-pointer hover:brightness-110 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary';
export function SettingsView({ settings, onUpdateSettings, onOpenImport, clubPlayerCount, parseStatus }: SettingsViewProps) {
  const [platform, setPlatform] = useState(settings.platform);
  const [message, setMessage] = useState('');
  useEffect(() => { setPlatform(settings.platform); }, [settings.platform]);
  const save = () => { try { onUpdateSettings({ ...settings, platform }); setMessage('Platform seçimi kaydedildi. Platform değiştiyse pazar verilerini yeniden getir.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Kaydedilemedi.'); } };
  const exportClub = () => { const players = ClubDataProvider.getPlayers().filter(p => p.priceStatus !== 'DEMO'); downloadText('fut-brain-manuel-kulup.json', JSON.stringify(players, null, 2), 'application/json;charset=utf-8'); setMessage(`${players.length} manuel kart dışa aktarıldı.`); };
  return <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
    <h1 className="text-2xl font-bold">Platform ve kulüp verileri</h1>
    {message && <p role="status" aria-live="polite" className="rounded-lg bg-surface-container p-3 text-sm">{message}</p>}
    <div className="grid md:grid-cols-2 gap-4"><section className="rounded-xl bg-surface-container-low border border-outline-variant p-5 space-y-4"><h2 className="font-bold text-lg">Kart fiyat platformu</h2><label className="text-sm block">Pazar platformu<select aria-label="Ayarlar pazar platformu" className="w-full min-h-11 mt-2 p-3 rounded-lg bg-surface-container-high border border-outline-variant" value={platform} onChange={e => setPlatform(e.target.value as AppSettings['platform'])}><option value="PC_WEBAPP">PC</option><option value="PLAYSTATION">PlayStation</option><option value="XBOX">Xbox · ayrı fiyat varsa</option></select></label><button className={button} onClick={save}>Platformu Kaydet</button><p className="text-sm text-outline">Overview ve oyuncu kataloğu aynı platform seçimini kullanır. FC 27 konsept SBC servisi kendi PlayStation fiyatlarıyla çalışır; PC fiyatı olarak gösterilmez.</p></section>
      <section className="rounded-xl bg-surface-container-low border border-outline-variant p-5 space-y-4"><h2 className="font-bold text-lg">Manuel kulüp kayıtları</h2><p className="text-3xl font-bold">{clubPlayerCount} kart</p><p className="text-sm text-outline">Eklenti, EA’daki aktif ilk 11 ve yedeklerini okur. Tüm kulüp envanteri henüz taranmaz. CSV veya JSON içe aktararak sahip olduğun kartları Kadro ekranında kullanabilirsin. Gerçek SBC’nin yerel aramasında oyun yılı belirtilmiş kartlar kullanılır.</p><div className="flex flex-wrap gap-3"><button className={button} onClick={onOpenImport}>Kulüp Verisi İçe Aktar</button><button className={button} onClick={exportClub}>Manuel Kayıtları İndir</button></div></section></div>
    <section className="rounded-xl bg-surface-container-low border border-outline-variant p-5"><h2 className="font-bold text-lg">Prototipteki veri kaynakları</h2><dl className="mt-4 text-sm space-y-3">{[
      ['Oyuncular ve fiyatlar', 'Pazar verileri · FC 26 / FC 27 · seçilen platform'], ['SBC görevleri ve koşulları', 'Pazar verileri · sayfalı kaynak listesi'], ['Tokensız konsept kadro', 'Pazar verileri · FC 27 · yalnızca PlayStation'], ['Evolution programları', 'Pazar verileri · kaynakta bulunan oyun yılları'], ['Kulüp ve kadro kayıtları', 'EA aktif kadrosu ve bu tarayıcıdaki manuel kayıtlar'],
    ].map(([label, value]) => <div key={label} className="grid sm:grid-cols-2 gap-2 border-t border-outline-variant pt-3"><dt className="font-bold">{label}</dt><dd className="text-outline">{value}</dd></div>)}</dl><p className="text-sm text-outline mt-4">{parseStatus?.configured ? 'Parse anahtarı sunucuda kayıtlı.' : 'Parse anahtarı henüz eklenmedi.'} Veriler kendiliğinden sorgulanmaz. Konsept kadroyu eklentiyle EA taslağına gönderebilirsin; uygulama kart satın almaz veya SBC teslim etmez.</p></section>
  </div>;
}
