import { useEffect, useRef, useState } from 'react';
import { BRIDGE_CHANNEL, isCurrentBridgeVersion } from './eaBridgeProtocol.ts';
import { normalizeEaSquad } from './eaSquad.ts';
import type { EaActiveSquad } from './eaSquad.ts';
const key = 'fut-brain-ea-active-squad-v1';
export function useEaSquad() {
  const [squad, setSquad] = useState<EaActiveSquad | null>(() => { try { const saved = normalizeEaSquad(JSON.parse(localStorage.getItem(key) || 'null')); return Date.now() - Date.parse(saved.observedAt) <= 86400000 ? saved : null; } catch { return null; } });
  const [message, setMessage] = useState('EA Web App açıldığında aktif kadron burada görünür.'), [installed, setInstalled] = useState(false), [busy, setBusy] = useState(false);
  const request = useRef(''), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = () => { clearTimeout(timer.current); setBusy(true); request.current = crypto.randomUUID(); window.postMessage({ channel: BRIDGE_CHANNEL, direction: 'SITE_TO_EXTENSION', type: 'PING', requestId: request.current }, location.origin); timer.current = setTimeout(() => { setBusy(false); setMessage('Eklentiye ulaşılamadı. Güncel eklentiyi Chrome/Edge’de yenile ve iki sayfayı da yeniden aç.'); }, 2500); };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const m = event.data; if (event.source !== window || event.origin !== location.origin || m?.channel !== BRIDGE_CHANNEL || m.direction !== 'EXTENSION_TO_SITE' || (m.requestId !== request.current && m.requestId !== 'EA_SQUAD_SYNC')) return;
      if (m.reply?.installed === true) {
        clearTimeout(timer.current); setInstalled(true);
        if (!isCurrentBridgeVersion(m.reply.version)) { setBusy(false); setMessage('Kadro okuma düzeltmesi için eklentiyi 0.3.4 sürümüne yenile; ardından EA ve site sekmesini yeniden yükle.'); return; }
        window.postMessage({ channel: BRIDGE_CHANNEL, direction: 'SITE_TO_EXTENSION', type: 'SQUAD_GET', requestId: request.current }, location.origin);
        timer.current = setTimeout(() => { setBusy(false); setMessage('EA kadrosu henüz okunamadı. Web App’e giriş yapıp tekrar dene.'); }, 35000); return;
      }
      clearTimeout(timer.current); setBusy(false); setInstalled(m.reply?.installed !== false);
      if (m.reply?.squad) { try { const next = normalizeEaSquad(m.reply.squad); setSquad(next); try { localStorage.setItem(key, JSON.stringify(next)); setMessage('Aktif EA kadron ve dizilişin alındı.'); } catch { setMessage('Kadro alındı; tarayıcı depolamasına kaydedilemedi.'); } } catch { setMessage('EA kadro verisi doğrulanamadı.'); } }
      else setMessage(m.reply?.message || 'EA’ya giriş yapıp ana ekranı aç.');
    };
    window.addEventListener('message', receive); refresh();
    const focused = () => refresh(); window.addEventListener('focus', focused);
    return () => { window.removeEventListener('message', receive); window.removeEventListener('focus', focused); clearTimeout(timer.current); };
  }, []);
  return { squad, message, installed, busy, refresh };
}
