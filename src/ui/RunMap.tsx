import { RUN_NODES } from '../game/data/stages';
import type { RunState } from '../game/types';

export function RunMap({ run, onEnter, onMenu }: { run: RunState; onEnter: () => void; onMenu: () => void }) {
  const node = RUN_NODES[run.nodeIndex];
  return (
    <section className="panel screen map-screen">
      <header className="bar">
        <h2>遠征圖 / Run Map</h2>
        <button className="btn" onClick={onMenu}>選單</button>
      </header>
      <ol className="path-nodes">
        {RUN_NODES.map((n, i) => (
          <li key={n.id} className={i === run.nodeIndex ? 'here' : i < run.nodeIndex ? 'done' : ''}>
            <b>{n.label}</b>
            <small>{n.labelEn}</small>
          </li>
        ))}
      </ol>
      <div className="stack">
        <p>遺物 {run.relics.length} · 模組 {run.mods.length} · 核心強化 {run.coreUpgrades.length}</p>
        <p className="hint">下一節點：{node?.label} / {node?.labelEn}</p>
        <button className="btn primary" onClick={onEnter}>進入 Enter</button>
      </div>
    </section>
  );
}
