import React from 'react';

export type NavPage = 'overview' | 'sbc-solver' | 'kadro-taktik' | 'fut-players' | 'evolutions' | 'clubs' | 'settings' | 'import-data';

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  playerCount: number;
  tokenCount: number;
  coinsBalance: number | null;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  playerCount,
  coinsBalance,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'overview' as NavPage, label: 'Overview', icon: 'grid_view' },
    { id: 'sbc-solver' as NavPage, label: 'SBC Solver', icon: 'memory', badge: 'HOT' },
    { id: 'kadro-taktik' as NavPage, label: 'Kadro', icon: 'sports_soccer' },
    { id: 'fut-players' as NavPage, label: 'Fut Players', icon: 'person_search' },
    { id: 'evolutions' as NavPage, label: 'Evolutions', icon: 'bolt' },
    { id: 'clubs' as NavPage, label: 'Clubs', icon: 'groups', badge: 'YENİ' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-surface-container-lowest/80 backdrop-blur-sm z-40 lg:hidden"
        ></div>
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-[230px] bg-surface-container-low border-r border-surface-container-highest/40 z-50 flex flex-col justify-between select-none transition-transform duration-200 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Brand Header */}
          <div
            className="h-16 px-space-md border-b border-surface-container-highest/40 flex items-center gap-space-sm cursor-pointer"
            onClick={() => {
              onNavigate('overview');
              onCloseMobile?.();
            }}
          >
            {/* FUT Brain Hexagonal Logo Icon */}
            <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-primary-container/40 flex items-center justify-center shrink-0 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-container/20 to-secondary/10"></div>
              <span className="material-symbols-outlined text-primary-fixed text-lg font-bold relative z-10">
                sports_soccer
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm tracking-tight text-primary font-bold leading-none truncate">
                FUT BRAIN
              </span>
              <span className="font-data-sm text-data-sm text-outline tracking-wider uppercase mt-1 truncate">
                Canlı veri prototipi
              </span>
            </div>
          </div>

        {/* Navigation list */}
        <div className="px-space-sm pt-space-md">
          <div className="px-space-sm pb-space-xs">
            <span className="font-label-md text-label-md text-outline uppercase tracking-wider">
              Navigasyon
            </span>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`min-h-11 cursor-pointer flex items-center justify-between px-space-sm py-2 rounded transition-colors group text-left ${
                    isActive
                      ? 'bg-surface-container-high text-primary font-bold shadow-[inset_2px_0_0_0_#b7f56a]'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-space-sm truncate">
                    <span className="material-symbols-outlined text-lg leading-none">
                      {item.icon}
                    </span>
                    <span className="font-body-md text-body-md truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-primary-container text-on-primary-container font-data-sm text-data-sm px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Status & Utility Box */}
      <div className="flex flex-col border-t border-surface-container-highest/40 bg-surface-container-lowest/50">
        <div className="p-space-sm border-b border-surface-container-highest/30">
          <div className="bg-surface-container p-space-sm rounded border border-surface-container-highest/50 flex flex-col gap-1">
            <div className="flex items-center justify-between text-outline">
              <span className="font-label-md text-label-md uppercase tracking-wide">
                Kulüp İstatistiği
              </span>
              <span
                className="flex h-2 w-2 rounded-full bg-tertiary-fixed-dim ring-2 ring-tertiary-container/30"
                title="EA ve manuel kulüp kayıtları"
              ></span>
            </div>
              <div className="font-data-sm text-data-sm text-on-surface font-medium flex items-center justify-between pt-0.5">
              <span>{playerCount.toLocaleString('tr-TR')} Oyuncu</span>
                <span className="text-xs text-outline">EA / Kulüp</span>
            </div>
              <div className="mt-1 flex items-center gap-2 rounded-lg bg-surface-container-lowest/60 px-2 py-2" aria-label="EA coin bakiyesi">
                <span className="material-symbols-outlined text-tertiary-fixed-dim text-lg" aria-hidden="true">monetization_on</span>
                <div className="min-w-0"><span className="block text-xs text-outline">EA coin bakiyesi</span><strong className="text-sm text-tertiary-fixed-dim tabular-nums">{coinsBalance === null ? 'Bakiye bekleniyor' : `${coinsBalance.toLocaleString('tr-TR')} Coins`}</strong></div>
              </div>
          </div>
        </div>

        <div className="px-space-sm py-space-xs flex flex-col gap-0.5">
          <button
            onClick={() => onNavigate('settings')}
            className={`flex items-center gap-space-sm px-space-sm py-1.5 rounded transition-colors text-left ${
              activePage === 'settings'
                ? 'bg-surface-container-high text-primary font-bold'
                : 'text-outline hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base leading-none">settings</span>
            <span className="font-body-sm text-body-sm truncate">Ayarlar</span>
          </button>
          <button
            onClick={() => onNavigate('import-data')}
            className={`flex items-center gap-space-sm px-space-sm py-1.5 rounded transition-colors text-left ${
              activePage === 'import-data'
                ? 'bg-surface-container-high text-primary font-bold'
                : 'text-outline hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base leading-none">upload_file</span>
            <span className="font-body-sm text-body-sm truncate">Veri İçe Aktar</span>
          </button>
        </div>

        <div className="p-space-sm bg-surface-container-low flex items-center gap-space-xs border-t border-surface-container-highest/40">
          <span className="inline-block w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span>
          <span className="font-label-md text-label-md text-outline truncate">
            Yerel prototip · Pazar verileri
          </span>
        </div>
      </div>
    </aside>
  </>
);
};
