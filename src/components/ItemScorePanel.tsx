import React, { useEffect, useRef, useState } from 'react';
import type { ParseMarket } from '../services/useParseMarket.ts';
import type { RemoteSbcSet, RemoteSbcSegment } from '../services/sbcData.ts';
import { BRIDGE_CHANNEL } from '../services/eaBridgeProtocol.ts';
import { normalizeItemScoreData, scorePricePool, scoreCandidates, solveItemScore } from '../services/itemScore.ts';
import type { ItemScoreData } from '../services/itemScore.ts';
const button = 'min-h-10 px-3 py-2 text-sm rounded-lg bg-primary-container text-on-primary-container font-bold cursor-pointer disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary';
export function ItemScorePanel({ market, set, segment }: { market: ParseMarket; set: RemoteSbcSet; segment: RemoteSbcSegment }) {
  const [data, setData] = useState<ItemScoreData | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('EA’dan hedef puanı ve kart puanlarını doğrulayarak başla.'), [now, setNow] = useState(Date.now());
  const request = useRef(''), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pool = scorePricePool(market.players, set.year, market.platform, now), candidates = scoreCandidates(pool);
  const remaining = market.status ? market.status.sessionCreditLimit - market.status.creditsAttempted : 0;
  const refresh = () => {
    clearTimeout(timer.current); setData(null); setBusy(true); setMessage('EA görev koşulları ve gerçek Item Score değerleri okunuyor…'); request.current = crypto.randomUUID();
    window.postMessage({ channel: BRIDGE_CHANNEL, direction: 'SITE_TO_EXTENSION', type: 'SCORE_GET', requestId: request.current, scoreRequest: { setName: set.name, segmentName: segment.name, cards: candidates.map(p => ({ key: p.id, name: p.name, commonName: p.commonName, rating: p.rating })) } }, location.origin);
    timer.current = setTimeout(() => { request.current = ''; setBusy(false); setMessage('Puan okuyucusuna ulaşılamadı. Eklentiyi güncelleyip EA’da SBC ekranını aç.'); }, 50000);
  };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const m = event.data;
      if (event.source !== window || event.origin !== location.origin || m?.channel !== BRIDGE_CHANNEL || m.direction !== 'EXTENSION_TO_SITE' || m.requestId !== request.current) return;
      clearTimeout(timer.current); request.current = ''; setBusy(false);
      try { if (!m.reply?.ok || !m.reply.itemScores) { setMessage(m.reply?.message || 'EA puanları okunamadı.'); return; } setData(normalizeItemScoreData(m.reply.itemScores)); setMessage('Hedef ve kart puanları EA’dan doğrulandı.'); } catch { setMessage('EA puan verisi doğrulanamadı.'); }
    };
    window.addEventListener('message', receive); const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => { window.removeEventListener('message', receive); clearTimeout(timer.current); clearInterval(clock); request.current = ''; };
  }, []);
  const freshEaData = data && now - Date.parse(data.observedAt) >= -60000 && now - Date.parse(data.observedAt) <= 5 * 60000;
  const plan = data && freshEaData ? solveItemScore(data, pool) : null;
  return <section className="rounded-xl border border-primary-fixed/20 p-4 bg-surface-container-lowest space-y-3" aria-label="Item Score fiyat performans önerisi"><h3 className="font-bold text-lg">Puanı tamamlayan F/P kartları</h3><p className="text-sm text-outline">Bu görev Item Score ile ilerler. Kart başına puan, adet, toplam maliyet ve coin/puan karşılaştırılır; klasik 11 kişilik kadro kurulmaz.</p>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || market.busy} onClick={refresh}>EA Puanlarını Kontrol Et · ücretsiz</button><button className={button} disabled={busy || market.busy || !market.status?.configured || remaining < 1} onClick={() => market.loadPlayers('', 1, 75)}>Güncel Fiyat Havuzunu Getir · en fazla 1 kredi</button><button className={button} disabled={busy || market.busy || !market.status?.configured || remaining < 1} onClick={() => market.loadPlayers('', (market.page?.page || 1) + 1, 75)}>Sonraki Fiyat Sayfası · en fazla 1 kredi</button></div>
    <p role="status" className="text-sm text-outline">{message}</p><p className="text-xs text-outline">Güncel {market.platform.toUpperCase()} havuzu: {pool.length} standart kart · EA’da karşılaştırılacak aday: {candidates.length}. Fiyatları getirdikten sonra EA puanlarını kontrol et. 30 dakikayı aşan fiyatlar kullanılmaz.</p>
    {data && <><div className="flex flex-wrap gap-3 text-sm font-bold"><span>Hedef: {data.target.toLocaleString('tr-TR')}</span><span>Teslim edilmiş: {data.submitted.toLocaleString('tr-TR')}</span><span>Kalan: {Math.max(0, data.target - data.submitted).toLocaleString('tr-TR')}</span></div>
      {data.unmatched > 0 && <p className="text-xs text-outline">{data.unmatched} adayın kimliği veya puanı doğrulanamadı; öneriye alınmadı.</p>}
      {!freshEaData && <p role="status" className="text-sm text-tertiary">EA puan kontrolü eskidi. Güncel ilerlemeyi görmek için EA Puanlarını Kontrol Et’e yeniden bas.</p>}
      {plan && data.target > data.submitted ? <><p className="text-primary-fixed font-bold">{plan.coins.toLocaleString('tr-TR')} Coins · {plan.score.toLocaleString('tr-TR')} puan</p><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">Kart</th><th>Adet</th><th>Puan / kart</th><th>Fiyat / kart</th></tr></thead><tbody>{plan.rows.map(r => <tr key={r.player.id} className="border-t border-outline-variant"><td className="p-2">{r.player.name} · {r.player.rating}<span className="block text-xs text-outline">{r.player.cardVersion || 'Standart kart'}</span></td><td>{r.quantity}</td><td>{r.score.toLocaleString('tr-TR')}</td><td>{r.player.price.toLocaleString('tr-TR')}</td></tr>)}</tbody></table></div><details><summary className="min-h-10 cursor-pointer text-sm">F/P sıralaması · Coin / puan</summary><ul className="text-sm space-y-2">{plan.ranking.slice(0, 10).map(r => <li key={r.player.id}>{r.player.name} · {r.player.rating} · {r.score} puan · {(r.player.price / r.score).toFixed(2)} coin/puan</li>)}</ul></details></> : <p className="text-sm">{!freshEaData ? 'Öneri için güncel EA puan kontrolü gerekiyor.' : data.target <= data.submitted ? 'EA kaydına göre hedef puan tamamlanmış.' : 'Doğrulanmış puan ve güncel fiyat eşleşmesi yetmedi. Fiyat havuzunu güncelleyip EA kontrolünü tekrar çalıştır.'}</p>}
      <p className="text-xs text-outline">EA kontrolü: {new Date(data.observedAt).toLocaleString('tr-TR')}. Plan, doğrulanmış aday havuzunda en düşük maliyeti arar; tüm piyasa veya belirtilen adette kart bulunacağı garanti edilmez. Aynı kartın birden fazla kopyası ayrı alım ve gerekirse birden fazla teslim gerektirir. Kart alınmaz, aktif kadrona dokunulmaz, görev teslim edilmez.</p>
    </>}
  </section>;
}
