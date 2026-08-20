import type { BattleEvent } from '../game/types';

export type AnimSpeed = 'normal' | 'fast' | 'skip';

export interface AnimItem {
  event: BattleEvent;
  startedAt: number;
  duration: number;
  done: boolean;
}

const DUR: Partial<Record<BattleEvent['type'], number>> = {
  UNIT_DEPLOYED: 0.35,
  PROJECTILE_FIRED: 0.28,
  UNIT_HIT: 0.18,
  UNIT_KNOCKED_BACK: 0.32,
  ROUTE_CHANGED: 0.5,
  CORE_DAMAGED: 0.4,
  LINK_TRIGGERED: 2.1,
  BOSS_PHASE_CHANGED: 2.4,
  ULT_CAST: 1.1,
  SKILL_CAST: 0.7,
  ARIA_MARK_PLACED: 0.3,
  ARIA_MARK_DETONATE: 0.55,
  TELEGRAPH: 1.4,
  GATE_DESTROYED: 0.8,
  BATTLE_WIN: 2.0,
  BATTLE_LOSE: 1.4,
};

export class AnimQueue {
  items: AnimItem[] = [];
  speed: AnimSpeed = 'normal';
  clock = 0;
  cinematic: { kind: string; until: number } | null = null;

  setSpeed(s: AnimSpeed): void {
    this.speed = s;
  }

  push(events: BattleEvent[]): void {
    for (const event of events) {
      const base = DUR[event.type] ?? 0.12;
      const duration = this.speed === 'skip' ? 0 : this.speed === 'fast' ? base * 0.45 : base;
      this.items.push({ event, startedAt: this.clock, duration, done: duration <= 0 });
      if (event.type === 'LINK_TRIGGERED' || event.type === 'BOSS_PHASE_CHANGED' || event.type === 'BATTLE_WIN' || event.type === 'ULT_CAST') {
        this.cinematic = { kind: event.type, until: this.clock + Math.min(2.5, duration + 0.3) };
      }
    }
  }

  update(dt: number): AnimItem[] {
    const mul = this.speed === 'fast' ? 1.8 : this.speed === 'skip' ? 99 : 1;
    this.clock += dt * mul;
    const live: AnimItem[] = [];
    for (const it of this.items) {
      if (this.clock - it.startedAt >= it.duration) it.done = true;
      else live.push(it);
    }
    this.items = this.items.filter((i) => this.clock - i.startedAt < Math.max(i.duration, 2.6));
    if (this.cinematic && this.clock >= this.cinematic.until) this.cinematic = null;
    return live;
  }

  skipAll(): void {
    for (const it of this.items) it.done = true;
    this.cinematic = null;
  }
}

export function poseFor(event: BattleEvent | undefined, charId?: string): 'idle' | 'attack' | 'skill' | 'hit' | 'down' | 'victory' {
  if (!event) return 'idle';
  if (event.type === 'BATTLE_WIN') return 'victory';
  if (event.type === 'UNIT_DOWN' && event.targetId === charId) return 'down';
  if (event.type === 'UNIT_HIT' && event.targetId === charId) return 'hit';
  if ((event.type === 'ULT_CAST' || event.type === 'SKILL_CAST' || event.type === 'LINK_TRIGGERED') && event.sourceId === charId) return 'skill';
  if (event.type === 'PROJECTILE_FIRED' && event.sourceId === charId) return 'attack';
  return 'idle';
}
