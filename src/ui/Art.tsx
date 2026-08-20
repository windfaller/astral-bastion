import { useState } from 'react';

export function assetUrl(path: string): string {
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${p}`;
}

export function Art({ src, alt, className, fallback, color }: { src: string; alt: string; className?: string; fallback?: string; color?: string }) {
  const [bad, setBad] = useState(false);
  if (bad || !src) {
    return (
      <div className={`sil ${className ?? ''}`} style={{ background: `radial-gradient(circle at 40% 30%, ${color ?? '#5b8cff'} 0%, #0b1220 70%)` }} aria-label={alt}>
        <span className="sil-figure" />
        <em>{fallback ?? alt}</em>
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} onError={() => setBad(true)} draggable={false} />;
}

export function charArt(id: string, kind: 'portrait' | 'full' | 'cutin' | 'skin' = 'portrait'): string {
  return assetUrl(`assets/characters/${id}/${kind}.webp`);
}
