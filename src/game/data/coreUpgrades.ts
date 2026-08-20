import type { CoreUpgradeDef } from '../types';

export const CORE_UPGRADES: CoreUpgradeDef[] = [
  { id: 'integrity_plus', name: '完整強化', nameEn: 'Integrity +2', desc: '靈核完整 +2。' },
  { id: 'move_plus', name: '靈脈加速', nameEn: 'Move +15%', desc: '靈核移動速度 +15%。' },
  { id: 'aura_slow', name: '遲滯光環', nameEn: 'Aura Slow', desc: '靈核周圍敵人減速 10%。' },
  { id: 'auto_repair', name: '檢查點自修', nameEn: 'Auto Repair', desc: '通過檢查點時自動修復 1 點完整。' },
  { id: 'reflect_melee', name: '近戰反傷', nameEn: 'Reflect 10%', desc: '將 10% 近戰傷害反射給攻擊者。' },
];

export const CORE_BY_ID = Object.fromEntries(CORE_UPGRADES.map((c) => [c.id, c]));
