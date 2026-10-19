import { useEffect, useRef, useState } from 'react';
import type { Player } from '../types/index.ts';
import type { ParseStatus, GameYear, MarketPlatform, MarketPage, MarketMeta, EvolutionPage } from './parseAdapter.ts';
import type { SbcPage } from './sbcData.ts';
import { mergeSbcPage, sbcPageKey } from './sbcData.ts';
import type { RemoteSbcSet, RemoteSbcSegment } from './sbcData.ts';
import type { ConceptSquad } from './conceptSquad.ts';
import { localGoldConcept } from './localGoldConcept.ts';

interface Snapshot { year: GameYear; platform: MarketPlatform; players: Player[]; page: MarketPage | null; evolutionPage: EvolutionPage | null; sbcPage: SbcPage | null; sbcPages: SbcPage[]; concept: ConceptSquad | null; lastQuery: string; lastMinRating: number }
const storageKey = 'fut-brain-parse-snapshot-v1';
function readSnapshot(): Partial<Snapshot> {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!saved || saved.version !== 1 || Date.now() - saved.savedAt > 86400000 || !['26', '27'].includes(saved.year) || !['pc', 'ps', 'xbox'].includes(saved.platform)) return {};
    return { ...saved, players: Array.isArray(saved.players) ? saved.players.filter((p: Player) => p.priceSource === 'Parse / FUTBIN' && !p.inClub && p.gameYear === saved.year).slice(-500) : [],
      page: Array.isArray(saved.page?.players) ? { ...saved.page, cached: true } : null, evolutionPage: Array.isArray(saved.evolutionPage?.evolutions) ? { ...saved.evolutionPage, cached: true } : null,
      sbcPage: Array.isArray(saved.sbcPage?.sets) && saved.sbcPage.year === saved.year ? { ...saved.sbcPage, cached: true } : null,
      sbcPages: Array.isArray(saved.sbcPages) ? saved.sbcPages.filter((p: SbcPage) => ['26', '27'].includes(p?.year) && Array.isArray(p.sets) && Number.isInteger(p.page) && Date.now() - Date.parse(p.fetchedAt) <= 86400000).slice(-20).map((p: SbcPage) => ({ ...p, cached: true })) : [],
      concept: saved.concept?.year === '27' && ['ps', 'pc', 'xbox'].includes(saved.concept?.platform) && Array.isArray(saved.concept.players) && Array.isArray(saved.concept.checks) ? { ...saved.concept, cached: true, reason: saved.concept.reason || '' } : null };
  } catch { return {}; }
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/parse/' + path, { method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(path === 'concept' ? 165000 : 35000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'Yerel veri sunucusuna ulaşılamadı. Uygulamayı yeniden başlatın.');
  return data as T;
}

export function useParseMarket() {
  const [snapshot] = useState(readSnapshot);
  const [status, setStatus] = useState<ParseStatus | null>(null);
  const [year, setYear] = useState<GameYear>(snapshot.year || '27');
  const [platform, setPlatform] = useState<MarketPlatform>(snapshot.platform || 'pc');
  const [players, setPlayers] = useState<Player[]>(snapshot.players || []);
  const [evolutionPage, setEvolutionPage] = useState<EvolutionPage | null>(snapshot.evolutionPage || null);
  const [sbcPage, setSbcPage] = useState<SbcPage | null>(snapshot.sbcPage || null);
  const [sbcPages, setSbcPages] = useState<SbcPage[]>(snapshot.sbcPages?.length ? snapshot.sbcPages : snapshot.sbcPage ? [snapshot.sbcPage] : []);
  const historyRef = useRef(sbcPages), contextGeneration = useRef(0);
  const [page, setPage] = useState<MarketPage | null>(snapshot.page || null);
  const [concept, setConcept] = useState<ConceptSquad | null>(snapshot.concept || null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [activity, setActivity] = useState('');
  const [detail, setDetail] = useState<{ id: string; phase: 'loading' | 'ready' | 'error'; meta?: MarketMeta; receivedStats?: boolean; receivedStyles?: boolean } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastQuery, setLastQuery] = useState(snapshot.lastQuery || '');
  const [lastMinRating, setLastMinRating] = useState(snapshot.lastMinRating || 85);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, savedAt: Date.now(), year, platform, players, page, evolutionPage, sbcPage, sbcPages, concept, lastQuery, lastMinRating })); } catch { /* Depolama kapalıysa veriler yalnızca oturumda tutulur. */ } }, [year, platform, players, page, evolutionPage, sbcPage, sbcPages, concept, lastQuery, lastMinRating]);
  const publishSbcs = (result: SbcPage) => {
    const previous = historyRef.current.find(p => sbcPageKey(p) === sbcPageKey(result));
    const merged = previous && previous.fetchedAt > result.fetchedAt ? mergeSbcPage(result, previous) : mergeSbcPage(previous, result);
    historyRef.current = [...historyRef.current.filter(p => sbcPageKey(p) !== sbcPageKey(merged)), merged].slice(-20);
    setSbcPages(historyRef.current); setSbcPage(merged);
  };
  useEffect(() => {
    let cancelled = false; const generation = contextGeneration.current;
    const known = historyRef.current.filter(p => p.year === year).at(-1);
    // Yalnızca sunucudaki kayıt okunur; açılışta ücretli sağlayıcı çağrısı yapılmaz.
    api<{ page: SbcPage | null }>(`sbcs/saved?year=${year}&page=${known?.page || 1}&activeOnly=${known?.activeOnly ?? true}`).then(result => {
      if (!cancelled && generation === contextGeneration.current && !pending.current && result.page) publishSbcs(result.page);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [year]);
  const refreshStatus = () => api<ParseStatus>('status').then(setStatus);
  useEffect(() => { refreshStatus().catch(() => setError('Yerel veri sunucusuna ulaşılamadı. Uygulamayı yeniden başlatın.')); }, []);
  const run = async (activityText: string, work: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setActivity(activityText); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Veri alınamadı.'); }
    finally { pending.current = false; setBusy(false); setActivity(''); await refreshStatus().catch(() => {}); }
  };
  const receipt = (meta: MarketMeta) => `${meta.cached ? '5 dakikalık önbellekten okundu; yeni kredi isteği yok.' : `Parse yanıtı alındı. Belgelenen çağrı bedeli: ${meta.credits} kredi.`} Okuma: ${new Date(meta.fetchedAt).toLocaleString('tr-TR')}`;
  const loadPlayers = (query = '', pageNumber = 1, minRating = 85) => run(query ? `“${query}” aranıyor…` : 'Katalog getiriliyor…', async () => {
    setDetail(null);
    const result = await api<MarketPage>('players', { year, platform, query, page: pageNumber, minRating });
    setPlayers(previous => [...new Map([...previous, ...result.players].map(p => [p.id, p])).values()].slice(-500));
    setPage(result); setLastQuery(query); setLastMinRating(minRating);
    setMessage(`${query ? `“${query}” araması` : 'Katalog'}: ${result.players.length} kart bulundu. ${receipt(result)}${result.skipped ? ` ${result.skipped} kartın verisi doğrulanamadığı için gösterilmedi.` : ''}`);
  });
  const loadDetails = (player: Player) => run(`${player.name} ayrıntısı getiriliyor…`, async () => {
    setDetail({ id: player.id, phase: 'loading' });
    try {
      const result = await api<MarketMeta & { player: Partial<Player> }>('details', { year, platform, playerId: player.futbinId });
      setPlayers(previous => previous.map(p => p.id === result.player.id ? { ...p, ...result.player } : p));
      setDetail({ id: player.id, phase: 'ready', meta: result, receivedStats: result.player.statsKnown === true, receivedStyles: result.player.playStyles !== undefined });
      setMessage(`${player.name}: kart bilgileri güncellendi. ${receipt(result)}`);
    } catch (error) { setDetail({ id: player.id, phase: 'error' }); throw error; }
  });
  const loadEvolutions = () => run('Evolution listesi getiriliyor…', async () => {
    const result = await api<EvolutionPage>('evolutions', {});
    setEvolutionPage(result); setMessage(`${result.evolutions.length} Evolution okundu. ${receipt(result)}`);
  });
  const loadSbcs = (pageNumber = 1, detailed = false, activeOnly = true) => run(detailed ? 'SBC koşulları getiriliyor…' : 'SBC listesi getiriliyor…', async () => {
    const result = await api<SbcPage>('sbcs', { year, page: pageNumber, detailed, activeOnly });
    publishSbcs(result);
    setMessage(`FC ${year}: ${result.sets.length} SBC grubu alındı. ${receipt(result)}${result.skipped ? ` ${result.skipped} kayıt yıl, kimlik veya süre filtresinden geçmedi.` : ''}`);
  });
  const loadConcept = (set: RemoteSbcSet, segment: RemoteSbcSegment, maxAgeMinutes = 60) => run(`${segment.name}: PlayStation konsept kadrosu aranıyor… Bu işlem yaklaşık 1–2 dakika sürebilir.`, async () => {
    const result = await api<ConceptSquad>('concept', { year: '27', platform: 'ps', page: sbcPage?.page, activeOnly: sbcPage?.activeOnly, setId: set.id, segmentId: segment.id, maxAgeMinutes });
    setConcept(result);
    setMessage(`${result.found ? 'Konsept kadro bulundu; aşağıdaki kartları ve koşul kontrolünü incele.' : result.reason} ${receipt(result)}`);
  });
  const loadLocalGold = (set: RemoteSbcSet, segment: RemoteSbcSegment) => run('Kayıtlı altın kart havuzu hesaplanıyor…', async () => { setConcept(localGoldConcept(set, segment, players, platform)); setMessage('Yerel havuzdan 10 altın kart seçildi. Yeni veri kredisi harcanmadı; fiyat tarihlerini kontrol et.'); });
  const refreshAll = () => run('Prototip verileri güncelleniyor…', async () => {
    const errors: string[] = [];
    for (const [label, work] of [
      ['Oyuncu kataloğu', async () => { const result = await api<MarketPage>('players', { year, platform, page: 1, minRating: 40 }); setPage(result); setPlayers(previous => [...new Map([...previous, ...result.players].map(p => [p.id, p])).values()].slice(-500)); setLastQuery(''); setLastMinRating(40); }],
      ['SBC koşulları', async () => { const result = await api<SbcPage>('sbcs', { year, page: 1, detailed: true, activeOnly: true }); publishSbcs(result); }],
      ['Evolution listesi', async () => { const result = await api<EvolutionPage>('evolutions', {}); setEvolutionPage(result); }],
    ] as const) {
      setActivity(`${label} güncelleniyor…`);
      try { await work(); } catch (e) { errors.push(`${label}: ${e instanceof Error ? e.message : 'Alınamadı.'}`); }
    }
    setMessage('Veri yenileme tamamlandı. Kartlar, SBC koşulları ve EVO kayıtları kaynakta geldikleri oyun yılıyla gösterilir.');
    if (errors.length) setError(errors.join(' '));
  });
  const saveKey = (apiKey: string) => run('Anahtar kaydediliyor…', async () => {
    const result = await api<ParseStatus>('config', { apiKey });
    contextGeneration.current++; historyRef.current = []; setSbcPages([]);
    setStatus(result); setPlayers([]); setPage(null); setEvolutionPage(null); setSbcPage(null); setConcept(null); setEnabled(false); setDetail(null);
    setMessage('Anahtar bu bilgisayardaki .env.local dosyasına kaydedildi. Henüz Parse çağrısı yapılmadı; bağlantıyı test edebilirsiniz.');
  });
  const saveBudget = (creditLimit: number) => run('Yerel kredi sınırı kaydediliyor…', async () => {
    const result = await api<ParseStatus>('budget', { creditLimit }); setStatus(result);
    setMessage(`Yerel sınır ${result.sessionCreditLimit} kredi olarak kaydedildi. Kullanım ${result.creditsAttempted} olarak korundu. Henüz yeni Parse çağrısı yapılmadı.`);
  });
  const setContext = (nextYear: GameYear, nextPlatform: MarketPlatform) => {
    if (pending.current) return;
    if (nextYear === year && nextPlatform === platform) return;
    contextGeneration.current++;
    if (nextYear !== year) { setSbcPage(historyRef.current.filter(p => p.year === nextYear).at(-1) || null); setConcept(null); }
    setYear(nextYear); setPlatform(nextPlatform); setPlayers([]); setPage(null); setEnabled(false); setDetail(null); setError(''); setMessage('');
  };
  return { status, year, platform, players, evolutionPage, page, enabled, setEnabled, busy, activity, detail, error, message, lastQuery, lastMinRating,
    sbcPage, loadSbcs, setContext, loadPlayers, loadDetails, loadEvolutions, saveKey, saveBudget, concept, loadConcept, loadLocalGold, refreshAll };
}
export type ParseMarket = ReturnType<typeof useParseMarket>;
