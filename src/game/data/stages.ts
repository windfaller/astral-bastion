import type { RunNodeDef, StageDef, WaveSpawn } from '../types';

function w(time: number, enemy: WaveSpawn['enemy'], path: WaveSpawn['path'], count = 1, interval = 0.7): WaveSpawn {
  return { time, enemy, path, count, interval };
}

export const STAGES: Record<string, StageDef> = {
  tutorial: {
    id: 'tutorial',
    name: '試行護送',
    nameEn: 'Tutorial Escort',
    kind: 'tutorial',
    battlefieldId: 'highway',
    waves: [
      {
        id: 't1',
        spawns: [
          w(10.0, 'shade', 'feederA', 2, 1.1),
          w(20.0, 'shade', 'feederA', 2, 1.0),
          w(36.0, 'runner', 'feederA', 1),
        ],
      },
    ],
    mutators: [],
    coreSpeed: 0.0135,
    coreIntegrity: 12,
    winT: 0.98,
    music: 'music.bastion.battle',
    criticalMusic: 'music.bastion.critical',
    rewardCategories: ['mod', 'relic', 'core'],
    tutorialHints: [
      '將女武神拖曳到高臺或地面部署格。',
      '點擊靈脈加速節點，讓靈核短暫加速。',
      '守住靈核完整，護送至星界之門。',
    ],
  },
  normal: {
    id: 'normal',
    name: '雙線匯流',
    nameEn: 'Twin Feeders',
    kind: 'normal',
    battlefieldId: 'highway',
    waves: [
      {
        id: 'n1',
        spawns: [
          w(1.5, 'shade', 'feederA', 3, 0.8),
          w(4.0, 'shade', 'feederB', 2, 0.9),
          w(12.0, 'runner', 'feederB', 2, 1.2),
          w(14.0, 'shield_drone', 'feederA', 1),
          w(20.0, 'jammer', 'feederB', 1),
          w(24.0, 'shade', 'feederA', 3, 0.7),
          w(26.0, 'wraith', 'feederB', 2, 1.0),
          w(34.0, 'bomb_carrier', 'feederA', 1),
          w(38.0, 'shade', 'feederB', 3, 0.65),
        ],
      },
    ],
    mutators: [],
    coreSpeed: 0.0128,
    coreIntegrity: 8,
    winT: 0.98,
    music: 'music.bastion.battle',
    criticalMusic: 'music.bastion.critical',
    rewardCategories: ['mod', 'relic', 'recruit', 'core'],
  },
  elite: {
    id: 'elite',
    name: '處刑夜',
    nameEn: 'Execution Night',
    kind: 'elite',
    battlefieldId: 'highway',
    waves: [
      {
        id: 'e1',
        spawns: [
          w(2.0, 'shade', 'feederA', 3, 0.7),
          w(3.0, 'runner', 'feederB', 2, 0.8),
          w(10.0, 'executioner', 'feederA', 1),
          w(12.0, 'jammer', 'feederB', 1),
          w(16.0, 'shield_drone', 'feederB', 1),
          w(20.0, 'wraith', 'feederA', 2, 0.9),
          w(26.0, 'bomb_carrier', 'feederB', 1),
          w(30.0, 'shade', 'feederA', 4, 0.55),
          w(36.0, 'runner', 'feederB', 3, 0.6),
        ],
      },
    ],
    mutators: ['night_rush'],
    coreSpeed: 0.0122,
    coreIntegrity: 8,
    winT: 0.98,
    music: 'music.bastion.critical',
    criticalMusic: 'music.bastion.critical',
    rewardCategories: ['relic', 'link', 'gadget', 'mod'],
  },
  boss: {
    id: 'boss',
    name: 'YAMATO-0',
    nameEn: 'YAMATO-0',
    kind: 'boss',
    battlefieldId: 'highway',
    waves: [
      {
        id: 'b1',
        spawns: [
          w(1.0, 'yamato', 'main', 1),
          w(6.0, 'shade', 'feederA', 2, 0.8),
          w(8.0, 'shade', 'feederB', 2, 0.8),
          w(18.0, 'jammer', 'feederA', 1),
          w(22.0, 'runner', 'feederB', 2, 0.7),
          w(32.0, 'wraith', 'feederA', 2, 0.8),
          w(40.0, 'bomb_carrier', 'feederB', 1),
          w(48.0, 'shield_drone', 'feederA', 1),
        ],
      },
    ],
    mutators: [],
    coreSpeed: 0.0114,
    coreIntegrity: 8,
    winT: 0.98,
    music: 'music.bastion.boss',
    criticalMusic: 'music.bastion.boss',
    cameraIntro: 'boss_intro',
    rewardCategories: [],
  },
};

export const RUN_NODES: RunNodeDef[] = [
  { id: 'n1', index: 0, kind: 'battle', stageId: 'tutorial', label: '試行護送', labelEn: 'Tutorial' },
  { id: 'n2', index: 1, kind: 'battle', stageId: 'normal', label: '雙線匯流', labelEn: 'Twin Feeders' },
  { id: 'n3', index: 2, kind: 'reward', label: '戰利拾取', labelEn: 'Rewards' },
  { id: 'n4', index: 3, kind: 'event', eventPool: ['shrine', 'abandoned_rail', 'mirror_crossing', 'night_market', 'lost_valkyrie'], label: '夜遇 / 招募', labelEn: 'Event' },
  { id: 'n5', index: 4, kind: 'battle', stageId: 'elite', label: '精英處刑', labelEn: 'Elite' },
  { id: 'n6', index: 5, kind: 'rest', label: '休整升級', labelEn: 'Rest' },
  { id: 'n7', index: 6, kind: 'boss', stageId: 'boss', label: 'YAMATO-0', labelEn: 'Boss' },
  { id: 'n8', index: 7, kind: 'victory', label: '星界之門', labelEn: 'Victory' },
];

export function getStage(id: string): StageDef {
  const s = STAGES[id];
  if (!s) throw new Error(`unknown stage ${id}`);
  return s;
}

export function getRunNode(index: number): RunNodeDef | undefined {
  return RUN_NODES[index];
}
