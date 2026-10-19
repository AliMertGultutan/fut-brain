import React from 'react';
import type { ParseMarket } from '../../services/useParseMarket.ts';
import { eaWebAppUrl } from '../ConceptSquadPanel.tsx';
import { evolutionDataForYear } from '../../data/evolutionsSnapshot.ts';

const button = 'min-h-11 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-bold cursor-pointer hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary';
const card = 'rounded-xl border border-outline-variant bg-surface-container-low p-5';
const time = (value?: string) => value ? new Date(value).toLocaleString('tr-TR') : 'Henüz okunmadı';
export function DashboardView({ market, playerCount, onNavigate }: { market: ParseMarket; playerCount: number; onNavigate: (page: string) => void }) {
  const sbcs = market.sbcPage?.sets || [];
  const evoData = evolutionDataForYear(market.evolutionPage, market.year);
  const activeEvos = evoData.evolutions.filter(e => e.status.toLowerCase() === 'active');
  const classic = sbcs.filter(set => set.segments.some(s => s.rules.kind === 'SQUAD'));
  const points = sbcs.filter(set => set.segments.some(s => s.rules.kind === 'POINTS'));
  const ready = Boolean(market.status?.configured) && !market.busy;
  const concept = market.concept;
  return <div className="p-4 md:p-6 xl:p-8 max-w-[1500px] mx-auto space-y-6" aria-label="Canlı veri özeti" role="region">
    <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface-container-low to-surface-container-low p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-primary text-sm tracking-wider font-bold">FUT BRAIN / DENEME PROTOTİPİ</p><h1 className="text-3xl md:text-4xl font-bold mt-3">Bir sonraki kadronu planla.</h1><p className="text-outline mt-3 max-w-2xl">Güncel kaynak kartlarını ve görev koşullarını incele, klasik SBC için tokensız konsept kadro önerisi al.</p></div><span className="rounded-lg bg-surface-container-high p-3 text-sm">{market.status?.connected ? 'Parse · Son çağrı başarılı' : market.status?.configured ? 'Parse anahtarı hazır' : 'Veri bağlantısı kurulmalı'}</span></div>
      <div className="flex flex-wrap gap-3 items-end mt-6">
        <label className="text-sm flex flex-col gap-1">Oyun yılı<select aria-label="Özet oyun yılı" className="min-h-11 bg-surface-container-high p-2 rounded-lg border border-outline-variant" value={market.year} disabled={market.busy} onChange={e => market.setContext(e.target.value as '26' | '27', market.platform)}><option value="27">EA FC 27</option><option value="26">EA FC 26</option></select></label>
        <label className="text-sm flex flex-col gap-1">Kart fiyat platformu<select aria-label="Özet fiyat platformu" className="min-h-11 bg-surface-container-high p-2 rounded-lg border border-outline-variant" value={market.platform} disabled={market.busy} onChange={e => market.setContext(market.year, e.target.value as 'pc' | 'ps' | 'xbox')}><option value="pc">PC</option><option value="ps">PlayStation</option><option value="xbox">Xbox · ayrı fiyat varsa</option></select></label>
        <button className={button} disabled={!ready} onClick={market.refreshAll}>{market.busy ? market.activity : `Verileri Güncelle · en fazla ${market.year === '27' ? 12 : 3} kredi`}</button>
        <a href={eaWebAppUrl} target="_blank" rel="noreferrer" className="min-h-11 px-4 py-2 rounded-lg border border-outline-variant font-bold inline-flex items-center hover:border-primary">EA Web App’i Aç ↗</a>
      </div>
      <p className="text-sm text-outline mt-3">İlk katalog sayfası + ilk SBC sayfasının koşulları + EVO listesi. Yeni dış çağrı yalnızca isteğinle yapılır; aynı istek 5 dakika önbellekten gelir. Konsept kadro araması ayrıca en fazla 10 kredi kullanır.</p>
      {(market.busy || market.message) && <p role="status" aria-live="polite" className="mt-4 rounded-lg bg-surface-container p-3 text-sm">{market.busy ? market.activity : market.message}</p>}
      {market.error && <p role="alert" className="mt-3 text-error bg-error-container/20 rounded-lg p-3 text-sm">{market.error}</p>}
      {!market.status?.configured && <button className={button + ' mt-4'} onClick={() => onNavigate('settings')}>Parse Bağlantısını Kur</button>}
    </section>
    <dl className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[
      ['Okunan pazar kartı', market.players.length, `FC ${market.year} · ${market.platform.toUpperCase()} · Sahiplik içermez`],
      ['Bu sayfadaki SBC', sbcs.length, `${classic.length} klasik grup · ${points.length} puanlı grup`],
      ['EVO kaynak kaydı', activeEvos.length, evoData.kind === 'SNAPSHOT' ? '18.10.2026 kontrolü · 7 ana program' : `FC ${market.year} · Okuma anında aktif`],
      ['Bilinen kulüp kartı', playerCount, playerCount ? 'EA aktif kadrosu ve manuel kartlar' : 'EA kadronu eklentiyle bağla'],
    ].map(([label, value, caption]) => <div key={String(label)} className={card}><dt className="text-sm text-outline">{label}</dt><dd className="text-3xl font-bold mt-2">{value}</dd><p className="text-xs text-outline mt-2">{caption}</p></div>)}</dl>
    <div className="grid xl:grid-cols-[1.5fr_1fr] gap-5">
      <section className={card}><div className="flex justify-between items-start gap-3"><div><h2 className="text-xl font-bold">Klasik SBC fırsatları</h2><p className="text-sm text-outline mt-1">Koşulları alınan, kadroyla tamamlanan görevler</p></div><button className="text-primary min-h-11 cursor-pointer underline" onClick={() => onNavigate('sbc-solver')}>SBC’leri Aç</button></div>
        {classic.length ? <div className="mt-4 space-y-3">{classic.slice(0, 4).map(set => <button key={set.id} className="w-full text-left rounded-lg bg-surface-container p-4 border border-outline-variant hover:border-primary cursor-pointer min-h-20" onClick={() => onNavigate('sbc-solver')}><span className="font-bold block">{set.name}</span><span className="text-sm text-outline block mt-1">{set.segments.filter(s => s.rules.kind === 'SQUAD').length} alt görev · {set.expires}</span><span className="text-xs text-primary block mt-2">FC 27’de PlayStation konsept önerisi al →</span></button>)}</div> : <div className="mt-5 p-5 bg-surface-container rounded-lg"><p>Önce güncel görev koşullarını getir.</p><p className="text-sm text-outline mt-2">Puanlı SBC’ler klasik önerilere dahil edilmez. Kaynağın göndermediği görevler için tahmini koşul üretilmez.</p></div>}
        <p className="text-xs text-outline mt-4">SBC okuması: {time(market.sbcPage?.fetchedAt)}{market.sbcPage?.cached ? ' · Saklanan veri' : ''}. Liste tüm görevleri kapsamayabilir; diğer sayfaları SBC ekranında açabilirsin.</p>
      </section>
      <section className={card}><h2 className="text-xl font-bold">Şimdi dene</h2><ol className="mt-4 space-y-4">{[
        ['1', 'Verileri güncelle', 'Kartlar, SBC koşulları ve EVO kayıtlarını yükle.'], ['2', 'Klasik bir SBC seç', 'SBC Solver’da kadro kurulan alt görevi aç.'], ['3', 'Konsept kadroyu incele', 'Kart sürümleri, gerçek diziliş ve her koşulun sonucunu kontrol et.'],
      ].map(([n, title, text]) => <li key={n} className="flex gap-3"><span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold">{n}</span><div><p className="font-bold">{title}</p><p className="text-sm text-outline mt-1">{text}</p></div></li>)}</ol><p className="text-sm text-outline mt-5">Konsept önerisi FC 27 / PlayStation pazarına aittir. Desteklenen standart kadrolar Chrome/Edge eklentisiyle EA taslağına gönderilebilir. Kulüp bakiyesi ve kart sahipliği otomatik okunmaz.</p>
        <button className={button + ' mt-4'} onClick={() => onNavigate('sbc-solver')}>Konsept Kadro Akışını Dene</button>
      </section>
    </div>
    <div className="grid md:grid-cols-2 gap-5"><section className={card}><h2 className="text-xl font-bold">Evolution gündemi</h2>{activeEvos.length ? <ul className="mt-3 space-y-2">{activeEvos.slice(0, 3).map(e => <li key={e.url} className="p-3 rounded-lg bg-surface-container"><span className="font-bold">{e.name}</span><p className="text-sm text-outline mt-1">{e.cost || 'Bedel belirtilmemiş'} · {e.expires || 'Süre belirtilmemiş'}</p></li>)}</ul> : <p className="text-sm text-outline mt-3">{market.evolutionPage ? `Kaynakta FC ${market.year} için aktif EVO bulunmadı. Diğer oyun yıllarını EVO ekranında görebilirsin.` : 'EVO kayıtları henüz yüklenmedi.'}</p>}<button className="min-h-11 text-primary underline cursor-pointer mt-2" onClick={() => onNavigate('evolutions')}>EVO Koşullarını İncele</button><p className="text-xs text-outline">{evoData.kind === 'SNAPSHOT' ? 'Tarihli kaynak kaydı · otomatik yenilenmez. Kontrol: ' : 'Okuma: '}{time(evoData.fetchedAt || undefined)}</p></section>
      <section className={card}><h2 className="text-xl font-bold">Son konsept kadro</h2>{concept ? <><p className="font-bold mt-3">{concept.sbcName} / {concept.challengeName}</p><p className="text-sm text-outline mt-2">{concept.found ? `${concept.players.length} kart · ${concept.totalCost!.toLocaleString('tr-TR')} coins · PlayStation` : 'Bu aramada çözüm bulunamadı.'}</p><p className="text-xs text-outline mt-2">{time(concept.fetchedAt)} tarihinde okundu. Alış öncesinde fiyatları kontrol et.</p><button className="min-h-11 text-primary underline cursor-pointer" onClick={() => onNavigate('sbc-solver')}>Kadro ve Koşulları Aç</button></> : <p className="text-sm text-outline mt-3">Henüz konsept kadro oluşturmadın. İlk öneriden sonra kartların ve koşul kontrolünün özeti burada görünecek.</p>}<p className="text-xs text-outline mt-3">Pazar kartları okuması: {time(market.page?.fetchedAt)}. Her kartın kaynak fiyat zamanı katalogda ayrıca gösterilir.</p></section></div>
  </div>;
}
