/// <reference types="chrome" />
import { BRIDGE_TTL, EA_MATCH, EA_WEB_URL, isEaUrl, isSiteUrl, validateEaPlan } from '../../src/services/eaBridgeProtocol.ts';
import type { EaPlan, EaImportResult } from '../../src/services/eaBridgeProtocol.ts';
import { importEaConcept } from './eaAdapter.ts';
import { readEaActiveSquad } from './eaSquadAdapter.ts';
import { normalizeEaSquad, EaSquadDataError } from '../../src/services/eaSquad.ts';
import { readEaPlayerEvolutions } from './eaEvolutionAdapter.ts';
import { normalizeEaEvolutions, validEaEvolutionId, EaEvolutionDataError } from '../../src/services/eaEvolutions.ts';
import { readEaItemScores } from './eaItemScoreAdapter.ts';
import { normalizeItemScoreData, normalizeItemScoreRequest } from '../../src/services/itemScore.ts';

interface Job { id: string; sourceRequestId: string; sourceTabId: number; sourceOrigin: string; targetTabId: number; plan: EaPlan; phase: 'queued' | 'working' | 'overwrite' | 'done'; result?: EaImportResult }
interface BridgeReply { ok: boolean; message?: string; installed?: boolean; version?: string; queued?: boolean; expired?: boolean; working?: boolean; result?: EaImportResult; squad?: ReturnType<typeof normalizeEaSquad>; evolutions?: ReturnType<typeof normalizeEaEvolutions>; itemScores?: ReturnType<typeof normalizeItemScoreData> }
const KEY = 'futBrainConceptJob';
export function publicResult(value: any): EaImportResult {
  if (!value || typeof value.ok !== 'boolean' || !/^[A-Z_]{2,50}$/.test(value.code) || typeof value.message !== 'string' || value.message.length > 500) return { ok: false, code: 'INVALID_RESULT', message: 'EA işlem sonucu doğrulanamadı. Taslağı Web App’te kontrol et.' };
  const result: EaImportResult = { ok: value.ok, code: value.code, message: value.message };
  for (const key of ['saved', 'alreadyPlaced', 'requiresOverwrite', 'mayHaveSaved'] as const) if (typeof value[key] === 'boolean') result[key] = value[key];
  for (const key of ['rating', 'chemistry', 'playerCount'] as const) if (Number.isFinite(value[key])) result[key] = value[key];
  return result;
}
export function createBridgeWorker(api: typeof chrome) {
  // Aynı anda gelen çift tıklamalar ve sekme yüklenmeleri tek sırada işlenir.
  let chain: Promise<any> = Promise.resolve();
  const read = async (): Promise<Job | undefined> => (await api.storage.session.get(KEY))[KEY] as Job | undefined;
  const write = (job: Job) => api.storage.session.set({ [KEY]: job });
  const send = async (tabId: number, value: unknown) => { try { await api.tabs.sendMessage(tabId, value, { frameId: 0 }); } catch { /* Yeni sekme hazır olunca EA_READY ile tekrar bildirilir. */ } };
  const notify = async (job: Job) => {
    await send(job.targetTabId, { type: 'RESULT', jobId: job.id, result: job.result });
    try { const tab = await api.tabs.get(job.sourceTabId); if (isSiteUrl(tab.url) && new URL(tab.url!).origin === job.sourceOrigin) await send(job.sourceTabId, { type: 'EA_RESULT', requestId: job.sourceRequestId, result: job.result }); } catch { /* Kaynak sekmesi kapanmış olabilir. */ }
  };
  let lastSync = 0;
  const evoCache = new Map<string, { at: number; data: ReturnType<typeof normalizeEaEvolutions> }>();
  const syncSquad = async (tabId: number): Promise<BridgeReply> => {
    try { const cached = (await api.storage.session.get('futBrainActiveSquad')).futBrainActiveSquad;
      if (cached && Date.now() - lastSync < 10000) return { ok: true, squad: normalizeEaSquad(cached) };
    } catch { /* Eski veya bozuk kayıt gerçek kadronun yeniden okunmasını engellemez. */ }
    let results;
    try { results = await api.scripting.executeScript({ target: { tabId, frameIds: [0] }, world: 'MAIN', func: readEaActiveSquad }); }
    catch { return { ok: false, message: 'EA sayfasında kadro okuması başlatılamadı. EA sekmesini yenileyip eklentinin site erişimini kontrol et.' }; }
    const result = results[0]?.result as any;
    if (!result?.ok) return { ok: false, message: typeof result?.message === 'string' ? result.message.slice(0, 300) : 'EA aktif kadrosu okunamadı.' };
    let squad;
    try { squad = normalizeEaSquad(result.squad); }
    catch (error) { return { ok: false, message: error instanceof EaSquadDataError ? error.message : 'EA kadro verisi doğrulanamadı.' }; }
    lastSync = Date.now();
    for (const player of [...squad.slots.flatMap(s => s.player ? [s.player] : []), ...squad.bench]) {
      const cached = evoCache.get(player.id);
      if (cached && (cached.data.rating !== player.rating || cached.data.definitionId !== player.definitionId)) evoCache.delete(player.id);
    }
    try { await api.storage.session.set({ futBrainActiveSquad: squad }); } catch { /* Geçici kayıt hatası doğrudan sonucu engellemez. */ }
    try { const tabs = await api.tabs.query({ url: ['http://127.0.0.1/*', 'http://localhost/*'] });
      for (const tab of tabs) if (tab.id !== undefined && isSiteUrl(tab.url)) await send(tab.id, { type: 'SQUAD_SYNC', squad });
    } catch { /* Bildirim yayınlanamazsa isteyen sekmeye doğrudan yanıt yine döner. */ }
    return { ok: true, squad };
  };
  const process = async (message: any, sender: chrome.runtime.MessageSender): Promise<BridgeReply> => {
    const tabId = sender.tab?.id;
    if (sender.id !== api.runtime.id || sender.frameId !== 0 || tabId === undefined || typeof sender.url !== 'string' || typeof sender.tab?.url !== 'string') return { ok: false, message: 'Sekme doğrulanamadı.' };
    const site = isSiteUrl(sender.url) && isSiteUrl(sender.tab.url) && new URL(sender.url).origin === new URL(sender.tab.url).origin;
    const ea = isEaUrl(sender.url) && isEaUrl(sender.tab.url);
    if (!site && !ea) return { ok: false, message: 'Bu sayfa aktarım bağlantısını kullanamaz.' };
    if (site && message?.type === 'PING') return { ok: true, installed: true, version: api.runtime.getManifest().version };
    if (site && message?.type === 'SCORE_GET') {
      let input;
      try { input = normalizeItemScoreRequest(message.scoreRequest); } catch { return { ok: false, message: 'Puan isteği geçersiz.' }; }
      const tabs = (await api.tabs.query({ url: EA_MATCH })).filter(tab => isEaUrl(tab.url));
      if (tabs.length !== 1 || tabs[0].id === undefined) return { ok: false, message: 'Puan kontrolü için tek EA Web App sekmesi açık olmalı.' };
      try {
        const results = await api.scripting.executeScript({ target: { tabId: tabs[0].id, frameIds: [0] }, world: 'MAIN', func: readEaItemScores, args: [input] });
        const result = results[0]?.result as any;
        if (!result?.ok) return { ok: false, message: typeof result?.message === 'string' ? result.message.slice(0, 300) : 'EA kart puanları okunamadı.' };
        const itemScores = normalizeItemScoreData(result.itemScores);
        const nameKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (nameKey(itemScores.setName) !== nameKey(input.setName) || itemScores.cards.length + itemScores.unmatched !== input.cards.length) return { ok: false, message: 'Puan yanıtı seçili görevle eşleşmedi.' };
        if (itemScores.cards.some(c => !input.cards.some((p: any) => p.key === c.key && p.rating === c.rating))) return { ok: false, message: 'Puan yanıtındaki kartlar istekle eşleşmedi.' };
        return { ok: true, itemScores };
      } catch { return { ok: false, message: 'EA puan kontrolü tamamlanamadı. Güncel eklentiyle tekrar dene.' }; }
    }
    if (site && message?.type === 'EVO_GET') {
      if (typeof message.playerId !== 'string' || !/^[1-9]\d{0,19}$/.test(message.playerId) || message.programId !== undefined && !validEaEvolutionId(message.programId)) return { ok: false, message: 'Oyuncu veya EVO kimliği geçersiz.' };
      const tabs = (await api.tabs.query({ url: EA_MATCH })).filter(tab => isEaUrl(tab.url));
      if (tabs.length !== 1 || tabs[0].id === undefined) return { ok: false, message: 'Canlı EVO kontrolü için tek EA Web App sekmesi açık olmalı.' };
      const cached = evoCache.get(message.playerId);
      if (!message.programId && cached && Date.now() - cached.at < 60000) return { ok: true, evolutions: cached.data };
      try {
        // Chrome args içinde undefined taşıyamaz. Liste çağrısında ikinci argüman hiç eklenmez.
        const args: [string, string?] = message.programId === undefined ? [message.playerId] : [message.playerId, message.programId];
        const results = await api.scripting.executeScript({ target: { tabId: tabs[0].id, frameIds: [0] }, world: 'MAIN', func: readEaPlayerEvolutions, args });
        const result = results[0]?.result as any;
        if (!result?.ok) return { ok: false, message: typeof result?.message === 'string' ? result.message.slice(0, 300) : 'EA EVO verisi okunamadı.' };
        const evolutions = normalizeEaEvolutions(result.evolutions);
        if (evolutions.playerId !== message.playerId || message.programId && evolutions.preview?.programId !== message.programId) return { ok: false, message: 'EVO yanıtı seçili kartla eşleşmedi.' };
        if (evoCache.size >= 30) evoCache.clear(); evoCache.set(message.playerId, { at: Date.now(), data: evolutions });
        return { ok: true, evolutions };
      } catch (error) { return { ok: false, message: error instanceof EaEvolutionDataError ? error.message : 'EA EVO okuyucusu çalıştırılamadı (EVO-EXEC). EA sekmesini yenileyip eklentinin site erişimini kontrol et.' }; }
    }
    if (site && message?.type === 'SQUAD_GET') {
      const tabs = (await api.tabs.query({ url: EA_MATCH })).filter(tab => isEaUrl(tab.url));
      if (tabs.length === 1 && tabs[0].id !== undefined) return syncSquad(tabs[0].id);
      const cached = (await api.storage.session.get('futBrainActiveSquad')).futBrainActiveSquad;
      return { ok: !!cached, ...(cached ? { squad: normalizeEaSquad(cached) } : {}), message: tabs.length > 1 ? 'Aktif kadroyu okumak için tek EA Web App sekmesi bırak.' : 'EA Web App’e giriş yaptığında kadron otomatik gelir.' };
    }
    if (site && message?.type === 'QUEUE') {
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(message.requestId)) return { ok: false, message: 'İstek kimliği geçersiz.' };
      let plan: EaPlan;
      try { plan = validateEaPlan(message.plan); } catch (error) { return { ok: false, message: (error as Error).message }; }
      const current = await read();
      if (current && current.sourceRequestId === message.requestId && current.sourceTabId === tabId) return { ok: true, queued: current.phase !== 'done', result: current.result };
      if (current?.phase === 'working') return { ok: false, message: 'EA’da bir aktarım sürüyor. Sonucunu bekle.' };
      const tabs = (await api.tabs.query({ url: EA_MATCH })).filter(t => isEaUrl(t.url));
      if (tabs.length > 1) return { ok: false, message: 'Birden fazla EA Web App sekmesi açık. Tek sekme bırakıp yeniden gönder.' };
      const target = tabs[0] || await api.tabs.create({ url: EA_WEB_URL, active: true });
      if (target.id === undefined) return { ok: false, message: 'EA sekmesi açılamadı.' };
      const job: Job = { id: crypto.randomUUID(), sourceRequestId: message.requestId, sourceTabId: tabId, sourceOrigin: new URL(sender.url).origin, targetTabId: target.id, plan, phase: 'queued' };
      await write(job);
      await send(target.id, { type: 'SHOW_PLAN', jobId: job.id, plan });
      await api.tabs.update(target.id, { active: true });
      return { ok: true, queued: true, message: 'EA’ya gönderildi. Üstteki bildirimden sonucu takip edebilirsin.' };
    }
    if (!ea) return { ok: false, message: 'İşlem bu sekmeden başlatılamaz.' };
    if (message?.type === 'EA_SYNC') return syncSquad(tabId);
    const job = await read();
    if (!job || job.targetTabId !== tabId) return { ok: false, message: 'Bu EA sekmesine gönderilmiş bir kadro yok.' };
    if (Date.now() - job.plan.createdAt > BRIDGE_TTL) return { ok: false, expired: true, message: 'Aktarımın süresi doldu. Kadroyu siteden yeniden gönder.' };
    if (message?.type === 'EA_READY') {
      if (job.phase === 'queued' || job.phase === 'overwrite') await send(tabId, { type: 'SHOW_PLAN', jobId: job.id, plan: job.plan, requiresOverwrite: job.phase === 'overwrite' });
      else if (job.phase === 'done') await notify(job);
      return { ok: true, working: job.phase === 'working' };
    }
    if (message?.type !== 'EA_RUN' || message.jobId !== job.id) return { ok: false, message: 'Aktarım isteği doğrulanamadı.' };
    if (job.phase === 'working') return { ok: false, message: 'Aktarım zaten sürüyor. EA taslağını kontrol et.' };
    if (job.phase === 'done') return { ok: true, result: job.result };
    const overwrite = job.phase === 'overwrite' && message.replaceDraft === true;
    if (job.phase === 'overwrite' && !overwrite) return { ok: false, message: 'Mevcut taslağı değiştirme onayı gerekli.' };
    job.phase = 'working'; await write(job);
    try {
      const results = await api.scripting.executeScript({ target: { tabId, frameIds: [0] }, world: 'MAIN', func: importEaConcept, args: [validateEaPlan(job.plan), overwrite] });
      job.result = publicResult(results[0]?.result);
    } catch {
      job.result = { ok: false, code: 'EXTENSION_EXECUTION_FAILED', mayHaveSaved: true, message: 'EA bağlantısı kesildi. Otomatik tekrar yapılmadı; Web App’te taslağı kontrol edip siteden yeniden gönder.' };
    }
    job.phase = job.result.requiresOverwrite ? 'overwrite' : 'done'; await write(job); await notify(job);
    return { ok: true, result: job.result };
  };
  return (message: any, sender: chrome.runtime.MessageSender): Promise<BridgeReply> => {
    // Uzun EVO taraması bağlantı kontrolünün yanıtını geciktirmemeli.
    if (message?.type === 'PING') return process(message, sender).catch(() => ({ ok: false, message: 'Eklenti bağlantısı kontrol edilemedi.' }));
    const next = chain.then(() => process(message, sender));
    chain = next.catch(() => undefined);
    return next.catch(() => ({ ok: false, message: 'Eklenti bağlantısı tamamlanamadı. EA sekmesini kontrol et.' }));
  };
}
