import { ParseDataError } from '../src/services/parseAdapter.ts';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const BASE_URL = 'https://api.parse.bot/scraper/21963078-8a17-40ff-a896-9b0b0ec3e828/';
const COSTS: Record<string, number> = { get_players: 1, search_players_fc26: 1, search_players_fc27: 3, get_player_details: 1, get_evos: 1, get_sbcs: 1, get_fc27_sbcs_list: 1, get_fc27_sbcs: 10, list_fc27_players: 3, fc27_sbc_solver: 10 };
const TTL = 5 * 60000;
export class ParseClient {
  getKey: () => string;
  transport: typeof fetch;
  cache = new Map<string, { data: unknown; fetchedAt: string; expires: number }>();
  pending = new Map<string, Promise<any>>();
  failures = new Map<string, { error: ApiError; expires: number }>();
  requests: number[] = [];
  creditsAttempted = 0;
  lastSuccessAt: string | null = null;
  lastError: string | null = null;
  sessionCreditLimit = 20;
  cacheFile?: string;
  budgetStartedAt = Date.now();
  constructor(getKey: () => string, transport: typeof fetch = fetch, cacheFile?: string, defaultCreditLimit = 20) {
    this.getKey = getKey; this.transport = transport; this.cacheFile = cacheFile; this.sessionCreditLimit = defaultCreditLimit;
    if (cacheFile) try {
      const saved = JSON.parse(readFileSync(cacheFile, 'utf8'));
      if (saved.fingerprint === this.fingerprint()) {
        if (Array.isArray(saved.entries)) this.cache = new Map(saved.entries.filter(([key, value]: any) => typeof key === 'string' && key.startsWith(BASE_URL) && Number.isFinite(Date.parse(value?.fetchedAt)) && Date.now() - Date.parse(value.fetchedAt) <= 86400000).slice(-100));
        if (Number.isInteger(saved.sessionCreditLimit) && saved.sessionCreditLimit >= 20 && saved.sessionCreditLimit <= 1000) this.sessionCreditLimit = saved.sessionCreditLimit;
        if (saved.budgetStartedAt > Date.now() - 86400000 && Number.isInteger(saved.creditsAttempted) && saved.creditsAttempted >= 0) { this.creditsAttempted = saved.creditsAttempted; this.budgetStartedAt = saved.budgetStartedAt; }
        this.requests = Array.isArray(saved.requests) ? saved.requests.filter((t: number) => Number.isFinite(t) && Date.now() - t < 60000) : [];
        this.lastSuccessAt = typeof saved.lastSuccessAt === 'string' && Number.isFinite(Date.parse(saved.lastSuccessAt)) ? saved.lastSuccessAt : null;
      }
    } catch { /* İlk açılış veya bozuk önbellek güvenli biçimde boş başlar. */ }
  }
  fingerprint() { return createHash('sha256').update(this.getKey()).digest('hex'); }
  persist() {
    if (!this.cacheFile) return;
    try { mkdirSync(dirname(this.cacheFile), { recursive: true }); writeFileSync(this.cacheFile, JSON.stringify({ fingerprint: this.fingerprint(), entries: [...this.cache], sessionCreditLimit: this.sessionCreditLimit, creditsAttempted: this.creditsAttempted, budgetStartedAt: this.budgetStartedAt, requests: this.requests, lastSuccessAt: this.lastSuccessAt }), { mode: 0o600 }); } catch { /* Disk yazılamazsa bellek önbelleği ve sınırlar korunur. */ }
  }
  setCreditLimit(value: unknown) {
    if (!Number.isInteger(value) || Number(value) < 20 || Number(value) > 1000) throw new ApiError(400, 'Yerel kredi sınırı 20 ile 1000 arasında tam sayı olmalı.');
    if (this.pending.size) throw new ApiError(409, 'Devam eden veri isteği tamamlandıktan sonra sınırı değiştirebilirsin.');
    this.sessionCreditLimit = Number(value); this.persist(); return this.status();
  }
  peekSaved(endpoint: string, params: Record<string, string>) {
    const url = new URL(endpoint, BASE_URL);
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => url.searchParams.set(k, v));
    const cached = this.cache.get(url.toString());
    return cached && Number.isFinite(Date.parse(cached.fetchedAt)) && Date.now() - Date.parse(cached.fetchedAt) <= 86400000 ? cached : null;
  }
  peek(endpoint: string, params: Record<string, string>) {
    const url = new URL(endpoint, BASE_URL);
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => url.searchParams.set(k, v));
    const cached = this.cache.get(url.toString());
    return cached && cached.expires > Date.now() ? cached : null;
  }
  status() {
    if (this.cacheFile && Date.now() - this.budgetStartedAt >= 86400000) { this.creditsAttempted = 0; this.budgetStartedAt = Date.now(); this.persist(); }
    this.requests = this.requests.filter(t => Date.now() - t < 60000);
    return { configured: Boolean(this.getKey()), connected: Boolean(this.lastSuccessAt && !this.lastError),
      lastSuccessAt: this.lastSuccessAt, lastError: this.lastError, creditsAttempted: this.creditsAttempted,
      sessionCreditLimit: this.sessionCreditLimit, requestsRemaining: Math.max(0, 5 - this.requests.length) };
  }
  resetConnection() { this.cache.clear(); this.failures.clear(); this.lastSuccessAt = null; this.lastError = null; this.persist(); }
  async request<T>(endpoint: string, params: Record<string, string>, validate: (data: unknown) => T) {
    const cost = Object.hasOwn(COSTS, endpoint) ? COSTS[endpoint] : 0;
    if (!cost) throw new ApiError(400, 'Bu veri işlemi desteklenmiyor.');
    const key = this.getKey();
    if (!key) throw new ApiError(503, 'Önce Ayarlar ekranına Parse API anahtarını ekleyin.');
    const url = new URL(endpoint, BASE_URL);
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => url.searchParams.set(k, v));
    const cacheKey = url.toString(), cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) { validate(cached.data); this.lastError = null; this.lastSuccessAt = cached.fetchedAt; return { data: cached.data, fetchedAt: cached.fetchedAt, cached: true, credits: 0 }; }
    const failed = this.failures.get(cacheKey);
    if (failed && failed.expires > Date.now()) throw failed.error;
    if (this.pending.has(cacheKey)) return this.pending.get(cacheKey)!;
    this.status();
    if (this.requests.length >= 5) throw new ApiError(429, 'Dakikada 5 istek sınırına ulaşıldı. Bir dakika sonra yeniden deneyin.');
    if (this.creditsAttempted + cost > this.sessionCreditLimit) throw new ApiError(429, `${this.sessionCreditLimit} kredilik yerel deneme sınırına ulaşıldı. Kullanım ${this.creditsAttempted}/${this.sessionCreditLimit}, kalan ${Math.max(0, this.sessionCreditLimit - this.creditsAttempted)}; bu işlem ${cost} kredi gerektiriyor. Bu sayaç Parse bakiyesi değildir. Ayarlar ekranından yerel sınırı düzenleyebilirsin.`);
    this.requests.push(Date.now()); this.creditsAttempted += cost;
    this.persist();
    const operation = (async () => {
      try {
        const response = await this.transport(url, { headers: { 'X-API-Key': key, Accept: 'application/json' },
          signal: AbortSignal.timeout(endpoint === 'fc27_sbc_solver' ? 150000 : 30000), redirect: 'error' });
        if (!response.ok) {
          const message = response.status === 401 || response.status === 403 ? 'Parse anahtarı veya bu API için erişim yetkisi doğrulanamadı.' :
            response.status === 429 ? 'Parse kullanım/kredi sınırına ulaşıldı. Hesabınızdaki kotayı kontrol edin.' : 'Parse veri sağlayıcısı şu anda yanıt veremiyor.';
          throw new ApiError(response.status === 429 ? 429 : 502, message);
        }
        const text = await response.text();
        if (text.length > 4_000_000) throw new ApiError(502, 'Sağlayıcı yanıtı beklenen boyutu aşıyor.');
        const payload = JSON.parse(text);
        if (payload?.status !== 'success' || !payload.data || typeof payload.data !== 'object') throw new ApiError(502, 'Parse başarılı bir veri yanıtı döndürmedi.');
        validate(payload.data);
        const fetchedAt = new Date().toISOString();
        if (this.getKey() !== key) throw new ApiError(409, 'Anahtar değişti; isteği yeniden başlatın.');
        if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(cacheKey, { data: payload.data, fetchedAt, expires: Date.now() + TTL });
        this.lastSuccessAt = fetchedAt; this.lastError = null;
        this.persist();
        return { data: payload.data, fetchedAt, cached: false, credits: cost };
      } catch (error) {
        // Sağlayıcının ham hatası ve kimlik bilgileri istemciye/loglara taşınmaz.
        const safe = error instanceof ApiError ? error : new ApiError(502, error instanceof ParseDataError ? error.message : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'Parse yanıtı zaman aşımına uğradı. Otomatik tekrar yapılmadı.' : 'Sağlayıcı yanıtı okunamadı veya biçimi doğrulanamadı.');
        if (this.getKey() === key) {
          if (this.failures.size >= 100) this.failures.delete(this.failures.keys().next().value!);
          this.failures.set(cacheKey, { error: new ApiError(safe.status, safe.message + ' Aynı hata için 1 dakika yeni ücretli çağrı yapılmayacak.'), expires: Date.now() + 60000 });
        }
        this.lastError = safe.message; throw safe;
      } finally { this.pending.delete(cacheKey); }
    })();
    this.pending.set(cacheKey, operation);
    return operation;
  }
}
