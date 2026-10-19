import React, { useState } from 'react';
import { SquadProvider } from '../../services/providers.ts';
import { calculateSquadChemistry, calculateSquadRating } from '../../services/sbcSolver.ts';
import { FORMATIONS, SQUAD_KEYS, squadSlots, optimizeSquadPositions, createInitialSquad } from '../../services/squad.ts';
import { copyText } from '../../services/export.ts';
import { PlayerPortrait } from '../PlayerPortrait.tsx';
import type { Player } from '../../types/index.ts';

interface SquadViewProps {
  clubPlayers: Player[];
  onPlayerUpdate: (updated: Player[]) => void;
}

export const SquadView: React.FC<SquadViewProps> = ({ clubPlayers, onPlayerUpdate }) => {
  const [formation, setFormation] = useState<'4-3-2-1' | '4-4-2' | '4-2-3-1' | '3-5-2'>(() => ((SquadProvider.getSaved()?.formation || '') in FORMATIONS ? SquadProvider.getSaved()!.formation : '4-3-2-1') as '4-3-2-1' | '4-4-2' | '4-2-3-1' | '3-5-2');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(() => clubPlayers[0]?.id || '');
  const [scoutQuery, setScoutQuery] = useState('');
  const [scoutRatingFilter, setScoutRatingFilter] = useState<number | 'all'>(86);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active 11 player IDs in tactical positions
  const [squadIds, setSquadIds] = useState<Record<string, string>>(() => {
    const saved = SquadProvider.getSaved();
    if (saved) return Object.fromEntries(SQUAD_KEYS.map(key => [key, clubPlayers.some(p => p.id === saved.ids[key]) ? saved.ids[key] : '']));
    return createInitialSquad(clubPlayers);
  });
  const slots = squadSlots(squadIds, formation, clubPlayers);
  const chemistry = calculateSquadChemistry(slots);
  const squadRating = calculateSquadRating(slots.map(s => s.player?.rating || 0)).effectiveRatingRounded;
  const squadValue = slots.reduce((n, s) => n + (s.player?.price || 0), 0);

  const getPlayer = (id: string): Player | undefined => {
    return clubPlayers.find((p) => p.id === id);
  };

  const selectedPlayer = getPlayer(selectedPlayerId) || clubPlayers[0];
  const selectedSlot = slots.find(s => s.player?.id === selectedPlayer?.id);

  const handleSwapPlayer = (candidateId: string) => {
    // Find which position the selected player occupies, and swap them with candidate
    const posKey = (Object.keys(squadIds) as Array<keyof typeof squadIds>).find(
      (k) => squadIds[k] === selectedPlayer?.id
    );

    if (posKey && !Object.values(squadIds).includes(candidateId)) {
      setSquadIds((prev) => ({
        ...prev,
        [posKey]: candidateId,
      }));
      setSelectedPlayerId(candidateId);
      const swapped = getPlayer(candidateId);
      setToastMessage(`${swapped?.name || 'Oyuncu'} başarıyla ilk 11'e yerleştirildi!`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleOptimizeChemistry = () => {
    const improved = optimizeSquadPositions(slots);
    setSquadIds(Object.fromEntries(improved.map(s => [s.slotId, s.player?.id || ''])));
    setToastMessage('Mevki eşlemesi tamamlandı: ' + calculateSquadChemistry(improved).totalChemistry + '/33 kimya (FC25 temel profili). Maksimum garantisi yok.');
  };
  const handleSaveSquad = () => {
    try { SquadProvider.save({ formation, ids: squadIds, savedAt: new Date().toISOString() }); setToastMessage('Kadro bu tarayıcıya kaydedildi. Sayfa yenilendiğinde geri yüklenir.'); }
    catch (error) { setToastMessage((error as Error).message); }
  };
  // Candidates for swap
  const swapCandidates = clubPlayers
    .filter((p) => {
      // Exclude players already on pitch
      const isAlreadyOnPitch = Object.values(squadIds).includes(p.id);
      if (isAlreadyOnPitch) return false;

      const matchesSearch =
        p.name.toLowerCase().includes(scoutQuery.toLowerCase()) ||
        p.club.toLowerCase().includes(scoutQuery.toLowerCase());
      const matchesRating = scoutRatingFilter === 'all' || p.rating >= scoutRatingFilter;
      return matchesSearch && matchesRating;
    })
    .slice(0, 5);

  const subPlayers = clubPlayers.filter(p => !Object.values(squadIds).includes(p.id)).sort((a, b) => b.rating - a.rating).slice(0, 7);

  if (!selectedPlayer) return <div className="p-gutter-desktop">Kulüpte oyuncu yok. Önce Veri İçe Aktar bölümünden oyuncu ekleyin.</div>;

  return (
    <div className="flex flex-col w-full">
      <p className="px-gutter-desktop py-2 text-body-sm text-outline">Yerel kadro • {slots.filter(s => s.player).length}/11 oyuncu • Kaydet işlemi yalnızca bu tarayıcıda saklar.</p>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-md font-bold shadow-2xl flex items-center gap-2">
          <span className="material-symbols-outlined text-xl">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Command & Telemetry Bar */}
      <section className="w-full bg-surface-container-low px-gutter-desktop py-space-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-sm select-none shadow-sm">
        <div className="flex flex-wrap items-center gap-space-md">
          {/* Squad Switcher */}
          <div className="relative flex items-center bg-surface-container px-space-sm py-1.5 rounded cursor-pointer group hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-primary-fixed text-lg mr-space-xs">shield</span>
            <div className="flex flex-col pr-space-md">
              <span className="font-headline-sm text-headline-sm text-on-surface leading-tight tracking-tight">
                Manuel Kulüp • Ana Kadro
              </span>
              <span className="font-data-sm text-data-sm text-outline">Champs Weekend • WL Play-off</span>
            </div>
            <span className="material-symbols-outlined text-outline text-base">expand_more</span>
          </div>

          {/* Formation Selector */}
          <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded">
            <span className="font-label-md text-label-md text-outline uppercase">Diziliş:</span>
            <div className="flex items-center gap-1">
              {(['4-3-2-1', '4-4-2', '4-2-3-1', '3-5-2'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormation(fmt)}
                  className={`px-2 py-0.5 rounded font-data-sm text-data-sm cursor-pointer transition-colors ${
                    formation === fmt
                      ? 'bg-surface text-primary-fixed font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Pills */}
          <div className="flex items-center gap-space-sm">
            <div className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded">
              <span className="font-label-md text-label-md text-outline uppercase">REYTING</span>
              <span className="font-data-lg text-data-lg text-primary-fixed leading-none">{squadRating}</span>
            </div>
            <div className="flex items-center gap-2 bg-surface-container px-2.5 py-1 rounded">
              <span className="font-label-md text-label-md text-outline uppercase">KİMYA</span>
              <div className="flex items-center gap-1">
                <span className="font-data-lg text-data-lg text-secondary leading-none">
                  {chemistry.totalChemistry}<span className="text-outline font-data-sm">/33</span>
                </span>
                <div className="flex gap-0.5 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded">
              <span className="font-label-md text-label-md text-outline uppercase">DEĞER</span>
              <span className="font-data-md text-data-md text-tertiary-fixed-dim">{squadValue.toLocaleString('tr-TR')}</span>
              <span className="material-symbols-outlined text-xs text-tertiary-fixed-dim">monetization_on</span>
            </div>
          </div>
        </div>

        {/* Squad Action CTAs */}
        <div className="flex items-center gap-space-xs self-end xl:self-center">
          <button
            onClick={handleOptimizeChemistry}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-body-sm font-body-sm transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-secondary">tune</span>
            <span>Mevkileri Eşleştir</span>
          </button>
          <button
            onClick={async () => { try { await copyText(JSON.stringify({ formation, players: slots.map(s => ({ position: s.position, name: s.player?.name || 'Boş', rating: s.player?.rating })), chemistry: chemistry.totalChemistry }, null, 2)); setToastMessage('Kadro metni panoya kopyalandı.'); } catch { setToastMessage('Panoya kopyalanamadı. Tarayıcı izinlerini kontrol edin.'); } }}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-body-sm font-body-sm transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-outline">share</span>
            <span>Paylaş</span>
          </button>
          <button
            onClick={handleSaveSquad}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container font-label-md text-label-md uppercase tracking-wider font-bold shadow-md hover:brightness-105 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base font-bold">save</span>
            <span>Kadro Kaydet</span>
          </button>
        </div>
      </section>

      {/* Workspace Grid: 68% Pitch / 32% Scouting & Inspection Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm p-space-sm bg-surface">
        {/* Left 8 Cols (Tactical Pitch & Sub Bench) */}
        <div className="lg:col-span-8 flex flex-col gap-space-sm">
          {/* Pitch Container */}
          <div className="relative w-full rounded-lg bg-surface-container-lowest p-space-sm overflow-hidden select-none min-h-[620px] flex flex-col justify-between shadow-xl">
            {/* Pitch Markings SVG Overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
              preserveAspectRatio="none"
              viewBox="0 0 1000 700"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect fill="#000000" height="700" width="1000" opacity="0.12"></rect>
              <rect fill="none" height="650" stroke="#7ad0ff" strokeDasharray="6,4" strokeWidth="2" width="950" x="25" y="25" />
              <line stroke="#7ad0ff" strokeOpacity="0.7" strokeWidth="2" x1="25" x2="975" y1="350" y2="350" />
              <circle cx="500" cy="350" fill="none" r="85" stroke="#7ad0ff" strokeOpacity="0.7" strokeWidth="2" />
              <circle cx="500" cy="350" fill="#7ad0ff" r="3" />
              <rect fill="none" height="120" stroke="#7ad0ff" strokeOpacity="0.5" strokeWidth="2" width="340" x="330" y="25" />
              <rect fill="none" height="45" stroke="#7ad0ff" strokeOpacity="0.4" strokeWidth="2" width="160" x="420" y="25" />
              <rect fill="none" height="120" stroke="#7ad0ff" strokeOpacity="0.5" strokeWidth="2" width="340" x="330" y="555" />
              <rect fill="none" height="45" stroke="#7ad0ff" strokeOpacity="0.4" strokeWidth="2" width="160" x="420" y="630" />
            </svg>

            {/* Dynamic Ambient Light Flares */}
            <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-primary-fixed-dim/5 blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-secondary/5 blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col justify-between h-full gap-space-md py-space-xs">
              {FORMATIONS[formation].map((row, rowIndex) => {
                const offset = FORMATIONS[formation].slice(0, rowIndex).flat().length;
                return <div key={rowIndex} className="flex items-center justify-around gap-2">{row.map((position, index) => {
                  const slot = slots[offset + index];
                  return slot.player ? <PitchPlayerCard key={slot.slotId} player={slot.player} posLabel={position} chemistry={chemistry.slotChemistry[slot.slotId]} isSelected={selectedPlayerId === slot.player.id} onSelect={() => setSelectedPlayerId(slot.player!.id)} /> : <button key={slot.slotId} className="w-24 h-24 border border-dashed border-outline rounded text-body-sm" onClick={() => { const candidate = clubPlayers.find(p => !Object.values(squadIds).includes(p.id)); if (candidate) setSquadIds(previous => ({ ...previous, [slot.slotId]: candidate.id })); else setToastMessage('Kulüpte kullanılabilir başka oyuncu yok.'); }}>{position} • Boş slot</button>;
                })}</div>;
              })}
            </div>
          </div>

          {/* Subs Bench Strip (Yedek Kulübesi) */}
          <div className="w-full bg-surface-container-low rounded-lg p-space-sm shadow-md">
            <div className="flex items-center justify-between pb-space-xs mb-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-secondary text-base">
                  airline_seat_recline_normal
                </span>
                <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface">
                  Yedek Kulübesi (7/7)
                </span>
              </div>
              <span className="font-data-sm text-data-sm text-outline">Kadroya Seç & Değiştir</span>
            </div>
            <div className="flex items-center gap-space-sm overflow-x-auto pb-1 no-scrollbar">
              {subPlayers.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => setSelectedPlayerId(sub.id)}
                  className={`flex-shrink-0 w-24 rounded p-1.5 cursor-pointer transition-colors ${
                    selectedPlayerId === sub.id
                      ? 'bg-surface-container-highest ring-1 ring-primary-fixed'
                      : 'bg-surface-container hover:bg-surface-container-high'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-data-sm text-data-sm font-bold text-primary-fixed">
                      {sub.rating}
                    </span>
                    <span className="font-label-md text-label-md text-outline">{sub.position}</span>
                  </div>
                  <div className="h-8 my-1 rounded bg-surface-container-low overflow-hidden">
                    <PlayerPortrait className="w-full h-full" name={sub.name} url={sub.imageUrl} />
                  </div>
                  <span className="font-label-md text-label-md text-on-surface truncate block text-center">
                    {sub.commonName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Tactical Deep-Dive & Inspection Panel */}
        <div className="lg:col-span-4 flex flex-col gap-space-sm">
          {/* Selected Player Inspector */}
          <div className="bg-surface-container-low rounded-lg p-space-md shadow-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md uppercase tracking-wider text-outline">
                Seçili Oyuncu Detayı
              </span>
              <span className="font-data-sm text-data-sm text-primary-fixed bg-surface-container-high px-2 py-0.5 rounded">
                Mevki: {selectedPlayer.position}
              </span>
            </div>

            {/* Identity Banner */}
            <div className="flex items-center gap-space-md bg-surface-container p-space-sm rounded">
              <div className="w-14 h-16 rounded bg-surface-container-high overflow-hidden flex-shrink-0 relative">
                <PlayerPortrait className="w-full h-full" name={selectedPlayer.name} url={selectedPlayer.imageUrl} />
                <span className="absolute bottom-0 right-0 bg-primary-container text-on-primary-container font-data-sm text-data-sm font-bold px-1 rounded-tl">
                  {selectedPlayer.rating}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                    {selectedPlayer.name}
                  </span>
                  <span className="material-symbols-outlined text-secondary text-sm" title="Hesaplanan kimya (FC25 profili)">
                    verified
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-outline truncate">
                  {selectedPlayer.club} • {selectedPlayer.league} • {selectedPlayer.nation}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-data-sm text-data-sm text-tertiary-fixed-dim font-bold">
                    {selectedPlayer.price.toLocaleString('tr-TR')} Coins
                  </span>
                  <span className="text-outline text-xs">•</span>
                  <span className="font-data-sm text-data-sm text-secondary">{selectedSlot ? chemistry.slotChemistry[selectedSlot.slotId] : 0}/3 Kimya</span>
                </div>
              </div>
            </div>

            {/* Radar / Stat Progress Meters */}
            <div className="flex flex-col gap-1.5 pt-space-xs">
              {selectedPlayer.statsKnown === false && <p className="text-outline">Oyuncu özellikleri içe aktarılmadı; değerler bilinmiyor.</p>}
              <StatBar label="HIZ (Pace)" value={selectedPlayer.stats.pace} colorClass="bg-primary-fixed" />
              <StatBar label="ŞUT (Shooting)" value={selectedPlayer.stats.shooting} colorClass="bg-primary-fixed" />
              <StatBar label="PAS (Passing)" value={selectedPlayer.stats.passing} colorClass="bg-secondary" />
              <StatBar label="DRİ (Dribbling)" value={selectedPlayer.stats.dribbling} colorClass="bg-primary-fixed" />
              <StatBar label="DEF (Defending)" value={selectedPlayer.stats.defending} colorClass="bg-outline" />
              <StatBar label="FİZ (Physicality)" value={selectedPlayer.stats.physical} colorClass="bg-secondary" />
            </div>

            {/* PlayStyles+ Badges */}
            <div className="flex flex-col gap-1 pt-space-xs">
              <span className="font-label-md text-label-md text-outline uppercase">
                Aktif Oyun Tarzları (PlayStyles+)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedPlayer.playStyles.map((ps, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-tertiary-container/20 text-tertiary-fixed-dim px-2 py-1 rounded font-data-sm text-data-sm font-semibold"
                  >
                    <span className="material-symbols-outlined text-sm">sprint</span>
                    <span>{ps}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Chemistry Telemetry Insight */}
            <div className="bg-surface-container p-space-sm rounded flex items-start gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-base mt-0.5">hub</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                <strong className="text-secondary">Kimya Analizi:</strong> Bu oyuncu {selectedSlot ? chemistry.slotChemistry[selectedSlot.slotId] : 0}/3 kimyaya sahip. Takım toplamı {chemistry.totalChemistry}/33. FC25 temel profili kullanılır; teknik direktör ve kampanya bonusları kapsam dışıdır.
              </p>
            </div>
          </div>

          {/* Quick Swap / Scout Drawer */}
          <div className="bg-surface-container-low rounded-lg p-space-md shadow-md flex flex-col gap-space-sm flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary-fixed text-base">
                  swap_horizontal_circle
                </span>
                <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface">
                  Hızlı Oyuncu Değiştir
                </span>
              </div>
              <span className="font-data-sm text-data-sm text-outline">
                Kulüp Havuzu ({clubPlayers.length})
              </span>
            </div>

            {/* Search Bar */}
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-outline text-base">
                search
              </span>
              <input
                className="w-full bg-surface-container rounded pl-8 pr-3 py-1.5 font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary-fixed"
                placeholder="Oyuncu ara (isim, mevki, kulüp)..."
                type="text"
                value={scoutQuery}
                onChange={(e) => setScoutQuery(e.target.value)}
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                onClick={() => setScoutRatingFilter(scoutRatingFilter === 86 ? 'all' : 86)}
                className={`px-2 py-0.5 rounded font-data-sm text-data-sm font-semibold cursor-pointer ${
                  scoutRatingFilter === 86
                    ? 'bg-surface-container-high text-primary-fixed'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                GEN 86+
              </button>
              <button
                onClick={() => setScoutRatingFilter(scoutRatingFilter === 88 ? 'all' : 88)}
                className={`px-2 py-0.5 rounded font-data-sm text-data-sm font-semibold cursor-pointer ${
                  scoutRatingFilter === 88
                    ? 'bg-surface-container-high text-primary-fixed'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                GEN 88+
              </button>
            </div>

            {/* Candidate Swap List */}
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-56 pr-0.5">
              {swapCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between p-2 rounded bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-data-md text-data-md font-bold text-primary-fixed">
                      {candidate.rating}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md font-bold text-on-surface truncate">
                        {candidate.name}
                      </span>
                      <span className="font-data-sm text-data-sm text-outline truncate">
                        {candidate.position} • {candidate.club} • {candidate.nationCode}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-data-sm text-data-sm text-secondary font-semibold">
                      Kimya tahmini yok
                    </span>
                    <button
                      onClick={() => handleSwapPlayer(candidate.id)}
                      className="bg-primary-container text-on-primary-container px-2 py-1 rounded font-label-md text-label-md uppercase font-bold hover:brightness-110 cursor-pointer"
                    >
                      Değiş
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Status Footer */}
            <div className="pt-space-xs mt-auto flex items-center justify-between bg-surface-container-lowest/40 p-2 rounded">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-fixed animate-ping"></span>
                <span className="font-label-md text-label-md text-outline">Demo / Manuel Fiyatlar</span>
              </div>
              <span className="font-data-sm text-data-sm text-secondary font-medium">Kayıtlı pazar verisi</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-component for individual tactical pitch cards
const PitchPlayerCard: React.FC<{
  player?: Player;
  posLabel: string;
  chemistry?: number;
  isSelected?: boolean;
  onSelect: () => void;
}> = ({ player, posLabel, chemistry = 0, isSelected, onSelect }) => {
  if (!player) return null;

  return (
    <div
      onClick={onSelect}
      className={`relative group cursor-pointer transition-transform duration-150 hover:-translate-y-1 ${
        isSelected ? 'scale-105 z-20' : ''
      }`}
    >
      {isSelected && (
        <div className="absolute -inset-1 rounded-lg bg-primary-container/30 blur-sm pointer-events-none"></div>
      )}
      <div
        className={`relative w-28 rounded p-1.5 flex flex-col shadow-lg transition-all ${
          isSelected
            ? 'bg-surface-container-high border border-primary-fixed'
            : 'bg-surface-container hover:bg-surface-container-high'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="font-data-md text-data-md font-bold text-primary-fixed">
              {player.rating}
            </span>
            <span className="font-label-md text-label-md text-secondary font-bold">
              {posLabel}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-data-sm text-secondary">{chemistry}/3</span>
          </div>
        </div>

        <div className="relative my-1 w-full h-14 rounded bg-surface-container-low flex items-center justify-center overflow-hidden">
          <PlayerPortrait className="w-full h-full" name={player.name} url={player.imageUrl} />
          <span className="absolute bottom-0.5 right-0.5 bg-surface-container-lowest/80 px-1 rounded font-data-sm text-data-sm text-tertiary-fixed-dim">
            {player.nationCode}
          </span>
        </div>

        <span className="font-label-md text-label-md font-bold text-on-surface truncate text-center">
          {player.commonName}
        </span>

        <div className="flex justify-between items-center px-1 pt-1 mt-0.5 bg-surface-container-lowest/60 rounded font-data-sm text-data-sm text-outline">
          <span>{player.stats.pace} <span className="text-[9px]">HIZ</span></span>
          <span>{player.stats.shooting} <span className="text-[9px]">ŞUT</span></span>
          <span>{player.stats.dribbling} <span className="text-[9px]">DRİ</span></span>
        </div>
      </div>
    </div>
  );
};

const StatBar: React.FC<{ label: string; value: number; colorClass: string }> = ({
  label,
  value,
  colorClass,
}) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex justify-between font-data-sm text-data-sm">
      <span className="text-on-surface-variant font-medium">{label}</span>
      <span className="text-primary-fixed font-bold">{value}</span>
    </div>
    <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(100, value)}%` }}></div>
    </div>
  </div>
);
