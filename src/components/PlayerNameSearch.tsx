import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { readSavedPlayerNames, rememberPlayerNames, suggestPlayerNames } from '../services/playerNames.ts';

export function PlayerNameSearch({ value, onChange, knownNames, disabled, inputClassName }: {
  value: string; onChange: (value: string) => void; knownNames: string[]; disabled: boolean; inputClassName: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [savedNames, setSavedNames] = useState(readSavedPlayerNames);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(() => suggestPlayerNames(value, [...knownNames, ...savedNames]), [value, knownNames, savedNames]);
  const visible = open && !disabled && suggestions.length > 0;
  useEffect(() => { if (knownNames.length) setSavedNames(rememberPlayerNames(knownNames)); }, [knownNames]);
  useEffect(() => { listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' }); }, [activeIndex]);
  const choose = (name: string) => { onChange(name); setOpen(false); setActiveIndex(-1); inputRef.current?.focus(); };
  return <div className="relative flex-1 w-full text-sm" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActiveIndex(-1); } }}>
    <label htmlFor={id}>Oyuncu adı</label>
    <input ref={inputRef} id={id} role="combobox" aria-autocomplete="list" aria-expanded={visible}
      aria-controls={visible ? `${id}-suggestions` : undefined} aria-activedescendant={visible && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
      aria-describedby={`${id}-hint`} autoComplete="off" spellCheck={false} className={inputClassName + ' mt-1'}
      value={value} onChange={event => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); }}
      onFocus={() => setOpen(true)} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActiveIndex(-1); return; }
        if (event.key === 'ArrowDown' && suggestions.length) { event.preventDefault(); setOpen(true); setActiveIndex(index => Math.min(index + 1, suggestions.length - 1)); }
        if (event.key === 'ArrowUp' && suggestions.length) { event.preventDefault(); setOpen(true); setActiveIndex(index => index <= 0 ? suggestions.length - 1 : index - 1); }
        if (event.key === 'Enter' && visible && activeIndex >= 0) { event.preventDefault(); choose(suggestions[activeIndex]); }
      }} minLength={2} maxLength={80} placeholder="Örn. Messi veya gre…" disabled={disabled} required />
    {visible && <ul ref={listRef} id={`${id}-suggestions`} role="listbox" aria-label="Oyuncu adı önerileri" className="absolute z-50 left-0 right-0 top-[calc(100%+4px)] max-h-80 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-high shadow-xl p-1">
      {suggestions.map((name, index) => <li id={`${id}-option-${index}`} role="option" aria-selected={index === activeIndex} key={name}
        className={`min-h-11 flex items-center px-3 py-2 rounded-lg cursor-pointer ${index === activeIndex ? 'bg-primary-container text-on-primary-container' : 'text-on-surface hover:bg-surface-container-highest'}`}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(name)}>{name}</li>)}
    </ul>}
    <span id={`${id}-hint`} className="sr-only">En az iki harf yaz. Yukarı ve aşağı oklarla öneri seç, Enter ile adı doldur. Aramayı Oyuncu Ara düğmesi başlatır.</span>
  </div>;
}
