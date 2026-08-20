import type { CharId, EnemyId, MetaSave, RunState, SettingsState } from '../types';

export const SAVE_KEY = 'astral-bastion-save-v1';

export const DEFAULT_META: MetaSave = {
  version: 1,
  unlockedChars: ['rin', 'alyssa', 'eve'],
  unlockedSkins: [],
  unlockedRelics: [],
  seenChars: ['rin', 'alyssa', 'eve'],
  seenEnemies: [],
  seenRelics: [],
  seenLinks: [],
  seenBoss: false,
  difficulty: 0,
  clears: 0,
  memories: [],
};

export const DEFAULT_SETTINGS: SettingsState = {
  animSpeed: 'normal',
  mute: false,
};

export interface SaveBlob {
  meta: MetaSave;
  run: RunState | null;
  settings: SettingsState;
}

export function loadSave(): SaveBlob {
  if (typeof localStorage === 'undefined') {
    return { meta: { ...DEFAULT_META }, run: null, settings: { ...DEFAULT_SETTINGS } };
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { meta: { ...DEFAULT_META }, run: null, settings: { ...DEFAULT_SETTINGS } };
    const parsed = JSON.parse(raw) as SaveBlob;
    return {
      meta: { ...DEFAULT_META, ...parsed.meta },
      run: parsed.run ?? null,
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  } catch {
    return { meta: { ...DEFAULT_META }, run: null, settings: { ...DEFAULT_SETTINGS } };
  }
}

export function writeSave(blob: SaveBlob): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
}

export function applyClearRewards(meta: MetaSave): MetaSave {
  const next: MetaSave = {
    ...meta,
    unlockedChars: [...meta.unlockedChars],
    unlockedSkins: [...meta.unlockedSkins],
    unlockedRelics: [...meta.unlockedRelics],
    memories: [...meta.memories],
    seenBoss: true,
    clears: meta.clears + 1,
    difficulty: Math.min(3, meta.difficulty + 1),
  };
  const order: CharId[] = ['mio', 'ren', 'aria'];
  for (const id of order) {
    if (!next.unlockedChars.includes(id)) {
      next.unlockedChars.push(id);
      if (!next.seenChars.includes(id)) next.seenChars.push(id);
      break;
    }
  }
  const skins = ['rin_eclipse', 'aly_dawn', 'eve_void', 'mio_shrine'];
  for (const s of skins) {
    if (!next.unlockedSkins.includes(s)) {
      next.unlockedSkins.push(s);
      next.memories.push(`memory_${s}`);
      break;
    }
  }
  const relics = ['collision_trauma', 'wraith_bane', 'second_wind', 'overclock_node'];
  for (const r of relics) {
    if (!next.unlockedRelics.includes(r)) {
      next.unlockedRelics.push(r);
      if (!next.seenRelics.includes(r)) next.seenRelics.push(r);
      break;
    }
  }
  return next;
}

export function markSeenEnemy(meta: MetaSave, id: EnemyId): MetaSave {
  if (meta.seenEnemies.includes(id)) return meta;
  return { ...meta, seenEnemies: [...meta.seenEnemies, id] };
}
