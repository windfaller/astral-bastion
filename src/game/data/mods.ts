import type { ModDef } from '../types';

export const MODS: ModDef[] = [
  { id: 'moon_edge', name: '月刃', nameEn: 'Moon Edge', desc: '凛的擊退距離 +30%。', target: 'rin' },
  { id: 'foxfire_radius', name: '狐火半徑', nameEn: 'Foxfire Radius', desc: '美緒結界範圍擴大。', target: 'mio' },
  { id: 'aegis_pulse', name: '神盾脈衝', nameEn: 'Aegis Pulse', desc: '艾莉莎阻擋時間 +1 秒。', target: 'alyssa' },
  { id: 'rail_overcharge', name: '軌道過載', nameEn: 'Rail Overcharge', desc: '伊芙穿透 +1（可再貫穿一道障礙）。', target: 'eve' },
  { id: 'shadow_step', name: '影步', nameEn: 'Shadow Step', desc: '蓮首次自潛行命中傷害加成。', target: 'ren' },
  { id: 'delayed_hex', name: '迅咒', nameEn: 'Delayed Hex', desc: '艾莉亞咒印更快引爆。', target: 'aria' },
  { id: 'shared_leyline', name: '共鳴靈脈', nameEn: 'Shared Leyline', desc: '全隊技能充能 +15%。', target: 'all' },
  { id: 'core_bond', name: '核緣', nameEn: 'Core Bond', desc: '靠近靈核的治療效果 +20%。', target: 'all' },
  { id: 'platform_discipline', name: '高臺紀律', nameEn: 'Platform Discipline', desc: '高臺單位攻擊速度提升。', target: 'all' },
  { id: 'blade_echo', name: '刃回聲', nameEn: 'Blade Echo', desc: '近戰攻擊造成小範圍濺射。', target: 'all' },
  { id: 'focus_fire', name: '集火', nameEn: 'Focus Fire', desc: '一波最後一名敵人受到傷害 +25%。', target: 'all' },
  { id: 'last_stand', name: '殘陣', nameEn: 'Last Stand', desc: '生命低於 30% 的單位傷害 +20%。', target: 'all' },
];

export const MOD_BY_ID = Object.fromEntries(MODS.map((m) => [m.id, m]));
