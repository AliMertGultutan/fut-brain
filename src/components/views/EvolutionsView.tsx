import React, { useState } from 'react';
import { EvolutionTrackingProvider } from '../../services/providers.ts';
import type { Player, EvolutionProgram } from '../../types/index.ts';

interface EvolutionsViewProps {
  programs: EvolutionProgram[];
  clubPlayers: Player[];
  onNavigate: (page: string) => void;
}

export const EvolutionsView: React.FC<EvolutionsViewProps> = ({ programs, clubPlayers, onNavigate }) => {
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programs[0]?.id || 'evo_wing_wizard');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('p_mainoo');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyClub, setOnlyClub] = useState(true);
  const [under20k, setUnder20k] = useState(false);
  const [max84, setMax84] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [tracking, setTracking] = useState(() => EvolutionTrackingProvider.getAll());
  const [showComparison, setShowComparison] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const activeProgram = programs.find((p) => p.id === selectedProgramId) || programs[0];

  // Map candidates to players
  const candidatePlayers = (activeProgram?.candidateIds || [])
    .map((id) => clubPlayers.find((p) => p.id === id))
    .filter(Boolean) as Player[];

  const filteredCandidates = candidatePlayers.filter((p) => {
    if (onlyClub && !p.inClub) return false;
    if (under20k && p.price > 20000) return false;
    if (max84 && p.rating > 84) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q);
    }
    return true;
  });

  const selectedCandidate = filteredCandidates.find(p => p.id === selectedCandidateId) || filteredCandidates[0];
  const isActivated = tracking.some(e => e.programId === activeProgram?.id && e.playerId === selectedCandidate?.id);
  const handleActivateEvo = () => {
    if (!selectedCandidate || !activeProgram) return;
    setIsActivating(true);
    try { EvolutionTrackingProvider.add({ programId: activeProgram.id, playerId: selectedCandidate.id, playerName: selectedCandidate.name, programName: activeProgram.name, savedAt: new Date().toISOString() }); setTracking(EvolutionTrackingProvider.getAll()); setNotification('Yerel takip listesine eklendi. EA hesabında Evolution başlatılmadı.'); }
    catch (error) { setNotification((error as Error).message); }
    finally { setIsActivating(false); }
  };
  if (!activeProgram) return <div className="p-gutter-desktop">Evolution program verisi yok.</div>;

  return (
    <div className="flex flex-col w-full">
      <p className="px-gutter-desktop py-3 text-body-sm text-outline">Örnek Evolution programları • Aday listesi ve yükseltmeler demo senaryosudur. Güncel oyun uygunluğu doğrulanmadı; takip yalnızca bu tarayıcıya kaydedilir.</p>
      {/* Sub-Header / Control Strip */}
      <div className="w-full bg-surface-container-low px-gutter-desktop py-space-md shadow-md">
        <div className="flex flex-col gap-space-md">
          {/* Search & Meta Badges */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
            <div className="relative flex-1 max-w-xl">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg pointer-events-none">
                search
              </span>
              <input
                className="w-full bg-surface-container border border-surface-container-highest/60 rounded px-10 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-fixed transition-colors"
                placeholder="Geliştirilecek oyuncu ara (Kulübümden veya Pazardan)..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-outline hover:text-primary transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">tune</span>
              </button>
            </div>

            <div className="flex items-center gap-space-sm flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container border border-surface-container-highest/40">
                <span className="material-symbols-outlined text-primary-fixed text-base">bolt</span>
                <span className="font-data-sm text-data-sm text-on-surface">
                  Kullanılabilir Yuva: <span className="text-primary-fixed font-bold">{activeProgram.activeSlotInfo}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container border border-surface-container-highest/40">
                <span className="material-symbols-outlined text-secondary text-base">verified</span>
                <span className="font-data-sm text-data-sm text-on-surface">{candidatePlayers.filter(p => p.inClub).length} Örnek Kulüp Adayı</span>
              </div>
              <button
                onClick={() => {
                  setNotification(tracking.length ? tracking.map(e => e.playerName + ' • ' + e.programName + ' • ' + new Date(e.savedAt).toLocaleDateString('tr-TR')).join(' | ') : 'Yerel takip listesi boş.');
                  setTimeout(() => setNotification(null), 3000);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-md text-label-md uppercase tracking-wider transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">history</span>
                Evo Geçmişi
              </button>
            </div>
          </div>

          {/* Active Evolution Slot Selector Pills */}
          <div className="flex items-center gap-space-sm overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedProgramId('evo_wing_wizard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded font-label-md text-label-md uppercase tracking-wide transition-all shrink-0 cursor-pointer ${
                selectedProgramId === 'evo_wing_wizard'
                  ? 'bg-surface-container-highest text-primary shadow-[inset_2px_0_0_0_#b7f56a]'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-primary-fixed animate-ping"></span>
              <span className="font-bold">Kanat Büyücüsü (Wing Wizard)</span>
              <span className="bg-primary-container/20 text-primary-fixed px-1.5 py-0.5 rounded font-data-sm text-data-sm">
                ÜCRETSİZ
              </span>
              <span className="text-outline font-data-sm text-data-sm">• 8 Gün Kaldı</span>
            </button>

            <button
              onClick={() => setSelectedProgramId('evo_quick_striker')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded font-label-md text-label-md uppercase tracking-wide transition-all shrink-0 cursor-pointer ${
                selectedProgramId === 'evo_quick_striker'
                  ? 'bg-surface-container-highest text-primary shadow-[inset_2px_0_0_0_#b7f56a]'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>Hızlı Forvet (Quick Striker)</span>
              <span className="bg-tertiary-container/20 text-tertiary-fixed-dim px-1.5 py-0.5 rounded font-data-sm text-data-sm">
                50K COINS
              </span>
              <span className="text-outline font-data-sm text-data-sm">• 12 Gün Kaldı</span>
            </button>

            <button
              onClick={() => setSelectedProgramId('evo_anchor_cb')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded font-label-md text-label-md uppercase tracking-wide transition-all shrink-0 cursor-pointer ${
                selectedProgramId === 'evo_anchor_cb'
                  ? 'bg-surface-container-highest text-primary shadow-[inset_2px_0_0_0_#b7f56a]'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>Defans Kalesi (Anchor CB)</span>
              <span className="bg-secondary-container/20 text-secondary px-1.5 py-0.5 rounded font-data-sm text-data-sm">
                ÜCRETSİZ
              </span>
              <span className="text-outline font-data-sm text-data-sm">• 4 Gün Kaldı</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 rounded font-label-md text-label-md uppercase tracking-wide bg-surface-container text-outline opacity-60 cursor-not-allowed shrink-0">
              <span className="material-symbols-outlined text-sm">lock</span>
              Kilitli Slot (Lv 30 Gerekli)
            </button>
          </div>

          {/* Tactical Eligibility Filters Bar */}
          <div className="flex items-center justify-between flex-wrap gap-space-sm pt-space-xs">
            <div className="flex items-center gap-space-md flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyClub}
                  onChange={(e) => setOnlyClub(e.target.checked)}
                  className="w-4 h-4 rounded bg-surface-container-lowest border border-primary-fixed text-primary-fixed accent-primary-fixed focus:ring-0"
                />
                <span className="font-body-sm text-body-sm text-on-surface font-medium">
                  Sadece Kulübümdeki Örnek Adayları Göster{' '}
                  <span className="text-primary-fixed font-data-sm text-data-sm">({candidatePlayers.filter(p => p.inClub).length})</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={under20k}
                  onChange={(e) => setUnder20k(e.target.checked)}
                  className="w-4 h-4 rounded bg-surface-container-lowest border border-surface-container-highest text-secondary accent-secondary focus:ring-0"
                />
                <span className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface">
                  Pazar Fiyatı 20k Altı Hedefler
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={max84}
                  onChange={(e) => setMax84(e.target.checked)}
                  className="w-4 h-4 rounded bg-surface-container-lowest border border-primary-fixed text-primary-fixed accent-primary-fixed focus:ring-0"
                />
                <span className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface">
                  Maks 84 GEN Sınırına Uyanlar
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-label-md text-label-md text-outline uppercase tracking-wider">
                Sıralama:
              </span>
              <button className="flex items-center gap-1 text-primary-fixed font-data-sm text-data-sm px-2 py-1 rounded bg-surface-container cursor-pointer">
                <span>En Yüksek Nihai Reyting</span>
                <span className="material-symbols-outlined text-sm">arrow_downward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {notification && (
        <div className="mx-gutter-desktop mt-4 p-3 rounded bg-primary-container/20 border border-primary-fixed text-primary-fixed font-body-sm text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>{notification}</span>
        </div>
      )}

      {/* Main 2-Column Split View: 45% List / 55% Simulator Inspector */}
      <div className="w-full px-gutter-desktop py-space-lg grid grid-cols-1 xl:grid-cols-12 gap-gutter-desktop">
        {/* LEFT COLUMN: Candidate List (5 cols) */}
        <div className="xl:col-span-5 flex flex-col gap-space-md">
          <div className="flex items-center justify-between px-space-xs">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                Örnek Aday Havuzu
              </span>
              <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded font-data-sm text-data-sm">
                {filteredCandidates.length} Aday
              </span>
            </div>
            <span className="font-label-md text-label-md text-outline tracking-wider uppercase">
              Filtrelenmiş Veri
            </span>
          </div>

          {/* Candidate Cards */}
          {filteredCandidates.map((cand) => {
            const isSelected = selectedCandidate?.id === cand.id;
            const targetRating = Math.min(88, cand.rating + 10);
            return (
              <div
                key={cand.id}
                onClick={() => setSelectedCandidateId(cand.id)}
                className={`group cursor-pointer rounded p-space-md transition-all shadow-md ${
                  isSelected
                    ? 'bg-surface-container-high border-l-4 border-l-primary-fixed'
                    : 'bg-surface-container hover:bg-surface-container-high'
                }`}
              >
                <div className="flex items-start justify-between gap-space-sm mb-space-sm">
                  <div className="flex items-center gap-space-sm">
                    {/* Before Rating */}
                    <div className="relative w-12 h-14 bg-surface-container-lowest rounded flex flex-col items-center justify-center overflow-hidden">
                      <span className="font-headline-sm text-headline-sm font-bold text-outline">
                        {cand.rating}
                      </span>
                      <span className="font-label-md text-label-md uppercase text-outline">
                        {cand.position}
                      </span>
                    </div>

                    <div className="flex items-center justify-center text-primary-fixed">
                      <span className="material-symbols-outlined text-base">trending_flat</span>
                    </div>

                    {/* After Rating */}
                    <div className="relative w-12 h-14 bg-surface-container-lowest rounded flex flex-col items-center justify-center overflow-hidden ring-1 ring-primary-fixed/40">
                      <div className="absolute inset-0 bg-gradient-to-t from-primary-fixed/20 to-transparent"></div>
                      <span className="font-headline-sm text-headline-sm font-bold text-primary-fixed relative z-10">
                        {targetRating}
                      </span>
                      <span className="font-label-md text-label-md uppercase text-primary-fixed font-bold relative z-10">
                        KAN
                      </span>
                    </div>

                    <div className="flex flex-col ml-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-headline-sm text-headline-sm text-primary font-bold">
                          {cand.name}
                        </span>
                        {cand.id === 'p_mainoo' && (
                          <span className="material-symbols-outlined text-primary-fixed text-sm" title="Örnek aday">
                            verified
                          </span>
                        )}
                      </div>
                      <span className="font-data-sm text-data-sm text-outline">
                        {cand.club} • {cand.league}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-primary-container/20 text-primary-fixed font-label-md text-label-md px-1.5 py-0.5 rounded">
                          Örnek yükseltme senaryosu
                        </span>
                        <span className="bg-surface-container-lowest text-secondary font-data-sm text-data-sm px-1.5 py-0.5 rounded">
                          {cand.inClub ? 'Kulüpte Var' : `Pazardan Al (~${cand.price.toLocaleString('tr-TR')} C)`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="font-data-sm text-data-sm text-primary-fixed bg-surface-container px-2 py-1 rounded font-bold">
                    +{targetRating - cand.rating} GEN
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-space-xs text-center">
                  <div className="bg-surface-container rounded p-1">
                    <span className="font-label-md text-label-md text-outline block">HIZ</span>
                    <span className="font-data-md text-data-md text-primary-fixed font-bold">
                      {Math.min(99, cand.stats.pace + 10)} <span className="font-data-sm text-data-sm font-normal text-outline-variant">+10</span>
                    </span>
                  </div>
                  <div className="bg-surface-container rounded p-1">
                    <span className="font-label-md text-label-md text-outline block">ŞUT</span>
                    <span className="font-data-md text-data-md text-primary-fixed font-bold">
                      {Math.min(99, cand.stats.shooting + 8)} <span className="font-data-sm text-data-sm font-normal text-outline-variant">+8</span>
                    </span>
                  </div>
                  <div className="bg-surface-container rounded p-1">
                    <span className="font-label-md text-label-md text-outline block">PAS</span>
                    <span className="font-data-md text-data-md text-primary-fixed font-bold">
                      {Math.min(99, cand.stats.passing + 9)} <span className="font-data-sm text-data-sm font-normal text-outline-variant">+9</span>
                    </span>
                  </div>
                  <div className="bg-surface-container rounded p-1">
                    <span className="font-label-md text-label-md text-outline block">DRİ</span>
                    <span className="font-data-md text-data-md text-primary-fixed font-bold">
                      {Math.min(99, cand.stats.dribbling + 7)} <span className="font-data-sm text-data-sm font-normal text-outline-variant">+7</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-space-sm mt-space-sm bg-surface-container/50 px-space-sm py-1 rounded">
                  <div className="flex items-center gap-1.5 text-primary-fixed">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span className="font-label-md text-label-md">Uygunluk doğrulanmadı</span>
                  </div>
                  <span className="font-data-sm text-data-sm text-outline">
                    PlayStyle+: <span className="text-on-surface">Trivela+</span>
                  </span>
                </div>
              </div>
            );
          })}

          {/* Quick Tips Bento Snippet */}
          <div className="bg-surface-container-low rounded p-space-md mt-space-sm flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary-fixed-dim text-xl">lightbulb</span>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-tertiary-fixed-dim font-bold uppercase tracking-wider">
                Örnek Senaryo Notu
              </span>
              <p className="font-body-sm text-body-sm text-outline mt-0.5">
                {activeProgram.expertTip}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 55% Evolution Upgrade Path & Attribute Simulator (7 cols) */}
        {selectedCandidate ? (
        <div className="xl:col-span-7 flex flex-col gap-space-md">
          {/* Simulator Shell */}
          <div className="bg-surface-container rounded p-space-lg shadow-xl flex flex-col gap-space-lg">
            {/* Target Overview Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-md border-b border-surface-container-highest/30">
              <div className="flex items-center gap-space-md">
                <div className="relative w-16 h-20 bg-surface-container-lowest rounded flex flex-col items-center justify-between p-1.5 shadow-[0_0_15px_rgba(183,245,106,0.15)] ring-1 ring-primary-fixed/30">
                  <div className="w-full flex justify-between items-center text-primary-fixed">
                    <span className="font-headline-sm text-headline-sm font-bold leading-none">
                      {Math.min(88, selectedCandidate.rating + 10)}
                    </span>
                    <span className="font-label-md text-label-md font-bold">KAN</span>
                  </div>
                  <img
                    className="w-10 h-10 object-contain rounded"
                    src={selectedCandidate.imageUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDFzWE38ArpeDEYkkwRxQjwtXG3RkZHxhs9IR0iLPUxQAyW8FVXnszvJZIMCh25CWSoYVxfA6c22zjq7iRPXpicXDCr1CjKjvwZZgUoL3yzWc-zcn9CA-0Wk19sBqBytQTkEJP4suEkRbxtloqmAo9AXKa456VOBS9bC8oCwdgNG48Shet1eyTVwJVoSpuUhtjGsEfBJTKpq9Ca9hvUQUNL-MIJixhvHUkT0-SujVFsqKUcZ4V-5tOs'}
                    alt={selectedCandidate.name}
                  />
                  <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-headline-lg text-headline-lg text-primary font-bold">
                      {selectedCandidate.name}
                    </span>
                    <span className="bg-primary-container text-on-primary-container font-data-sm text-data-sm px-2 py-0.5 rounded font-bold uppercase">
                      Simülasyon Aktif
                    </span>
                  </div>
                  <span className="font-body-md text-body-md text-on-surface-variant">
                    {selectedCandidate.club} • {selectedCandidate.league} • {selectedCandidate.nation}
                  </span>
                  <span className="font-data-sm text-data-sm text-primary-fixed font-medium mt-1">
                    Yükseltme Yolu: {activeProgram.tagline}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1 rounded">
                  <span className="font-label-md text-label-md text-outline uppercase">Toplam Maliyet:</span>
                  <span className="font-data-md text-data-md text-primary-fixed font-bold">
                    {activeProgram.costType === 'FREE' ? '0 Coins (Ücretsiz)' : `${activeProgram.costCoins.toLocaleString('tr-TR')} Coins`}
                  </span>
                </div>
                <span className="font-data-sm text-data-sm text-outline">
                  Kalan Süre: {activeProgram.expiresDays} Gün 14 Saat
                </span>
              </div>
            </div>

            {/* Attribute Telemetry & Radar Comparison Bar */}
            <div className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface-variant font-bold uppercase tracking-wider">
                  Nitelik Karşılaştırma Analizi (Mevcut vs Yükseltilmiş)
                </span>
                <div className="flex items-center gap-space-md">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-outline rounded"></span>
                    <span className="font-data-sm text-data-sm text-outline">
                      Mevcut ({selectedCandidate.rating} GEN)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-primary-fixed rounded shadow-[0_0_8px_#b7f56a]"></span>
                    <span className="font-data-sm text-data-sm text-primary-fixed font-bold">
                      Örnek Evo Sonrası ({Math.min(88, selectedCandidate.rating + 10)} GEN)
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat Meters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-space-lg gap-y-space-sm pt-2">
                <EvoStatMeter
                  name="Hız (Pace)"
                  base={selectedCandidate.stats.pace}
                  boosted={selectedCandidate.stats.pace + 10}
                />
                <EvoStatMeter
                  name="Şut (Shooting)"
                  base={selectedCandidate.stats.shooting}
                  boosted={selectedCandidate.stats.shooting + 8}
                />
                <EvoStatMeter
                  name="Pas (Passing)"
                  base={selectedCandidate.stats.passing}
                  boosted={selectedCandidate.stats.passing + 9}
                />
                <EvoStatMeter
                  name="Dribbling"
                  base={selectedCandidate.stats.dribbling}
                  boosted={selectedCandidate.stats.dribbling + 7}
                />
                <EvoStatMeter
                  name="Defans (Defending)"
                  base={selectedCandidate.stats.defending}
                  boosted={selectedCandidate.stats.defending + 4}
                />
                <EvoStatMeter
                  name="Fizik (Physical)"
                  base={selectedCandidate.stats.physical}
                  boosted={selectedCandidate.stats.physical + 7}
                />
              </div>
            </div>

            {/* Level Paths Breakdown */}
            <div className="flex flex-col gap-space-sm">
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                Örnek Yükseltme Seviyeleri & Görevler
              </span>

              {activeProgram.levels.map((lvl) => {
                return (
                  <div
                    key={lvl.levelNumber}
                    className={`rounded p-space-md flex flex-col gap-space-sm ${
                      lvl.isCompleted
                        ? 'bg-surface-container-high'
                        : lvl.isCurrent
                        ? 'bg-surface-container-high border-l-2 border-l-secondary'
                        : 'bg-surface-container-low opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-sm">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            lvl.isCompleted
                              ? 'bg-primary-container text-on-primary-container'
                              : lvl.isCurrent
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-surface-container-highest text-outline'
                          }`}
                        >
                          {lvl.isCompleted ? '✓' : lvl.isCurrent ? lvl.levelNumber : '🔒'}
                        </div>
                        <div>
                          <span className={`font-label-md text-label-md font-bold uppercase ${
                            lvl.isCompleted ? 'text-primary' : lvl.isCurrent ? 'text-secondary' : 'text-outline'
                          }`}>
                            {lvl.title}
                          </span>
                          <span className="text-outline font-data-sm text-data-sm block">
                            {lvl.isCompleted ? 'Yükseltme aktif edildi' : lvl.isCurrent ? 'Son 1 maç kaldı' : 'Seviye 2 tamamlanınca açılır'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-data-sm text-data-sm text-primary-fixed font-medium">
                          {lvl.statBoostSummary}
                        </span>
                        {lvl.specialRewardBadge && (
                          <span className="bg-surface-container-lowest text-secondary px-2 py-0.5 rounded font-label-md text-label-md">
                            {lvl.specialRewardBadge}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-surface-container rounded px-space-sm py-2 text-on-surface font-body-sm text-body-sm">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-base">
                          {lvl.isCompleted ? 'sports_soccer' : 'military_tech'}
                        </span>
                        <span>Görev: {lvl.objectiveText}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-data-sm text-data-sm text-secondary font-bold">
                          {lvl.currentProgress} / {lvl.targetProgress} {lvl.isCompleted ? 'Tamam' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chemistry & Squad Impact Live Preview */}
            <div className="bg-surface-container-low rounded p-space-md flex items-center justify-between flex-wrap gap-space-sm">
              <div className="flex items-center gap-space-md">
                <div className="flex items-center gap-2">
                  <span className="font-label-md text-label-md text-outline uppercase">
                    Kimya Durumu:
                  </span>
                  <div className="flex items-center gap-1 bg-surface-container px-2 py-1 rounded">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    <span className="font-data-sm text-data-sm text-secondary font-bold ml-1">
                      Doğrulanmadı
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-label-md text-label-md text-outline uppercase">
                    Yeni Pozisyonlar:
                  </span>
                  <span className="font-data-sm text-data-sm text-on-surface bg-surface-container px-2 py-0.5 rounded">
                    MÖ • SLK • SĞK
                  </span>
                </div>
              </div>
              <span className="font-data-sm text-data-sm text-primary-fixed">
                Kadro etkisi, güncel Evolution kuralları geldiğinde doğrulanabilir.
              </span>
            </div>

            {showComparison && <section className="p-3 bg-surface-container rounded-lg" aria-label="Aday karşılaştırması"><h3 className="font-bold mb-2">Mevcut oyuncu verileriyle karşılaştırma</h3><table className="w-full text-body-sm"><thead><tr><th>Oyuncu</th><th>GEN</th><th>Hız</th><th>Şut</th><th>Fiyat</th></tr></thead><tbody>{filteredCandidates.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.rating}</td><td>{p.statsKnown === false ? '—' : p.stats.pace}</td><td>{p.statsKnown === false ? '—' : p.stats.shooting}</td><td>{p.priceStatus === 'UNAVAILABLE' ? 'Bilinmiyor' : p.price.toLocaleString('tr-TR')}</td></tr>)}</tbody></table></section>}
            {/* Action Bar CTAs */}
            <div className="flex items-center justify-between gap-space-md pt-space-xs border-t border-surface-container-highest/30 flex-wrap">
              <button
                onClick={() => {
                  setShowComparison(previous => !previous);
                  setTimeout(() => setNotification(null), 2500);
                }}
                className="px-space-md py-2.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-md text-body-md flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">compare_arrows</span>
                Başka Adayla Kıyasla
              </button>
              <div className="flex items-center gap-space-sm">
                <button
                  onClick={() => onNavigate('kadro-taktik')}
                  className="px-space-md py-2.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-md text-body-md flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">group_add</span>
                  Kadro Sayfasını Aç
                </button>
                <button
                  onClick={handleActivateEvo}
                  disabled={isActivating || isActivated}
                  className="px-space-lg py-2.5 rounded bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-sm text-headline-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(183,245,106,0.3)] transition-all cursor-pointer disabled:opacity-80"
                >
                  <span className={`material-symbols-outlined text-xl ${isActivating ? 'animate-spin' : ''}`}>
                    {isActivating ? 'sync' : isActivated ? 'check' : 'bolt'}
                  </span>
                  <span>
                    {isActivating
                      ? 'Kaydediliyor...'
                      : isActivated
                      ? 'Yerel Takipte'
                      : 'Yerel Takibe Ekle'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>        ) : <div className="xl:col-span-7 p-6 bg-surface-container rounded-lg">Filtrelere uygun örnek aday yok. Filtreleri değiştirin veya kulüp verisi ekleyin.</div>}

      </div>
    </div>
  );
};

const EvoStatMeter: React.FC<{ name: string; base: number; boosted: number }> = ({
  name,
  base,
  boosted,
}) => {
  boosted = Math.min(99, boosted);
  const delta = boosted - base;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-data-sm text-data-sm">
        <span className="text-on-surface">{name}</span>
        <span className="text-outline">
          {base} <span className="text-on-surface-variant font-bold">→</span> <span className="text-primary-fixed font-bold">{boosted} (+{delta})</span>
        </span>
      </div>
      <div className="relative h-2 w-full bg-surface-container rounded overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-outline/40 rounded"
          style={{ width: `${Math.min(100, base)}%` }}
        ></div>
        <div
          className="absolute left-0 top-0 h-full bg-primary-fixed rounded transition-all duration-500 shadow-[0_0_10px_#b7f56a]"
          style={{ width: `${Math.min(100, boosted)}%` }}
        ></div>
      </div>
    </div>
  );
};
