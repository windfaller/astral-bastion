import type { EventDef } from '../types';

export const EVENTS: EventDef[] = [
  {
    id: 'shrine',
    name: '月下社',
    nameEn: 'Moon Shrine',
    desc: '廢棄神社的狐火還在燃燒。獻上片刻安寧，或窺見美緒的殘影。',
    choices: [
      { id: 'heal', label: '祈願療傷', desc: '全體女武神回復 40% 生命（下場合成）。', effect: { kind: 'heal_team', value: 0.4 } },
      { id: 'preview', label: '窺見狐影', desc: '預覽並暫時理解美緒（本局可招募權重提升）。', effect: { kind: 'preview_char', charId: 'mio' } },
    ],
  },
  {
    id: 'abandoned_rail',
    name: '廢棄軌道',
    nameEn: 'Abandoned Rail',
    desc: '高架上留下伊芙校準過的軌道殘件。',
    choices: [
      { id: 'mod', label: '拾取過載核心', desc: '獲得 軌道過載 模組。', effect: { kind: 'grant_mod', modId: 'rail_overcharge' } },
      { id: 'relic', label: '拆下跳彈鏡', desc: '獲得 高臺跳彈 遺物。', effect: { kind: 'grant_relic', relicId: 'ricochet_platform' } },
    ],
  },
  {
    id: 'mirror_crossing',
    name: '鏡渡',
    nameEn: 'Mirror Crossing',
    desc: '靈脈在此對折。以完整換取破碎，或以破碎換取鋒利。',
    choices: [
      { id: 'risk', label: '踏入鏡中', desc: '靈核上限 -1，隨機獲得一件遺物。', effect: { kind: 'swap_integrity', value: -1 } },
      { id: 'safe', label: '繞道而行', desc: '無事發生。', effect: { kind: 'nothing' } },
    ],
  },
  {
    id: 'night_market',
    name: '夜市',
    nameEn: 'Night Market',
    desc: '高架下的黑市只收靈核的完整。',
    choices: [
      { id: 'buy', label: '付出 1 點完整', desc: '隨機獲得一件遺物。', effect: { kind: 'pay_integrity', value: 1 } },
      { id: 'leave', label: '離開', desc: '不交易。', effect: { kind: 'nothing' } },
    ],
  },
  {
    id: 'lost_valkyrie',
    name: '迷途女武神',
    nameEn: 'Lost Valkyrie',
    desc: '有人在支線盡頭等待被編入護衛。',
    choices: [
      { id: 'recruit', label: '伸出手', desc: '本局招募一名尚未解鎖的女武神。', effect: { kind: 'recruit' } },
      { id: 'pass', label: '繼續護送', desc: '不改變編成。', effect: { kind: 'nothing' } },
    ],
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
