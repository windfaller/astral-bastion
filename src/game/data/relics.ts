import type { RelicDef } from '../types';

export const RELICS: RelicDef[] = [
  { id: 'first_shift_free', name: '先遣令', nameEn: 'First Shift Free', desc: '每場戰鬥第一次換位不消耗次數。', rule: 'first_shift_free' },
  { id: 'ricochet_platform', name: '高臺跳彈', nameEn: 'Ricochet Platform', desc: '高臺發射的投射物會再彈射至另一名敵人一次。', rule: 'ricochet' },
  { id: 'checkpoint_mercy', name: '檢查點恩典', nameEn: 'Checkpoint Mercy', desc: '靈核通過 t=0.33 與 0.66 時治療全體女武神。', rule: 'checkpoint_heal' },
  { id: 'collision_trauma', name: '對撞創傷', nameEn: 'Collision Trauma', desc: '擊退使敵人撞上另一名敵人時造成額外傷害。', rule: 'collision_damage' },
  { id: 'empty_slot_resonance', name: '空位共鳴', nameEn: 'Empty Slot Resonance', desc: '空部署格為相鄰單位充能。', rule: 'empty_charge' },
  { id: 'link_reroute', name: '連攜改道', nameEn: 'Link Reroute', desc: '連攜可將一名敵人改道至另一條支線一次。', rule: 'link_reroute' },
  { id: 'gate_tithe', name: '閘門什一', nameEn: 'Gate Tithe', desc: '閘門未毀時持續為隊伍充能。', rule: 'gate_energy' },
  { id: 'wraith_bane', name: '幽靈剋星', nameEn: 'Wraith Bane', desc: '攻擊可穿過阻擋命中幽靈。', rule: 'hit_wraith' },
  { id: 'overclock_node', name: '超頻節點', nameEn: 'Overclock Node', desc: '加速節點同時加快友軍投射物。', rule: 'fast_proj' },
  { id: 'second_wind', name: '再起', nameEn: 'Second Wind', desc: '本局首次倒下的女武神以 30% 生命復活一次。', rule: 'revive_once' },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));
export const START_RELIC_POOL = RELICS.map((r) => r.id);
