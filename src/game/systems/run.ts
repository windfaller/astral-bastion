import type { CharId, RunState } from '../types';
import { RUN_NODES, getRunNode, getStage } from '../data/stages';
import { EVENTS } from '../data/events';
import { applyReward, rollRewards } from './rewards';
import { RNG } from './battle';

export function newRun(team: CharId[], seed: number, difficulty = 0): RunState {
  return {
    active: true,
    seed,
    nodeIndex: 0,
    team: team.slice(0, 4),
    bench: [],
    mods: [],
    relics: [],
    coreUpgrades: [],
    linkUpgrades: [],
    gadgets: [],
    integrityBonus: 0,
    recruited: [],
    secondWindUsed: false,
    difficulty,
  };
}

export function currentNode(run: RunState) {
  return getRunNode(run.nodeIndex);
}

export function prepareBattle(run: RunState) {
  const node = currentNode(run);
  if (!node?.stageId) return null;
  const stage = getStage(node.stageId);
  return {
    stage,
    seed: run.seed + run.nodeIndex * 1009,
    team: run.team,
    mods: run.mods,
    relics: run.relics,
    coreUpgrades: run.coreUpgrades,
    linkUpgrades: run.linkUpgrades,
    gadgets: run.gadgets,
    extraMutators: stage.mutators,
    integrityBonus: run.integrityBonus,
    secondWindUsed: run.secondWindUsed,
  };
}

export function afterBattleWin(run: RunState): RunState {
  const node = currentNode(run);
  let next: RunState = { ...run, lastResult: 'win', nodeIndex: run.nodeIndex + 1 };
  const upcoming = getRunNode(next.nodeIndex);
  if (upcoming?.kind === 'reward' || node?.kind === 'battle') {
    const stageId = node?.stageId;
    const cats = (stageId ? getStage(stageId).rewardCategories : ['mod', 'relic', 'core']) as import('../types').RewardCategory[];
    if (cats.length) next.pendingRewards = rollRewards(next, cats, 3);
  }
  if (upcoming?.kind === 'event') {
    const rng = new RNG(run.seed + 333 + run.nodeIndex);
    const pool = upcoming.eventPool ?? EVENTS.map((e) => e.id);
    next.pendingEvent = pool[rng.int(0, pool.length - 1)];
  }
  return next;
}

export function pickReward(run: RunState, offerId: string): RunState {
  const offer = run.pendingRewards?.find((o) => o.id === offerId);
  if (!offer) return { ...run, pendingRewards: undefined, nodeIndex: run.nodeIndex + (currentNode(run)?.kind === 'reward' ? 1 : 0) };
  let next = applyReward(run, offer);
  next.pendingRewards = undefined;
  if (currentNode(next)?.kind === 'reward') next = { ...next, nodeIndex: next.nodeIndex + 1 };
  return next;
}

export function skipToAfterReward(run: RunState): RunState {
  const n = currentNode(run);
  if (n?.kind === 'reward') return { ...run, pendingRewards: undefined, nodeIndex: run.nodeIndex + 1 };
  return { ...run, pendingRewards: undefined };
}

export function ensureEvent(run: RunState): RunState {
  const node = currentNode(run);
  if (node?.kind !== "event" || run.pendingEvent) return run;
  const rng = new RNG(run.seed + 333 + run.nodeIndex);
  const pool = node.eventPool ?? EVENTS.map((e) => e.id);
  return { ...run, pendingEvent: pool[rng.int(0, pool.length - 1)] };
}

export function applyEventChoice(run: RunState, eventId: string, choiceId: string, unlocked: CharId[]): RunState {
  const ev = EVENTS.find((e) => e.id === eventId);
  const ch = ev?.choices.find((c) => c.id === choiceId);
  if (!ch) return { ...run, pendingEvent: undefined, nodeIndex: run.nodeIndex + 1 };
  let next: RunState = { ...run, mods: [...run.mods], relics: [...run.relics], recruited: [...run.recruited], team: [...run.team], bench: [...run.bench] };
  const fx = ch.effect;
  if (fx.kind === 'heal_team') {
    /* applied as integrity bonus proxy */
    next.integrityBonus += 1;
  } else if (fx.kind === 'preview_char' && fx.charId) {
    if (!next.bench.includes(fx.charId) && !next.team.includes(fx.charId)) next.bench.push(fx.charId);
  } else if (fx.kind === 'grant_mod' && fx.modId && !next.mods.includes(fx.modId)) {
    next.mods.push(fx.modId);
  } else if (fx.kind === 'grant_relic' && fx.relicId && !next.relics.includes(fx.relicId)) {
    next.relics.push(fx.relicId);
  } else if (fx.kind === 'swap_integrity') {
    next.integrityBonus += fx.value ?? -1;
    const rng = new RNG(run.seed + 77);
    const relics = ['first_shift_free', 'collision_trauma', 'gate_tithe', 'wraith_bane'];
    const r = relics[rng.int(0, relics.length - 1)];
    if (!next.relics.includes(r)) next.relics.push(r);
  } else if (fx.kind === 'pay_integrity') {
    next.integrityBonus -= fx.value ?? 1;
    const rng = new RNG(run.seed + 88);
    const relics = ['ricochet_platform', 'checkpoint_mercy', 'empty_slot_resonance', 'overclock_node'];
    const r = relics[rng.int(0, relics.length - 1)];
    if (!next.relics.includes(r)) next.relics.push(r);
  } else if (fx.kind === 'recruit') {
    const locked: CharId[] = (['mio', 'ren', 'aria'] as CharId[]).filter((id) => !next.team.includes(id));
    const pick = locked[0];
    if (pick) {
      if (next.team.length < 4) next.team.push(pick);
      else next.bench.push(pick);
      next.recruited.push(pick);
    } else if (unlocked.length) {
      const extra = unlocked.find((id) => !next.team.includes(id));
      if (extra) next.bench.push(extra);
    }
  }
  next.pendingEvent = undefined;
  next.nodeIndex = run.nodeIndex + 1;
  return next;
}

export function restPick(run: RunState, kind: 'heal' | 'mod' | 'core'): RunState {
  const next: RunState = { ...run, mods: [...run.mods], coreUpgrades: [...run.coreUpgrades], nodeIndex: run.nodeIndex + 1 };
  if (kind === 'heal') next.integrityBonus += 1;
  if (kind === 'mod' && !next.mods.includes('shared_leyline')) next.mods.push('shared_leyline');
  if (kind === 'core' && !next.coreUpgrades.includes('auto_repair')) next.coreUpgrades.push('auto_repair');
  return next;
}

export function isRunVictory(run: RunState): boolean {
  return run.nodeIndex >= RUN_NODES.length - 1 && RUN_NODES[RUN_NODES.length - 1].kind === 'victory';
}

export { RUN_NODES };
