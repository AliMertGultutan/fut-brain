import React from 'react';
export function SquadPitchBackdrop() {
  return <div className="absolute inset-0 pointer-events-none -z-10" aria-hidden="true">
    <svg className="w-full h-full text-primary-fixed/15" viewBox="0 0 720 1100" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="24" y="28" width="672" height="1044" rx="8" />
      <path d="M24 550h672M205 28v160h310V28M278 28v65h164V28M205 1072V912h310v160M278 1072v-65h164v65" />
      <ellipse cx="360" cy="550" rx="92" ry="100" /><circle cx="360" cy="550" r="3" fill="currentColor" />
      <path d="M286 188a92 100 0 0 0 148 0M286 912a92 100 0 0 1 148 0" />
      <circle cx="360" cy="143" r="3" fill="currentColor" /><circle cx="360" cy="957" r="3" fill="currentColor" />
    </svg>
  </div>;
}
