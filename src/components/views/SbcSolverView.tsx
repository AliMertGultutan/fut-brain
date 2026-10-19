import React, { useState, useMemo, useEffect } from 'react';
import type {
  Player,
  SbcChallenge,
  SbcSlot,
  SbcSolution,
  SolverStrategy,
  TokenInventory,
} from '../../types/index.ts';
import {
  calculateSquadRating,
  solveClubAndTokenSbc,
  solveNormalSbc,
} from '../../services/sbcSolver.ts';
import { PlayerSwapModal } from '../modals/PlayerSwapModal.tsx';
import { copyText, downloadText } from '../../services/export.ts';
import { ItemTokenProvider, SquadProvider } from '../../services/providers.ts';

interface SbcSolverViewProps {
  challenges: SbcChallenge[];
  clubPlayers: Player[];
  marketPlayers: Player[];
  tokenInventory: TokenInventory;
  onUpdateTokens: (newTokens: TokenInventory) => void;
  onNavigate: (page: string) => void;
  initialChallengeId?: string;
}

export const SbcSolverView: React.FC<SbcSolverViewProps> = ({
  challenges,
  clubPlayers,
  marketPlayers,
  tokenInventory,
  onUpdateTokens,
  initialChallengeId,
}) => {
  const [activeMode, setActiveMode] = useState<'CLUB_TOKEN' | 'NORMAL'>('CLUB_TOKEN');
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(initialChallengeId || challenges[0]?.id || '');
  const [activeStrategy, setActiveStrategy] = useState<SolverStrategy>('CLUB_FIRST');

  // Mod A toggles
  const [avoidClubPlayers, setAvoidClubPlayers] = useState<boolean>(false);
  const [prioritizeUntradeables, setPrioritizeUntradeables] = useState<boolean>(true);
  const [protectSquad, setProtectSquad] = useState(true);
  const [savedSquad] = useState(() => SquadProvider.getSaved());
  const [onlyClub, setOnlyClub] = useState(false);
  const [includeTokens, setIncludeTokens] = useState<boolean>(challenges[0]?.source !== 'PARSE');

  // Mod B manual inputs
  const [normalMinRating, setNormalMinRating] = useState<number>(87);
  const [normalMinTotw, setNormalMinTotw] = useState<number>(1);
  const [normalMinChem, setNormalMinChem] = useState<number>(14);
  const [normalBudgetLimit, setNormalBudgetLimit] = useState<string>('');

  const [extraRequirements, setExtraRequirements] = useState<Record<string, string>>({});
  const [recalculation, setRecalculation] = useState(0);
  // Computation status
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Slot customization / Locked slots
  type SlotLocks = Record<string, Player | { isToken: boolean; tokenRating: number }>;
  const [modeLocks, setModeLocks] = useState<Record<'CLUB_TOKEN' | 'NORMAL', SlotLocks>>({ CLUB_TOKEN: {}, NORMAL: {} });
  const lockedSlots = modeLocks[activeMode];
  const setLockedSlots = (next: SlotLocks | ((previous: SlotLocks) => SlotLocks)) => setModeLocks(previous => ({ ...previous, [activeMode]: typeof next === 'function' ? next(previous[activeMode]) : next }));
  const [swapModalSlot, setSwapModalSlot] = useState<SbcSlot | null>(null);

  const selectedChallenge = useMemo(() => {
    return challenges.find((c) => c.id === selectedChallengeId) || challenges[0];
  }, [challenges, selectedChallengeId]);

  useEffect(() => { if (initialChallengeId) setSelectedChallengeId(initialChallengeId); }, [initialChallengeId]);
  const [solution, setSolution] = useState<SbcSolution>(() => solveNormalSbc(selectedChallenge, []));
  useEffect(() => {
    setIsCalculating(true);
    setSolution(solveNormalSbc(selectedChallenge, []));
    const worker = new Worker(new URL('../../services/sbcSolver.worker.ts', import.meta.url), { type: 'module' });
    const customChallenge: SbcChallenge = activeMode === 'NORMAL' && selectedChallenge.source !== 'PARSE' ? { ...selectedChallenge, tokenRules: undefined, requirements: {
      ...selectedChallenge.requirements, minSquadRating: normalMinRating, minTotw: normalMinTotw, minChemistry: normalMinChem,
      ...Object.fromEntries(Object.entries(extraRequirements).filter(([, v]) => v !== '').map(([k, v]) => [k, k.startsWith('exact') ? v : Number(v)])),
    }} : selectedChallenge;
    worker.onmessage = ({ data }) => {
      setIsCalculating(false);
      if (data.solution) setSolution(data.solution);
      else setNotification(data.error || 'Çözüm hesaplanamadı.');
    };
    worker.onerror = () => { setIsCalculating(false); setNotification('Hesaplama başlatılamadı. Yeniden deneyin.'); };
    worker.postMessage({ mode: activeMode, challenge: customChallenge, club: protectSquad && savedSquad ? clubPlayers.filter(p => !Object.values(savedSquad.ids).includes(p.id)) : clubPlayers, market: marketPlayers, inventory: tokenInventory,
      options: { useClubPlayers: !avoidClubPlayers, onlyClub: onlyClub && !avoidClubPlayers, prioritizeUntradeables, includeTokens: activeMode === 'CLUB_TOKEN' && includeTokens,
        strategy: activeStrategy, lockedSlots, budgetLimit: activeMode === 'NORMAL' && normalBudgetLimit !== '' ? Number(normalBudgetLimit) : undefined } });
    return () => worker.terminate();
  }, [activeMode, selectedChallenge, clubPlayers, marketPlayers, tokenInventory, avoidClubPlayers, onlyClub, prioritizeUntradeables, includeTokens, activeStrategy, lockedSlots, normalMinRating, normalMinTotw, normalMinChem, normalBudgetLimit, extraRequirements, recalculation, protectSquad, savedSquad]);
  const handleRecalculate = () => setRecalculation(n => n + 1);
  const exportSolution = () => {
    downloadText('fut-brain-sbc.json', JSON.stringify({ ...solution, warning: 'Yerel çözüm dosyasıdır; EA hesabına aktarım veya satın alma yapılmadı.' }, null, 2), 'application/json');
    setNotification('Çözüm dosyası indirildi. EA hesabında işlem yapılmadı.');
  };
  const handleConvertFragments = () => {
    const res = ItemTokenProvider.convertFragments(tokenInventory, selectedChallenge.tokenRules);
    if (res.success) {
      onUpdateTokens(res.updated);
      setNotification(res.message);
    } else {
      setNotification(res.message);
    }
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSlotSwap = (slotId: string, player: Player) => {
    setLockedSlots((prev) => ({
      ...prev,
      [slotId]: player,
    }));
  };

  const handleTokenSwap = (slotId: string, tokenRating: number) => {
    setLockedSlots((prev) => ({
      ...prev,
      [slotId]: { isToken: true, tokenRating },
    }));
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Ambient Glow Field */}
      <div className="relative w-full overflow-hidden px-gutter-desktop py-space-md bg-surface-container-lowest">
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-secondary/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Mode Selector & Live Engine State Banner */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-md pb-space-md">
          <div>
            <div className="flex items-center gap-space-xs text-outline font-label-md text-label-md tracking-wider uppercase">
              <span className="inline-block w-2 h-2 rounded-full bg-primary-fixed animate-ping"></span>
              <span>KÇG Optimizasyon Motoru • Yerel Kombinasyon Araması • {marketPlayers.some(p => p.futbinId) ? 'Parse pazar verisi' : 'Demo / Manuel Veri'}</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-0.5">
              SBC Solver & Kadro Eniyileyici
            </h1>
          </div>

          {/* Segmented Mode Control Bar */}
          <div className="flex items-center bg-surface-container p-1 rounded-xl shadow-inner">
            <button
              onClick={() => {
                setActiveMode('CLUB_TOKEN');
                setActiveStrategy('CLUB_FIRST');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded font-body-sm text-body-sm transition-all duration-150 cursor-pointer ${
                activeMode === 'CLUB_TOKEN'
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-medium'
              }`}
            >
              <span className="material-symbols-outlined text-base">inventory_2</span>
              <span>Mod A: Kulüp & Jeton Çözücü</span>
              {activeMode === 'CLUB_TOKEN' && (
                <span className="bg-on-primary-container text-primary-container font-data-sm text-data-sm px-1.5 py-0.2 rounded-full">
                  Aktif
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveMode('NORMAL');
                setActiveStrategy('CHEAPEST');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded font-body-sm text-body-sm transition-all duration-150 cursor-pointer ${
                activeMode === 'NORMAL'
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-medium'
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              <span>Mod B: Standart KÇG (Manuel)</span>
              {activeMode === 'NORMAL' && (
                <span className="bg-on-primary-container text-primary-container font-data-sm text-data-sm px-1.5 py-0.2 rounded-full">
                  Aktif
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="relative z-20 mb-3 p-2.5 rounded bg-primary-container/20 border border-primary-fixed text-primary-fixed font-body-sm text-body-sm flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{notification}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-xs hover:underline cursor-pointer">
              Kapat
            </button>
          </div>
        )}

        {/* Active SBC Parameter Matrix */}
        <div className="relative z-10 bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          {/* Left Controls */}
          {selectedChallenge.source === 'PARSE' ? (
            <div className="space-y-2 text-sm">
              <h2 className="text-lg font-bold text-primary">{selectedChallenge.name} / {selectedChallenge.segmentTitle}</h2>
              <p>Pazar · FC {selectedChallenge.gameYear} · {selectedChallenge.expiresText} · {activeMode === 'NORMAL' ? 'Yalnızca gerçek pazar kartları' : 'Gerçek kulüp ve pazar kartları'}</p>
              <ul className="list-disc pl-5">{selectedChallenge.rawRequirements?.map((line, i) => <li key={i}>{line}</li>)}</ul>
              <p className="text-outline">Kaynak koşulları değiştirilmeden hesaplanır. Jeton ve demo kartları kullanılmaz.</p>
            </div>
          ) : activeMode === 'CLUB_TOKEN' ? (
            <div className="flex flex-wrap items-center gap-space-md">
              {/* SBC Dropdown */}
              <div className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-outline uppercase tracking-wider">
                  Hedef Meydan Okuma
                </span>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-2.5 text-secondary text-lg pointer-events-none">
                    military_tech
                  </span>
                  <select
                    value={selectedChallengeId}
                    onChange={(e) => {
                      setSelectedChallengeId(e.target.value);
                      setLockedSlots({});
                    }}
                    className="bg-surface-container border-none text-on-surface font-body-sm text-body-sm rounded-lg pl-9 pr-8 py-2 appearance-none focus:outline-none focus:ring-1 focus:ring-primary-container cursor-pointer"
                  >
                    {challenges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-2 text-outline pointer-events-none text-base">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Task Indicator */}
              <div className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-outline uppercase tracking-wider">
                  KÇG Grubu
                </span>
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg">
                  <span className="bg-surface-bright text-on-surface font-data-sm text-data-sm px-2 py-0.5 rounded font-bold">
                    {selectedChallenge.segmentIndex} / {selectedChallenge.segmentTotal}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
                    {selectedChallenge.segmentTitle}
                  </span>
                </div>
              </div>

              <div className="hidden lg:block h-9 w-px bg-surface-container-highest"></div>

              {/* Checkbox Filter Toggles */}
              <div className="flex flex-wrap items-center gap-space-md pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={avoidClubPlayers}
                    onChange={(e) => setAvoidClubPlayers(e.target.checked)}
                    className="w-4 h-4 rounded bg-surface-container text-primary-container focus:ring-0 cursor-pointer accent-primary-container"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-on-surface transition-colors select-none">
                    Kulüp oyuncularını harcama
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={prioritizeUntradeables}
                    onChange={(e) => setPrioritizeUntradeables(e.target.checked)}
                    className="w-4 h-4 rounded bg-surface-container text-primary-container focus:ring-0 cursor-pointer accent-primary-container"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface font-medium group-hover:text-primary-container transition-colors select-none">
                    Takas Edilemezlere (Untradeable) öncelik ver
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includeTokens}
                    onChange={(e) => setIncludeTokens(e.target.checked)}
                    className="w-4 h-4 rounded bg-surface-container text-secondary focus:ring-0 cursor-pointer accent-secondary"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface font-medium group-hover:text-secondary transition-colors select-none flex items-center gap-1">
                    Jeton/Fragment dahil et
                    <span className="bg-secondary-container/40 text-secondary-fixed font-data-sm text-data-sm px-1.5 py-0.2 rounded font-bold">
                      {tokenInventory.tokens88Plus + tokenInventory.tokens89Plus + tokenInventory.tokens87Plus} jeton • {tokenInventory.fragments} parça{' '}
                      Stok
                    </span>
                  </span>
                </label>
              </div>
            </div>
          ) : (
            /* Mod B Manual Controls */
            <div className="flex flex-wrap items-center gap-space-md">
              <div className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-outline uppercase tracking-wider">
                  Hedef Reyting
                </span>
                <select
                  value={normalMinRating}
                  onChange={(e) => setNormalMinRating(Number(e.target.value))}
                  className="bg-surface-container text-on-surface font-body-sm text-body-sm rounded-lg px-3 py-2 border-none focus:outline-none cursor-pointer"
                >
                  <option value={83}>83 GEN Kadro</option>
                  <option value={84}>84 GEN Kadro</option>
                  <option value={85}>85 GEN Kadro</option>
                  <option value={86}>86 GEN Kadro</option>
                  <option value={87}>87 GEN Kadro</option>
                  <option value={88}>88 GEN Kadro</option>
                  <option value={89}>89 GEN Kadro</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-outline uppercase tracking-wider">
                  Min. TOTW Şartı
                </span>
                <select
                  value={normalMinTotw}
                  onChange={(e) => setNormalMinTotw(Number(e.target.value))}
                  className="bg-surface-container text-on-surface font-body-sm text-body-sm rounded-lg px-3 py-2 border-none focus:outline-none cursor-pointer"
                >
                  <option value={0}>TOTW Gerekmez (0)</option>
                  <option value={1}>Min. 1x TOTW</option>
                  <option value={2}>Min. 2x TOTW</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-outline uppercase tracking-wider">
                  Min. Kimya Şartı
                </span>
                <select
                  value={normalMinChem}
                  onChange={(e) => setNormalMinChem(Number(e.target.value))}
                  className="bg-surface-container text-on-surface font-body-sm text-body-sm rounded-lg px-3 py-2 border-none focus:outline-none cursor-pointer"
                >
                  <option value={0}>Kimya Önemsiz (0)</option>
                  <option value={14}>Min. 14 Kimya</option>
                  <option value={20}>Min. 20 Kimya</option>
                  <option value={24}>Min. 24 Kimya</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-outline uppercase tracking-wider">
                  Bütçe Sınırı (Coins)
                </span>
                <input
                  type="number"
                  placeholder="Opsiyonel (Örn: 150000)"
                  value={normalBudgetLimit}
                  onChange={(e) => setNormalBudgetLimit(e.target.value)}
                  className="bg-surface-container text-on-surface font-body-sm text-body-sm rounded-lg px-3 py-2 w-44 border-none focus:outline-none placeholder:text-outline"
                />
              </div>

              <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-container rounded-lg text-outline font-data-sm text-data-sm">
                <span className="material-symbols-outlined text-base text-secondary">database</span>
                <span>Saf Pazar Optimizasyonu (Kulüp Verisi Kullanılmaz)</span>
              </div>
            </div>
          )}

          {/* Action Primary Button */}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleRecalculate}
              disabled={isCalculating}
              className="w-full xl:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-headline-sm tracking-tight font-bold hover:brightness-105 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-75"
            >
              <span className={`material-symbols-outlined text-xl ${isCalculating ? 'animate-spin' : ''}`}>
                {isCalculating ? 'refresh' : 'bolt'}
              </span>
              <span>{isCalculating ? 'Hesaplanıyor...' : 'Uygun Çözümü Ara'}</span>
            </button>
          </div>
        </div>

        {/* EasySBC Strategy Selector Strip */}
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-2 pt-space-sm">
          <div className="flex items-center gap-1.5 bg-surface-container p-1 rounded-lg">
            <span className="px-2 text-outline font-label-md text-label-md uppercase tracking-wider">
              Konsept Stratejisi:
            </span>
            <button
              onClick={() => setActiveStrategy('CHEAPEST')}
              className={`px-3 py-1 rounded font-body-sm text-body-sm font-semibold transition-all cursor-pointer ${
                activeStrategy === 'CHEAPEST'
                  ? 'bg-secondary-container text-on-secondary shadow-sm'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              En Düşük Maliyet (Pazar)
            </button>
            <button
              onClick={() => setActiveStrategy('CLUB_FIRST')}
              className={`px-3 py-1 rounded font-body-sm text-body-sm font-semibold transition-all cursor-pointer ${
                activeStrategy === 'CLUB_FIRST'
                  ? 'bg-primary-container text-on-primary-container shadow-sm'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Kulüp Öncelikli (0 Coin Hedefi)
            </button>
            <button
              onClick={() => setActiveStrategy('TOKEN_OPTIMIZED')}
              className={`px-3 py-1 rounded font-body-sm text-body-sm font-semibold transition-all cursor-pointer ${
                activeStrategy === 'TOKEN_OPTIMIZED'
                  ? 'bg-tertiary-container text-on-tertiary-container shadow-sm'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Jeton & Fragment Tasarrufu
            </button>
            <button
              onClick={() => setActiveStrategy('MAX_CHEM')}
              className={`px-3 py-1 rounded font-body-sm text-body-sm font-semibold transition-all cursor-pointer ${
                activeStrategy === 'MAX_CHEM'
                  ? 'bg-surface-bright text-primary-fixed shadow-sm'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Maksimum Kimya
            </button>
          </div>

          <div className="flex items-center gap-2 text-outline font-data-sm text-data-sm">
            <span className="material-symbols-outlined text-xs text-primary-fixed">info</span>
            <span>Konsept kadrolar bilgi amaçlıdır; satın alma ve gönderim EA Web App'te elle yapılır.</span>
          </div>
        </div>

        {/* Quick Telemetry & Status Indicator Bar */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-space-sm pt-space-sm">
          {/* KPI 1: Tahmini Ek Maliyet */}
          <div className="bg-surface-container p-space-sm rounded-lg flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md uppercase text-outline">Tahmini Ek Maliyet</span>
              {solution.savingsPercent > 0 && (
                <span className="font-data-sm text-data-sm text-primary-fixed bg-surface-container-high px-1.5 py-0.5 rounded font-bold">
                  -%{solution.savingsPercent} Tasarruf
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-data-lg text-data-lg text-primary font-bold">
                {solution.totalCoinCost.toLocaleString('tr-TR')}
              </span>
              <span className="font-data-sm text-data-sm text-tertiary-fixed-dim uppercase">Coins</span>
            </div>
            <span className="font-body-sm text-body-sm text-outline mt-0.5 truncate">
              {selectedChallenge.source === 'PARSE' ? selectedChallenge.marketPriceBench > 0 ? `Kaynak maliyet tahmini: ${selectedChallenge.marketPriceBench.toLocaleString('tr-TR')} coin` : 'Kaynak maliyet tahmini belirtilmemiş' : activeMode === 'CLUB_TOKEN'
                ? `Örnek referans maliyet: ${(selectedChallenge.marketPriceBench / 1000).toFixed(0)}k coin`
                : 'Pazardan 11 Oyuncu Satın Alma Maliyeti'}
            </span>
          </div>

          {/* KPI 2: Gerekli Kadro */}
          <div className="bg-surface-container p-space-sm rounded-lg flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md uppercase text-outline">Gerekli Kadro</span>
              <span className="material-symbols-outlined text-sm text-primary-fixed">verified</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-data-lg text-data-lg text-on-surface font-bold">
                {solution.slots.length} / {activeMode === 'NORMAL' ? Number(extraRequirements.playerCount || selectedChallenge.requirements.playerCount) : selectedChallenge.requirements.playerCount}
              </span>
              <span className="font-body-sm text-body-sm text-outline">{solution.isFeasible ? 'Geçerli' : 'Eksik'}</span>
            </div>
            <div className="flex items-center gap-2 font-data-sm text-data-sm text-outline mt-0.5">
              <span className="text-primary-fixed font-semibold">{solution.clubPlayersCount} Kulüp</span>
              <span>•</span>
              <span className="text-secondary font-semibold">{solution.marketPlayersCount} Pazar</span>
              {solution.tokensCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-tertiary-fixed-dim font-semibold">{solution.tokensCount} Jeton</span>
                </>
              )}
            </div>
          </div>

          {/* KPI 3: Kullanılan Jeton */}
          <div className="bg-surface-container p-space-sm rounded-lg flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md uppercase text-outline">Kullanılan Jeton</span>
              <span className="material-symbols-outlined text-sm text-secondary">token</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-data-lg text-data-lg text-secondary font-bold">
                {solution.tokensCount}x
              </span>
              <span className="font-body-sm text-body-sm text-on-surface font-semibold">
                {solution.tokensCount > 0 ? solution.tokensUsed.join(', ') : 'Jeton Kullanılmadı'}
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-outline mt-0.5">
              {tokenInventory.tokens88Plus + tokenInventory.tokens89Plus + tokenInventory.tokens87Plus - solution.tokensCount} jeton çözüm dışında
            </span>
          </div>

          {/* KPI 4: Kadro GEN Skoru & Kimya */}
          <div className="bg-surface-container p-space-sm rounded-lg flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md uppercase text-outline">GEN & Kimya</span>
              {solution.isFeasible ? (
                <span className="font-label-md text-label-md text-on-primary-container bg-primary-container px-1 rounded font-bold">
                  GEREKSİNİM KARŞILANDI ✓
                </span>
              ) : (
                <span className="font-label-md text-label-md text-on-error bg-error px-1 rounded font-bold">
                  ŞARTLAR EKSİK
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <div className="flex items-baseline gap-1">
                <span className="font-data-lg text-data-lg text-primary-fixed font-bold">
                  {solution.effectiveRating.toFixed(2)}
                </span>
                <span className="font-body-sm text-body-sm text-outline">
                  / {solution.requiredRating}.00
                </span>
              </div>
              <div className="flex items-center gap-1 font-data-md text-data-md text-secondary font-bold">
                <span className="material-symbols-outlined text-sm text-secondary">diamond</span>
                <span>{solution.totalChemistry}/33</span>
              </div>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-primary-container h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (solution.effectiveRating / solution.requiredRating) * 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* EasySBC Requirements Checklist Strip */}
        <div className="relative z-10 mt-space-sm p-space-sm bg-surface-container rounded-xl flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-label-md text-label-md uppercase text-outline font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-primary-fixed">checklist</span>
              KÇG Şart Kontrol Listesi:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {solution.requirementChecklist.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-data-sm text-data-sm font-semibold transition-all ${
                    item.satisfied
                      ? 'bg-primary-container/30 text-primary-fixed border border-primary-fixed/40'
                      : 'bg-error-container/30 text-error border border-error/40 animate-pulse'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">
                    {item.satisfied ? 'check_circle' : 'cancel'}
                  </span>
                  <span>{item.label}:</span>
                  <span className="font-bold">{item.current}</span>
                  <span className="text-outline text-[11px]">({item.required})</span>
                </div>
              ))}
            </div>
          </div>

          {lockedSlots && Object.keys(lockedSlots).length > 0 && (
            <button
              onClick={() => setLockedSlots({})}
              className="text-xs text-outline hover:text-error transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">lock_open</span>
              Kilitleri Sıfırla ({Object.keys(lockedSlots).length})
            </button>
          )}
        </div>
      </div>

      <section aria-live="polite" className="mx-gutter-desktop my-3 p-3 rounded-lg bg-surface-container border border-outline-variant text-body-sm">
        <strong>{isCalculating ? 'Çözüm aranıyor…' : solution.isFeasible ? (solution.searchStatus === 'OPTIMAL' ? 'Bu oyuncu havuzunda seçilen hedef için optimum bulundu.' : 'Geçerli çözüm bulundu; optimum garantisi yok.') : 'Geçerli çözüm bulunamadı.'}</strong>
        <p>{{ DEMO: 'DEMO', MANUAL: 'MANUEL / YEREL', PARSE: 'PAZAR', MIXED: 'PARSE + MANUEL', UNAVAILABLE: 'VERİ YOK' }[solution.dataStatus]} • {solution.searchedNodes.toLocaleString('tr-TR')} arama adımı • Hesaplama kulüp envanterini harcamaz.</p>
        {!isCalculating && [...solution.unmetRequirements, ...solution.warnings].map((message, i) => <p key={i} className="mt-1 text-on-surface-variant">{message}</p>)}
      </section>
      {activeMode === 'CLUB_TOKEN' && <div className="mx-gutter-desktop mb-3 flex items-center gap-2 text-body-sm"><label><input type="checkbox" checked={onlyClub} disabled={avoidClubPlayers} onChange={e => setOnlyClub(e.target.checked)} /> Yalnızca kulüp oyuncuları ve izinli jetonlar</label></div>}
      {activeMode === 'CLUB_TOKEN' && <label className="mx-gutter-desktop mb-3 text-body-sm"><input type="checkbox" checked={protectSquad} disabled={!savedSquad} onChange={e => setProtectSquad(e.target.checked)} /> Kayıtlı kadromu koru {savedSquad ? '(oyuncuları SBC için harcama)' : '(önce Kadro sayfasında kaydet)'}</label>}
      {activeMode === 'NORMAL' && selectedChallenge.source !== 'PARSE' && <details className="mx-gutter-desktop mb-3 p-3 bg-surface-container rounded-lg"><summary className="cursor-pointer">Diğer SBC şartları</summary><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        {Object.entries({ playerCount: 'Oyuncu sayısı (1–11)', minSpecial: 'Minimum özel kart', minNations: 'Minimum farklı ülke', minLeagues: 'Minimum farklı lig', maxPerClub: 'Aynı kulüp üst sınırı', minSameNation: 'Aynı ülkeden minimum', minSameLeague: 'Aynı ligden minimum', exactNation: 'Gerekli ülke (en az 1)', exactLeague: 'Gerekli lig (en az 1)', exactClub: 'Gerekli kulüp (en az 1)' }).map(([key, label]) => <label key={key} className="flex flex-col gap-1 text-body-sm">{label}<input type={key.startsWith('exact') ? 'text' : 'number'} min="0" step="1" aria-label={label} className="p-2 rounded bg-surface-container-high" value={extraRequirements[key] || ''} onChange={e => setExtraRequirements(previous => ({ ...previous, [key]: e.target.value }))} /></label>)}
      </div></details>}
      {/* Primary Split Working Matrix: Left 60% Tactical Pitch Grid / Right 40% Telemetry & Cost Breakdown */}
      <div className="px-gutter-desktop py-space-md grid grid-cols-1 xl:grid-cols-12 gap-gutter-desktop">
        {/* LEFT COLUMN: Tactical Pitch & 11-Slot Board (Col-span 7) */}
        <div className="xl:col-span-7 flex flex-col gap-space-md">
          {/* Pitch Canvas Frame */}
          <div className="relative bg-surface-container-low rounded-xl p-space-md shadow-md overflow-hidden flex flex-col">
            {/* Pitch Header Bar */}
            <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-surface-container-highest/20">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Formasyon: {solution.formation}
                </span>
                <span className="bg-surface-container-high px-2 py-0.5 rounded font-data-sm text-data-sm text-outline">
                  Yerel Çözüm
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRecalculate}
                  className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-md text-label-md flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Yeniden Hesapla
                </button>
                <button
                  onClick={async () => {
                    const text = solution.slots
                      .map(
                        (s) =>
                          `${s.position}: ${s.player ? s.player.name : s.tokenLabel} (${
                            s.isFromClub ? 'Kulüp' : s.cost > 0 ? `${s.cost}c` : 'Jeton'
                          }) [${s.chemistry || 0} Chem]`
                      )
                      .join('\n');
                    try { await copyText(text); setNotification('Çözüm metni panoya kopyalandı.'); }
                    catch { setNotification('Panoya kopyalanamadı. Çözüm dosyasını indirebilirsiniz.'); }
                    setTimeout(() => setNotification(null), 2500);
                  }}
                  className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-md text-label-md flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Kopyala
                </button>
              </div>
            </div>

            {/* Interactive Tactical Pitch Surface */}
            <div className="relative w-full aspect-[4/3] max-h-[580px] bg-surface-container-lowest rounded-xl overflow-hidden flex flex-col justify-between p-3 select-none">
              {/* Pitch Markings (SVG overlay) */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none opacity-20 text-surface-bright"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line stroke="currentColor" strokeDasharray="6 6" strokeWidth="2" x1="0" x2="100%" y1="50%" y2="50%" />
                <circle cx="50%" cy="50%" fill="none" r="55" stroke="currentColor" strokeWidth="2" />
                <rect fill="none" height="18%" stroke="currentColor" strokeWidth="2" width="50%" x="25%" y="0" />
                <rect fill="none" height="8%" stroke="currentColor" strokeWidth="2" width="30%" x="35%" y="0" />
                <rect fill="none" height="18%" stroke="currentColor" strokeWidth="2" width="50%" x="25%" y="82%" />
                <rect fill="none" height="8%" stroke="currentColor" strokeWidth="2" width="30%" x="35%" y="92%" />
              </svg>

              {/* FORWARD LINE (LW - ST - RW) */}
              <div className="relative z-10 grid grid-cols-3 gap-2 w-full pt-1">
                {(() => {
                  const lw = solution.slots.find((s) => s.position === 'LW') || solution.slots[0];
                  const st = solution.slots.find((s) => s.position === 'ST') || solution.slots[1];
                  const rw = solution.slots.find((s) => s.position === 'RW') || solution.slots[2];
                  return (
                    <>
                      {lw && <SlotCard slot={lw} onOpenSwap={() => setSwapModalSlot(lw)} />}
                      {st && <SlotCard slot={st} isHighlighted onOpenSwap={() => setSwapModalSlot(st)} />}
                      {rw && <SlotCard slot={rw} onOpenSwap={() => setSwapModalSlot(rw)} />}
                    </>
                  );
                })()}
              </div>

              {/* MIDFIELD LINE (CM - CM - CAM) */}
              <div className="relative z-10 grid grid-cols-3 gap-3 w-full px-2 py-1">
                {(() => {
                  const cm1 = solution.slots.find((s) => s.slotId === 'pos_cm1') || solution.slots[3];
                  const cm2 = solution.slots.find((s) => s.slotId === 'pos_cm2') || solution.slots[4];
                  const cam =
                    solution.slots.find((s) => s.slotId === 'pos_cm3' || s.position === 'CAM') ||
                    solution.slots[5];
                  return (
                    <>
                      {cm1 && <SlotCard slot={cm1} onOpenSwap={() => setSwapModalSlot(cm1)} />}
                      {cm2 && <SlotCard slot={cm2} onOpenSwap={() => setSwapModalSlot(cm2)} />}
                      {cam && <SlotCard slot={cam} onOpenSwap={() => setSwapModalSlot(cam)} />}
                    </>
                  );
                })()}
              </div>

              {/* DEFENSE LINE (LB - CB - CB - RB) */}
              <div className="relative z-10 grid grid-cols-4 gap-2 w-full py-1">
                {(() => {
                  const lb = solution.slots.find((s) => s.position === 'LB') || solution.slots[6];
                  const cb1 = solution.slots.find((s) => s.slotId === 'pos_cb1') || solution.slots[7];
                  const cb2 = solution.slots.find((s) => s.slotId === 'pos_cb2') || solution.slots[8];
                  const rb = solution.slots.find((s) => s.position === 'RB') || solution.slots[9];
                  return (
                    <>
                      {lb && <SlotCard slot={lb} onOpenSwap={() => setSwapModalSlot(lb)} />}
                      {cb1 && <SlotCard slot={cb1} onOpenSwap={() => setSwapModalSlot(cb1)} />}
                      {cb2 && <SlotCard slot={cb2} onOpenSwap={() => setSwapModalSlot(cb2)} />}
                      {rb && <SlotCard slot={rb} onOpenSwap={() => setSwapModalSlot(rb)} />}
                    </>
                  );
                })()}
              </div>

              {/* GOALKEEPER (GK) */}
              <div className="relative z-10 flex justify-center w-full pb-1">
                {(() => {
                  const gk = solution.slots.find((s) => s.position === 'GK') || solution.slots[10];
                  return gk ? (
                    <div className="w-1/3">
                      <SlotCard slot={gk} onOpenSwap={() => setSwapModalSlot(gk)} />
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Pitch Action Toolbar */}
            <div className="flex items-center justify-between pt-space-sm mt-space-sm border-t border-surface-container-highest/20 font-body-sm text-body-sm flex-wrap gap-2">
              <div className="flex items-center gap-3 text-outline">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary-container inline-block"></span>{' '}
                  {solution.clubPlayersCount} Kulüp Oyuncusu
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block"></span>{' '}
                  {solution.marketPlayersCount} Pazar Transferi
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim inline-block"></span>{' '}
                  {solution.tokensCount} Jeton Kullanımı
                </span>
              </div>
              <button
                onClick={exportSolution}
                disabled={isCalculating || !solution.isFeasible}
                className="text-primary-fixed hover:underline font-label-md text-label-md uppercase font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Çözümü Dosya Olarak İndir</span>
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </button>
            </div>
          </div>

          {/* Quick Analysis Card: Mathematical Balance Indicator */}
          <div className="bg-surface-container-low p-space-md rounded-xl shadow-md flex items-center justify-between">
            <div className="flex items-center gap-space-md">
              <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-2xl">calculate</span>
              </div>
              <div>
                <span className="font-body-md text-body-md font-bold text-on-surface block">
                  Reyting & Kimya Kontrolü
                </span>
                <span className="font-body-sm text-body-sm text-outline">
                  Gereken Toplam Ham Reyting Puanı: {solution.requiredRawSum} • Mevcut Toplam:{' '}
                  {solution.rawRatingSum.toFixed(2)} (Kimya: {solution.totalChemistry}/33)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-data-md text-data-md text-primary-fixed font-bold">
                {solution.ratingDelta >= 0 ? `+${solution.ratingDelta.toFixed(2)} Ham Puan` : `${solution.ratingDelta.toFixed(2)} Ham Puan Eksik`}
              </span>
              <span className="font-data-sm text-data-sm text-outline block">En Uygun Maliyet Dağılımı</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Table, Substitutes & Token Inventory (Col-span 5) */}
        <div className="xl:col-span-5 flex flex-col gap-space-md">
          {/* Section: Player & Cost Breakdown Table */}
          <div className="bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col">
            <div className="flex items-center justify-between pb-space-sm mb-space-xs border-b border-surface-container-highest/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed text-lg">receipt_long</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Kadro & Harcama Dökümü
                </h2>
              </div>
              <span className="font-data-sm text-data-sm text-secondary font-medium">
                Toplam {solution.slots.length} Oyuncu • {solution.totalChemistry}/33 Kimya
              </span>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left font-body-sm text-body-sm">
                <thead className="bg-surface-container text-outline font-label-md text-label-md uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-2">Mevki</th>
                    <th className="py-2 px-2">Oyuncu</th>
                    <th className="py-2 px-1 text-center">Kimya</th>
                    <th className="py-2 px-2">GEN</th>
                    <th className="py-2 px-2">Durum</th>
                    <th className="py-2 px-2 text-right">Fiyat</th>
                    <th className="py-2 px-2 text-center">Eylem</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0">
                  {solution.slots.map((s, index) => {
                    const isBuy = !s.isFromClub && !s.isToken;
                    return (
                      <tr
                        key={s.slotId || index}
                        className={`transition-colors ${
                          isBuy
                            ? 'bg-surface-container-high/80 hover:bg-surface-container-highest'
                            : index % 2 === 0
                            ? 'bg-surface-container-low hover:bg-surface-container'
                            : 'bg-surface-container hover:bg-surface-container-high'
                        }`}
                      >
                        <td className={`py-2 px-2 font-bold ${isBuy ? 'text-secondary' : 'text-outline'}`}>
                          {s.position}
                        </td>
                        <td className="py-2 px-2 truncate max-w-[130px]">
                          <span
                            className={`font-semibold block truncate ${
                              isBuy ? 'text-secondary font-bold' : 'text-on-surface'
                            }`}
                          >
                            {s.player ? s.player.name : s.tokenLabel || 'Jeton İkamesi'}
                          </span>
                          <span className="text-[11px] text-outline block truncate">
                            {s.isToken
                              ? 'Joker KÇG Jetonu'
                              : `${s.player?.club || 'Kulüp'} • ${s.player?.league || 'Lig'}`}
                          </span>
                        </td>
                        <td className="py-2 px-1 text-center font-data-sm text-data-sm">
                          <span className="text-secondary font-bold inline-flex items-center gap-0.5">
                            {s.chemistry ?? 0}
                            <span className="material-symbols-outlined text-[10px]">diamond</span>
                          </span>
                        </td>
                        <td
                          className={`py-2 px-2 font-data-md text-data-md font-bold ${
                            s.isToken
                              ? 'text-tertiary-fixed-dim'
                              : isBuy
                              ? 'text-secondary'
                              : 'text-primary-fixed'
                          }`}
                        >
                          {s.isToken ? s.tokenRating : s.player?.rating}
                        </td>
                        <td className="py-2 px-2">
                          {s.isToken ? (
                            <span className="bg-tertiary-container/30 text-tertiary-fixed-dim font-data-sm text-data-sm px-1.5 py-0.2 rounded font-medium">
                              Jeton #{s.tokenRating}
                            </span>
                          ) : isBuy ? (
                            <span className="bg-secondary-container/50 text-secondary-fixed font-data-sm text-data-sm px-1.5 py-0.2 rounded font-bold">
                              Konsept Satın Al
                            </span>
                          ) : s.player?.cardType === 'TOTW' ? (
                            <span className="bg-tertiary-container/30 text-tertiary-fixed-dim font-data-sm text-data-sm px-1.5 py-0.2 rounded font-medium">
                              Kulüp (TOTW)
                            </span>
                          ) : (
                            <span className="bg-on-primary-container text-primary-container font-data-sm text-data-sm px-1.5 py-0.2 rounded font-medium">
                              {s.isUntradeable ? 'Kulüp (Untr)' : 'Kulüp'}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-data-sm text-data-sm ${
                            isBuy ? 'font-data-md text-secondary font-bold' : 'text-outline'
                          }`}
                        >
                          {s.cost > 0 ? `${s.cost.toLocaleString('tr-TR')} c` : '0 c'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {isBuy ? (
                            <button
                              onClick={() => setSwapModalSlot(s)}
                              className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary font-label-md text-label-md font-bold hover:brightness-110 flex items-center gap-0.5 mx-auto cursor-pointer"
                              title="Pazarda Alternatif Ara veya Kulüple Değiştir"
                            >
                              <span className="material-symbols-outlined text-xs">shopping_bag</span>
                              <span>Pazar</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setSwapModalSlot(s)}
                              className="p-1 text-outline hover:text-on-surface rounded hover:bg-surface-container-high cursor-pointer"
                              title="Oyuncuyu veya Jetonu Değiştir"
                            >
                              <span className="material-symbols-outlined text-sm leading-none">
                                {s.isToken ? 'tune' : 'swap_horiz'}
                              </span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-space-sm pt-space-xs flex items-center justify-between font-body-sm text-body-sm border-t border-surface-container-highest/20">
              <span className="text-outline">Toplam Net Harcama:</span>
              <span className="font-data-lg text-data-lg text-secondary font-bold">
                {solution.totalCoinCost.toLocaleString('tr-TR')} Coins
              </span>
            </div>
          </div>

          {/* Section: Jeton & Fragment Envanteri Paneli */}
          <div className="bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary-fixed-dim text-lg">token</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  KÇG Jeton & Fragment Envanteri
                </h3>
              </div>
              <span className="bg-surface-container px-2 py-0.5 rounded font-data-sm text-data-sm text-outline font-medium">
                {tokenInventory.fragments} Parça
                Mevcut
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Token Slot 1 */}
              <div className="bg-surface-container p-space-sm rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-tertiary-fixed-dim uppercase font-bold">
                    89+ Jeton
                  </span>
                  <span className="material-symbols-outlined text-xs text-tertiary-fixed-dim">check_circle</span>
                </div>
                <div className="my-1">
                  <span className="font-data-lg text-data-lg text-on-surface font-bold">
                    {tokenInventory.tokens89Plus}
                  </span>
                  <span className="font-body-sm text-body-sm text-outline"> toplam stok</span>
                </div>
                <span className="font-data-sm text-data-sm text-outline">
                  {(solution.tokenUsage['89'] || 0) + ' Kadroda'}
                </span>
              </div>

              {/* Token Slot 2 */}
              <div className="bg-surface-container p-space-sm rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-tertiary-fixed-dim uppercase font-bold">
                    88+ Jeton
                  </span>
                  <span className="material-symbols-outlined text-xs text-tertiary-fixed-dim">check_circle</span>
                </div>
                <div className="my-1">
                  <span className="font-data-lg text-data-lg text-on-surface font-bold">
                    {tokenInventory.tokens88Plus}
                  </span>
                  <span className="font-body-sm text-body-sm text-outline"> toplam stok</span>
                </div>
                <span className="font-data-sm text-data-sm text-outline">
                  {(solution.tokenUsage['88'] || 0) + ' Kadroda'}
                </span>
              </div>

              {/* Token Slot 3: Fragment */}
              <div className="bg-surface-container p-space-sm rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-outline uppercase font-bold">Fragment</span>
                  <span className="material-symbols-outlined text-xs text-outline">toll</span>
                </div>
                <div className="my-1">
                  <span className="font-data-lg text-data-lg text-on-surface font-bold">
                    {tokenInventory.fragments}
                  </span>
                  <span className="font-body-sm text-body-sm text-outline"> stok</span>
                </div>
                <span className="font-data-sm text-data-sm text-outline">Dönüştürülebilir</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 my-3">
              {Object.entries({ tokens89Plus: '89+ jeton stoğu', tokens88Plus: '88+ jeton stoğu', tokens87Plus: '87+ jeton stoğu', fragments: 'Parça stoğu' }).map(([key, label]) => <label key={key} className="flex flex-col text-body-sm gap-1">{label}<input aria-label={label} type="number" min="0" step="1" className="p-2 rounded bg-surface-container" value={tokenInventory[key as keyof TokenInventory]} onChange={e => { const n = Number(e.target.value); if (!Number.isInteger(n) || n < 0) return; try { onUpdateTokens({ ...tokenInventory, [key]: n }); } catch (error) { setNotification((error as Error).message); } }} /></label>)}
            </div>
            <div className="bg-surface-container/70 p-2.5 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-base">auto_fix_high</span>
                <span className="font-body-sm text-body-sm text-on-surface font-medium">
                  Yerel parça dönüşümü (örnek / manuel kural)
                </span>
              </div>
              <button
                onClick={handleConvertFragments}
                className="px-2.5 py-1 rounded bg-secondary-container text-on-secondary font-label-md text-label-md font-bold hover:brightness-105 transition-all cursor-pointer"
              >
                Dönüştür ({selectedChallenge.tokenRules?.fragmentCost || '—'} parça)
              </button>
            </div>
          </div>

          {/* Algorithmic Live Telemetry Notice Banner */}
          <div className="p-space-sm bg-surface-container-lowest rounded-xl flex items-center justify-between text-outline">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-primary-fixed">database</span>
              <span className="font-data-sm text-data-sm">
                Canlı pazar bağlantısı yok • Yerel hesaplama
              </span>
            </div>
            <span className="font-data-sm text-data-sm text-primary-fixed font-bold">
              {solution.solveTimeMs}ms Yanıt Süresi
            </span>
          </div>
        </div>
      </div>

      {/* Player Swap Modal */}
      {swapModalSlot && (
        <PlayerSwapModal
          slot={swapModalSlot}
          clubPlayers={activeMode === 'CLUB_TOKEN' && !avoidClubPlayers ? clubPlayers.filter(p => !(protectSquad && savedSquad && Object.values(savedSquad.ids).includes(p.id)) && !solution.slots.some(s => s.slotId !== swapModalSlot.slotId && s.player?.id === p.id)) : []}
          marketPlayers={onlyClub && activeMode === 'CLUB_TOKEN' ? [] : marketPlayers.filter(p => !solution.slots.some(s => s.slotId !== swapModalSlot.slotId && s.player?.id === p.id))}
          tokenInventory={activeMode === 'CLUB_TOKEN' && includeTokens && selectedChallenge.tokenRules ? { ...tokenInventory, tokens87Plus: Math.max(0, tokenInventory.tokens87Plus - (solution.tokenUsage['87'] || 0) + Number(swapModalSlot.tokenRating === 87)), tokens88Plus: Math.max(0, tokenInventory.tokens88Plus - (solution.tokenUsage['88'] || 0) + Number(swapModalSlot.tokenRating === 88)), tokens89Plus: Math.max(0, tokenInventory.tokens89Plus - (solution.tokenUsage['89'] || 0) + Number(swapModalSlot.tokenRating === 89)) } : { tokens87Plus: 0, tokens88Plus: 0, tokens89Plus: 0, fragments: 0 }}
          onClose={() => setSwapModalSlot(null)}
          onSelectPlayer={handleSlotSwap}
          onSelectToken={handleTokenSwap}
        />
      )}
    </div>
  );
};

// Compact slot card on tactical pitch with Chemistry, Position match and Price
const SlotCard: React.FC<{
  slot: SbcSlot;
  isHighlighted?: boolean;
  onOpenSwap: () => void;
}> = ({ slot, isHighlighted, onOpenSwap }) => {
  const isBuy = !slot.isFromClub && !slot.isToken;

  function getRatingColor() {
    if (slot.isToken) return 'text-tertiary-fixed-dim';
    if (isBuy) return 'text-secondary';
    return 'text-primary-fixed';
  }

  const chemPoints = slot.chemistry ?? 0;

  return (
    <div
      onClick={onOpenSwap}
      className={`group relative flex flex-col bg-surface-container/95 hover:bg-surface-container-high p-2 rounded-lg shadow transition-all cursor-pointer ${
        isHighlighted ? '-mt-1 scale-105 z-20 ring-1 ring-primary-container' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className={`font-data-lg text-data-lg font-bold ${getRatingColor()}`}>
            {slot.isToken ? slot.tokenRating : slot.player?.rating || 85}
          </span>
          {/* Chemistry diamonds */}
          <div className="flex items-center gap-0.5 text-secondary" title={`${chemPoints}/3 Kimya Puanı`}>
            {[1, 2, 3].map((num) => (
              <span
                key={num}
                className={`w-1.5 h-1.5 rounded-full ${
                  num <= chemPoints ? 'bg-secondary' : 'bg-surface-container-highest'
                }`}
              ></span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span
            className={`font-label-md text-label-md uppercase font-bold ${
              slot.isPositionMatch === false ? 'text-error' : 'text-outline'
            }`}
          >
            {slot.position}
          </span>
        </div>
      </div>

      <div className="my-1">
        <span className="font-body-md text-body-md font-bold text-on-surface block truncate">
          {slot.isToken ? slot.tokenLabel || 'Jeton İkamesi' : slot.player?.name || 'Oyuncu'}
        </span>
        <span className="font-data-sm text-[11px] text-outline block truncate">
          {slot.isToken
            ? 'SBC Jeton İkamesi'
            : `${slot.player?.club || 'Kulüp'} • ${slot.player?.league || 'Lig'}`}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between pt-1">
        {slot.isToken ? (
          <>
            <span className="bg-tertiary-container/30 text-tertiary-fixed-dim font-label-md text-label-md px-1.5 py-0.5 rounded font-bold uppercase truncate">
              Jeton {slot.tokenRating}+
            </span>
            <span className="material-symbols-outlined text-sm text-tertiary-fixed-dim">token</span>
          </>
        ) : isBuy ? (
          <>
            <span className="bg-secondary-container/40 text-secondary-fixed font-label-md text-label-md px-1.5 py-0.5 rounded font-bold uppercase truncate">
              Satın Al: {slot.cost > 0 ? `${(slot.cost / 1000).toFixed(1)}k` : 'Pazar'}
            </span>
            <span className="material-symbols-outlined text-sm text-secondary">shopping_cart</span>
          </>
        ) : slot.player?.cardType === 'TOTW' ? (
          <>
            <span className="bg-tertiary-container/30 text-tertiary-fixed-dim font-label-md text-label-md px-1.5 py-0.5 rounded font-bold uppercase truncate">
              Kulüp TOTW ✓
            </span>
            <span className="material-symbols-outlined text-sm text-tertiary-fixed-dim">stars</span>
          </>
        ) : (
          <>
            <span className="bg-on-primary-container text-primary-container font-label-md text-label-md px-1.5 py-0.5 rounded font-bold uppercase truncate">
              Kulüpte Var
            </span>
            <span className="material-symbols-outlined text-sm text-primary-container">lock</span>
          </>
        )}
      </div>
    </div>
  );
};
