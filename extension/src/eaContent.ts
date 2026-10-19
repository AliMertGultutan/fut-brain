/// <reference types="chrome" />
import { isEaUrl, validateEaPlan } from '../../src/services/eaBridgeProtocol.ts';
import type { EaPlan, EaImportResult } from '../../src/services/eaBridgeProtocol.ts';
import { sendRuntimeMessage } from './runtimeMessaging.ts';
if (window.top === window && isEaUrl(location.href)) {
  let jobId = '', plan: EaPlan | undefined, busy = false;
  let retired = false, syncTimer: ReturnType<typeof setInterval> | undefined;
  const retire = () => { retired = true; clearInterval(syncTimer); window.removeEventListener('focus', syncSquad); };
  const seen = new Set<string>();
  const host = document.createElement('div'); host.id = 'fut-brain-extension';
  host.style.cssText = 'position:fixed;top:16px;right:16px;width:min(390px,calc(100vw - 32px));z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style'); style.textContent = `:host{color-scheme:dark}*{box-sizing:border-box}section{font:14px/1.5 system-ui,sans-serif;background:#14201b;color:#edf8f0;border:1px solid #8fe3a7;border-radius:16px;box-shadow:0 18px 60px #0008;padding:18px}h2{font-size:18px;margin:0 42px 10px 0}p{margin:8px 0;overflow-wrap:anywhere}.muted{color:#b4c8bd;font-size:12px}button{min-height:44px;padding:10px 14px;font:600 14px system-ui;cursor:pointer;border:0;border-radius:9px;background:#8fe3a7;color:#102719}button:focus-visible{outline:3px solid white;outline-offset:3px}.close{position:absolute;right:12px;top:10px;background:transparent;color:#edf8f0;font-size:22px}.status{padding:12px;background:#22342b;border-radius:9px;margin:12px 0}button:disabled{opacity:.5;cursor:wait}`;
  root.append(style);
  const section = document.createElement('section'); section.setAttribute('role', 'region'); section.setAttribute('aria-label', 'FUT Brain kadro aktarımı'); root.append(section);
  const render = (text: string, result?: EaImportResult) => {
    if (!host.isConnected) document.documentElement.append(host);
    section.replaceChildren();
    const close = document.createElement('button'); close.className = 'close'; close.textContent = '×'; close.setAttribute('aria-label', 'Bildirimi kapat'); close.onclick = () => host.remove();
    const title = document.createElement('h2'); title.textContent = 'FUT Brain · Konsept kadro';
    const name = document.createElement('p'); name.textContent = plan ? `${plan.setName} / ${plan.challengeName}` : '';
    const status = document.createElement('p'); status.className = 'status'; status.setAttribute('role', 'status'); status.textContent = text;
    const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Kart satın alınmaz, SBC teslim edilmez. Yalnızca konsept taslak kaydedilir.';
    section.append(close, title, name, status);
    if (result?.ok) { const summary = document.createElement('p'); summary.textContent = `${result.playerCount} kart · ${result.rating} reyting · ${result.chemistry} kimya`; section.append(summary); }
    if (result?.requiresOverwrite) { const button = document.createElement('button'); button.textContent = 'Mevcut Taslağı Değiştir'; button.onclick = () => void run(true); section.append(button); }
    else if (result && !result.ok && !result.mayHaveSaved) { const retry = document.createElement('button'); retry.textContent = 'Siteden yeniden gönder'; retry.onclick = () => { const text = document.createElement('p'); text.textContent = 'FUT Brain sekmesine dönüp kadroyu yeniden gönder. EA’ya giriş yaptıktan sonra gönderim yapabilirsin.'; section.append(text); retry.disabled = true; }; section.append(retry); }
    section.append(note);
  };
  const run = async (replaceDraft: boolean) => {
    if (retired) { render('Eklenti yenilendi. EA sekmesini yenileyerek tekrar bağlan.'); return; }
    if (busy || !plan) return; busy = true; render('Oyuncular ve EA koşulları doğrulanıyor…');
    try { const reply = await sendRuntimeMessage(chrome, { type: 'EA_RUN', jobId, replaceDraft }, retire); render(reply.result?.message || reply.message || 'EA taslağını kontrol et.', reply.result); }
    catch { render('Eklenti bağlantısı kesildi. EA taslağını kontrol et; otomatik tekrar yapılmadı.'); }
    finally { busy = false; }
  };
  chrome.runtime.onMessage.addListener(message => {
    if (retired) return;
    if (message?.type === 'RESULT' && message.jobId === jobId && message.result) { render(message.result.message, message.result); return; }
    if (message?.type !== 'SHOW_PLAN' || busy) return;
    try { plan = validateEaPlan(message.plan); } catch { return; }
    jobId = message.jobId;
    if (message.requiresOverwrite) render('Bu görevde başka bir kadro var. Değiştirmek için aşağıdaki düğmeyi kullan.', { ok: false, code: 'EA_DRAFT_EXISTS', message: '', requiresOverwrite: true });
    else if (!seen.has(jobId)) { seen.add(jobId); void run(false); }
  });
  let syncing = false;
  const syncSquad = async () => { if (retired || syncing || busy || document.hidden) return; syncing = true; try { await sendRuntimeMessage(chrome, { type: 'EA_SYNC' }, retire); } finally { syncing = false; } };
  syncTimer = setInterval(() => void syncSquad(), 15000);
  // Aynı işlev referansı kullanılır; bağlam kapanınca odak dinleyicisi de kaldırılır.
  window.addEventListener('focus', syncSquad);
  void sendRuntimeMessage(chrome, { type: 'EA_READY' }, retire).then(reply => { if (!retired && reply?.working) render('Aktarım daha önce başladı. EA taslağını kontrol et; ikinci işlem başlatılmadı.'); });
  void syncSquad();
}
