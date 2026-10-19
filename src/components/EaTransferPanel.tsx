import React, { useEffect, useRef, useState } from 'react';
import type { ConceptSquad } from '../services/conceptSquad.ts';
import { BRIDGE_CHANNEL, createEaPlan, validateEaPlan, isCurrentBridgeVersion } from '../services/eaBridgeProtocol.ts';
import type { EaImportResult, EaPlan } from '../services/eaBridgeProtocol.ts';

export function EaTransferPanel({ squad, goldPlan }: { squad?: ConceptSquad; goldPlan?: EaPlan }) {
  const getPlan = () => goldPlan ? validateEaPlan({ ...goldPlan, createdAt: Date.now() }) : createEaPlan(squad!);
  const [installed, setInstalled] = useState(false), [checking, setChecking] = useState(true);
  const [state, setState] = useState<{ text: string; pending?: boolean; result?: EaImportResult }>({ text: '' });
  const pingId = useRef(''), jobId = useRef(''), pingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), jobTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  let unavailable = '';
  try { getPlan(); } catch (error) { unavailable = (error as Error).message; }
  const post = (type: string, requestId: string, plan?: unknown) => window.postMessage({ channel: BRIDGE_CHANNEL, direction: 'SITE_TO_EXTENSION', type, requestId, plan }, window.location.origin);
  const check = () => {
    clearTimeout(pingTimer.current); setChecking(true); pingId.current = crypto.randomUUID(); post('PING', pingId.current);
    pingTimer.current = setTimeout(() => { setChecking(false); setInstalled(false); }, 1800);
  };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const m = event.data;
      if (event.source !== window || event.origin !== window.location.origin || m?.channel !== BRIDGE_CHANNEL || m.direction !== 'EXTENSION_TO_SITE') return;
      if (m.requestId === pingId.current && m.reply?.installed === true) { clearTimeout(pingTimer.current); setChecking(false); const current = isCurrentBridgeVersion(m.reply.version); setInstalled(current); if (!current) setState({ text: 'Eklentinin eski sürümü bağlı. Uzantılar sayfasından FUT Brain eklentisini yenile; ardından site ve EA sekmesini yeniden yükle.' }); }
      if (m.requestId !== jobId.current || !jobId.current) return;
      clearTimeout(jobTimer.current);
      if (m.reply?.result) { const result: EaImportResult = m.reply.result; setState({ text: result.message, result }); }
      else setState(previous => previous.result ? previous : ({ text: m.reply?.message || 'EA Web App’teki bildirimi kontrol et.', pending: m.reply?.queued === true }));
    };
    window.addEventListener('message', receive); check();
    return () => { window.removeEventListener('message', receive); clearTimeout(pingTimer.current); clearTimeout(jobTimer.current); };
  }, []);
  useEffect(() => { jobId.current = ''; clearTimeout(jobTimer.current); setState({ text: '' }); }, [squad?.fetchedAt, squad?.segmentId, goldPlan?.challengeName]);
  const transfer = () => {
    try {
      const plan = getPlan(); jobId.current = crypto.randomUUID();
      setState({ text: 'Kadro EA sekmesine gönderiliyor…', pending: true }); post('QUEUE', jobId.current, plan);
      jobTimer.current = setTimeout(() => setState(previous => previous.result ? previous : { text: 'Eklenti yanıtı gecikti. Yeniden göndermeden önce EA Web App’teki bildirimi ve taslağı kontrol et.' }), 15000);
    } catch (error) { setState({ text: (error as Error).message }); }
  };
  const button = 'min-h-11 px-4 py-2 rounded-lg font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed';
  return <div className="rounded-xl border border-primary/30 bg-surface-container p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-lg">{goldPlan ? 'EA’da 10 altın konsept kart kur' : 'Hazır kadroyu Web App’e gönder'}</h3><p className="text-sm text-outline mt-1">Chrome / Edge eklentisi · {goldPlan ? '10 altın kart · kilitli slot korunur' : `${squad?.players.length} standart konsept kart`} · FC 27</p></div><span className="text-sm text-primary">{checking ? 'Eklenti kontrol ediliyor…' : installed ? 'Eklenti bağlı' : 'Eklenti bağlı değil'}</span></div>
    <p className="text-sm text-outline">Gönderdiğinde EA sekmesinde bildirim açılır. Oyuncular eşleştirilir, EA koşulları doğrulanır ve uygun kadro taslağa kaydedilir. Farklı bir taslak varsa değiştirmek için bildirimden onay verirsin.</p>
    {unavailable && <p className="text-sm" role="status">{unavailable}</p>}
    <div className="flex flex-wrap gap-3">
      <button className={`${button} bg-primary-container text-on-primary-container`} disabled={!installed || !!unavailable || state.pending} onClick={transfer}>{state.pending ? 'EA sonucu bekleniyor…' : 'Web App’te Konsept Kadroyu Kur'}</button>
      <a className={`${button} bg-surface-container-high`} href="/extension/index.html" target="_blank" rel="noreferrer">Eklenti Kurulumu ↗</a>
      <button className={`${button} border border-outline-variant`} disabled={checking} onClick={check}>Bağlantıyı Kontrol Et</button>
    </div>
    {state.text && <div role="status" aria-live="polite" className="rounded-lg bg-surface-container-low p-3 text-sm"><p>{state.text}</p>{state.result?.ok && <p className="mt-1 text-primary">EA sonucu: {state.result.playerCount} kart · {state.result.rating} reyting · {state.result.chemistry} kimya</p>}{state.pending && <button className={`${button} mt-2 border border-outline-variant`} onClick={() => setState({ text: 'EA bildirimini ve taslağı kontrol et. Sonuç bağlantısı açıksa buraya da yansır.' })}>EA Ekranını Kontrol Ettim</button>}</div>}
    <p className="text-xs text-outline">Kart satın alma ve SBC teslimi sende kalır. Aktarım ek veri kredisi kullanmaz. {goldPlan ? 'Kartlar EA kataloğundan düşük reytingli standart altın adaylar arasından seçilir. Piyasa fiyatı taranmaz; en ucuz maliyet garantisi yoktur.' : 'Özel kart sürümleri otomatik aktarılmaz.'}</p>
  </div>;
}
