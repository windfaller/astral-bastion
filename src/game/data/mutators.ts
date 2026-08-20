import type { MutatorDef } from '../types';

export const MUTATORS: MutatorDef[] = [
  { id: 'night_rush', name: '夜襲', nameEn: 'Night Rush', desc: '更多疾影出現在支線上。' },
  { id: 'jammed_grid', name: '干擾電網', nameEn: 'Jammed Grid', desc: '一處高臺開場即被關閉。' },
  { id: 'cracked_gate', name: '裂閘', nameEn: 'Cracked Gate', desc: '閘門只有 50% 耐久。' },
];

export const MUTATOR_BY_ID = Object.fromEntries(MUTATORS.map((m) => [m.id, m]));
