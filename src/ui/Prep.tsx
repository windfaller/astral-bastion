import { CHARACTERS } from '../game/data/characters';
import type { StageDef } from '../game/types';
import type { RunState } from '../game/types';
import { Art, assetUrl, charArt } from './Art';

export function Prep({ stage, run, onFight, onBack }: { stage: StageDef; run: RunState; onFight: () => void; onBack: () => void }) {
  return (
    <section className="panel screen prep-screen">
      <div className="prep-bg" style={{ backgroundImage: `url(${assetUrl('assets/bg/moonlight.webp')})` }} />
      <header className="bar">
        <h2>{stage.name} / {stage.nameEn}</h2>
        <button className="btn" onClick={onBack}>地圖</button>
      </header>
      <p>{stage.kind === 'tutorial' ? '教學：部署與加速節點。' : stage.kind === 'elite' ? '精英戰：處刑者 + 變異。' : stage.kind === 'boss' ? '首領 YAMATO-0 即將降臨。' : '雙支線匯入靈脈。'}</p>
      {stage.tutorialHints && (
        <ul className="hints">{stage.tutorialHints.map((h) => <li key={h}>{h}</li>)}</ul>
      )}
      {!!stage.mutators.length && <p className="warn">變異：{stage.mutators.join(', ')}</p>}
      <div className="row team-row">
        {run.team.map((id) => (
          <div key={id} className="mini">
            <Art src={charArt(id, 'portrait')} alt={CHARACTERS[id].name} color={CHARACTERS[id].color} />
            <span>{CHARACTERS[id].name}</span>
          </div>
        ))}
      </div>
      <p className="hint">遺物：{run.relics.join(', ') || '無'}　模組：{run.mods.join(', ') || '無'}</p>
      <button className="btn primary" onClick={onFight}>出擊 Deploy</button>
    </section>
  );
}
