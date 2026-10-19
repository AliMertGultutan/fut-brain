import React, { useEffect, useRef, useState } from 'react';
import { EaPlayStylesPanel } from './EaPlayStylesPanel.tsx';
import { BRIDGE_CHANNEL } from '../services/eaBridgeProtocol.ts';
import { normalizeEaEvolutions } from '../services/eaEvolutions.ts';
import type { EaPlayerEvolutions } from '../services/eaEvolutions.ts';
import type { EaSquadCard } from '../services/eaSquad.ts';
const button = 'min-h-10 rounded-lg px-3 py-2 text-xs font-bold cursor-pointer bg-primary-container text-on-primary-container disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary';
export function EaPlayerEvolutionPanel({ card }: { card: EaSquadCard }) {
  const [data, setData] = useState<EaPlayerEvolutions | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [showAll, setShowAll] = useState(false);
  const request = useRef(''), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const signature = JSON.stringify([card.id, card.definitionId, card.rating, card.stats, card.secondaryPositions, card.playStyles]);
  const load = (programId?: string) => {
    clearTimeout(timer.current); setBusy(true); setMessage(programId ? 'EA son kartı hesaplıyor…' : 'EA’daki güncel EVO’lar kontrol ediliyor…'); request.current = crypto.randomUUID();
    window.postMessage({ channel: BRIDGE_CHANNEL, direction: 'SITE_TO_EXTENSION', type: 'EVO_GET', requestId: request.current, playerId: card.id, ...(programId ? { programId } : {}) }, location.origin);
    timer.current = setTimeout(() => { setBusy(false); setMessage('Canlı EVO kontrolüne ulaşılamadı. Eklentiyi 0.3.4 sürümüne güncelle ve EA’da Evolutions ekranını aç.'); }, 50000);
  };
  useEffect(() => {
    setData(null); setShowAll(false); setBusy(false);
    if (card.concept) { setMessage('Konsept kartın kulüp içindeki EVO uygunluğu kontrol edilemez. Sahip olduğun bir kartı seç.'); return; }
    const receive = (event: MessageEvent) => {
      const m = event.data;
      if (event.source !== window || event.origin !== location.origin || m?.channel !== BRIDGE_CHANNEL || m.direction !== 'EXTENSION_TO_SITE' || m.requestId !== request.current) return;
      clearTimeout(timer.current); setBusy(false);
      if (!m.reply?.evolutions) { setMessage(m.reply?.message || 'EA EVO verisi alınamadı.'); return; }
      try {
        const next = normalizeEaEvolutions(m.reply.evolutions);
        if (next.playerId !== card.id || next.definitionId !== card.definitionId || next.rating !== card.rating) { setMessage('Kart EA’da değişmiş. Önce EA kadronu yenile.'); return; }
        setData(next); setMessage('Mevcut kartın EA koşullarıyla kontrol edildi.');
      } catch { setMessage('EA EVO verisi doğrulanamadı.'); }
    };
    window.addEventListener('message', receive); const debounce = setTimeout(() => load(), 350);
    return () => { clearTimeout(debounce); clearTimeout(timer.current); request.current = ''; window.removeEventListener('message', receive); };
  }, [signature]);
  const eligible = data?.programs.filter(p => p.eligible === true) || [], programs = showAll ? data?.programs || [] : eligible;
  return <section className="border-t border-outline-variant pt-3 space-y-2.5" aria-label="Seçili oyuncunun canlı EVO kontrolü"><div className="flex flex-wrap justify-between gap-2 items-center"><h3 className="font-bold text-base">Bu kart hangi EVO’ya uygun?</h3><button className={button} disabled={busy || card.concept} onClick={() => load()}>EVO’ları Yenile</button></div><p className="text-sm text-outline" role="status">{message}</p>
    {data && <><p className="text-sm">EA Web App · Kontrol: {new Date(data.observedAt).toLocaleString('tr-TR')} · {eligible.length} uygun / {data.programs.length} program</p>{data.partial && <p className="text-tertiary text-sm">Liste kısmen okunabildi. Görünmeyen programlar için EA Evolutions ekranını kontrol et.</p>}
      <label className="flex items-center gap-2 min-h-10 text-xs"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />Uygun olmayanları ve eksik verileri de göster</label>
      {!programs.length && <p>{data.partial ? 'Okunan programlar içinde' : 'Katılıma açık programlar içinde'} bu karta uygun EVO bulunamadı.</p>}
      <div className="space-y-2">{programs.map(p => <article key={p.id} className="bg-surface-container rounded-lg p-2.5 border border-outline-variant/60 space-y-1.5"><div className="flex justify-between gap-2"><h4 className="font-bold text-sm leading-5">{p.name}</h4><div className="flex shrink-0 items-center gap-2"><span className="text-xs text-outline">{p.eligible === true ? 'Uygun' : p.eligible === false ? 'Uygun değil' : 'Veri eksik'}</span>{p.eligible === true && !p.multiChoice && <button className={button} disabled={busy} title="EA’dan son kartı göster" onClick={() => load(p.id)}>Önizle</button>}</div></div><p className="text-sm text-outline">{p.cost}{p.expiresAt ? ` · Son katılım: ${new Date(p.expiresAt).toLocaleString('tr-TR')}` : ''}</p>
        {p.eligible === true && <p className="text-lg font-bold text-primary-fixed">{card.rating} → {data.preview?.programId === p.id ? data.preview.rating : p.finalRating ?? '?'} <span className="text-xs text-outline font-normal">{data.preview?.programId === p.id ? 'EA son kart önizlemesi' : p.multiChoice ? 'Yol seçimine bağlı' : p.finalRating === null ? 'Son reyting okunamadı' : 'Tüm seviyeler · reyting artışı ve üst sınır hesabı'}</span></p>}
        <details><summary className="min-h-9 cursor-pointer text-xs">Katılım koşulları</summary><ul className="text-sm space-y-2">{p.checks.map((c, i) => <li key={i}>{c.satisfied === true ? '✓' : c.satisfied === false ? '✕' : '?'} {c.label}</li>)}</ul></details>
        
        {data.preview?.programId === p.id && <div className="text-sm space-y-2" aria-live="polite">{data.preview.stats && <div className="grid grid-cols-3 gap-2">{['HIZ', 'ŞUT', 'PAS', 'DRİ', 'DEF', 'FİZ'].map((label, i) => <span key={label}>{label} {card.stats?.[i] ?? '—'} → <strong>{data.preview!.stats![i]}</strong></span>)}</div>}<EaPlayStylesPanel styles={data.preview.playStyleDetails} known={data.preview.playStylesKnown === true} legacyCount={data.preview.playStyles.length} /></div>}
      </article>)}</div></>}
    <p className="text-xs text-outline">Önizleme EVO’yu başlatmaz, kartı değiştirmez ve coin harcamaz. Seçmeli EVO yollarının sonucu EA’daki seçimine bağlıdır.</p>
  </section>;
}
