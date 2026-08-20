import { CHARACTERS } from '../game/data/characters';
import { LINKS } from '../game/data/links';
import type { BattleSim } from '../game/systems/battle';
import type { CharId } from '../game/types';
import { Art, charArt } from './Art';

export function BattleHUD({
  sim,
  paused,
  inspect,
  linkReady,
  selected,
  dragging,
  onSelect,
  onUlt,
  onActive,
  onLink,
  onAccel,
  onPause,
  onResume,
  onSkip,
  onFast,
  onMenu,
}: {
  sim: BattleSim;
  paused: boolean;
  inspect: string | null;
  linkReady: string | null;
  selected: string | null;
  dragging: CharId | null;
  onSelect: (id: string) => void;
  onUlt: (id: string) => void;
  onActive: (id: string) => void;
  onLink: () => void;
  onAccel: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onFast: () => void;
  onMenu: () => void;
}) {
  const corePct = sim.core.t * 100;
  const hpPct = (sim.core.hp / sim.core.maxHp) * 100;
  const v = inspect ? sim.valkyries.find((x) => x.id === inspect) : null;
  const e = inspect ? sim.enemies.find((x) => x.id === inspect) : null;
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="core-bar">
          <span>靈核 {sim.core.hp.toFixed(1)} / {sim.core.maxHp}</span>
          <i style={{ width: `${hpPct}%` }} />
        </div>
        <div className="t-bar">
          <span>靈脈 {corePct.toFixed(0)}%</span>
          <i style={{ width: `${corePct}%` }} />
        </div>
        <div className="chips">
          <span>換位 {sim.shiftsLeft}</span>
          <span>閘門 {sim.gateDestroyed ? '毀' : `${Math.ceil(sim.gateHp)}`}</span>
          {sim.bossPhase === 2 && <span className="warn">P2</span>}
        </div>
        <button className="btn tiny" onClick={onPause}>暫停</button>
      </div>

      <div className="hud-left">
        {sim.valkyries.map((u) => {
          const c = CHARACTERS[u.charId!];
          return (
            <button key={u.id} className={`vcard ${selected === u.id ? 'on' : ''} ${u.deployed ? 'dep' : ''} ${u.dead ? 'dead' : ''}`} onClick={() => onSelect(u.id)}>
              <Art src={charArt(u.id, 'portrait')} alt={c.name} color={c.color} />
              <div>
                <b>{c.name}</b>
                <small>{Math.max(0, Math.ceil(u.hp))}/{u.maxHp}</small>
                <div className="en"><i style={{ width: `${u.energy}%` }} /></div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hud-right">
        <button className="btn" disabled={sim.accelUsed} onClick={onAccel}>加速節點</button>
        <button className={`btn ${linkReady ? 'link-ready' : ''}`} disabled={!linkReady} onClick={onLink}>
          {linkReady ? `LINK READY ${LINKS.find((l) => l.id === linkReady)?.name}` : `連攜 ${sim.linkEnergy.toFixed(0)}%`}
        </button>
        {selected && (
          <>
            <button className="btn" onClick={() => onActive(selected)}>主動技</button>
            <button className="btn primary" disabled={(sim.valkyries.find((x) => x.id === selected)?.energy ?? 0) < 100} onClick={() => onUlt(selected)}>必殺</button>
          </>
        )}
      </div>

      <div className="hud-bottom">
        {!sim.valkyries.some((u) => u.deployed) && <p className="deploy-hint">拖到高台部署</p>}
        <p className="hint">拖曳女武神到光圈部署 · 點地面放置艾莉亞咒印 · 點角色放必殺</p>
        {dragging && <p>正在部署 {CHARACTERS[dragging].name}</p>}
      </div>

      {paused && (
        <div className="pause">
          <div className="panel">
            <h3>暫停 / Inspect</h3>
            {v && (
              <div>
                <h4>{CHARACTERS[v.charId!].name}</h4>
                <p>{CHARACTERS[v.charId!].auto.desc}</p>
                <p>被動：{CHARACTERS[v.charId!].passive.desc}</p>
                <p>主動：{CHARACTERS[v.charId!].active.desc}</p>
                <p>必殺：{CHARACTERS[v.charId!].ult.desc}</p>
              </div>
            )}
            {e && (
              <div>
                <h4>{e.name}</h4>
                <p>HP {e.hp.toFixed(0)} / {e.maxHp} · 路徑 {e.pathId} t={e.t.toFixed(2)}</p>
              </div>
            )}
            {!v && !e && <p>點選單位檢視技能。模擬不受暫停影響以外的結算——暫停僅凍結畫面推進。</p>}
            <div className="row">
              <button className="btn" onClick={onFast}>快速</button>
              <button className="btn" onClick={onSkip}>跳過動畫</button>
              <button className="btn" onClick={onMenu}>放棄</button>
              <button className="btn primary" onClick={onResume}>繼續</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
