import React, { useEffect, useRef, useState } from 'react';
import type { ParseMarket } from '../services/useParseMarket.ts';
import type { SbcChallenge } from '../types/index.ts';
import { toSolverChallenge } from '../services/sbcData.ts';
import { canRequestConcept } from '../services/conceptSquad.ts';
import { ItemScorePanel } from './ItemScorePanel.tsx';
import { ConceptSquadPanel } from './ConceptSquadPanel.tsx';
import { supportsLocalGold, goldCatalogPlan } from '../services/localGoldConcept.ts';
import { EaTransferPanel } from './EaTransferPanel.tsx';

const button = 'min-h-11 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-bold cursor-pointer hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary';
const field = 'min-h-11 p-2 rounded-lg bg-surface-container-high border border-outline-variant text-on-surface';
export function LiveSbcPanel({ market, onUseChallenge, activeChallenge, onUseDemo }: {
  market: ParseMarket; onUseChallenge: (challenge: SbcChallenge) => void; activeChallenge: SbcChallenge | null; onUseDemo: () => void;
}) {
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [maxAgeMinutes, setMaxAgeMinutes] = useState(60);
  const selectedRef = useRef<HTMLDivElement>(null);
  const page = market.sbcPage;
  const ready = Boolean(market.status?.configured) && !market.busy;
  const remaining = market.status ? Math.max(0, market.status.sessionCreditLimit - market.status.creditsAttempted) : 0;
  const detailCost = market.year === '27' ? 10 : 1;
  useEffect(() => { setSelectedId(''); }, [page?.year, page?.page]);
  const selected = page?.sets.find(set => set.id === selectedId);
  useEffect(() => { if (selected) { selectedRef.current?.focus({ preventScroll: true }); selectedRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, [selectedId, selected?.detailsLoaded]);
  const rows = page?.sets.filter(set => `${set.name} ${set.description}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))) || [];
  const status = market.busy ? market.activity : market.message || (page ? 'Son okunan görevler gösteriliyor. Okuma tarihini kontrol ederek gerektiğinde koşulları yenile.' : 'SBC listesini getirerek başla. Dış çağrı yalnızca düğmeye bastığında yapılır.');
  return <section aria-label="Güncel SBC görevleri" className="rounded-xl bg-surface-container-low border border-outline-variant p-4 md:p-6 space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold text-primary">Güncel SBC görevleri</h1><p className="text-outline text-sm mt-1">Pazar verileri kaynağı · Görev koşulları ve ödüller</p></div><span className="text-sm bg-surface-container-high rounded-lg p-3">{page ? `FC ${page.year} · ${page.detailed ? 'Koşullar alındı' : 'Liste alındı'}` : 'Henüz yüklenmedi'}</span></div>
    {!market.status?.configured && <p className="text-sm text-outline">Önce <a className="text-primary underline" href="#settings">Ayarlar ekranına</a> kendi Parse anahtarını ekle.</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">SBC oyun yılı<select aria-label="SBC oyun yılı" className={field} value={market.year} disabled={market.busy} onChange={event => market.setContext(event.target.value as '26' | '27', market.platform)}><option value="27">EA FC 27</option><option value="26">EA FC 26</option></select></label>
      <label className="flex gap-2 items-center min-h-11 text-sm"><input type="checkbox" checked={activeOnly} disabled={market.busy} onChange={event => setActiveOnly(event.target.checked)} />Yalnızca aktif görevler</label>
      <button className={button} disabled={!ready || remaining < 1} onClick={() => market.loadSbcs(1, false, activeOnly)}>SBC Listesini Getir · en fazla 1 kredi</button>
      {market.year === '27' && <button className={button} disabled={!ready || remaining < detailCost} onClick={() => market.loadSbcs(page?.page || 1, true, page?.activeOnly ?? activeOnly)}>Bu Sayfanın Koşullarını Getir · en fazla 10 kredi</button>}
      {market.year === '27' && <label className="flex flex-col gap-1 text-sm">Konsept fiyat süresi<select aria-label="Konsept fiyat süresi" className={field} value={maxAgeMinutes} disabled={market.busy} onChange={e => setMaxAgeMinutes(Number(e.target.value))}><option value={60}>Son 60 dakika</option><option value={180}>Son 3 saat</option></select></label>}
    </div>
    <p className="text-sm text-outline">{market.year === '27' ? 'Koşulları alınmış göreve tıklamak ücretsizdir. Koşulları eksik bir görevi açmak bu sayfanın koşullarını en fazla 10 krediyle getirir. Hafif liste 1 kredidir; kayıtlı koşulları silmez.' : 'FC 26 için sağlayıcı liste ve koşulları birlikte getirir: en fazla 1 kredi.'} Kayıtlı koşullar 24 saate kadar saklanır; okuma tarihini kontrol et.</p>
    {market.status?.configured && remaining < detailCost && <div role="status" className="rounded-lg bg-surface-container-high p-4 text-sm space-y-2"><p>Yerel kullanım: {market.status.creditsAttempted}/{market.status.sessionCreditLimit} kredi · Kalan {remaining}. Yeni koşullar {detailCost} kredi gerektiriyor. Daha önce alınmış koşullar ücretsiz açılabilir.</p><a href="#settings" className="inline-flex items-center min-h-11 text-primary underline font-bold">Ayarlar’da Yerel Kredi Sınırını Düzenle →</a><p className="text-outline">Bu sınır Parse bakiyen değildir. Sayfa yenilemek veya listeyi tekrar getirmek sınırı kaldırmaz.</p></div>}
    <div role="status" aria-live="polite" aria-atomic="true" className="text-sm bg-surface-container rounded-lg p-3">{status}</div>
    {market.error && <p role="alert" className="text-error p-3 rounded-lg bg-error-container/20">{market.error}</p>}
    {page && <>
      <div className="flex flex-wrap items-end justify-between gap-3"><label className="flex flex-col gap-1 text-sm flex-1">Görev listesinde ara<input className={field} value={search} onChange={event => setSearch(event.target.value)} placeholder="SBC adı" /></label>
        <button className={button} disabled={!ready || remaining < 1 || page.page <= 1} onClick={() => market.loadSbcs(page.page - 1, false, page.activeOnly)}>Önceki · en fazla 1 kredi</button>
        <button className={button} disabled={!ready || remaining < 1 || (page.paginationKnown && !page.hasMore)} onClick={() => market.loadSbcs(page.page + 1, false, page.activeOnly)}>Sonraki · en fazla 1 kredi</button>
      </div>
      <p className="text-sm text-outline">Sayfa {page.page} · {page.activeOnly ? 'Aktif görevler' : 'Tüm görevler'} · Okuma: {new Date(page.fetchedAt).toLocaleString('tr-TR')} · {page.cached ? 'Önbellek' : 'Yeni kaynak yanıtı'}</p>
      {!rows.length && <p>Bu sayfada filtreye uyan görev yok.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{rows.map(set => <button key={set.id} type="button" disabled={market.busy} onClick={() => { setSelectedId(set.id); if (!set.detailsLoaded && ready && remaining >= detailCost) void market.loadSbcs(page.page, true, page.activeOnly); }} aria-pressed={set.id === selectedId} className={`text-left p-4 rounded-xl border min-h-24 cursor-pointer disabled:opacity-50 disabled:cursor-wait hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary ${set.id === selectedId ? 'border-primary bg-surface-container-high' : 'border-outline-variant bg-surface-container'}`}><span className="block font-bold">{set.name}</span><span className="block text-sm text-outline mt-2">{set.expires} · {set.detailsLoaded ? `${set.segments.length} alt görev` : 'Koşullar henüz alınmadı'}</span><span className="block text-sm text-primary mt-2">{set.detailsLoaded ? 'Alt Görevleri Aç · ücretsiz' : remaining < detailCost ? 'Koşulları Aç · yerel kredi sınırı yetersiz' : `Koşulları Aç · en fazla ${detailCost} kredi`}</span></button>)}</div>
      {selected && <div ref={selectedRef} tabIndex={-1} aria-label="Seçili SBC koşulları" role="region" className="scroll-mt-20 focus:outline-none p-4 rounded-xl bg-surface-container border border-outline-variant space-y-3">
        <h2 className="font-bold text-xl">{selected.name}</h2><p className="text-sm text-outline">{selected.description}</p>
        <p className="text-sm">Süre: {selected.expires} (okuma anındaki kaynak metni)</p>
        <p className="text-sm">Kaynağın grup maliyeti tahmini ({market.platform.toUpperCase()}): {(market.platform === 'pc' ? selected.costPc : selected.costConsole)?.toLocaleString('tr-TR') || 'Belirtilmemiş'}{(market.platform === 'pc' ? selected.costPc : selected.costConsole) ? ' coins' : ''}</p>
        {selected.detailsLoaded && <p className="text-sm text-outline">Koşulların okuma tarihi: {new Date(selected.detailsFetchedAt || page.fetchedAt).toLocaleString('tr-TR')}. Liste yenilemesi bu tarihi değiştirmez.</p>}
        {!selected.detailsLoaded && (market.busy ? <p role="status" className="text-primary">{market.activity}</p> : remaining < detailCost ? <div className="space-y-2"><p>Koşullar henüz alınmadı. Bu işlem {detailCost} kredi, yerel sınırda kalan ise {remaining} kredi.</p><a href="#settings" className="inline-flex items-center min-h-11 text-primary underline font-bold">Yerel Kredi Sınırını Düzenle →</a></div> : <button className={button} disabled={!ready} onClick={() => market.loadSbcs(page.page, true, page.activeOnly)}>Koşulları Getir · en fazla {detailCost} kredi</button>)}
        {selected.detailsError && <p className="text-error">{selected.detailsError}</p>}
        {selected.segments.map(segment => {
          const challenge = toSolverChallenge(selected, segment, page, market.platform);
          return <article key={segment.id} className="p-4 rounded-lg border border-outline-variant space-y-3">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{segment.name}</h3><span className="text-sm text-primary">{segment.rules.kind === 'POINTS' ? 'Puanla tamamlanan SBC' : segment.rules.kind === 'SQUAD' ? 'Kadro kurulan SBC' : 'Türü doğrulanamadı'}</span></div>
            {segment.description && <p className="text-sm text-outline">{segment.description}</p>}
            <p className="text-sm">Ödül: {segment.reward || 'Belirtilmemiş'}</p>
            <h4 className="font-bold text-sm">Kaynağın koşulları</h4><ul className="list-disc pl-5 text-sm space-y-1">{segment.rules.raw.map((line, i) => <li key={i}>{line}</li>)}</ul>
            {!segment.rules.raw.length && <p className="text-outline text-sm">Koşul verisi yok.</p>}
            {!!segment.rules.unsupported.length && <details className="rounded-lg bg-surface-container-high p-3 text-sm"><summary className="font-bold min-h-11 cursor-pointer">{segment.rules.kind === 'POINTS' ? 'Puan görevi nasıl hesaplanır?' : 'Yerel çözücü desteği sınırlı · ayrıntı'}</summary><ul className="list-disc pl-5 mt-1">{segment.rules.unsupported.map((line, i) => <li key={i}>{line}</li>)}</ul></details>}
            {supportsLocalGold(selected, segment) ? <div className="space-y-3"><p className="text-sm">Bu görevde bir kilitli slot ve 10 açık slot var. Yerel çözüm kilitli slota dokunmadan 10 altın kart kullanır.</p><EaTransferPanel goldPlan={goldCatalogPlan(selected, segment, market.platform)} /><details className="rounded-lg bg-surface-container p-3"><summary className="min-h-11 cursor-pointer font-bold">Kayıtlı fiyatlarla yerel maliyet önerisi</summary><div className="flex flex-wrap gap-3 mt-3"><button className={button} disabled={market.busy} onClick={() => market.loadLocalGold(selected, segment)}>Kayıtlı Havuzdan Öner · ücretsiz</button><button className={button} disabled={!ready || remaining < 1} onClick={() => market.loadPlayers('', 1, 75)}>Altın Kart Havuzunu Getir · en fazla 1 kredi</button><button className={button} disabled={!ready || remaining < 1} onClick={() => market.loadPlayers('', (market.page?.page || 1) + 1, 75)}>Sonraki Katalog Sayfası · en fazla 1 kredi</button></div><p className="text-sm text-outline mt-3">Yalnızca kayıtlı ve fiyatı bilinen standart kartlardan seçim yapılır; tüm piyasada en düşük fiyat garantisi yoktur.</p></details></div> : canRequestConcept(selected, segment) && <><button className={button} disabled={!ready || remaining < 10 || (market.concept?.segmentId === segment.id && market.concept.outcome === 'not_searched')} onClick={() => market.loadConcept(selected, segment, maxAgeMinutes)}>PS Konsept Kadro Öner · en fazla 10 kredi</button><p className="text-sm text-outline">{market.concept?.segmentId === segment.id && market.concept.outcome === 'not_searched' ? market.concept.reason : 'Tüm klasik görev koşullarıyla, tokensız pazar kadrosu aranır. PlayStation fiyatları kullanılır; PC veya Xbox için maliyet önerisi değildir.'}{remaining < 10 ? ' Yeni öneri için yerel kredi sınırını Ayarlar’dan düzenle.' : ''}</p></>}
            {challenge && <button className={button + ' ml-0 sm:ml-3'} disabled={market.busy} onClick={() => onUseChallenge(challenge)}>Yerel Havuzda Dene</button>}
            {segment.rules.kind === 'POINTS' && <ItemScorePanel key={selected.id + ':' + segment.id} market={market} set={selected} segment={segment} />}
          </article>;
        })}
      </div>}
    </>}
    {market.concept && selected?.id === market.concept.setId && selected.year === market.concept.year && !(market.concept.outcome === 'not_searched' && page?.sets.some(set => set.id === market.concept?.setId && set.segments.some(s => s.id === market.concept?.segmentId && supportsLocalGold(set, s)))) && <ConceptSquadPanel squad={market.concept} />}
    <div className="text-sm rounded-lg bg-surface-container p-3">{activeChallenge ? <><span className="font-bold">Yerel çözücüde: {activeChallenge.name} / {activeChallenge.segmentTitle} · FC {activeChallenge.gameYear}</span><button className="ml-3 min-h-11 text-primary underline cursor-pointer" onClick={onUseDemo}>Yerel Çözücüyü Kapat</button></> : 'Koşulları alınan bir klasik görev seçerek konsept kadro önerisi al. Örnek görevler bu prototipe dahil edilmez.'}</div>
  </section>;
}
