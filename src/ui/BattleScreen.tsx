import { useEffect, useMemo, useRef, useState } from 'react';
import { Board, type BoardHandle } from '../rendering/board';
import { AnimQueue, type AnimSpeed } from '../rendering/animations';
import { BattleHUD } from './BattleHUD';
import { LinkCutin } from './LinkCutin';
import type { BattleSim } from '../game/systems/battle';
import type { CharId, Vec3 } from '../game/types';
import { play } from '../audio/cues';

export function BattleScreen({
  sim,
  speed,
  music,
  onEnd,
  onAbort,
  onSpeed,
}: {
  sim: BattleSim;
  speed: AnimSpeed;
  music: string;
  onEnd: (win: boolean) => void;
  onAbort: () => void;
  onSpeed: (s: AnimSpeed) => void;
}) {
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<CharId | null>(null);
  const [linkShow, setLinkShow] = useState<string | null>(null);
  const anim = useMemo(() => new AnimQueue(), [sim]);
  const board = useRef<BoardHandle | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    anim.setSpeed(speed);
  }, [anim, speed]);

  useEffect(() => {
    play(music as 'music.bastion.battle');
  }, [music]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (paused) return;
      const mul = speed === 'fast' ? 1.65 : speed === 'skip' ? 3.2 : 1;
      const ev = sim.step(dt * mul);
      if (ev.length) anim.push(ev);
      if (sim.core.hp <= sim.core.maxHp * 0.35 && music !== 'music.bastion.boss') {
        play('music.bastion.critical');
      }
      if ((sim.win || sim.lose) && !ended.current) {
        ended.current = true;
        setTimeout(() => onEnd(sim.win), speed === 'skip' ? 200 : 900);
      }
      setTick((t) => t + 1);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, paused, speed, anim, onEnd, music]);

  const reduced = typeof navigator !== 'undefined' && ((window.innerWidth < 500) || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4);

  function deployTo(slotId: string, unit?: string): void {
    const id = unit ?? selected;
    if (!id) return;
    const v = sim.valkyries.find((x) => x.id === id);
    if (!v) return;
    if (v.deployed) sim.applyAction({ type: 'shift', unitId: id, slotId });
    else sim.applyAction({ type: 'deploy', unitId: id, slotId });
    play('sfx.deploy');
    setDragging(null);
  }

  return (
    <div className="battle-root" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const slot = board.current?.pickSlot(e.clientX, e.clientY); if (slot) deployTo(slot); }}>
      <Board
        sim={sim}
        version={tick}
        anim={anim}
        speed={speed}
        reduced={reduced}
        selected={selected}
        onReady={(h) => {
          board.current = h;
        }}
        onSlotHit={(id) => deployTo(id)}
        onUnitHit={(id) => {
          setSelected(id);
          const v = sim.valkyries.find((x) => x.id === id);
          if (v && v.energy >= 100) {
            sim.applyAction({ type: 'ult', unitId: id });
            play('sfx.ult');
          }
        }}
        onAccel={() => sim.applyAction({ type: 'accel' })}
        onGround={(p: Vec3) => {
          if (sim.valkyries.some((v) => v.charId === 'aria' && v.deployed)) {
            sim.applyAction({ type: 'aria_mark', pos: p });
          }
        }}
      />
      <BattleHUD
        sim={sim}
        paused={paused}
        inspect={selected}
        linkReady={sim.readyLink()}
        selected={selected}
        dragging={dragging}
        onSelect={(id) => {
          setSelected(id);
          const v = sim.valkyries.find((x) => x.id === id);
          if (v && !v.deployed) setDragging(v.charId!);
        }}
        onUlt={(id) => {
          sim.applyAction({ type: 'ult', unitId: id });
          play('sfx.ult');
        }}
        onActive={(id) => sim.applyAction({ type: 'active', unitId: id })}
        onLink={() => {
          const id = sim.readyLink();
          sim.applyAction({ type: 'link' });
          if (id) {
            setLinkShow(id);
            play('sfx.link.ready');
            setTimeout(() => setLinkShow(null), 2200);
          }
        }}
        onAccel={() => sim.applyAction({ type: 'accel' })}
        onPause={() => setPaused(true)}
        onResume={() => setPaused(false)}
        onSkip={() => {
          onSpeed('skip');
          anim.skipAll();
        }}
        onFast={() => onSpeed('fast')}
        onMenu={onAbort}
      />
      {linkShow && <LinkCutin id={linkShow} onSkip={() => setLinkShow(null)} />}
      <div className="dock">
        {sim.valkyries.map((v) => (
          <button
            key={v.id}
            className={`dock-item ${dragging === v.charId ? 'on' : ''}`}
            draggable
            onDragStart={() => { setDragging(v.charId!); setSelected(v.id); }}
            onClick={() => {
              setSelected(v.id);
              setDragging(v.charId!);
            }}
          >
            {v.name}
          </button>
        ))}
      </div>
    </div>
  );
}
