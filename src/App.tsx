import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Sidebar, type NavPage } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
import { DashboardView } from './components/views/DashboardView.tsx';
import { SbcSolverView } from './components/views/SbcSolverView.tsx';
import { SquadView } from './components/views/SquadView.tsx';
import { PlayerCatalogView } from './components/PlayerCatalogView.tsx';
import { LiveEvolutionsView } from './components/views/LiveEvolutionsView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';
import { ImportModal } from './components/modals/ImportModal.tsx';
import {
  ClubDataProvider,
  ItemTokenProvider,
  SettingsProvider,
} from './services/providers.ts';
import type { Player, TokenInventory, AppSettings, SbcChallenge } from './types/index.ts';
import { useParseMarket } from './services/useParseMarket.ts';
import { ageMarketPlayers } from './services/parseAdapter.ts';
import { ParseMarketPanel } from './components/ParseMarketPanel.tsx';
import { LiveSbcPanel } from './components/LiveSbcPanel.tsx';
import { useEaSquad } from './services/useEaSquad.ts';
import { eaSquadPlayers } from './services/eaSquad.ts';
import { EaActiveSquadPanel } from './components/EaActiveSquadPanel.tsx';
const ClubsView = lazy(() => import('./components/views/ClubsView.tsx').then(module => ({ default: module.ClubsView })));

export default function App() {
  const parseMarket = useParseMarket();
  const eaSquad = useEaSquad();
  const [activePage, setActivePage] = useState<NavPage>(() => { const route = location.hash.slice(1).split('/')[0]; const page = route === 'fut-gallery' ? 'fut-players' : route; return ['overview','sbc-solver','kadro-taktik','fut-players','evolutions','settings','clubs'].includes(page) ? page as NavPage : 'overview'; });
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>();
  const [liveChallenge, setLiveChallenge] = useState<SbcChallenge | null>(null);
  const solverChallenges = useMemo(() => liveChallenge ? [liveChallenge] : [], [liveChallenge]);
  useEffect(() => { if (liveChallenge && activePage === 'sbc-solver') document.getElementById('active-sbc-solver')?.scrollIntoView({ block: 'start' }); }, [liveChallenge, activePage]);
  const [players, setPlayers] = useState<Player[]>(() => ClubDataProvider.getPlayers());
  const [settings, setSettings] = useState<AppSettings>(() => SettingsProvider.getSettings());
  const [globalSearch, setGlobalSearch] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<string | null>(null);

  useEffect(() => {
    const platform = parseMarket.platform === 'pc' ? 'PC_WEBAPP' : parseMarket.platform === 'ps' ? 'PLAYSTATION' : 'XBOX';
    if (settings.platform !== platform) {
      const updated = { ...settings, platform } as AppSettings;
      setSettings(updated);
      try { SettingsProvider.saveSettings(updated); } catch { setGlobalNotification('Platform seçildi; tarayıcı depolamasına kaydedilemedi.'); }
    }
  }, [parseMarket.platform]);

  useEffect(() => { const navigate = () => { const route = location.hash.slice(1).split('/')[0]; const page = route === 'fut-gallery' ? 'fut-players' : route; if (['overview','sbc-solver','kadro-taktik','fut-players','evolutions','settings','clubs'].includes(page)) setActivePage(page as NavPage); }; window.addEventListener('hashchange', navigate); return () => window.removeEventListener('hashchange', navigate); }, []);

  // Keyboard shortcut for ⌘K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('header input');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUpdatePlayers = (updated: Player[]) => {
    ClubDataProvider.savePlayers(updated);
    setPlayers(updated);
  };

  const handleUpdateTokens = (updatedTokens: TokenInventory) => {
    ItemTokenProvider.saveInventory(updatedTokens);
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    if (parseMarket.busy && newSettings.platform !== settings.platform) throw new Error('Veri isteği tamamlandıktan sonra platformu değiştirebilirsin.');
    SettingsProvider.saveSettings(newSettings);
    setSettings(newSettings);
    parseMarket.setContext(parseMarket.year, newSettings.platform === 'PC_WEBAPP' ? 'pc' : newSettings.platform === 'PLAYSTATION' ? 'ps' : 'xbox');
  };

  const handleResetData = () => {
    const defaultPlayers = ClubDataProvider.resetToDefault();
    setPlayers(defaultPlayers);
  };

  const handleNavigate = (page: string, params?: { challengeId?: string }) => {
    setIsMobileMenuOpen(false);
    if (page === 'import-data') {
      setIsImportModalOpen(true);
      return;
    }
    if (params?.challengeId) { setSelectedChallengeId(params.challengeId); if (!params.challengeId.startsWith('futbin-sbc:')) setLiveChallenge(null); }
    setActivePage(page as NavPage);
    location.hash = page;
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Separated pools
  const realPlayers = useMemo(() => [...new Map([...players.filter(p => p.priceStatus !== 'DEMO' && !p.id.startsWith('ea:')), ...(eaSquad.squad ? eaSquadPlayers(eaSquad.squad) : [])].map(p => [p.id, p])).values()], [players, eaSquad.squad]);
  const clubOnly = useMemo(() => realPlayers.filter(p => p.inClub && (!p.gameYear || p.gameYear === parseMarket.year)), [realPlayers, parseMarket.year]);
  const solverClub = useMemo(() => parseMarket.enabled || liveChallenge ? clubOnly.filter(p => p.priceStatus !== 'DEMO' && p.gameYear === (liveChallenge?.gameYear || parseMarket.year)) : clubOnly, [clubOnly, parseMarket.enabled, parseMarket.year, liveChallenge]);
  const marketOnly = useMemo(() => parseMarket.enabled || liveChallenge ? ageMarketPlayers(parseMarket.players.filter(p => p.gameYear === (liveChallenge?.gameYear || parseMarket.year) && p.pricePlatform === parseMarket.platform)) : players.filter(p => !p.inClub || (['GOLD_RARE', 'TOTW'].includes(p.cardType) && p.price > 0 && p.priceStatus !== 'UNAVAILABLE')).map(p => ({ ...p, inClub: false, isUntradeable: p.inClub ? false : p.isUntradeable })), [players, parseMarket.enabled, parseMarket.players, parseMarket.year, parseMarket.platform, liveChallenge]);

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        playerCount={clubOnly.length}
        tokenCount={0}
        coinsBalance={eaSquad.squad?.coinsBalance ?? null}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main App Container */}
      <div className="lg:pl-[230px] pl-0 flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          statusText={activePage === 'clubs' ? 'EA Clubs · Ortak veri merkezi' : parseMarket.status?.connected ? `Canlı veri · FC ${parseMarket.year} · ${parseMarket.platform.toUpperCase()}` : parseMarket.status?.configured ? 'Parse anahtarı hazır' : 'Parse bağlantısı gerekli'}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onSearch={query => { setGlobalSearch(query); if (query.trim().length >= 2) handleNavigate('fut-players'); }}
        />

        {/* Global Notification Banner */}
        {globalNotification && (
          <div className="fixed top-20 right-8 z-50 p-3 rounded-lg bg-secondary-container text-on-secondary font-headline-sm text-body-md font-bold shadow-xl flex items-center gap-2 animate-bounce">
            <span className="material-symbols-outlined text-lg">sync</span>
            <span>{globalNotification}</span>
          </div>
        )}

        {/* Page Content */}
        <main className="relative pt-16 bg-surface min-h-screen">
          <div className="px-4 md:px-6 py-2 text-sm bg-surface-container-low text-outline border-b border-outline-variant">{activePage === 'clubs' ? 'Clubs takip prototipi · Veriler doğrudan EA’dan · Son okuma tarihi ekranda gösterilir' : <>Deneme prototipi · FC {parseMarket.year} · {eaSquad.squad ? 'EA kadro kaydı alındı' : eaSquad.installed ? 'Eklenti bağlı · EA kadrosu bekleniyor' : 'EA kadro bağlantısı için eklentiyi kur'} · Örnek veriler gizli</>}</div>
          {activePage === 'clubs' && <Suspense fallback={<p role="status" className="p-6">Clubs ekranı açılıyor…</p>}><ClubsView /></Suspense>}
          {activePage === 'sbc-solver' && <div className="p-gutter-desktop"><LiveSbcPanel market={parseMarket} activeChallenge={liveChallenge} onUseDemo={() => { setLiveChallenge(null); setSelectedChallengeId(undefined); }} onUseChallenge={challenge => { setLiveChallenge(challenge); setSelectedChallengeId(challenge.id); parseMarket.setEnabled(true); }} /></div>}
          {activePage === 'sbc-solver' && (parseMarket.enabled || liveChallenge) && <p className="px-gutter-desktop py-3 text-sm text-outline">Parse pazar havuzu: {marketOnly.length} kart. Oyun yılı eşleşmeyen veya örnek kulüp kartları kullanılmaz. Reyting ve kimya hesabı topluluk modelidir; FC 27 Item Score kuralları desteklenmez. {liveChallenge ? `Görev koşulları: Pazar verileri, FC ${liveChallenge.gameYear}.` : 'Görev gereksinimleri örnek veridir.'} {!marketOnly.length && 'Pazar kartlarını Fut Players ekranından getir.'}</p>}
          {activePage === 'fut-players' && <PlayerCatalogView market={parseMarket} clubPlayers={realPlayers} initialQuery={globalSearch} />}
          {activePage === 'overview' && (
            <DashboardView
              market={parseMarket} onNavigate={handleNavigate} playerCount={clubOnly.length}
            />
          )}

          {activePage === 'sbc-solver' && liveChallenge && (
            <div id="active-sbc-solver" className="scroll-mt-20">
            <SbcSolverView
              key={liveChallenge?.id || 'demo'}
              initialChallengeId={selectedChallengeId}
              challenges={solverChallenges}
              clubPlayers={solverClub}
              marketPlayers={marketOnly}
              tokenInventory={{ tokens87Plus: 0, tokens88Plus: 0, tokens89Plus: 0, fragments: 0 }}
              onUpdateTokens={handleUpdateTokens}
              onNavigate={handleNavigate}
            />
            </div>
          )}

          {activePage === 'kadro-taktik' && (
            <div className="p-gutter-desktop space-y-5"><EaActiveSquadPanel bridge={eaSquad} />
            {clubOnly.some(p => !p.id.startsWith('ea:')) && <details className="rounded-xl border border-outline-variant p-4"><summary className="min-h-11 cursor-pointer font-bold">Yerel kadro planlayıcısı</summary>
            <SquadView
              clubPlayers={clubOnly.filter(p => !p.id.startsWith('ea:'))}
              onPlayerUpdate={updated => handleUpdatePlayers([...players.filter(p => !clubOnly.some(c => c.id === p.id)), ...updated])}
            />
            </details>}</div>
          )}

          {activePage === 'evolutions' && (
            <LiveEvolutionsView market={parseMarket} clubPlayers={clubOnly} />
          )}

          {activePage === 'settings' && (
            <>
            <div className="p-gutter-desktop max-w-5xl mx-auto"><ParseMarketPanel market={parseMarket} variant="settings" /></div>
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onOpenImport={() => setIsImportModalOpen(true)}
              onResetData={handleResetData}
              clubPlayerCount={clubOnly.length}
              parseStatus={parseMarket.status}
            />
            </>
          )}
        </main>
      </div>

      {/* CSV / JSON Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(updated, summary) => {
          handleUpdatePlayers(updated);
          handleUpdateSettings({ ...settings, dataSourceMode: 'MANUAL', lastSyncTime: new Date().toLocaleString('tr-TR') });
          if (!summary?.errorCount) setIsImportModalOpen(false);
          setGlobalNotification('Kulüp verisi başarıyla içe aktarıldı ve güncellendi!');
          setTimeout(() => setGlobalNotification(null), 3500);
        }}
      />
    </div>
  );
}
