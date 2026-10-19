import React, { useState } from 'react';

export function Header({ onSearch, statusText, onToggleMobileMenu }: { onSearch?: (query: string) => void; statusText: string; onToggleMobileMenu?: () => void }) {
  const [searchValue, setSearchValue] = useState('');
  return <header className="fixed top-0 left-0 lg:left-[230px] right-0 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant z-30 flex items-center justify-between px-4 md:px-6 gap-3">
    <button onClick={onToggleMobileMenu} className="lg:hidden min-w-11 min-h-11 p-2 rounded-lg bg-surface-container cursor-pointer" aria-label="Menüyü Aç"><span className="material-symbols-outlined">menu</span></button>
    <form className="flex-1 max-w-xl" onSubmit={e => { e.preventDefault(); onSearch?.(searchValue); }}><label className="sr-only" htmlFor="global-player-search">Oyuncu kataloğuna git</label><input id="global-player-search" className="w-full min-h-11 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary" placeholder="Oyuncu ara… Enter ile kataloğa git" value={searchValue} onChange={e => setSearchValue(e.target.value)} /></form>
    <span className="hidden md:block text-sm text-outline rounded-lg bg-surface-container px-3 py-2">{statusText}</span><span className="text-primary text-xs font-bold">PROTOTİP</span>
  </header>;
}
