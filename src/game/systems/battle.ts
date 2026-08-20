import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { getBattlefield } from '../data/battlefields';
import { getStage } from '../data/stages';
import type {
  AriaMark,
  BattleEvent,
  BattlefieldDef,
  CharId,
  EnemyId,
  PathId,
  PlatformRuntime,
  StageDef,
  StatusEffect,
  Vec3,
} from '../types';
import { cloneVec, dist, mul, norm, sub, vec3 } from '../types';
import {
  aabbOverlapsRay,
  buildBattlefieldPaths,
  meleeCanEnter,
  nearestT,
  onBridge,
  samplePath,
  tangentAt,
  worldToPathT,
  type SampledPath,
} from './pathfinding';

export class RNG {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s += 0x6d2b79f5;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
}

export type UnitKind = 'valkyrie' | 'enemy' | 'core';

export interface SimUnit {
  id: string;
  kind: UnitKind;
  charId?: CharId;
  enemyId?: EnemyId;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  range: number;
  atkInterval: number;
  cooldown: number;
  energy: number;
  activeCd: number;
  pos: Vec3;
  pathId?: PathId;
  t: number;
  slotId?: string | null;
  deployed: boolean;
  facing: number;
  dead: boolean;
  downed: boolean;
  isMelee: boolean;
  isSmall: boolean;
  radius: number;
  speed: number;
  status: StatusEffect[];
  stunUntil: number;
  undeployUntil: number;
  stealthUntil: number;
  firstStrike: boolean;
  lastHitTime: number;
  blocking: boolean;
  blockUntil: number;
}

export interface PlayerAction {
  type: 'deploy' | 'shift' | 'ult' | 'active' | 'aria_mark' | 'accel' | 'link';
  unitId?: string;
  slotId?: string;
  pos?: Vec3;
}

export interface BattleConfig {
  seed: number;
  stageId: string;
  team: CharId[];
  mods: string[];
  relics: string[];
  coreUpgrades: string[];
  linkUpgrades: string[];
  gadgets: string[];
  extraMutators?: string[];
  integrityBonus?: number;
  secondWindUsed?: boolean;
  autoDeploy?: boolean;
}

export interface BattleSnapshot {
  time: number;
  tick: number;
  core: SimUnit;
  valkyries: SimUnit[];
  enemies: SimUnit[];
  gateHp: number;
  gateMax: number;
  gateDestroyed: boolean;
  platforms: PlatformRuntime[];
  accelUsed: boolean;
  accelUntil: number;
  shiftsLeft: number;
  linkEnergy: number;
  bossPhase: 1 | 2;
  slotLocked: string | null;
  destroyedSegment: { t0: number; t1: number } | null;
  useReroute: boolean;
  ariaMarks: AriaMark[];
  win: boolean;
  lose: boolean;
  loseReason?: string;
  kills: number;
  events: BattleEvent[];
}

const TICK = 1 / 20;

export class BattleSim {
  readonly cfg: BattleConfig;
  readonly stage: StageDef;
  readonly bf: BattlefieldDef;
  readonly paths: Record<PathId, SampledPath>;
  readonly rng: RNG;
  time = 0;
  tick = 0;
  core!: SimUnit;
  valkyries: SimUnit[] = [];
  enemies: SimUnit[] = [];
  events: BattleEvent[] = [];
  gateHp = 80;
  gateMax = 80;
  gateDestroyed = false;
  platforms: PlatformRuntime[] = [];
  accelUsed = false;
  accelUntil = 0;
  projSpeedMul = 1;
  shiftsLeft = 3;
  firstShiftConsumed = false;
  linkEnergy = 0;
  bossPhase: 1 | 2 = 1;
  slotLocked: string | null = null;
  destroyedSegment: { t0: number; t1: number } | null = null;
  useReroute = false;
  ariaMarks: AriaMark[] = [];
  win = false;
  lose = false;
  loseReason?: string;
  kills = 0;
  nextId = 1;
  spawnedKeys = new Set<string>();
  checkpoint33 = false;
  checkpoint66 = false;
  secondWindUsed: boolean;
  linkRerouteUsed = false;
  nextBossSummon = 8;
  nextBossSlash = 6;
  nextBossTele = 12;
  lateAutoDeployed = false;

  constructor(cfg: BattleConfig) {
    this.cfg = cfg;
    this.stage = getStage(cfg.stageId);
    this.bf = getBattlefield(this.stage.battlefieldId);
    this.paths = buildBattlefieldPaths(this.bf);
    this.rng = new RNG(cfg.seed);
    this.secondWindUsed = !!cfg.secondWindUsed;
    this.init();
    if (cfg.autoDeploy) this.autoDeployTeam();
  }

  hasMod(id: string): boolean {
    return this.cfg.mods.includes(id);
  }
  hasRelic(id: string): boolean {
    return this.cfg.relics.includes(id);
  }
  hasCore(id: string): boolean {
    return this.cfg.coreUpgrades.includes(id);
  }
  mutators(): string[] {
    return [...this.stage.mutators, ...(this.cfg.extraMutators ?? [])];
  }

  private nid(prefix: string): string {
    return `${prefix}_${this.nextId++}`;
  }

  private emit(e: Omit<BattleEvent, 'time' | 'tick'> & { time?: number; tick?: number }): BattleEvent {
    const ev: BattleEvent = { ...e, time: this.time, tick: this.tick };
    this.events.push(ev);
    return ev;
  }

  private init(): void {
    const integ = this.stage.coreIntegrity + (this.cfg.integrityBonus ?? 0) + (this.hasCore('integrity_plus') ? 2 : 0);
    const start = samplePath(this.paths.main, 0);
    this.core = {
      id: 'core',
      kind: 'core',
      name: 'Astral Core',
      hp: integ,
      maxHp: integ,
      atk: 0,
      range: 0,
      atkInterval: 99,
      cooldown: 0,
      energy: 0,
      activeCd: 0,
      pos: start,
      pathId: 'main',
      t: 0,
      deployed: true,
      facing: 0,
      dead: false,
      downed: false,
      isMelee: false,
      isSmall: false,
      radius: 0.55,
      speed: this.stage.coreSpeed * (this.hasCore('move_plus') ? 1.15 : 1),
      status: [],
      stunUntil: 0,
      undeployUntil: 0,
      stealthUntil: 0,
      firstStrike: false,
      lastHitTime: -99,
      blocking: false,
      blockUntil: 0,
    };

    this.valkyries = this.cfg.team.map((id) => {
      const c = CHARACTERS[id];
      return {
        id: id,
        kind: 'valkyrie' as const,
        charId: id,
        name: c.name,
        hp: c.hp,
        maxHp: c.hp,
        atk: c.atk,
        range: c.range,
        atkInterval: c.atkInterval,
        cooldown: 0.4,
        energy: 0,
        activeCd: 0,
        pos: vec3(-16, 0.1, 8),
        slotId: null,
        deployed: false,
        facing: 0,
        dead: false,
        downed: false,
        isMelee: c.isMelee,
        isSmall: false,
        radius: 0.4,
        speed: 0,
        status: [],
        stunUntil: 0,
        undeployUntil: 0,
        stealthUntil: id === 'ren' ? 8 : 0,
        firstStrike: id === 'ren',
        lastHitTime: -99,
        blocking: false,
        blockUntil: 0,
        t: 0,
      };
    });

    this.gateMax = this.bf.gate.hp * (this.mutators().includes('cracked_gate') ? 0.5 : 1);
    this.gateHp = this.gateMax;
    this.platforms = this.bf.slots.filter((s) => s.kind === 'platform').map((s) => ({
      id: s.id,
      jammed: false,
      jammedUntil: 0,
    }));
    if (this.mutators().includes('jammed_grid') && this.platforms[0]) {
      this.platforms[0].jammed = true;
      this.platforms[0].jammedUntil = 1e9;
      this.emit({ type: 'PLATFORM_JAMMED', slotId: this.platforms[0].id });
    }
  }

  autoDeployTeam(): void {
    const slots = this.bf.slots.filter((s) => s.id !== this.slotLocked);
    this.valkyries.forEach((v, i) => {
      const slot = slots[i];
      if (slot) this.deploy(v.id, slot.id);
    });
  }

  private maybeLateAutoDeploy(): void {
    if (this.lateAutoDeployed) return;
    if (this.time + 1e-6 < 8) return;
    this.lateAutoDeployed = true;
    if (this.valkyries.some((v) => v.deployed && !v.dead)) return;
    this.autoDeployTeam();
  }

  applyAction(action: PlayerAction): BattleEvent[] {
    const before = this.events.length;
    if (this.win || this.lose) return [];
    switch (action.type) {
      case 'deploy':
        if (action.unitId && action.slotId) this.deploy(action.unitId, action.slotId);
        break;
      case 'shift':
        if (action.unitId && action.slotId) this.shift(action.unitId, action.slotId);
        break;
      case 'ult':
        if (action.unitId) this.castUlt(action.unitId);
        break;
      case 'active':
        if (action.unitId) this.castActive(action.unitId, action.pos);
        break;
      case 'aria_mark':
        if (action.pos) this.placeAriaMark(action.pos, false);
        break;
      case 'accel':
        this.activateAccel();
        break;
      case 'link':
        this.fireLink();
        break;
    }
    return this.events.slice(before);
  }

  step(dt: number): BattleEvent[] {
    const before = this.events.length;
    let remain = dt;
    while (remain > 1e-6 && !this.win && !this.lose) {
      const slice = Math.min(TICK, remain);
      this.tickOnce(slice);
      remain -= slice;
    }
    return this.events.slice(before);
  }

  stepTicks(n: number): BattleEvent[] {
    const before = this.events.length;
    for (let i = 0; i < n && !this.win && !this.lose; i++) this.tickOnce(TICK);
    return this.events.slice(before);
  }

  private tickOnce(dt: number): void {
    this.time += dt;
    this.tick += 1;
    this.spawnWaves();
    this.maybeLateAutoDeploy();
    this.tickCore(dt);
    this.tickPlatforms(dt);
    this.tickValkyries(dt);
    this.tickEnemies(dt);
    this.tickMarks();
    this.tickLinks(dt);
    this.tickRelics(dt);
    this.checkEnd();
  }

  private spawnWaves(): void {
    if (this.mutators().includes('night_rush') && !this.spawnedKeys.has('nr')) {
      this.spawnedKeys.add('nr');
      this.spawnEnemy('runner', 'feederA');
      this.spawnEnemy('runner', 'feederB');
    }
    for (const wave of this.stage.waves) {
      for (let si = 0; si < wave.spawns.length; si++) {
        const sp = wave.spawns[si];
        const count = sp.count ?? 1;
        const interval = sp.interval ?? 0.6;
        for (let i = 0; i < count; i++) {
          const key = `${wave.id}:${si}:${i}`;
          const at = sp.time + i * interval;
          if (this.time + 1e-6 >= at && !this.spawnedKeys.has(key)) {
            this.spawnedKeys.add(key);
            this.spawnEnemy(sp.enemy, sp.path);
            this.emit({ type: 'WAVE_SPAWN', message: sp.enemy, pathId: sp.path });
          }
        }
      }
    }
  }

  private spawnEnemy(id: EnemyId, pathId: PathId): SimUnit {
    const d = ENEMIES[id];
    const path = this.paths[pathId] ?? this.paths.main;
    const u: SimUnit = {
      id: this.nid(id),
      kind: 'enemy',
      enemyId: id,
      name: d.name,
      hp: d.hp,
      maxHp: d.hp,
      atk: d.atk,
      range: d.range,
      atkInterval: d.atkInterval,
      cooldown: 0.2,
      energy: 0,
      activeCd: 0,
      pos: samplePath(path, 0.01),
      pathId,
      t: 0.01,
      deployed: true,
      facing: 0,
      dead: false,
      downed: false,
      isMelee: d.isMelee,
      isSmall: d.isSmall,
      radius: d.radius,
      speed: d.speed,
      status: [],
      stunUntil: 0,
      undeployUntil: 0,
      stealthUntil: 0,
      firstStrike: false,
      lastHitTime: -99,
      blocking: false,
      blockUntil: 0,
    };
    if (id === 'yamato') {
      u.t = 0.42;
      u.pathId = 'main';
      u.pos = samplePath(this.paths.main, 0.42);
    }
    this.enemies.push(u);
    this.emit({ type: 'UNIT_DEPLOYED', sourceId: u.id, pathId: u.pathId, t: u.t, pos: cloneVec(u.pos), message: id });
    return u;
  }

  private tickCore(dt: number): void {
    let pathId: PathId = this.useReroute && this.core.t >= 0.36 && this.core.t <= 0.66 ? 'reroute' : 'main';
    if (this.destroyedSegment && this.core.t >= this.destroyedSegment.t0 && this.core.t <= this.destroyedSegment.t1) {
      pathId = 'reroute';
      this.useReroute = true;
    }
    this.core.pathId = pathId;
    const path = this.paths[pathId];
    const mulSp = this.time < this.accelUntil ? this.bf.accel.multiplier : 1;
    this.core.t = Math.min(1, this.core.t + this.core.speed * mulSp * dt);
    this.core.pos = samplePath(path, pathId === 'reroute' ? (this.core.t - 0.36) / 0.3 : this.core.t);
    if (!this.checkpoint33 && this.core.t >= 0.33) {
      this.checkpoint33 = true;
      this.onCheckpoint();
    }
    if (!this.checkpoint66 && this.core.t >= 0.66) {
      this.checkpoint66 = true;
      this.onCheckpoint();
    }
    if (this.hasCore('aura_slow')) {
      for (const e of this.aliveEnemies()) {
        if (dist(e.pos, this.core.pos) < 3.2) this.addStatus(e, { id: 'aura', kind: 'slow', until: this.time + 0.2, value: 0.1 });
      }
    }
  }

  private onCheckpoint(): void {
    this.emit({ type: 'CHECKPOINT', t: this.core.t, pos: cloneVec(this.core.pos) });
    if (this.hasRelic('checkpoint_mercy')) {
      for (const v of this.valkyries) {
        if (!v.dead) v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.35);
      }
    }
    if (this.hasCore('auto_repair')) {
      this.core.hp = Math.min(this.core.maxHp, this.core.hp + 1);
      this.emit({ type: 'CORE_HEALED', amount: 1, targetId: 'core' });
    }
  }

  private tickPlatforms(dt: number): void {
    for (const p of this.platforms) {
      if (p.jammed && p.jammedUntil < 1e8 && this.time >= p.jammedUntil) {
        p.jammed = false;
        this.emit({ type: 'PLATFORM_RESTORED', slotId: p.id });
      }
    }
    for (const e of this.aliveEnemies()) {
      if (e.enemyId !== 'jammer') continue;
      for (const slot of this.bf.slots.filter((s) => s.kind === 'platform')) {
        if (dist(e.pos, slot.pos) < 3.4) {
          const pr = this.platforms.find((p) => p.id === slot.id);
          if (pr && !pr.jammed) {
            pr.jammed = true;
            pr.jammedUntil = this.time + 6;
            this.emit({ type: 'PLATFORM_JAMMED', slotId: slot.id, sourceId: e.id });
          }
        }
      }
    }
  }

  private tickValkyries(dt: number): void {
    const chargeMul = this.hasMod('shared_leyline') ? 1.15 : 1;
    for (const v of this.valkyries) {
      if (v.dead) continue;
      if (v.undeployUntil > this.time) continue;
      if (!v.deployed || !v.slotId) continue;
      const slot = this.bf.slots.find((s) => s.id === v.slotId);
      if (!slot) continue;
      v.pos = cloneVec(slot.pos);
      if (v.blocking && this.time > v.blockUntil) v.blocking = false;
      if (v.blocking) {
        const pt = nearestT(this.paths.main, v.pos);
        v.pos = samplePath(this.paths.main, pt);
      }
      v.cooldown = Math.max(0, v.cooldown - dt);
      v.activeCd = Math.max(0, v.activeCd - dt);
      v.energy = Math.min(100, v.energy + CHARACTERS[v.charId!].energyRate * dt * chargeMul);
      if (this.hasRelic('empty_slot_resonance')) {
        const adjEmpty = this.bf.slots.some((s) => s.id !== v.slotId && !this.occupant(s.id) && dist(s.pos, v.pos) < 6);
        if (adjEmpty) v.energy = Math.min(100, v.energy + 4 * dt);
      }
      if (v.charId === 'mio') this.mioPassive(v, dt);
      if (v.cooldown <= 0) this.autoAttack(v);
    }
  }

  private mioPassive(v: SimUnit, dt: number): void {
    const healMul = this.hasMod('core_bond') && dist(v.pos, this.core.pos) < 5 ? 1.2 : 1;
    for (const a of this.valkyries) {
      if (a.dead || !a.deployed) continue;
      if (dist(a.pos, v.pos) < 5.5) a.hp = Math.min(a.maxHp, a.hp + 2.2 * dt * healMul);
    }
  }

  private autoAttack(v: SimUnit): void {
    const target = this.pickTarget(v);
    if (!target) return;
    v.cooldown = this.atkIntervalOf(v);
    this.face(v, target.pos);
    this.fireAttack(v, target, false);
  }

  private atkIntervalOf(v: SimUnit): number {
    let iv = v.atkInterval;
    if (this.isOnPlatform(v) && this.hasMod('platform_discipline')) iv *= 0.82;
    return iv;
  }

  private rangeOf(v: SimUnit): number {
    let r = v.range;
    if (this.isOnPlatform(v)) {
      r *= v.charId === 'eve' ? 1.55 : 1.28;
    }
    const plat = this.platforms.find((p) => p.id === v.slotId);
    if (plat?.jammed) r *= 0.55;
    return r;
  }

  isOnPlatform(v: SimUnit): boolean {
    if (!v.slotId) return false;
    const slot = this.bf.slots.find((s) => s.id === v.slotId);
    const plat = this.platforms.find((p) => p.id === v.slotId);
    return slot?.kind === 'platform' && !plat?.jammed;
  }

  private occupant(slotId: string): SimUnit | undefined {
    return this.valkyries.find((v) => v.deployed && v.slotId === slotId && !v.dead);
  }

  private pickTarget(v: SimUnit): SimUnit | null {
    const r = this.rangeOf(v);
    let best: SimUnit | null = null;
    let bestScore = Infinity;
    for (const e of this.aliveEnemies()) {
      const d = dist(v.pos, e.pos);
      if (d > r) continue;
      if (v.isMelee && this.blockedByBridge(v, e)) continue;
      if (!this.hasLos(v.pos, e.pos, e) && v.charId !== 'eve') continue;
      let score = d;
      if (v.charId === 'ren') {
        if (e.enemyId === 'jammer' || e.enemyId === 'bomb_carrier' || e.enemyId === 'wraith') score -= 8;
      }
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private blockedByBridge(from: SimUnit, to: SimUnit): boolean {
    if (!from.isMelee) return false;
    const fromGround = (from.pos.y ?? 0) < 1.1;
    if (to.pathId && onBridge(this.bf, to.pathId, to.t) && fromGround) return true;
    return false;
  }

  private hasLos(from: Vec3, to: Vec3, target?: SimUnit): boolean {
    if (target?.enemyId === 'wraith' && this.hasRelic('wraith_bane')) return true;
    const dir = sub(to, from);
    const maxD = dist(from, to);
    if (maxD < 0.01) return true;
    const nd = mul(norm(dir), 1);
    for (const ob of this.liveObstacles()) {
      const hit = aabbOverlapsRay(from, nd, ob.pos, ob.size);
      if (hit !== null && hit < maxD - 0.15) {
        if (target?.enemyId === 'wraith' && (ob.id === 'gate' || ob.kind === 'crate')) continue;
        return false;
      }
    }
    return true;
  }

  private liveObstacles() {
    return this.bf.obstacles.filter((o) => !(o.id === 'gate' && this.gateDestroyed));
  }

  private fireAttack(src: SimUnit, target: SimUnit, skill: boolean, opts?: { pierce?: boolean; dmgMul?: number; knock?: number }): void {
    const pierce = opts?.pierce || src.charId === 'eve';
    const dmgMul = opts?.dmgMul ?? 1;
    this.emit({
      type: 'PROJECTILE_FIRED',
      sourceId: src.id,
      targetId: target.id,
      pos: cloneVec(src.pos),
      endPos: cloneVec(target.pos),
      pierce,
      skillId: skill ? 'skill' : 'auto',
    });
    const hits = pierce ? this.rayHits(src, target) : [target];
    for (const h of hits) {
      this.dealDamage(src, h, src.atk * dmgMul, { knock: opts?.knock ?? (src.charId === 'rin' ? 0.018 : 0) });
    }
    if (this.hasRelic('ricochet_platform') && this.isOnPlatform(src) && !skill) {
      const extra = this.aliveEnemies().find((e) => e.id !== target.id && dist(e.pos, target.pos) < 5);
      if (extra) this.dealDamage(src, extra, src.atk * 0.55, {});
    }
    if (this.hasMod('blade_echo') && src.isMelee) {
      for (const e of this.aliveEnemies()) {
        if (e.id === target.id) continue;
        if (dist(e.pos, target.pos) < 1.6) this.dealDamage(src, e, src.atk * 0.3, {});
      }
    }
  }

  rayHits(src: SimUnit, toward: SimUnit): SimUnit[] {
    const dir = norm(sub(toward.pos, src.pos));
    const maxD = this.rangeOf(src) * (src.charId === 'eve' ? 1.15 : 1);
    let obstaclesPierceLeft = this.hasMod('rail_overcharge') && src.charId === 'eve' ? 1 : 0;
    let blockedAt = maxD;
    for (const ob of this.liveObstacles()) {
      const hit = aabbOverlapsRay(src.pos, dir, ob.pos, ob.size);
      if (hit !== null && hit < blockedAt && hit > 0.2) {
        if (obstaclesPierceLeft > 0) {
          obstaclesPierceLeft -= 1;
        } else {
          blockedAt = hit;
        }
      }
    }
    const hits: { e: SimUnit; d: number }[] = [];
    for (const e of this.aliveEnemies()) {
      const toE = sub(e.pos, src.pos);
      const along = toE.x * dir.x + toE.y * dir.y + toE.z * dir.z;
      if (along < 0.1 || along > blockedAt + 0.4) continue;
      const closest = vec3(src.pos.x + dir.x * along, e.pos.y, src.pos.z + dir.z * along);
      const xz = Math.hypot(closest.x - e.pos.x, closest.z - e.pos.z);
      if (xz <= e.radius + 0.75) hits.push({ e, d: along });
    }
    hits.sort((a, b) => a.d - b.d);
    return hits.map((h) => h.e);
  }

  private dealDamage(src: SimUnit | null, target: SimUnit, raw: number, opts: { knock?: number; magic?: boolean }): void {
    if (target.dead) return;
    let dmg = raw;
    if (target.kind === 'enemy' && target.enemyId === 'shield_drone' && src) {
      const incoming = norm(sub(target.pos, src.pos));
      const face = target.pathId ? tangentAt(this.paths[target.pathId], target.t) : vec3(1, 0, 0);
      const dot = incoming.x * face.x + incoming.z * face.z;
      if (dot < 0.15) dmg *= 0.6;
    }
    if (target.kind === 'valkyrie' && target.blocking) dmg *= 0.6;
    if (src?.charId === 'rin' && this.hasStatus(target, 'knock')) dmg *= 1.35;
    if (src?.charId === 'aria' && this.hasStatus(target, 'mark')) dmg *= 1.25;
    if (opts.magic && this.hasStatus(target, 'mark')) dmg *= 1.25;
    if (src && src.kind === 'valkyrie' && src.hp / src.maxHp < 0.3 && this.hasMod('last_stand')) dmg *= 1.2;
    if (src?.charId === 'ren' && src.firstStrike && this.hasMod('shadow_step') && this.time < src.stealthUntil + 0.1) {
      dmg *= 1.45;
      src.firstStrike = false;
    }
    if (this.lastInWave(target)) dmg *= this.hasMod('focus_fire') ? 1.25 : 1;
    const inv = target.status.find((s) => s.kind === 'invuln' && s.until > this.time);
    if (inv) dmg = 0;
    target.hp -= dmg;
    target.lastHitTime = this.time;
    this.emit({ type: 'UNIT_HIT', sourceId: src?.id, targetId: target.id, amount: dmg, pos: cloneVec(target.pos) });
    if (opts.knock && opts.knock > 0 && target.kind === 'enemy') {
      this.knockback(target, opts.knock * (this.hasMod('moon_edge') && src?.charId === 'rin' ? 1.3 : 1), src);
    }
    if (target.hp <= 0) this.kill(target, src);
  }

  private lastInWave(target: SimUnit): boolean {
    const live = this.aliveEnemies();
    return live.length === 1 && live[0].id === target.id;
  }

  private knockback(e: SimUnit, amount: number, src: SimUnit | null): void {
    if (!e.pathId) return;
    if (!e.isSmall && e.enemyId !== 'yamato') {
      // elites resist most knock
      amount *= 0.25;
    }
    if (e.enemyId === 'yamato') amount *= 0.08;
    const prev = e.t;
    e.t = Math.max(0, e.t - amount);
    e.pos = samplePath(this.paths[e.pathId], e.t);
    this.addStatus(e, { id: 'kb', kind: 'knock', until: this.time + 0.8, value: 0.25 });
    this.emit({ type: 'UNIT_KNOCKED_BACK', targetId: e.id, t: e.t, amount: prev - e.t, pos: cloneVec(e.pos), sourceId: src?.id });
    if (this.hasRelic('collision_trauma')) {
      for (const o of this.aliveEnemies()) {
        if (o.id === e.id) continue;
        if (dist(o.pos, e.pos) < 1.05) {
          o.hp -= 12;
          this.emit({ type: 'COLLISION_TRAUMA', sourceId: e.id, targetId: o.id, amount: 12 });
          if (o.hp <= 0) this.kill(o, src);
        }
      }
    }
  }

  private kill(u: SimUnit, src: SimUnit | null): void {
    if (u.dead) return;
    if (u.kind === 'valkyrie' && !this.secondWindUsed && this.hasRelic('second_wind')) {
      this.secondWindUsed = true;
      u.hp = u.maxHp * 0.3;
      this.emit({ type: 'UNIT_REVIVE', targetId: u.id, amount: u.hp });
      return;
    }
    u.hp = 0;
    u.dead = true;
    u.downed = u.kind === 'valkyrie';
    u.deployed = u.kind === 'valkyrie' ? false : u.deployed;
    if (u.kind === 'enemy') this.kills += 1;
    this.emit({ type: 'UNIT_DOWN', targetId: u.id, sourceId: src?.id });
    if (u.enemyId === 'bomb_carrier') {
      // exploded already handled on contact
    }
  }

  private tickEnemies(dt: number): void {
    const blocker = this.valkyries.find((v) => v.deployed && !v.dead && v.blocking);
    const blockT = blocker ? nearestT(this.paths.main, blocker.pos) : null;
    for (const e of this.aliveEnemies()) {
      if (e.stunUntil > this.time) continue;
      const slow = this.slowOf(e);
      this.advanceEnemy(e, dt * (1 - slow), blockT, blocker);
      e.cooldown = Math.max(0, e.cooldown - dt);
      this.enemyAct(e, dt);
    }
    if (this.stage.kind === 'boss') this.tickBoss(dt);
  }

  private slowOf(e: SimUnit): number {
    let s = 0;
    for (const st of e.status) if (st.kind === 'slow' && st.until > this.time) s = Math.max(s, st.value);
    return Math.min(0.7, s);
  }

  private advanceEnemy(e: SimUnit, dt: number, blockT: number | null, blocker?: SimUnit): void {
    if (!e.pathId) return;
    if (e.enemyId === 'yamato' && e.t > 0.42) {
      // boss holds mid
      e.t = 0.42;
      e.pos = samplePath(this.paths.main, e.t);
      return;
    }
    let pathId = e.pathId;
    let t = e.t;
    const path = this.paths[pathId];
    const merge = path.mergeInto;
    const step = e.speed * dt;
    if (merge && t + step >= 1) {
      pathId = merge.path;
      t = merge.t;
      e.pathId = pathId;
      e.t = t;
      this.emit({ type: 'ROUTE_CHANGED', targetId: e.id, pathId, t });
    } else {
      t = Math.min(1, t + step);
    }
    if (this.destroyedSegment && pathId === 'main' && t >= this.destroyedSegment.t0 && t <= this.destroyedSegment.t1) {
      pathId = 'reroute';
      e.pathId = 'reroute';
      this.emit({ type: 'ROUTE_CHANGED', targetId: e.id, pathId: 'reroute', t });
    }
    if (blockT !== null && pathId === 'main' && t >= blockT - 0.02 && e.enemyId !== 'wraith') {
      t = Math.min(t, blockT - 0.02);
      if (blocker && e.cooldown <= 0) {
        this.hitValkyrie(e, blocker);
        e.cooldown = e.atkInterval;
      }
    }
    if (e.isMelee && onBridge(this.bf, pathId, t) && !meleeCanEnter(this.bf, pathId, t, e.pos.y < 1.0) && e.enemyId !== 'wraith') {
      // following the leyline still crosses; only free chase is blocked. keep walking the path.
    }
    e.t = t;
    const sampleId = pathId === 'reroute' ? 'reroute' : pathId;
    const sp = this.paths[sampleId];
    e.pos = samplePath(sp, sampleId === 'reroute' ? Math.max(0, Math.min(1, (t - 0.36) / 0.3)) : t);
  }

  private coreIntegrityHit(e: SimUnit): number {
    if (e.enemyId === 'bomb_carrier') return 2;
    if (e.enemyId === 'executioner' || e.enemyId === 'yamato') return 1;
    if (e.enemyId === 'shade' || e.enemyId === 'runner') return 0.35;
    return 1;
  }

  private enemyAct(e: SimUnit, _dt: number): void {
    const def = ENEMIES[e.enemyId!];
    if (e.enemyId === 'yamato') return;
    if (def.ai === 'disable_platform') return;
    if (def.ai === 'break_gate' || (!this.gateDestroyed && e.enemyId === 'shade' && dist(e.pos, this.bf.gate.pos) < 2.2 && e.t > 0.5)) {
      if (!this.gateDestroyed && dist(e.pos, this.bf.gate.pos) < 2.3 && e.cooldown <= 0) {
        this.damageGate(e.atk, e.id);
        e.cooldown = e.atkInterval;
        return;
      }
    }
    if (dist(e.pos, this.core.pos) <= e.range + 0.55) {
      if (e.enemyId === 'bomb_carrier') {
        this.damageCore(this.coreIntegrityHit(e), e.id);
        e.hp = 0;
        e.dead = true;
        this.kills += 1;
        this.emit({ type: 'UNIT_DOWN', targetId: e.id, message: 'explode' });
        return;
      }
      if (e.cooldown <= 0) {
        this.damageCore(this.coreIntegrityHit(e), e.id);
        e.cooldown = e.atkInterval;
        if (this.hasCore('reflect_melee') && e.isMelee) {
          e.hp -= e.atk * 0.1;
          if (e.hp <= 0) this.kill(e, this.core);
        }
      }
      return;
    }
    if (def.ai === 'prioritize_support' || def.ai === 'elite_displace') {
      const support = this.valkyries
        .filter((v) => v.deployed && !v.dead && (v.charId === 'mio' || v.charId === 'aria' || def.ai === 'elite_displace'))
        .sort((a, b) => dist(a.pos, e.pos) - dist(b.pos, e.pos))[0];
      if (support && dist(support.pos, e.pos) < e.range + 1.2 && e.cooldown <= 0) {
        this.hitValkyrie(e, support);
        e.cooldown = e.atkInterval;
        if (e.enemyId === 'executioner') this.displace(support);
      }
    }
  }

  private hitValkyrie(e: SimUnit, v: SimUnit): void {
    this.dealDamage(e, v, e.atk, {});
  }

  private displace(v: SimUnit): void {
    v.deployed = false;
    v.slotId = null;
    v.undeployUntil = this.time + 2.4;
    v.stunUntil = this.time + 2.4;
    this.emit({ type: 'UNIT_UNDEPLOYED', targetId: v.id, message: 'displaced' });
  }

  private damageCore(amount: number, src?: string): void {
    const sh = this.core.status.find((s) => s.kind === 'shield' && s.until > this.time);
    let dmg = amount;
    if (sh) {
      const absorb = Math.min(sh.value, dmg);
      sh.value -= absorb;
      dmg -= absorb;
    }
    this.core.hp = Math.max(0, this.core.hp - dmg);
    this.emit({ type: 'CORE_DAMAGED', amount: dmg, sourceId: src, targetId: 'core', pos: cloneVec(this.core.pos) });
  }

  private damageGate(amount: number, src?: string): void {
    if (this.gateDestroyed) return;
    this.gateHp = Math.max(0, this.gateHp - amount);
    this.emit({ type: 'GATE_DAMAGED', amount, sourceId: src });
    if (this.gateHp <= 0) {
      this.gateDestroyed = true;
      this.emit({ type: 'GATE_DESTROYED' });
    }
  }

  private tickBoss(dt: number): void {
    const boss = this.aliveEnemies().find((e) => e.enemyId === 'yamato');
    if (!boss) return;
    if (this.bossPhase === 1 && boss.hp <= boss.maxHp * 0.5) this.enterPhase2(boss);
    if (this.time >= this.nextBossSummon) {
      this.nextBossSummon = this.time + (this.bossPhase === 1 ? 12 : 9);
      this.spawnEnemy('shade', this.rng.next() > 0.5 ? 'feederA' : 'feederB');
      if (this.bossPhase === 2) this.spawnEnemy('runner', 'feederB');
    }
    if (this.bossPhase === 1 && !this.slotLocked && this.time > 5) {
      const lock = this.bf.slots.find((s) => s.lockable) ?? this.bf.slots.find((s) => s.kind === 'platform');
      if (lock) {
        this.slotLocked = lock.id;
        const occ = this.occupant(lock.id);
        if (occ) this.displace(occ);
        this.emit({ type: 'SLOT_LOCKED', slotId: lock.id });
      }
    }
    if (this.time >= this.nextBossSlash) {
      this.nextBossSlash = this.time + 9;
      this.emit({ type: 'SKILL_CAST', sourceId: boss.id, skillId: 'yamato_slash', pos: cloneVec(this.core.pos) });
      this.damageCore(1, boss.id);
    }
    if (this.bossPhase === 2 && this.time >= this.nextBossTele) {
      this.nextBossTele = this.time + 8;
      const t = 0.4 + this.rng.next() * 0.3;
      const pos = samplePath(this.paths.main, t);
      this.emit({ type: 'TELEGRAPH', pos, t, pathId: 'main', skillId: 'yamato_nova' });
      this.ariaMarks.push({
        id: this.nid('bossmark'),
        pos,
        pathId: 'main',
        t,
        radius: 2.6,
        detonateAt: this.time + 1.6,
        damage: 18,
        sourceId: boss.id,
        ult: false,
      });
    }
  }

  private enterPhase2(boss: SimUnit): void {
    this.bossPhase = 2;
    this.destroyedSegment = { t0: 0.38, t1: 0.54 };
    this.useReroute = true;
    this.gateDestroyed = true;
    this.gateHp = 0;
    this.emit({ type: 'GATE_DESTROYED', message: 'boss' });
    this.emit({ type: 'ROUTE_CHANGED', pathId: 'reroute', t: 0.4, message: 'destroyed_stretch' });
    this.emit({ type: 'BOSS_PHASE_CHANGED', phase: 2, sourceId: boss.id, pos: cloneVec(boss.pos) });
  }

  private tickMarks(): void {
    const left: AriaMark[] = [];
    for (const m of this.ariaMarks) {
      if (this.time >= m.detonateAt) {
        this.emit({ type: 'ARIA_MARK_DETONATE', pos: cloneVec(m.pos), sourceId: m.sourceId, amount: m.damage });
        const src = this.valkyries.find((v) => v.id === m.sourceId) ?? null;
        if (m.sourceId.startsWith('yamato') || m.sourceId.startsWith('boss') || (src === null && m.sourceId.includes('boss'))) {
          for (const v of this.valkyries) {
            if (v.deployed && !v.dead && dist(v.pos, m.pos) < m.radius) this.dealDamage(null, v, 10, { magic: true });
          }
          
        } else {
          for (const e of this.aliveEnemies()) {
            if (dist(e.pos, m.pos) < m.radius) {
              this.addStatus(e, { id: 'hex', kind: 'mark', until: this.time + 4, value: 1 });
              this.dealDamage(src, e, m.damage, { magic: true });
            }
          }
        }
      } else left.push(m);
    }
    this.ariaMarks = left;
  }

  private tickLinks(dt: number): void {
    const pairs = [
      ['rin', 'mio'],
      ['alyssa', 'eve'],
      ['ren', 'aria'],
    ];
    let both = false;
    for (const [a, b] of pairs) {
      const A = this.valkyries.find((v) => v.charId === a && v.deployed && !v.dead);
      const B = this.valkyries.find((v) => v.charId === b && v.deployed && !v.dead);
      if (A && B) both = true;
    }
    if (both) this.linkEnergy = Math.min(100, this.linkEnergy + 5.5 * dt);
    if (this.hasRelic('gate_tithe') && !this.gateDestroyed) {
      this.linkEnergy = Math.min(100, this.linkEnergy + 2.2 * dt);
      for (const v of this.valkyries) if (v.deployed && !v.dead) v.energy = Math.min(100, v.energy + 1.4 * dt);
    }
  }

  private tickRelics(_dt: number): void {
    // hook reserved
  }

  private checkEnd(): void {
    if (this.win || this.lose) return;
    if (this.core.hp <= 0) {
      this.lose = true;
      this.loseReason = 'core';
      this.emit({ type: 'BATTLE_LOSE', message: 'core' });
      return;
    }
    if (this.valkyries.every((v) => v.dead || v.downed)) {
      this.lose = true;
      this.loseReason = 'team';
      this.emit({ type: 'BATTLE_LOSE', message: 'team' });
      return;
    }
    if (this.core.t >= this.stage.winT && this.core.hp >= 1) {
      this.win = true;
      this.emit({ type: 'BATTLE_WIN', t: this.core.t, amount: this.core.hp });
    }
  }

  deploy(unitId: string, slotId: string): boolean {
    if (slotId === this.slotLocked) return false;
    const v = this.valkyries.find((x) => x.id === unitId);
    const slot = this.bf.slots.find((s) => s.id === slotId);
    if (!v || !slot || v.dead) return false;
    if (this.occupant(slotId) && this.occupant(slotId)!.id !== v.id) return false;
    v.deployed = true;
    v.slotId = slotId;
    v.pos = cloneVec(slot.pos);
    v.undeployUntil = 0;
    this.emit({ type: 'UNIT_DEPLOYED', sourceId: v.id, slotId, pos: cloneVec(slot.pos) });
    return true;
  }

  shift(unitId: string, slotId: string): boolean {
    const free = this.hasRelic('first_shift_free') && !this.firstShiftConsumed;
    if (this.shiftsLeft <= 0 && !free) return false;
    const ok = this.deploy(unitId, slotId);
    if (!ok) return false;
    if (free) this.firstShiftConsumed = true;
    else this.shiftsLeft -= 1;
    this.emit({ type: 'SHIFT_USED', sourceId: unitId, slotId, amount: this.shiftsLeft });
    return true;
  }

  activateAccel(): boolean {
    if (this.accelUsed) return false;
    this.accelUsed = true;
    this.accelUntil = this.time + this.bf.accel.duration;
    if (this.hasRelic('overclock_node')) this.projSpeedMul = 1.45;
    this.emit({ type: 'ACCEL_ACTIVATED', pos: cloneVec(this.bf.accel.pos), amount: this.bf.accel.multiplier });
    return true;
  }

  castActive(unitId: string, pos?: Vec3): boolean {
    const v = this.valkyries.find((x) => x.id === unitId);
    if (!v || !v.deployed || v.dead || v.activeCd > 0) return false;
    const c = CHARACTERS[v.charId!];
    v.activeCd = c.active.cd;
    v.energy = Math.min(100, v.energy + 8);
    this.emit({ type: 'SKILL_CAST', sourceId: v.id, skillId: c.active.id, pos: pos ? cloneVec(pos) : cloneVec(v.pos) });
    switch (v.charId) {
      case 'rin':
        this.rinDash(v, false);
        break;
      case 'mio':
        this.mioWard(v, false);
        break;
      case 'alyssa':
        this.alyssaBlock(v, false);
        break;
      case 'eve':
        this.eveRail(v, false);
        break;
      case 'ren':
        this.renBlink(v, false);
        break;
      case 'aria':
        this.placeAriaMark(pos ?? this.guessMark(), false);
        break;
    }
    return true;
  }

  castUlt(unitId: string): boolean {
    const v = this.valkyries.find((x) => x.id === unitId);
    if (!v || !v.deployed || v.dead || v.energy < 100) return false;
    v.energy = 0;
    this.emit({ type: 'ULT_CAST', sourceId: v.id, skillId: CHARACTERS[v.charId!].ult.id, pos: cloneVec(v.pos) });
    switch (v.charId) {
      case 'rin':
        this.rinDash(v, true);
        break;
      case 'mio':
        this.mioWard(v, true);
        break;
      case 'alyssa':
        this.alyssaBlock(v, true);
        break;
      case 'eve':
        this.eveRail(v, true);
        break;
      case 'ren':
        this.renBlink(v, true);
        break;
      case 'aria':
        this.placeAriaMark(this.guessMark(), true);
        break;
    }
    return true;
  }

  private rinDash(v: SimUnit, ult: boolean): void {
    const target = this.aliveEnemies().sort((a, b) => dist(a.pos, this.core.pos) - dist(b.pos, this.core.pos))[0];
    if (target?.pathId) {
      const dest = samplePath(this.paths[target.pathId], target.t);
      this.emit({ type: 'SKILL_CAST', sourceId: v.id, skillId: ult ? 'lunar_eclipse' : 'lunar_step', pos: dest, pathId: target.pathId, t: target.t });
    }
    const r = ult ? 3.6 : 2.2;
    const knock = ult ? 0.055 : 0.028;
    const dmg = v.atk * (ult ? 2.4 : 1.45);
    const origin = target ? target.pos : v.pos;
    for (const e of this.aliveEnemies()) {
      if (dist(e.pos, origin) <= r) this.dealDamage(v, e, dmg, { knock: e.isSmall || ult ? knock : 0 });
    }
  }

  private mioWard(v: SimUnit, ult: boolean): void {
    const rad = (ult ? 4.4 : 2.6) * (this.hasMod('foxfire_radius') ? 1.35 : 1);
    this.addStatus(this.core, { id: 'ward', kind: 'shield', until: this.time + (ult ? 6 : 3.5), value: ult ? 4 : 2 });
    this.core.hp = Math.min(this.core.maxHp, this.core.hp + (ult ? 2 : 0));
    if (ult) this.emit({ type: 'CORE_HEALED', amount: 2, targetId: 'core' });
    for (const e of this.aliveEnemies()) {
      if (dist(e.pos, this.core.pos) < rad) this.addStatus(e, { id: 'fox', kind: 'slow', until: this.time + (ult ? 5 : 3), value: ult ? 0.45 : 0.28 });
    }
    for (const a of this.valkyries) {
      if (!a.dead) a.hp = Math.min(a.maxHp, a.hp + (ult ? 18 : 8) * (this.hasMod('core_bond') ? 1.2 : 1));
    }
  }

  private alyssaBlock(v: SimUnit, ult: boolean): void {
    v.blocking = true;
    v.blockUntil = this.time + (ult ? 4.2 : 2.2) + (this.hasMod('aegis_pulse') ? 1 : 0);
    this.addStatus(v, { id: 'block', kind: 'block', until: v.blockUntil, value: 1 });
    if (ult) {
      this.addStatus(v, { id: 'aegis', kind: 'invuln', until: this.time + 2.2, value: 1 });
      for (const e of this.aliveEnemies()) {
        if (dist(e.pos, v.pos) < 5.5) this.addStatus(e, { id: 'taunt', kind: 'taunt', until: this.time + 3, value: 1 });
      }
    }
  }

  private eveRail(v: SimUnit, ult: boolean): void {
    const target = this.pickTarget(v) ?? this.aliveEnemies()[0];
    if (!target) return;
    const hits = this.rayHits(v, target);
    this.emit({
      type: 'PROJECTILE_FIRED',
      sourceId: v.id,
      targetId: target.id,
      targetIds: hits.map((h) => h.id),
      pos: cloneVec(v.pos),
      endPos: cloneVec(target.pos),
      pierce: true,
      skillId: ult ? 'starfault' : 'rail',
    });
    for (const h of hits) this.dealDamage(v, h, v.atk * (ult ? 2.1 : 1.35), {});
  }

  private renBlink(v: SimUnit, ult: boolean): void {
    const prios = this.aliveEnemies()
      .filter((e) => e.enemyId === 'jammer' || e.enemyId === 'bomb_carrier' || e.enemyId === 'wraith' || ult)
      .sort((a, b) => dist(b.pos, v.pos) - dist(a.pos, v.pos));
    const t = prios[0] ?? this.aliveEnemies()[0];
    if (!t) return;
    this.emit({ type: 'SKILL_CAST', sourceId: v.id, skillId: ult ? 'phantom_zero' : 'blink', pos: cloneVec(t.pos), targetId: t.id });
    let mul = ult ? 2.6 : 1.55;
    if (ult && t.hp / t.maxHp < 0.28) mul = 8;
    this.dealDamage(v, t, v.atk * mul, {});
  }

  placeAriaMark(pos: Vec3, ult: boolean): boolean {
    const aria = this.valkyries.find((v) => v.charId === 'aria' && v.deployed && !v.dead);
    if (!aria) return false;
    const loc = worldToPathT(this.bf, this.paths, pos);
    const delay = (ult ? 1.35 : 1.7) * (this.hasMod('delayed_hex') ? 0.65 : 1);
    const mark: AriaMark = {
      id: this.nid('mark'),
      pos: cloneVec(pos),
      pathId: loc.pathId,
      t: loc.t,
      radius: ult ? 3.4 : 2.1,
      detonateAt: this.time + delay,
      damage: aria.atk * (ult ? 2.3 : 1.4),
      sourceId: aria.id,
      ult,
    };
    this.ariaMarks.push(mark);
    this.emit({ type: 'ARIA_MARK_PLACED', sourceId: aria.id, pos: cloneVec(pos), pathId: loc.pathId, t: loc.t, skillId: ult ? 'nova' : 'hex' });
    this.emit({ type: 'TELEGRAPH', pos: cloneVec(pos), sourceId: aria.id, t: loc.t });
    return true;
  }

  private guessMark(): Vec3 {
    const e = this.aliveEnemies().sort((a, b) => a.t - b.t)[Math.floor(this.aliveEnemies().length / 2)];
    return e ? cloneVec(e.pos) : cloneVec(this.core.pos);
  }

  fireLink(): boolean {
    if (this.linkEnergy < 100) return false;
    const ready = this.readyLink();
    if (!ready) return false;
    this.linkEnergy = 0;
    this.emit({ type: 'LINK_TRIGGERED', linkId: ready, skillId: ready });
    if (ready === 'rin-mio') {
      this.core.hp = Math.min(this.core.maxHp, this.core.hp + 2);
      this.emit({ type: 'CORE_HEALED', amount: 2 });
      for (const e of this.aliveEnemies()) {
        this.addStatus(e, { id: 'mf', kind: 'slow', until: this.time + 4, value: 0.4 });
        this.dealDamage(this.valkyries.find((v) => v.charId === 'rin') ?? null, e, 22, { knock: 0.04 });
      }
    } else if (ready === 'alyssa-eve') {
      const eve = this.valkyries.find((v) => v.charId === 'eve');
      const aly = this.valkyries.find((v) => v.charId === 'alyssa');
      if (aly) this.addStatus(aly, { id: 'wall', kind: 'invuln', until: this.time + 2, value: 1 });
      const dummy = this.aliveEnemies()[0];
      if (eve && dummy) {
        const hits = this.rayHits(eve, dummy);
        for (const h of hits) {
          this.addStatus(h, { id: 'st', kind: 'stun', until: this.time + 1.4, value: 1 });
          h.stunUntil = this.time + 1.4;
          this.dealDamage(eve, h, eve.atk * 1.8, {});
        }
      }
    } else if (ready === 'ren-aria') {
      const cluster = this.aliveEnemies().slice().sort((a, b) => dist(a.pos, this.core.pos) - dist(b.pos, this.core.pos));
      const center = cluster[0];
      if (center) {
        this.placeAriaMark(center.pos, true);
        for (const e of this.aliveEnemies()) {
          if (dist(e.pos, center.pos) < 3.2) {
            const ren = this.valkyries.find((v) => v.charId === 'ren');
            this.dealDamage(ren ?? null, e, 28, {});
          }
        }
        if (this.hasRelic('link_reroute') && !this.linkRerouteUsed) {
          const victim = this.aliveEnemies().find((e) => e.pathId === 'feederA' || e.pathId === 'feederB');
          if (victim && victim.pathId) {
            const next: PathId = victim.pathId === 'feederA' ? 'feederB' : 'feederA';
            victim.pathId = next;
            victim.t = Math.min(victim.t, 0.4);
            victim.pos = samplePath(this.paths[next], victim.t);
            this.linkRerouteUsed = true;
            this.emit({ type: 'ROUTE_CHANGED', targetId: victim.id, pathId: next, t: victim.t, message: 'link_reroute' });
          }
        }
      }
    }
    return true;
  }

  readyLink(): string | null {
    const pairs: [CharId, CharId, string][] = [
      ['rin', 'mio', 'rin-mio'],
      ['alyssa', 'eve', 'alyssa-eve'],
      ['ren', 'aria', 'ren-aria'],
    ];
    for (const [a, b, id] of pairs) {
      const A = this.valkyries.find((v) => v.charId === a && v.deployed && !v.dead);
      const B = this.valkyries.find((v) => v.charId === b && v.deployed && !v.dead);
      if (A && B && this.linkEnergy >= 100) return id;
    }
    return null;
  }

  private addStatus(u: SimUnit, s: StatusEffect): void {
    u.status = u.status.filter((x) => x.id !== s.id);
    u.status.push(s);
  }

  private hasStatus(u: SimUnit, kind: StatusEffect['kind']): boolean {
    return u.status.some((s) => s.kind === kind && s.until > this.time);
  }

  private face(u: SimUnit, pos: Vec3): void {
    u.facing = Math.atan2(pos.x - u.pos.x, pos.z - u.pos.z);
  }

  aliveEnemies(): SimUnit[] {
    return this.enemies.filter((e) => !e.dead);
  }

  snapshot(): BattleSnapshot {
    const cloneU = (u: SimUnit): SimUnit => ({ ...u, pos: cloneVec(u.pos), status: u.status.map((s) => ({ ...s })) });
    return {
      time: this.time,
      tick: this.tick,
      core: cloneU(this.core),
      valkyries: this.valkyries.map(cloneU),
      enemies: this.enemies.map(cloneU),
      gateHp: this.gateHp,
      gateMax: this.gateMax,
      gateDestroyed: this.gateDestroyed,
      platforms: this.platforms.map((p) => ({ ...p })),
      accelUsed: this.accelUsed,
      accelUntil: this.accelUntil,
      shiftsLeft: this.shiftsLeft,
      linkEnergy: this.linkEnergy,
      bossPhase: this.bossPhase,
      slotLocked: this.slotLocked,
      destroyedSegment: this.destroyedSegment ? { ...this.destroyedSegment } : null,
      useReroute: this.useReroute,
      ariaMarks: this.ariaMarks.map((m) => ({ ...m, pos: cloneVec(m.pos) })),
      win: this.win,
      lose: this.lose,
      loseReason: this.loseReason,
      kills: this.kills,
      events: this.events.map((e) => ({ ...e })),
    };
  }
}

export function foldEvents(events: BattleEvent[]): { integrity: number; kills: number; win: boolean; lose: boolean } {
  let integrity = 8;
  let kills = 0;
  let win = false;
  let lose = false;
  let maxCore = 8;
  for (const e of events) {
    if (e.type === 'CORE_DAMAGED') integrity -= e.amount ?? 0;
    if (e.type === 'CORE_HEALED') integrity += e.amount ?? 0;
    if (e.type === 'UNIT_DOWN' && e.targetId && !e.targetId.startsWith('rin') && !e.targetId.startsWith('mio') && !e.targetId.startsWith('aly') && !e.targetId.startsWith('eve') && !e.targetId.startsWith('ren') && !e.targetId.startsWith('aria') && e.targetId !== 'core') {
      kills += 1;
    }
    if (e.type === 'BATTLE_WIN') win = true;
    if (e.type === 'BATTLE_LOSE') lose = true;
  }
  return { integrity: Math.max(0, Math.min(99, integrity)), kills, win, lose, maxCore } as { integrity: number; kills: number; win: boolean; lose: boolean };
}

export function runHeadless(cfg: BattleConfig, seconds: number, script?: (sim: BattleSim, t: number) => void): BattleSim {
  const sim = new BattleSim(cfg);
  const step = 0.05;
  for (let t = 0; t < seconds && !sim.win && !sim.lose; t += step) {
    script?.(sim, sim.time);
    sim.step(step);
  }
  return sim;
}
