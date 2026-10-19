import React, { useState, useMemo } from 'react';
import type { Player, SbcSlot, TokenInventory } from '../../types/index.ts';

interface PlayerSwapModalProps {
  slot: SbcSlot;
  clubPlayers: Player[];
  marketPlayers: Player[];
  tokenInventory: TokenInventory;
  onClose: () => void;
  onSelectPlayer: (slotId: string, player: Player) => void;
  onSelectToken: (slotId: string, tokenRating: number) => void;
}

export const PlayerSwapModal: React.FC<PlayerSwapModalProps> = ({
  slot,
  clubPlayers,
  marketPlayers,
  tokenInventory,
  onClose,
  onSelectPlayer,
  onSelectToken,
}) => {
  const [activeTab, setActiveTab] = useState<'club' | 'market' | 'tokens'>(clubPlayers.length ? 'club' : 'market');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | 'all'>('all');

  const filteredClub = useMemo(() => {
    return clubPlayers.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.club.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating = selectedRatingFilter === 'all' || p.rating >= selectedRatingFilter;
      return matchesSearch && matchesRating;
    });
  }, [clubPlayers, searchQuery, selectedRatingFilter]);

  const filteredMarket = useMemo(() => {
    return marketPlayers.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.club.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating = selectedRatingFilter === 'all' || p.rating >= selectedRatingFilter;
      return matchesSearch && matchesRating;
    });
  }, [marketPlayers, searchQuery, selectedRatingFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container-lowest/80 backdrop-blur-sm p-4">
      <div className="bg-surface-container-low border border-surface-container-highest/60 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-space-md border-b border-surface-container-highest/40 flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary-fixed text-2xl">swap_horiz</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Mevki Oyuncusu Değiştir
              </h3>
              <span className="font-data-sm text-data-sm text-outline">
                Hedef Pozisyon: <strong className="text-secondary">{slot.position}</strong> • Şu An: {slot.player ? `${slot.player.name} (${slot.player.rating})` : slot.tokenLabel || 'Boş'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Tabs & Controls */}
        <div className="px-space-md pt-space-sm pb-space-xs flex flex-col gap-space-sm bg-surface-container-lowest/50 border-b border-surface-container-highest/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center bg-surface-container p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('club')}
                className={`px-3 py-1.5 rounded font-label-md text-label-md transition-all ${
                  activeTab === 'club'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Kulüp Havuzu ({clubPlayers.length})
              </button>
              <button
                onClick={() => setActiveTab('market')}
                className={`px-3 py-1.5 rounded font-label-md text-label-md transition-all ${
                  activeTab === 'market'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Transfer Pazarı ({marketPlayers.length})
              </button>
              <button
                onClick={() => setActiveTab('tokens')}
                className={`px-3 py-1.5 rounded font-label-md text-label-md transition-all ${
                  activeTab === 'tokens'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                KÇG Jetonları
              </button>
            </div>

            {activeTab !== 'tokens' && (
              <div className="flex items-center gap-1 font-data-sm text-data-sm">
                <span className="text-outline">Filtre:</span>
                <button
                  onClick={() => setSelectedRatingFilter('all')}
                  className={`px-2 py-0.5 rounded ${selectedRatingFilter === 'all' ? 'bg-primary-container text-on-primary-container font-bold' : 'bg-surface-container text-outline'}`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setSelectedRatingFilter(86)}
                  className={`px-2 py-0.5 rounded ${selectedRatingFilter === 86 ? 'bg-primary-container text-on-primary-container font-bold' : 'bg-surface-container text-outline'}`}
                >
                  86+
                </button>
                <button
                  onClick={() => setSelectedRatingFilter(88)}
                  className={`px-2 py-0.5 rounded ${selectedRatingFilter === 88 ? 'bg-primary-container text-on-primary-container font-bold' : 'bg-surface-container text-outline'}`}
                >
                  88+
                </button>
              </div>
            )}
          </div>

          {activeTab !== 'tokens' && (
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-2 text-outline text-base">search</span>
              <input
                className="w-full bg-surface-container rounded pl-9 pr-3 py-1.5 font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary-fixed"
                placeholder="İsim veya kulüp ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Modal Body / Selection List */}
        <div className="p-space-md overflow-y-auto max-h-96 flex flex-col gap-2">
          {activeTab === 'tokens' && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([87, 88, 89] as const).map(rating => { const amount = tokenInventory[('tokens' + rating + 'Plus') as keyof TokenInventory]; return <button key={rating} disabled={!Number.isInteger(amount) || amount <= 0} onClick={() => { onSelectToken(slot.slotId, rating); onClose(); }} className="p-3 rounded-lg bg-surface-container text-left border border-outline-variant disabled:opacity-40"><strong>{rating}+ Jeton</strong><p>{amount} kullanılabilir</p><p className="text-body-sm">Bu Slota Ata</p></button>; })}
          </div>}

          {/* Recommended Alternatives from EasySBC Engine */}
          {slot.alternativePlayers && slot.alternativePlayers.length > 0 && activeTab !== 'tokens' && (
            <div className="mb-2 p-2.5 rounded-lg bg-surface-container-highest/60 border border-primary-fixed/30 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-primary-fixed font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  Önerilen Alternatifler (Reyting & Maliyet)
                </span>
                <span className="font-data-sm text-[11px] text-outline">Anında Değiştir</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {slot.alternativePlayers.slice(0, 4).map((alt) => (
                  <button
                    key={alt.id}
                    onClick={() => {
                      onSelectPlayer(slot.slotId, alt);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2 rounded bg-surface-container hover:bg-primary-container/20 border border-surface-container-high hover:border-primary-fixed/40 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-data-md text-data-md font-bold text-primary-fixed">
                        {alt.rating}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-body-sm text-body-sm font-bold text-on-surface truncate group-hover:text-primary-fixed">
                          {alt.name}
                        </span>
                        <span className="font-data-sm text-[11px] text-outline truncate">
                          {alt.position} • {alt.club}
                        </span>
                      </div>
                    </div>
                    <span className={`font-data-sm text-data-sm font-bold ${alt.inClub ? 'text-primary-fixed' : 'text-secondary'}`}>
                      {alt.inClub ? '0 c (Kulüp)' : `${alt.price.toLocaleString('tr-TR')} c`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'club' && (
            <div className="flex flex-col gap-1.5">
              {filteredClub.length === 0 ? (
                <div className="p-8 text-center text-outline">Eşleşen kulüp oyuncusu bulunamadı.</div>
              ) : (
                filteredClub.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => {
                      onSelectPlayer(slot.slotId, player);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-space-sm min-w-0">
                      <span className="font-data-lg text-data-lg font-bold text-primary-fixed w-8 text-center">
                        {player.rating}
                      </span>
                      <span className="font-label-md text-label-md text-outline w-8 uppercase">
                        {player.position}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-body-md text-body-md font-bold text-on-surface truncate">
                            {player.name}
                          </span>
                          {player.cardType === 'TOTW' && (
                            <span className="bg-tertiary-container/30 text-tertiary-fixed-dim font-data-sm text-[10px] px-1 rounded font-bold">
                              TOTW
                            </span>
                          )}
                        </div>
                        <span className="font-data-sm text-data-sm text-outline truncate">
                          {player.club} • {player.league}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-space-md">
                      <span className="bg-on-primary-container text-primary-container font-data-sm text-data-sm px-2 py-0.5 rounded font-medium">
                        {player.isUntradeable ? 'Kulüp (Untr)' : 'Kulüp (Takas Edilir)'}
                      </span>
                      <span className="font-data-sm text-data-sm text-outline">0 c</span>
                      <button className="px-3 py-1 rounded bg-primary-container text-on-primary-container font-label-md text-label-md font-bold hover:brightness-110">
                        Seç
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'market' && (
            <div className="flex flex-col gap-1.5">
              {filteredMarket.length === 0 ? (
                <div className="p-8 text-center text-outline">Eşleşen pazar oyuncusu bulunamadı.</div>
              ) : (
                filteredMarket.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => {
                      onSelectPlayer(slot.slotId, player);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-space-sm min-w-0">
                      <span className="font-data-lg text-data-lg font-bold text-secondary w-8 text-center">
                        {player.rating}
                      </span>
                      <span className="font-label-md text-label-md text-outline w-8 uppercase">
                        {player.position}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-body-md text-body-md font-bold text-on-surface truncate">
                            {player.name}
                          </span>
                          {player.cardType === 'TOTW' && (
                            <span className="bg-tertiary-container/30 text-tertiary-fixed-dim font-data-sm text-[10px] px-1 rounded font-bold">
                              TOTW
                            </span>
                          )}
                        </div>
                        <span className="font-data-sm text-data-sm text-outline truncate">
                          {player.club} • {player.league}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-space-md">
                      <span className="bg-secondary-container/40 text-secondary font-data-sm text-data-sm px-2 py-0.5 rounded font-bold">
                        Pazardan Al
                      </span>
                      <span className="font-data-md text-data-md text-secondary font-bold">
                        {player.price.toLocaleString('tr-TR')} c
                      </span>
                      <button className="px-3 py-1 rounded bg-secondary-container text-on-secondary font-label-md text-label-md font-bold hover:brightness-110">
                        Seç
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-space-sm border-t border-surface-container-highest/40 bg-surface-container-lowest flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
