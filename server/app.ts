import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { ApiError, ParseClient } from './parseClient.ts';
import { normalizePlayers, normalizeDetail, normalizeEvolutions, validFutbinId } from '../src/services/parseAdapter.ts';
import type { GameYear, MarketPlatform } from '../src/services/parseAdapter.ts';
import { normalizeSbcPage, mergeSbcPage } from '../src/services/sbcData.ts';
import { canRequestConcept, normalizeConcept } from '../src/services/conceptSquad.ts';
import { ClubsClient, ClubsError } from './clubsClient.ts';
import { CLUBS_MATCH_TYPES } from '../src/services/clubsData.ts';
import type { ClubsMatchType } from '../src/services/clubsData.ts';
export function createApp({ root = process.cwd(), transport = fetch, keyOverride, clubsTransport = fetch, clubsNow = Date.now }: { root?: string; transport?: typeof fetch; keyOverride?: () => string; clubsTransport?: typeof fetch; clubsNow?: () => number } = {}) {
  const envPath = path.join(root, '.env.local');
  const fileKey = () => { try { return parse(readFileSync(envPath)).PARSE_API_KEY?.trim() || ''; } catch { return ''; } };
  const getKey = keyOverride || (() => process.env.PARSE_API_KEY?.trim() || fileKey());
  const client = new ParseClient(getKey, transport, keyOverride ? undefined : path.join(root, 'node_modules/.cache/fut-brain/parse-responses.json'), keyOverride ? 20 : 50), app = express();
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    const host = /^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/i.test(req.headers.host || '');
    const origin = req.headers.origin;
    const allowedOrigin = !origin || origin === `http://${req.headers.host}` || ['http://localhost:3000', 'http://127.0.0.1:3000'].includes(origin);
    if (!host || !allowedOrigin || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Yalnızca bu bilgisayardaki uygulama erişebilir.' });
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'JSON isteği gerekli.' });
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  const clubs = new ClubsClient(root, clubsTransport, clubsNow);
  const matchType = (value: unknown): ClubsMatchType => { const type = value ?? 'leagueMatch'; if (typeof type !== 'string' || !CLUBS_MATCH_TYPES.includes(type as ClubsMatchType)) throw new ClubsError(400, 'Maç türü geçersiz.'); return type as ClubsMatchType; };
  app.get('/api/clubs/search', async (req, res, next) => { try { if (typeof req.query.q !== 'string') throw new ClubsError(400, 'Kulüp adı gerekli.'); res.json(await clubs.search(req.query.q)); } catch (e) { next(e); } });
  app.get('/api/clubs/club/:id', async (req, res, next) => { try { res.json(await clubs.dashboard(req.params.id, matchType(req.query.matchType))); } catch (e) { next(e); } });
  app.get('/api/clubs/club/:id/archive', async (req, res, next) => { try { res.json(await clubs.archive(req.params.id, matchType(req.query.matchType))); } catch (e) { next(e); } });
  app.get('/api/clubs/club/:id/report.pdf', async (req, res, next) => {
    try {
      const type = matchType(req.query.matchType), report = await clubs.report(req.params.id,type);
      const { createClubsPdf } = await import('./clubsPdf.ts');
      const pdf = await createClubsPdf(report.data,report.archive.matches);
      res.set({ 'Content-Type':'application/pdf', 'Content-Disposition':`attachment; filename="clubs-${req.params.id}-${type}.pdf"` }).send(pdf);
    } catch(e) { next(e); }
  });
  app.get('/api/extension/download', (_req, res) => {
    const archive = path.join(root, 'extension/fut-brain-extension.zip');
    if (!existsSync(archive)) return res.status(503).json({ error: 'Eklenti paketi henüz oluşturulmadı. Önce npm run build:extension çalıştırılmalı.' });
    res.download(archive, 'fut-brain-extension.zip');
  });
  app.get('/api/parse/status', (_req, res) => res.json(client.status()));
  app.post('/api/parse/budget', (req, res, next) => {
    try { res.json(client.setCreditLimit(req.body?.creditLimit)); } catch (error) { next(error); }
  });
  const savedSbcs = (year: '26' | '27', page: number, activeOnly: boolean) => {
    const params = { page: String(page), active_only: String(activeOnly) };
    const detail = client.peekSaved(year === '26' ? 'get_sbcs' : 'get_fc27_sbcs', params);
    const list = year === '27' ? client.peekSaved('get_fc27_sbcs_list', params) : null;
    const detailed = detail ? normalizeSbcPage(detail.data, year, true, activeOnly, { cached: true, fetchedAt: detail.fetchedAt, credits: 0 }) : null;
    if (!list || (detail && detail.fetchedAt >= list.fetchedAt)) return detailed;
    return mergeSbcPage(detailed, normalizeSbcPage(list.data, year, false, activeOnly, { cached: true, fetchedAt: list.fetchedAt, credits: 0 }));
  };
  app.get('/api/parse/sbcs/saved', (req, res, next) => {
    try {
      const year = req.query.year, page = Number(req.query.page || 1), activeOnly = req.query.activeOnly !== 'false';
      if (!['26', '27'].includes(String(year)) || !Number.isInteger(page) || page < 1 || page > 1000 || (req.query.activeOnly !== undefined && !['true', 'false'].includes(String(req.query.activeOnly)))) throw new ApiError(400, 'Kayıtlı SBC yılı, sayfa veya filtre değeri geçersiz.');
      res.json({ page: savedSbcs(year as '26' | '27', page, activeOnly) });
    } catch (error) { next(error); }
  });
  app.post('/api/parse/config', (req, res, next) => {
    try {
      if (process.env.PARSE_API_KEY || keyOverride) throw new ApiError(409, 'Anahtar sunucu ortamında tanımlı; buradan değiştirilemez.');
      const key = req.body?.apiKey;
      if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{12,512}$/.test(key)) throw new ApiError(400, 'Geçerli Parse anahtarını boşluk veya satır sonu olmadan girin.');
      const text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
      const lines = text.split(/\r?\n/).filter(line => !/^\s*(?:export\s+)?PARSE_API_KEY\s*=/.test(line));
      writeFileSync(envPath, lines.join('\n').trimEnd() + `\nPARSE_API_KEY="${key}"\n`, { mode: 0o600 });
      client.resetConnection(); res.json(client.status());
    } catch (e) { next(e instanceof ApiError ? e : new ApiError(500, 'Anahtar yerel dosyaya kaydedilemedi.')); }
  });
  const context = (body: any) => {
    if (!['26', '27'].includes(body?.year) || !['pc', 'ps', 'xbox'].includes(body?.platform)) throw new ApiError(400, 'Oyun yılı ve platform geçerli olmalı.');
    return { year: body.year as GameYear, platform: body.platform as MarketPlatform };
  };
  const initialMeta = () => ({ fetchedAt: new Date().toISOString(), cached: false, credits: 0 });
  const route = (name: string, handler: (body: any) => Promise<any>) => app.post('/api/parse/' + name, async (req, res, next) => {
    try { res.json(await handler(req.body)); } catch (e) { next(e); }
  });
  route('players', async body => {
    const { year, platform } = context(body);
    const page = body.page ?? 1, minRating = body.minRating ?? 85, query = body.query ?? '';
    if (!Number.isInteger(page) || page < 1 || page > 1000 || !Number.isInteger(minRating) || minRating < 40 || minRating > 99 || typeof query !== 'string' || query.length > 80 || (query && query.trim().length < 2)) throw new ApiError(400, 'Arama, sayfa veya reyting sınırı geçersiz.');
    const endpoint = query.trim() ? `search_players_fc${year}` : 'get_players';
    const params: Record<string, string> = query.trim() ? { query: query.trim(), page: String(page) } : { page: String(page), min_rating: String(minRating), [`fc${year}_only`]: 'true' };
    const result = await client.request(endpoint, params, data => normalizePlayers(data, year, platform, initialMeta()));
    return normalizePlayers(result.data, year, platform, result);
  });
  route('details', async body => {
    const { year, platform } = context(body), id = body.playerId;
    if (!validFutbinId(id)) throw new ApiError(400, 'Tek bir geçerli kart kimliği gerekli.');
    const result = await client.request('get_player_details', { player_id: id, year }, data => normalizeDetail(data, id, year, platform, initialMeta()));
    return { cached: result.cached, fetchedAt: result.fetchedAt, credits: result.credits, player: normalizeDetail(result.data, id, year, platform, result) };
  });
  route('evolutions', async () => {
    const result = await client.request('get_evos', {}, data => normalizeEvolutions(data, initialMeta()));
    return normalizeEvolutions(result.data, result);
  });
  route('sbcs', async body => {
    const year = body?.year, page = body?.page ?? 1, detailed = body?.detailed ?? false, activeOnly = body?.activeOnly ?? true;
    if (!['26', '27'].includes(year) || !Number.isInteger(page) || page < 1 || page > 1000 || typeof detailed !== 'boolean' || typeof activeOnly !== 'boolean') throw new ApiError(400, 'SBC yılı, sayfa veya filtre değeri geçersiz.');
    const withDetails = year === '26' || detailed;
    const endpoint = year === '26' ? 'get_sbcs' : detailed ? 'get_fc27_sbcs' : 'get_fc27_sbcs_list';
    const result = await client.request(endpoint, { page: String(page), active_only: String(activeOnly) }, data => normalizeSbcPage(data, year, withDetails, activeOnly, initialMeta()));
    return mergeSbcPage(savedSbcs(year, page, activeOnly), normalizeSbcPage(result.data, year, withDetails, activeOnly, result));
  });
  route('concept', async body => {
    const { year, platform } = context(body);
    const { setId, segmentId } = body, page = body.page ?? 1, activeOnly = body.activeOnly ?? true, maxAgeMinutes = body.maxAgeMinutes ?? 60;
    if (year !== '27' || platform !== 'ps' || !Number.isInteger(page) || page < 1 || page > 1000 || typeof activeOnly !== 'boolean' ||
      typeof setId !== 'string' || !/^[1-9]\d{0,9}$/.test(setId) || typeof segmentId !== 'string' || !/^[1-9]\d{0,9}$/.test(segmentId) ||
      ![60, 180].includes(maxAgeMinutes)) throw new ApiError(400, 'FC 27 PlayStation görevi ve geçerli fiyat süresi gerekli.');
    const source = client.peekSaved('get_fc27_sbcs', { page: String(page), active_only: String(activeOnly) });
    if (!source) throw new ApiError(409, 'Görev koşullarının 24 saatlik kaydı bulunamadı. Önce bu sayfanın koşullarını getir.');
    const sourcePage = normalizeSbcPage(source.data, '27', true, activeOnly, { cached: true, fetchedAt: source.fetchedAt, credits: 0 });
    const set = sourcePage.sets.find(s => s.id === setId), segment = set?.segments.find(s => s.id === segmentId);
    if (!set || !segment || !canRequestConcept(set, segment)) throw new ApiError(400, 'Yalnızca kaynakta doğrulanan aktif klasik SBC için konsept kadro kurulabilir.');
    const result = await client.request('fc27_sbc_solver', { sbc_name: segment.name === set.name ? set.name : segment.name, max_age_minutes: String(maxAgeMinutes), card_type_mode: 'Any' }, data => normalizeConcept(data, set, segment, maxAgeMinutes, initialMeta()));
    return normalizeConcept(result.data, set, segment, maxAgeMinutes, result);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Bu işlem bulunamadı.' }));
  if (existsSync(path.join(root, 'dist/index.html'))) {
    app.use(express.static(path.join(root, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
  }
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const code = error instanceof ApiError || error instanceof ClubsError ? error.status : error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 502;
    res.status(code).json({ error: error instanceof ApiError || error instanceof ClubsError ? error.message : code === 400 || code === 413 ? 'İstek gövdesi geçersiz veya çok büyük.' : 'Veri sağlayıcısı yanıtı doğrulanamadı.' });
  });
  return { app, client, clubs };
}
