import type { CharId, RewardCategory, RewardOffer, RunState } from '../types';
import { MODS } from '../data/mods';
import { RELICS } from '../data/relics';
import { CORE_UPGRADES } from '../data/coreUpgrades';
import { LINKS } from '../data/links';
import { CHARACTERS } from '../data/characters';
import { RNG } from './battle';

const GADGETS = [
  { id: 'accel_tune', name: '節點校準', nameEn: 'Accel Tune', desc: '加速節點持續時間 +2 秒。' },
  { id: 'slot_brace', name: '格位加固', nameEn: 'Slot Brace', desc: '被打落部署格的暈眩縮短。' },
  { id: 'path_lantern', name: '脈燈', nameEn: 'Path Lantern', desc: '靈核光環減速 +5%。' },
];

export function rollRewards(run: RunState, categories: RewardCategory[], count = 3): RewardOffer[] {
  const rng = new RNG(run.seed + run.nodeIndex * 97 + run.mods.length * 13);
  const pool: RewardOffer[] = [];
  const cats = categories.length ? categories : (['mod', 'relic', 'core', 'recruit', 'link', 'gadget'] as RewardCategory[]);
  for (const cat of cats) pool.push(...offersFor(cat, run));
  const unique: RewardOffer[] = [];
  const seen = new Set<string>();
  for (const o of pool) {
    if (seen.has(o.id) || owned(run, o)) continue;
    seen.add(o.id);
    unique.push(o);
  }
  const picks: RewardOffer[] = [];
  const bag = unique.slice();
  while (picks.length < count && bag.length) {
    const i = rng.int(0, bag.length - 1);
    picks.push(bag.splice(i, 1)[0]);
  }
  while (picks.length < count && unique.length) picks.push(unique[picks.length % unique.length]);
  return picks.slice(0, count);
}

function owned(run: RunState, o: RewardOffer): boolean {
  return (
    run.mods.includes(o.id) ||
    run.relics.includes(o.id) ||
    run.coreUpgrades.includes(o.id) ||
    run.linkUpgrades.includes(o.id) ||
    run.gadgets.includes(o.id) ||
    run.team.includes(o.id as CharId) ||
    run.recruited.includes(o.id as CharId)
  );
}

function offersFor(cat: RewardCategory, run: RunState): RewardOffer[] {
  if (cat === 'mod') return MODS.map((m) => ({ category: cat, id: m.id, name: m.name, nameEn: m.nameEn, desc: m.desc }));
  if (cat === 'relic') return RELICS.map((m) => ({ category: cat, id: m.id, name: m.name, nameEn: m.nameEn, desc: m.desc }));
  if (cat === 'core') return CORE_UPGRADES.map((m) => ({ category: cat, id: m.id, name: m.name, nameEn: m.nameEn, desc: m.desc }));
  if (cat === 'link') return LINKS.map((m) => ({ category: cat, id: m.id, name: m.name, nameEn: m.nameEn, desc: m.desc }));
  if (cat === 'gadget') return GADGETS.map((m) => ({ category: cat, id: m.id, name: m.name, nameEn: m.nameEn, desc: m.desc }));
  if (cat === 'recruit') {
    return (Object.values(CHARACTERS) as { id: CharId; name: string; nameEn: string }[])
      .filter((c) => !run.team.includes(c.id) && !run.recruited.includes(c.id))
      .map((c) => ({ category: cat, id: c.id, name: c.name, nameEn: c.nameEn, desc: `本局招募 ${c.name}` }));
  }
  return [];
}

export function applyReward(run: RunState, offer: RewardOffer): RunState {
  const next = { ...run, mods: [...run.mods], relics: [...run.relics], coreUpgrades: [...run.coreUpgrades], linkUpgrades: [...run.linkUpgrades], gadgets: [...run.gadgets], recruited: [...run.recruited], team: [...run.team], bench: [...run.bench] };
  switch (offer.category) {
    case 'mod':
      if (!next.mods.includes(offer.id)) next.mods.push(offer.id);
      break;
    case 'relic':
      if (!next.relics.includes(offer.id)) next.relics.push(offer.id);
      break;
    case 'core':
      if (!next.coreUpgrades.includes(offer.id)) next.coreUpgrades.push(offer.id);
      break;
    case 'link':
      if (!next.linkUpgrades.includes(offer.id)) next.linkUpgrades.push(offer.id);
      break;
    case 'gadget':
      if (!next.gadgets.includes(offer.id)) next.gadgets.push(offer.id);
      break;
    case 'recruit': {
      const id = offer.id as CharId;
      if (!next.team.includes(id) && next.team.length < 4) next.team.push(id);
      else if (!next.bench.includes(id)) next.bench.push(id);
      if (!next.recruited.includes(id)) next.recruited.push(id);
      break;
    }
  }
  return next;
}

export { GADGETS };
