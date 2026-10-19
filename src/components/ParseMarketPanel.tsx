import React, { useEffect, useState } from 'react';
import type { ParseMarket } from '../services/useParseMarket.ts';
import { PlayerCatalogView } from './PlayerCatalogView.tsx';

const field = 'w-full min-h-11 rounded-lg bg-surface-container-high px-3 py-2 text-on-surface border border-outline-variant focus-visible:outline-2 focus-visible:outline-primary';
const button = 'min-h-11 rounded-lg px-4 py-2 bg-primary-container text-on-primary-container font-bold cursor-pointer hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary';
type PanelProps = { market: ParseMarket; variant: 'settings' | 'players' | 'evolutions'; initialQuery?: string };
export function ParseMarketPanel(props: PanelProps) {
  return props.variant === 'players' ? <PlayerCatalogView market={props.market} initialQuery={props.initialQuery} /> : <ParseConnectionPanel {...props} />;
}
function ParseConnectionPanel({ market, variant, initialQuery = '' }: PanelProps) {
  const [key, setKey] = useState('');
  const [creditLimit, setCreditLimit] = useState(market.status?.sessionCreditLimit || 50);
  useEffect(() => { if (market.status) setCreditLimit(market.status.sessionCreditLimit); }, [market.status?.sessionCreditLimit]);
  const [evoSearch, setEvoSearch] = useState('');
  const ready = Boolean(market.status?.configured) && !market.busy;
  const feedback = <div className="space-y-2">
    <div role="status" aria-live="polite" aria-atomic="true" className="text-sm rounded-lg bg-surface-container p-3">{market.busy ? market.activity : market.message || { settings: 'Anahtarı kaydet, ardından bağlantıyı test et. Sonuç burada görünecek.', players: 'Oyuncu ara veya katalog getir. Sonuçlar bu alanda gösterilecek.', evolutions: 'Evolution Getir düğmesine bas. Sonuç burada görünecek.' }[variant]}</div>
    {market.error && <p role="alert" className="text-error bg-error-container/20 rounded-lg p-3">{market.error}</p>}
  </div>;
  const evos = market.evolutionPage?.evolutions.filter(e => e.year === market.year && e.name.toLowerCase().includes(evoSearch.toLowerCase())) || [];
  return <section aria-label="Parse veri bağlantısı" className="bg-surface-container-low rounded-xl border border-outline-variant p-4 md:p-6 flex flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-bold text-xl text-primary">{variant === 'settings' ? 'Parse bağlantısı' : variant === 'players' ? 'Oyuncu kataloğu' : 'Evolution programları'}</h2>
        <p className="text-outline mt-1 text-sm">Parse üzerinden pazar verileri • EA kulüp hesabına bağlanmaz.</p></div>
      <span className="px-3 py-2 rounded-lg bg-surface-container-high text-sm font-bold">{!market.status ? market.error ? 'Sunucuya ulaşılamadı' : 'Bağlantı durumu okunuyor…' : !market.status.configured ? 'Anahtar gerekli' : market.status.connected ? 'Son çağrı başarılı' : 'Henüz doğrulanmadı'}</span>
    </div>
    {variant === 'settings' && feedback}
    {variant === 'settings' && <>
      <p className="text-sm text-outline">Kendi anahtarını <a className="text-primary underline" href="https://parse.bot/" target="_blank" rel="noreferrer">Parse hesabından</a> alıp aşağıya gir. Anahtar sunucuda saklanır, yeniden gösterilmez ve tarayıcı depolamasına yazılmaz.</p>
      <form className="flex flex-col sm:flex-row items-end gap-3" onSubmit={async e => { e.preventDefault(); const entered = key; setKey(''); await market.saveKey(entered); }}>
        <label className="flex-1 w-full text-sm">Parse API anahtarı<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} maxLength={512} className={field + ' mt-1'} placeholder="Kendi Parse anahtarını buraya gir" required disabled={market.busy} /></label>
        <button className={button} disabled={market.busy || !key.trim()} type="submit">Anahtarı Kaydet</button>
      </form>
      <button className={button + ' self-start'} disabled={!ready} onClick={() => market.loadPlayers('', 1, 85)}>Bağlantıyı Test Et · en fazla 1 kredi</button>
      <p className="text-sm text-outline">Test ilk katalog sayfasını okur. Aynı istek 5 dakika önbellekten karşılanır. Otomatik sorgu yok; yerel deneme sınırı 24 saatte {market.status?.sessionCreditLimit || 50} kredi, hız sınırı dakikada 5 çağrıdır. Sunucuyu yeniden başlatmak kullanım sayacını sıfırlamaz.</p>
      {market.status && <p className="text-sm">Bu 24 saatlik dönemde dış çağrılara ayrılan: {market.status.creditsAttempted}/{market.status.sessionCreditLimit} kredi. Başarısız çağrıların bedeli de temkinli olarak sayılır; gerçek bakiye Parse hesabındadır.</p>}
      <form className="rounded-xl bg-surface-container p-4 space-y-3" onSubmit={e => { e.preventDefault(); void market.saveBudget(creditLimit); }}>
        <h3 className="font-bold">Yerel kredi sınırı</h3>
        <p className="text-sm text-outline">Bu uygulamanın 24 saatlik harcama korumasıdır; Parse bakiyesi değildir. SBC koşulları ve konsept önerisi ayrı ayrı en fazla 10 kredi ister. Sınırı yükseltmek sonraki isteklerde daha fazla Parse kredisi kullanılmasına izin verir.</p>
        <label className="block text-sm">24 saatlik yerel kredi sınırı<input className={field + ' mt-1 max-w-48 block'} aria-label="24 saatlik yerel kredi sınırı" type="number" min={20} max={1000} step={1} value={creditLimit} disabled={market.busy || !market.status} onChange={e => setCreditLimit(Number(e.target.value))} /></label>
        <button className={button} type="submit" disabled={market.busy || !market.status || !Number.isInteger(creditLimit) || creditLimit < 20 || creditLimit > 1000 || creditLimit === market.status.sessionCreditLimit}>Yerel Sınırı Kaydet</button>
        <p className="text-sm text-outline">Kaydetmek kredi harcamaz ve kullanım sayacını sıfırlamaz. Kaydettikten sonra SBC ekranında istediğin görevi açabilirsin.</p>
      </form>
    </>}
    {variant !== 'settings' && !market.status?.configured && <p className="text-sm text-outline">Başlamak için <a href="#settings" className="text-primary underline">Ayarlar → Parse bağlantısı</a> alanına kendi API anahtarını ekle.</p>}
    {variant !== 'settings' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-sm">Oyun yılı<select className={field + ' mt-1'} value={market.year} disabled={market.busy} onChange={e => market.setContext(e.target.value as '26' | '27', market.platform)}><option value="27">EA FC 27</option><option value="26">EA FC 26</option></select></label>
    </div>}
    {variant === 'evolutions' && <>
      <button className={button + ' self-start'} disabled={!ready} onClick={market.loadEvolutions}>Evolution Getir · en fazla 1 kredi</button>
      {feedback}
      <p className="text-sm text-outline">Sağlayıcı farklı oyun yılları döndürebilir; yalnızca seçtiğin yılın kayıtları gösterilir. Uygunluk ve yükseltme hesabı bu verilerden otomatik yapılmaz.</p>
      <label className="text-sm">Liste içinde ara<input className={field + ' mt-1'} value={evoSearch} onChange={e => setEvoSearch(e.target.value)} placeholder="Evolution adı" /></label>
      {market.evolutionPage && <p className="text-sm">FC {market.year}: {evos.length} kayıt. Toplam {market.evolutionPage.evolutions.length} kaynak kaydı okundu.{!evos.length ? ' Bu yıl için eşleşen veri yok.' : ''}</p>}
      <div className="max-h-[500px] overflow-auto space-y-3">{evos.map((e, i) => <details key={e.url || `${e.name}-${i}`} className="rounded-lg bg-surface-container p-3"><summary className="cursor-pointer min-h-11 font-bold">{e.name} · {e.cost || 'Bedel belirtilmemiş'} · {e.status}</summary><p className="text-sm text-outline my-2">{e.description}</p><p className="text-sm mb-3">Açılış: {e.unlockTime || '—'} · Bitiş: {e.expires || '—'} (okuma anındaki kaynak metni)</p><h3 className="font-bold">Kaynağın uygunluk koşulları</h3><dl className="text-sm my-2">{Object.entries(e.requirements).map(([key, value]) => <div key={key} className="flex gap-2"><dt>{key}:</dt><dd>{value}</dd></div>)}</dl><h3 className="font-bold">Yükseltmeler</h3><dl className="text-sm my-2">{Object.entries(e.boosts).map(([key, value]) => <div key={key} className="flex gap-2"><dt>{key}:</dt><dd>{value}</dd></div>)}</dl></details>)}</div>
    </>}
  </section>;
}
