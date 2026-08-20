import type { LinkDef } from '../types';

export const LINKS: LinkDef[] = [
  {
    id: 'rin-mio',
    a: 'rin',
    b: 'mio',
    name: '月狐鎮魂',
    nameEn: 'Moonfox Requiem',
    desc: '沿整條靈脈釋放月刃與狐火：擊退、減速並治療靈核。',
  },
  {
    id: 'alyssa-eve',
    a: 'alyssa',
    b: 'eve',
    name: '鐵地平線',
    nameEn: 'Iron Horizon',
    desc: '展開盾牆並沿車道發射穿透軌道，暈眩敵人。',
  },
  {
    id: 'ren-aria',
    a: 'ren',
    b: 'aria',
    name: '緋紅殘影',
    nameEn: 'Crimson Phantom',
    desc: '標記後處刑聚集的敵人；若持有連攜改道可轉移一名敵人。',
  },
];

export const LINK_BY_ID = Object.fromEntries(LINKS.map((l) => [l.id, l]));

export function linkFor(a: string, b: string): LinkDef | undefined {
  return LINKS.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
}
