import { LINKS } from '../game/data/links';
import { Art, charArt } from './Art';

export function LinkCutin({ id, onSkip }: { id: string; onSkip: () => void }) {
  const l = LINKS.find((x) => x.id === id);
  if (!l) return null;
  return (
    <div className="cutin">
      <Art src={`/assets/links/${l.id}.webp`} alt={l.name} className="cutin-bg" />
      <Art src={charArt(l.a, 'cutin')} alt={l.a} className="cutin-a" color="#88c" />
      <Art src={charArt(l.b, 'cutin')} alt={l.b} className="cutin-b" color="#c8a" />
      <div className="cutin-title">
        <b>{l.name}</b>
        <small>{l.nameEn}</small>
      </div>
      <button className="btn tiny skip" onClick={onSkip}>跳過 Skip</button>
    </div>
  );
}
