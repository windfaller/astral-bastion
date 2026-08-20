import { CHAR_LIST } from '../game/data/characters';
import type { CharId } from '../game/types';
import { Art, charArt } from './Art';

export function TeamCompose({ unlocked, team, onToggle, onStart, onBack }: { unlocked: CharId[]; team: CharId[]; onToggle: (id: CharId) => void; onStart: () => void; onBack: () => void }) {
  return (
    <section className="panel screen">
      <header className="bar">
        <h2>編成 / Compose</h2>
        <button className="btn" onClick={onBack}>返回</button>
      </header>
      <p className="hint">選擇 3 或 4 名女武神。初始解鎖：凛、艾莉莎、伊芙。第四人可在遠征中招募。</p>
      <div className="grid chars">
        {CHAR_LIST.map((c) => {
          const open = unlocked.includes(c.id);
          const on = team.includes(c.id);
          return (
            <button key={c.id} className={`card ${on ? 'on' : ''} ${open ? '' : 'locked'}`} disabled={!open} onClick={() => onToggle(c.id)}>
              <Art src={open ? charArt(c.id, 'portrait') : ''} alt={c.name} color={c.color} fallback={open ? c.name : '???'} />
              <strong>{open ? c.name : '未解鎖'}</strong>
              <small>{open ? c.nameEn : 'Undiscovered'}</small>
              <em>{c.role}</em>
            </button>
          );
        })}
      </div>
      <footer className="bar">
        <span>{team.length} / 3–4</span>
        <button className="btn primary" disabled={team.length < 3 || team.length > 4} onClick={onStart}>開始遠征 Start</button>
      </footer>
    </section>
  );
}
