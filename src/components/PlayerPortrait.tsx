import React, { useState } from 'react';
export function PlayerPortrait({ name, url, className = '' }: { name: string; url?: string; className?: string }) {
  const [failed, setFailed] = useState('');
  return url && url !== failed ? <img className={className + ' object-contain'} src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(url)} /> : <span className={className + ' flex items-center justify-center text-outline text-lg font-bold'} role="img" aria-label={`${name} için görsel yok`}>{name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>;
}
