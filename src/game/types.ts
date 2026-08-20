export type CharId = 'rin' | 'mio' | 'alyssa' | 'eve' | 'ren' | 'aria';
export type EnemyId =
  | 'shade'
  | 'runner'
  | 'shield_drone'
  | 'wraith'
  | 'jammer'
  | 'bomb_carrier'
  | 'executioner'
  | 'yamato';
export type PathId = 'main' | 'feederA' | 'feederB' | 'reroute';
export type SlotKind = 'platform' | 'ground';
export type Role = 'melee' | 'guardian' | 'ranged' | 'support' | 'assassin' | 'mage';
export type ScreenId =
  | 'menu'
  | 'team'
  | 'collection'
  | 'map'
  | 'prep'
  | 'battle'
  | 'reward'
  | 'event'
  | 'rest'
  | 'victory'
  | 'defeat'
  | 'settings';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type BattleEventType =
  | 'UNIT_DEPLOYED'
  | 'UNIT_UNDEPLOYED'
  | 'PROJECTILE_FIRED'
  | 'UNIT_HIT'
  | 'UNIT_KNOCKED_BACK'
  | 'UNIT_DOWN'
  | 'UNIT_REVIVE'
  | 'ROUTE_CHANGED'
  | 'CORE_DAMAGED'
  | 'CORE_HEALED'
  | 'CORE_MOVED'
  | 'LINK_TRIGGERED'
  | 'BOSS_PHASE_CHANGED'
  | 'GATE_DAMAGED'
  | 'GATE_DESTROYED'
  | 'PLATFORM_JAMMED'
  | 'PLATFORM_RESTORED'
  | 'SLOT_LOCKED'
  | 'ACCEL_ACTIVATED'
  | 'ARIA_MARK_PLACED'
  | 'ARIA_MARK_DETONATE'
  | 'SKILL_CAST'
  | 'ULT_CAST'
  | 'WAVE_SPAWN'
  | 'CHECKPOINT'
  | 'TELEGRAPH'
  | 'BATTLE_WIN'
  | 'BATTLE_LOSE'
  | 'SHIFT_USED'
  | 'COLLISION_TRAUMA';

export interface BattleEvent {
  type: BattleEventType;
  time: number;
  tick: number;
  sourceId?: string;
  targetId?: string;
  targetIds?: string[];
  pathId?: PathId;
  t?: number;
  pos?: Vec3;
  endPos?: Vec3;
  amount?: number;
  knocked?: boolean;
  pierce?: boolean;
  skillId?: string;
  linkId?: string;
  slotId?: string;
  phase?: number;
  message?: string;
  seed?: number;
}

export interface StatusEffect {
  id: string;
  kind: 'slow' | 'stun' | 'mark' | 'shield' | 'invuln' | 'taunt' | 'block' | 'stealth' | 'jam' | 'knock';
  until: number;
  value: number;
}

export interface CharacterDef {
  id: CharId;
  name: string;
  nameEn: string;
  role: Role;
  tags: string[];
  linkPartner: CharId;
  hp: number;
  atk: number;
  range: number;
  atkInterval: number;
  energyRate: number;
  isMelee: boolean;
  color: string;
  silhouette: string;
  auto: { id: string; name: string; nameEn: string; desc: string };
  passive: { id: string; name: string; nameEn: string; desc: string };
  active: { id: string; name: string; nameEn: string; desc: string; cd: number };
  ult: { id: string; name: string; nameEn: string; desc: string };
  anim: string;
  skin: { id: string; name: string; nameEn: string };
  startUnlocked: boolean;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  nameEn: string;
  hp: number;
  atk: number;
  range: number;
  speed: number;
  atkInterval: number;
  radius: number;
  isMelee: boolean;
  isSmall: boolean;
  isBoss: boolean;
  ai: EnemyAiGoal;
  color: string;
  desc: string;
  tags: string[];
}

export type EnemyAiGoal =
  | 'attack_core'
  | 'rush_core'
  | 'break_gate'
  | 'disable_platform'
  | 'prioritize_support'
  | 'explode_core'
  | 'elite_displace'
  | 'boss';

export interface WaveSpawn {
  time: number;
  enemy: EnemyId;
  path: PathId;
  count?: number;
  interval?: number;
}

export interface WaveDef {
  id: string;
  spawns: WaveSpawn[];
}

export interface DeploySlotDef {
  id: string;
  kind: SlotKind;
  pos: Vec3;
  lockable?: boolean;
}

export interface ObstacleDef {
  id: string;
  kind: 'gate' | 'pylon' | 'crate';
  pos: Vec3;
  size: Vec3;
  opaque: boolean;
  destructible?: boolean;
  hp?: number;
}

export interface BridgeDef {
  t0: number;
  t1: number;
  height: number;
}

export interface AccelNodeDef {
  id: string;
  pos: Vec3;
  duration: number;
  multiplier: number;
}

export interface BattlefieldDef {
  id: string;
  name: string;
  paths: Record<PathId, { points: Vec3[]; mergeInto?: { path: PathId; t: number } }>;
  bridge: BridgeDef;
  slots: DeploySlotDef[];
  obstacles: ObstacleDef[];
  accel: AccelNodeDef;
  gate: { pos: Vec3; hp: number };
  astralGate: { pos: Vec3; t: number };
  crates: Vec3[];
  camera: { pos: Vec3; target: Vec3; fov: number };
  music: string;
}

export interface StageDef {
  id: string;
  name: string;
  nameEn: string;
  kind: 'tutorial' | 'normal' | 'elite' | 'boss';
  battlefieldId: string;
  waves: WaveDef[];
  mutators: string[];
  coreSpeed: number;
  coreIntegrity: number;
  winT: number;
  music: string;
  criticalMusic: string;
  cameraIntro?: string;
  rewardCategories: RewardCategory[];
  tutorialHints?: string[];
}

export type RewardCategory =
  | 'mod'
  | 'relic'
  | 'recruit'
  | 'core'
  | 'link'
  | 'gadget';

export interface RunNodeDef {
  id: string;
  index: number;
  kind: 'battle' | 'reward' | 'event' | 'rest' | 'boss' | 'victory';
  stageId?: string;
  eventPool?: string[];
  label: string;
  labelEn: string;
}

export interface ModDef {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  target?: CharId | 'all';
}

export interface RelicDef {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  rule: string;
}

export interface EventChoice {
  id: string;
  label: string;
  desc: string;
  effect: EventEffect;
}

export interface EventEffect {
  kind:
    | 'heal_team'
    | 'preview_char'
    | 'grant_mod'
    | 'grant_relic'
    | 'swap_integrity'
    | 'pay_integrity'
    | 'recruit'
    | 'nothing';
  value?: number;
  modId?: string;
  relicId?: string;
  charId?: CharId;
}

export interface EventDef {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  choices: EventChoice[];
}

export interface CoreUpgradeDef {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
}

export interface LinkDef {
  id: string;
  a: CharId;
  b: CharId;
  name: string;
  nameEn: string;
  desc: string;
}

export interface MutatorDef {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
}

export interface CollectionEntryState {
  state: 'owned' | 'seen' | 'unknown';
}

export interface MetaSave {
  version: 1;
  unlockedChars: CharId[];
  unlockedSkins: string[];
  unlockedRelics: string[];
  seenChars: CharId[];
  seenEnemies: EnemyId[];
  seenRelics: string[];
  seenLinks: string[];
  seenBoss: boolean;
  difficulty: number;
  clears: number;
  memories: string[];
}

export interface RunState {
  active: boolean;
  seed: number;
  nodeIndex: number;
  team: CharId[];
  bench: CharId[];
  mods: string[];
  relics: string[];
  coreUpgrades: string[];
  linkUpgrades: string[];
  gadgets: string[];
  integrityBonus: number;
  recruited: CharId[];
  secondWindUsed: boolean;
  lastResult?: 'win' | 'lose';
  pendingRewards?: RewardOffer[];
  pendingEvent?: string;
  difficulty: number;
}

export interface RewardOffer {
  category: RewardCategory;
  id: string;
  name: string;
  nameEn: string;
  desc: string;
}

export interface SettingsState {
  animSpeed: 'normal' | 'fast' | 'skip';
  mute: boolean;
}

export interface AriaMark {
  id: string;
  pos: Vec3;
  pathId: PathId;
  t: number;
  radius: number;
  detonateAt: number;
  damage: number;
  sourceId: string;
  ult: boolean;
}

export interface PlatformRuntime {
  id: string;
  jammed: boolean;
  jammedUntil: number;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function mul(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function len(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function norm(a: Vec3): Vec3 {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function cloneVec(a: Vec3): Vec3 {
  return { x: a.x, y: a.y, z: a.z };
}
