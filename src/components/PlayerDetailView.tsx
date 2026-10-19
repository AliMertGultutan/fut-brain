import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Coins, Globe2, RefreshCw, Shield, Trophy } from 'lucide-react';
import type { Player } from '../types/index.ts';
import type { ParseMarket } from '../services/useParseMarket.ts';
import { officialEaImage } from '../services/eaSquad.ts';
import { catalogHasPrice } from '../services/catalogFilters.ts';
import { PLAYER_STAT_GROUPS } from '../services/playerDetails.ts';
import { PlayerPortrait } from './PlayerPortrait.tsx';
import { EaPlayStylesPanel } from './EaPlayStylesPanel.tsx';

const action = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40 disabled:cursor-not-allowed';
const panel = 'rounded-2xl border border-outline-variant/60 bg-surface-container-low';
const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('tr-TR') : 'Bilgi alınmadı';
const platformName = (value?: string) => value === 'ps' ? 'PlayStation' : value === 'xbox' ? 'Xbox' : value === 'pc' ? 'PC' : 'Platform belirtilmemiş';
const valueColor = (value: number) => value >= 85 ? 'text-primary' : value >= 70 ? 'text-secondary' : value >= 50 ? 'text-tertiary-fixed-dim' : 'text-error';

export function PlayerCardArtwork({ player }: { player: Player }) {
  const shell = officialEaImage(player.shellUrl), [failedShell, setFailedShell] = useState('');
  const hasShell = shell && shell !== failedShell;
  return <div className="relative mx-auto w-[220px] max-w-full isolate">
    <div className={`relative h-[300px] overflow-hidden ${hasShell ? '' : 'rounded-[28px] border border-primary/25 bg-surface-container-high shadow-xl'}`}>
      {hasShell && <img src={shell} alt="" className="absolute inset-0 w-full h-full object-fill -z-10" onError={() => setFailedShell(shell)} referrerPolicy="no-referrer"/>}
      {!hasShell && <div className="absolute inset-0 -z-10 opacity-50" style={{ background: 'radial-gradient(ellipse at 50% 25%, var(--color-secondary-container), transparent 70%)' }}/>}
      <div className="absolute left-5 top-5 z-10 rounded-lg bg-surface-container-lowest/90 px-2 py-1 text-center"><strong className="block text-3xl font-bold tracking-tight tabular-nums text-primary">{player.rating}</strong><span className="text-xs font-semibold text-on-surface">{player.position}</span></div>
      <PlayerPortrait name={player.name} url={officialEaImage(player.imageUrl)} className="absolute left-[15%] top-9 w-[75%] h-[175px] text-5xl"/>
      <div className="absolute bottom-0 inset-x-0 bg-surface-container-lowest/95 p-4 text-center border-t border-primary/20"><strong className="block text-base font-bold leading-5 break-words">{player.commonName || player.name}</strong><span className="block mt-1 text-[11px] text-secondary">{player.cardVersion || 'Kart sürümü belirtilmemiş'}</span><div className="grid grid-cols-6 gap-1 mt-3">{PLAYER_STAT_GROUPS.map(group => <div key={group.key}><span className="block text-[10px] text-outline">{group.short}</span><strong className="text-xs tabular-nums">{player.statsKnown && player.position !== 'GK' ? player.stats[group.key] : '—'}</strong></div>)}</div></div>
    </div>
    <p className="text-center text-[11px] text-outline mt-3">{officialEaImage(player.imageUrl) ? 'EA oyuncu görseli' : 'Kaynak bu kartın görselini göndermedi'}</p>
  </div>;
}

export function PlayerDetailView({ player, market, owned, onBack }: { player: Player; market: ParseMarket; owned: boolean; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [player.id]);
  const priced = catalogHasPrice(player), known = player.statsKnown === true && player.position !== 'GK';
  const remaining = market.status ? market.status.sessionCreditLimit - market.status.creditsAttempted : 0;
  const canRefresh = !owned && !!player.futbinId && !!market.status?.configured && !market.busy && remaining >= 1;
  const loading = market.detail?.id === player.id && market.detail.phase === 'loading';
  const positions = [...new Set([player.position, ...(player.secondaryPositions || [])])];
  const priceState = player.priceStatus === 'LIVE' ? 'Güncel kaynak fiyatı' : player.priceStatus === 'CACHED' ? 'Önbellekteki fiyat' : player.priceStatus === 'MANUAL' ? 'Elle girilen fiyat' : 'Eski fiyat / tarih belirsiz';
  const facts = [{ icon: Shield, label: 'Kulüp', value: player.club }, { icon: Trophy, label: 'Lig', value: player.league }, { icon: Globe2, label: 'Ülke', value: player.nation }];
  const styles = player.playStyles.filter(style => !/^PS\s*\d/i.test(style));
  return <section className="p-3 md:p-5 space-y-5 max-w-[1600px] mx-auto" aria-label={`${player.name} oyuncu detayları`}>
    <div className="flex items-center justify-between flex-wrap gap-3"><button onClick={onBack} className={action + ' border border-outline-variant bg-surface-container-low hover:bg-surface-container-high'}><ArrowLeft size={16} aria-hidden="true"/>Fut Players’a dön</button><span className="text-xs text-outline">Fut Players <span className="mx-2" aria-hidden="true">/</span> Oyuncu detayları <span className="mx-2" aria-hidden="true">/</span> FC {player.gameYear || market.year}</span></div>

    <div className={panel + ' relative overflow-hidden'}>
      <div className="absolute inset-x-0 top-0 h-px bg-primary/50"/>
      <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[270px_minmax(0,1fr)_260px] gap-6 xl:gap-8 p-5 md:p-7 relative">
        <div className="rounded-2xl bg-surface-container-lowest/60 border border-outline-variant/30 px-4 py-6 flex items-center justify-center"><PlayerCardArtwork key={player.id} player={player}/></div>
        <div className="min-w-0 space-y-5">
          <div><div className="flex flex-wrap gap-2 mb-3"><span className="inline-flex items-center rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-1 text-[11px] font-bold tracking-wider">FC {player.gameYear || market.year}</span><span className="rounded-md bg-surface-container-high px-2 py-1 text-xs text-secondary">{player.cardVersion || 'Sürüm bilgisi yok'}</span><span className="rounded-md bg-surface-container-high px-2 py-1 text-xs text-outline">{owned ? 'Kulübündeki kart' : 'Pazar kartı'}</span></div><h1 ref={heading} tabIndex={-1} className="text-2xl md:text-3xl font-bold tracking-tight leading-tight break-words focus:outline-none">{player.name}</h1><div className="flex flex-wrap gap-2 mt-3" aria-label="Oynayabildiği mevkiler">{positions.map((position, i) => <span key={position} className={`rounded-md px-2.5 py-1 text-xs font-bold border ${i === 0 ? 'border-secondary/40 text-secondary bg-secondary/10' : 'border-outline-variant text-on-surface-variant'}`}>{position}{i === 0 && <span className="ml-1.5 font-normal opacity-80">Ana mevki</span>}</span>)}</div></div>
          <dl className="grid sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3">{facts.map(({ icon: Icon, label, value }) => <div key={label} className="rounded-xl border border-outline-variant/40 p-3 bg-surface-container/40 min-w-0"><dt className="flex items-center gap-2 text-xs text-outline"><Icon size={14} aria-hidden="true"/>{label}</dt><dd className="mt-2 font-semibold text-sm break-words">{value && value !== 'Bilinmiyor' ? value : 'Bilgi alınmadı'}</dd></div>)}</dl>
          <div className="flex gap-6 border-t border-outline-variant/50 pt-4"><div><p className="text-xs text-outline">Genel reyting</p><p className="text-3xl font-bold text-primary mt-1 tabular-nums">{player.rating}<span className="text-xs text-outline font-normal"> / 99</span></p></div><div><p className="text-xs text-outline">Oyun tarzları</p><p className="text-xl font-bold mt-2">{player.playStylesKnown ? styles.length === player.playStyles.length ? styles.length : '—' : '—'}{player.playStylesKnown && <span className="text-xs text-outline font-normal ml-2">{styles.filter(s => s.endsWith('+')).length} PlayStyle+</span>}</p></div>{owned && <div><p className="text-xs text-outline">Kart durumu</p><p className="text-sm font-semibold mt-3">{player.isUntradeable ? 'Satılamaz' : 'Satılabilir'}</p></div>}</div>
        </div>
        <aside className="rounded-2xl border border-primary/20 bg-surface-container-lowest/70 p-5 flex flex-col lg:col-span-2 2xl:col-span-1" aria-label="Pazar fiyatı">
          <div className="flex items-center gap-2 text-sm font-semibold"><Coins size={17} className="text-primary" aria-hidden="true"/>{owned ? 'Kulüp kartı' : platformName(player.pricePlatform)}</div><p className="text-xs text-outline mt-4">{priced ? priceState : 'Pazar fiyatı'}</p><p className={`text-3xl font-bold tracking-tight tabular-nums mt-2 ${priced ? 'text-primary' : 'text-outline'}`}>{priced ? player.price.toLocaleString('tr-TR') : '—'}</p><p className="text-xs text-outline mt-1">{priced ? 'Coins' : owned ? 'Bu EA kaydı fiyat içermez.' : 'Fiyat bilgisi henüz alınmadı.'}</p>
          <dl className="space-y-3 mt-6 mb-6 text-xs"><div><dt className="text-outline">Fiyat güncellemesi</dt><dd className="mt-1 leading-5">{date(player.priceUpdatedAt)}</dd></div><div><dt className="text-outline">Son kaynak okuması</dt><dd className="mt-1 leading-5">{date(player.priceObservedAt)}</dd></div></dl>
          {!owned && <><button className={action + ' mt-auto bg-primary-container text-on-primary-fixed hover:brightness-110 w-full'} disabled={!canRefresh} onClick={() => void market.loadDetails(player)}><RefreshCw size={15} aria-hidden="true" className={loading ? 'motion-safe:animate-spin' : ''}/>{loading ? 'Güncelleniyor…' : 'Fiyat ve özellikleri yenile'}</button><p className="mt-2 text-center text-[11px] text-outline">En fazla 1 kredi · Açmak ücretsiz</p>{!market.status?.configured && <a href="#settings" className="text-xs text-secondary underline text-center mt-3">Veri bağlantısını kur</a>}{!!market.status?.configured && remaining < 1 && <p role="status" className="text-xs text-error mt-3">Yerel kredi sınırına ulaşıldı.</p>}</>}
        </aside>
      </div>
      {market.detail?.id === player.id && market.detail.phase === 'error' && <p role="alert" className="mx-5 mb-5 p-3 rounded-xl bg-error/10 text-error text-sm">{market.error || 'Kart bilgileri yenilenemedi. Mevcut kayıt gösteriliyor.'}</p>}
      {market.detail?.id === player.id && market.detail.phase === 'ready' && <p role="status" className="mx-5 mb-5 text-xs text-secondary">Kaynak yanıtı alındı. Gönderilen fiyat ve özellikler karta işlendi.</p>}
    </div>

    <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
      <section aria-label="Oyuncu özellikleri" className="min-w-0"><div className="flex items-end justify-between flex-wrap gap-2 mb-3"><h2 className="font-bold text-lg">Oyuncu özellikleri</h2><span className="text-xs text-outline">Mevcut kart · Kimya takviyesi eklenmedi</span></div>
        {player.position === 'GK' ? <div className={panel + ' p-6 text-sm text-outline'}>Bu kayıt ayrıntılı kaleci özelliklerini içermiyor. Saha oyuncusu değerleri kaleci özelliği olarak gösterilmez.</div> : <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-3">{PLAYER_STAT_GROUPS.map(group => {
          const value = known ? player.stats[group.key] : null;
          return <div key={group.key} className={panel + ' p-4'}><div className="flex justify-between items-center"><h3 className="text-sm font-semibold">{group.name}</h3><strong className={`text-2xl tabular-nums ${value === null ? 'text-outline' : valueColor(value)}`}>{value ?? '—'}</strong></div><div className="h-1 rounded-full bg-surface-container-highest mt-3 mb-4 overflow-hidden" aria-hidden="true">{value !== null && <div className="h-full rounded-full bg-current text-primary" style={{ width: `${value}%` }}/>}</div><dl className="space-y-2">{group.attributes.map(([key, label]) => { const raw = player.detailedStats?.[key], stat = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 99 ? raw : null; return <div key={key} className="flex justify-between gap-3 text-xs leading-5"><dt className="text-on-surface-variant">{label}</dt><dd className={`tabular-nums font-semibold ${stat === null ? 'text-outline' : valueColor(stat)}`}>{stat ?? '—'}</dd></div>; })}</dl></div>;
        })}</div>}
        <p className="text-xs text-outline mt-3 leading-5">“—” kaynağın göndermediği özelliktir. Alt özellikler ana kart puanlarından hesaplanmaz.</p>
      </section>
      <aside className={panel + ' p-4 mt-1 space-y-4'}>
        {player.playStyleDetails?.length ? <EaPlayStylesPanel styles={player.playStyleDetails} known={player.playStylesKnown === true}/> : <section aria-label="Oyun tarzları"><div className="flex justify-between items-center mb-3"><h2 className="font-bold text-base">Oyun tarzları</h2><span className="text-xs text-outline">PlayStyles</span></div>{!player.playStylesKnown ? <p className="text-sm text-outline leading-6">Bu kartın oyun tarzları henüz alınmadı.</p> : !player.playStyles.length ? <p className="text-sm text-outline">Bu kartta oyun tarzı yok.</p> : <div className="flex flex-wrap gap-2">{styles.map(style => <span key={style} className={`inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border ${style.endsWith('+') ? 'text-primary border-primary/30 bg-primary/10' : 'border-outline-variant bg-surface-container text-on-surface'}`}>{style.endsWith('+') && <ArrowUpRight size={14} aria-hidden="true"/>}{style}</span>)}{styles.length < player.playStyles.length && <p className="text-xs text-outline leading-5">Bazı oyun tarzlarının adı kaynaktan alınamadı.</p>}</div>}</section>}
        <div className="border-t border-outline-variant/50 pt-4"><h2 className="text-sm font-semibold mb-3">Kart bilgileri</h2><dl className="space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-outline">Oyun</dt><dd>EA FC {player.gameYear || market.year}</dd></div><div className="flex justify-between gap-3"><dt className="text-outline">Sürüm</dt><dd className="text-right">{player.cardVersion || 'Bilgi alınmadı'}</dd></div><div className="flex justify-between gap-3"><dt className="text-outline">Kayıt</dt><dd>{owned ? 'Kulüp kartı' : 'Pazar kartı'}</dd></div>{!owned && <div className="flex justify-between gap-3"><dt className="text-outline">Pazar</dt><dd>{platformName(player.pricePlatform)}</dd></div>}</dl></div>
      </aside>
    </div>
  </section>;
}
