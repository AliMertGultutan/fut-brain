import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeClubsSearch, normalizeClubsInfo, normalizeClubsOverall, normalizeClubsMembers, normalizeClubsMatches, validClubsId, CLUBS_PLATFORM } from '../src/services/clubsData.ts';
import type { ClubsDashboard, ClubsMatch, ClubsMatchType } from '../src/services/clubsData.ts';
export class ClubsError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
export const CLUBS_TTL = 120000;
const HEADERS = { accept: 'application/json', 'accept-language': 'en-US,en;q=0.9', 'sec-fetch-site': 'same-origin', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' };
export class ClubsClient {
  root: string; transport: typeof fetch; now: () => number;
  cache = new Map<string, { at: number; value: any }>(); pending = new Map<string, Promise<any>>(); failures = new Map<string, { at: number; error: Error }>();
  queue: Promise<any> = Promise.resolve(); diskQueue: Promise<any> = Promise.resolve(); lastRequest = 0;
  constructor(root: string, transport = fetch, now = Date.now) { this.root = path.join(root, 'data/clubs'); this.transport = transport; this.now = now; }
  private async shared<T>(key: string, work: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key); if (cached && this.now() - cached.at < CLUBS_TTL) return { ...structuredClone(cached.value), cached: true };
    if (this.pending.has(key)) return this.pending.get(key);
    const failed = this.failures.get(key); if (failed && this.now() - failed.at < 30000) throw failed.error;
    if (this.pending.size >= 32) throw new ClubsError(503, 'Clubs veri kuyruğu dolu. Biraz sonra tekrar dene.');
    const promise = work().then(value => { if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!); const meta = value as any, observed = Date.parse(meta.observedAt); const at = !meta.stale && Number.isFinite(observed) ? Math.min(this.now(),observed) : this.now(); this.cache.set(key, { at, value }); this.failures.delete(key); return value; }).catch(error => { if (this.failures.size >= 200) this.failures.clear(); this.failures.set(key, { at: this.now(), error }); throw error; }).finally(() => this.pending.delete(key));
    this.pending.set(key, promise); return promise;
  }
  private request(endpoint: string, params: Record<string,string>) {
    const run = async () => {
      const wait = Math.max(0, 400 - (Date.now() - this.lastRequest)); if (wait) await new Promise(r => setTimeout(r, wait)); this.lastRequest = Date.now();
      const url = new URL('https://proclubs.ea.com/api/fc/' + endpoint); url.search = new URLSearchParams({ platform: CLUBS_PLATFORM, ...params }).toString();
      let response: Response;
      try { response = await this.transport(url, { headers: HEADERS, signal: AbortSignal.timeout(9000), redirect: 'error' }); } catch { throw new ClubsError(502, 'EA Clubs bağlantısı kurulamadı veya zaman aşımına uğradı.'); }
      if (!response.ok) throw new ClubsError(502, response.status === 403 ? 'EA Clubs bu bağlantıyı reddetti (403). Daha sonra tekrar dene.' : response.status === 429 ? 'EA Clubs istekleri geçici olarak sınırladı. Biraz sonra tekrar dene.' : 'EA Clubs şu anda yanıt veremiyor.');
      try { const bytes = await response.arrayBuffer(); if (bytes.byteLength > 4 * 1024 * 1024) throw new Error(); return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ClubsError(502, 'EA Clubs yanıtı okunamadı.'); }
    };
    const next = this.queue.then(run); this.queue = next.catch(() => undefined); return next;
  }
  search(query: string) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.trim().length > 60 || /[\x00-\x1f]/.test(query)) throw new ClubsError(400, 'Kulüp adı 2–60 karakter olmalı.');
    const q = query.trim(); return this.shared('search:' + q.toLowerCase(), async () => ({ clubs: normalizeClubsSearch(await this.request('allTimeLeaderboard/search', { clubName: q, maxResultCount: '30' })), observedAt: new Date(this.now()).toISOString(), cached: false }));
  }
  private filename(id: string, type: ClubsMatchType, kind: string) { return path.join(this.root, `${id}-${type}-${kind}.json`); }
  private async snapshot(id: string, type: ClubsMatchType): Promise<ClubsDashboard> {
    const text = await readFile(this.filename(id,type,'snapshot'),'utf8'); if (text.length > 8e6) throw new Error();
    const saved = JSON.parse(text), d = saved.data;
    if (saved.version !== 1 || d?.club?.id !== id || d.matchType !== type || typeof d.club.name !== 'string' || !Array.isArray(d.members) || !Array.isArray(d.matches) || !Number.isFinite(Date.parse(d.observedAt))) throw new Error();
    return d;
  }
  async report(id: string, type: ClubsMatchType) {
    if (!validClubsId(id) || !['leagueMatch','friendlyMatch','playoffMatch'].includes(type)) throw new ClubsError(400, 'Kulüp veya maç türü geçersiz.');
    let data: ClubsDashboard;
    try { data = await this.snapshot(id,type); } catch { throw new ClubsError(409, 'PDF için önce bu kulübün verilerini başarıyla getir.'); }
    return { data, archive: await this.archive(id,type) };
  }
  private async atomic(file: string, value: unknown) { await mkdir(this.root, { recursive: true }); const temp = file + '.tmp'; await writeFile(temp, JSON.stringify(value), 'utf8'); await rename(temp, file); }
  async archive(id: string, type: ClubsMatchType): Promise<{ version: number; clubId: string; matchType: ClubsMatchType; startedAt: string; updatedAt: string; matches: ClubsMatch[] }> {
    if (!validClubsId(id) || !['leagueMatch','friendlyMatch','playoffMatch'].includes(type)) throw new ClubsError(400, 'Kulüp veya maç türü geçersiz.');
    try { const text = await readFile(this.filename(id, type, 'archive'), 'utf8'); if (text.length > 30e6) throw new Error(); const d = JSON.parse(text); if (d.version !== 1 || d.clubId !== id || d.matchType !== type || !Array.isArray(d.matches) || !Number.isFinite(Date.parse(d.startedAt)) || d.matches.some((m: any) => !validClubsId(m.id) || m.type !== type)) throw new Error(); return d; }
    catch (e: any) { if (e.code !== 'ENOENT') throw new ClubsError(500, 'Yerel maç arşivi okunamadı; mevcut dosya korunuyor.'); return { version: 1, clubId: id, matchType: type, startedAt: '', updatedAt: '', matches: [] }; }
  }
  private async persist(data: ClubsDashboard) {
    const run = async () => {
      const archive = await this.archive(data.club.id, data.matchType), stamp = data.observedAt;
      const matches = [...new Map([...archive.matches, ...data.matches].map(m => [m.id, m])).values()].sort((a,b) => b.playedAt.localeCompare(a.playedAt));
      await this.atomic(this.filename(data.club.id, data.matchType, 'archive'), { ...archive, startedAt: archive.startedAt || stamp, updatedAt: stamp, matches });
      data.archivedCount = matches.length; data.archiveStartedAt = archive.startedAt || stamp;
      await this.atomic(this.filename(data.club.id, data.matchType, 'snapshot'), { version: 1, data });
    };
    const next = this.diskQueue.then(run); this.diskQueue = next.catch(() => undefined); await next;
  }
  dashboard(id: string, type: ClubsMatchType) {
    if (!validClubsId(id) || !['leagueMatch','friendlyMatch','playoffMatch'].includes(type)) throw new ClubsError(400, 'Kulüp veya maç türü geçersiz.');
    return this.shared<ClubsDashboard>('club:' + id + ':' + type, async () => {
      try { const saved = await this.snapshot(id,type); const age = this.now() - Date.parse(saved.observedAt); if (!saved.stale && age >= 0 && age < CLUBS_TTL) return { ...saved, cached: true }; } catch { /* Eksik veya bozuk kayıt güncel EA okumasını engellemez. */ }
      try {
        const info = normalizeClubsInfo(await this.request('clubs/info', { clubIds: id }), id);
        const overall = normalizeClubsOverall(await this.request('clubs/overallStats', { clubIds: id }), id);
        const members = normalizeClubsMembers(await this.request('members/stats', { clubId: id }));
        const matches = normalizeClubsMatches(await this.request('clubs/matches', { clubIds: id, matchType: type, maxResultCount: '10' }), id, type);
        const data: ClubsDashboard = { club: { ...info, ...overall }, skillRating: overall.skillRating, streak: overall.streak, members, matches, matchType: type, observedAt: new Date(this.now()).toISOString(), cached: false, stale: false, warning: '', archivedCount: 0, archiveStartedAt: '' };
        try { await this.persist(data); } catch { data.storageWarning = 'Veri EA’dan alındı; yerel arşive yazılamadı. Dosya izinlerini ve diski kontrol et.'; }
        return data;
      } catch (error) {
        try { const saved = await this.snapshot(id,type); return { ...saved, cached: true, stale: true, warning: error instanceof ClubsError ? error.message : 'EA yanıtı doğrulanamadı; son başarılı kayıt gösteriliyor.' }; } catch { throw error instanceof ClubsError ? error : new ClubsError(502, 'EA Clubs verisi doğrulanamadı.'); }
      }
    });
  }
}
