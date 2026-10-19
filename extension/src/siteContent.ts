/// <reference types="chrome" />
import { BRIDGE_CHANNEL, isSiteUrl } from '../../src/services/eaBridgeProtocol.ts';
import { publicResult } from './bridgeWorker.ts';
import { normalizeEaSquad } from '../../src/services/eaSquad.ts';
import { disconnectedReply, sendRuntimeMessage } from './runtimeMessaging.ts';
if (window.top === window && isSiteUrl(location.href)) {
  const requests = new Set<string>();
  let retired = false;
  const post = (requestId: string, reply: unknown) => window.postMessage({ channel: BRIDGE_CHANNEL, direction: 'EXTENSION_TO_SITE', requestId, reply }, location.origin);
  const retire = () => { retired = true; requests.clear(); try { chrome.runtime.onMessage.removeListener(receive); } catch { /* Eski bağlamın dinleyicisi artık kullanılamayabilir. */ } };
  const forward = async (m: any) => post(m.requestId, await sendRuntimeMessage(chrome, { type: m.type, requestId: m.requestId, ...(m.type === 'QUEUE' ? { plan: m.plan } : {}), ...(m.type === 'EVO_GET' ? { playerId: m.playerId, programId: m.programId } : {}), ...(m.type === 'SCORE_GET' ? { scoreRequest: m.scoreRequest } : {}) }, retire));
  window.addEventListener('message', event => {
    const m = event.data;
    if (event.source !== window || event.origin !== location.origin || m?.channel !== BRIDGE_CHANNEL || m.direction !== 'SITE_TO_EXTENSION' || !/^[a-zA-Z0-9-]{8,80}$/.test(m.requestId) || !['PING', 'QUEUE', 'SQUAD_GET', 'EVO_GET', 'SCORE_GET'].includes(m.type)) return;
    if (retired) { post(m.requestId, disconnectedReply()); return; }
    if (requests.size >= 200) requests.clear(); requests.add(m.requestId);
    void forward(m);
  });
  const receive = (message: any) => {
    if (retired) return;
    if (message?.type === 'EA_RESULT' && requests.has(message.requestId)) post(message.requestId, { ok: true, result: publicResult(message.result) });
    if (message?.type === 'SQUAD_SYNC') { try { post('EA_SQUAD_SYNC', { ok: true, squad: normalizeEaSquad(message.squad) }); } catch { /* Doğrulanamayan veriler sayfaya verilmez. */ } }
  };
  chrome.runtime.onMessage.addListener(receive);
}
