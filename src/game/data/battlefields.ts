import type { BattlefieldDef, PathId, Vec3 } from '../types';
import { vec3 } from '../types';

const main: Vec3[] = [
  vec3(-13.5, 0.05, 7.2),
  vec3(-10.2, 0.05, 5.4),
  vec3(-7.4, 0.08, 2.8),
  vec3(-4.6, 0.55, 0.6),
  vec3(-1.8, 1.55, -0.9),
  vec3(0.4, 1.85, -1.3),
  vec3(2.8, 1.5, -0.5),
  vec3(5.4, 0.5, 1.1),
  vec3(8.2, 0.08, 3.4),
  vec3(11.0, 0.05, 5.6),
  vec3(13.6, 0.08, 6.4),
];

const feederA: Vec3[] = [
  vec3(-12.4, 0.05, -5.8),
  vec3(-9.6, 0.05, -3.6),
  vec3(-7.0, 0.05, -1.2),
  vec3(-4.8, 0.2, 0.4),
];

const feederB: Vec3[] = [
  vec3(3.2, 0.05, -7.4),
  vec3(4.8, 0.05, -4.6),
  vec3(6.4, 0.05, -1.2),
  vec3(8.0, 0.08, 2.2),
];

const reroute: Vec3[] = [
  vec3(-1.8, 0.08, 2.4),
  vec3(0.6, 0.12, 3.6),
  vec3(3.2, 0.1, 3.2),
  vec3(5.4, 0.08, 1.4),
];

export const HIGHWAY: BattlefieldDef = {
  id: 'highway',
  name: '高架月路',
  paths: {
    main: { points: main },
    feederA: { points: feederA, mergeInto: { path: 'main', t: 0.28 } },
    feederB: { points: feederB, mergeInto: { path: 'main', t: 0.62 } },
    reroute: { points: reroute, mergeInto: { path: 'main', t: 0.66 } },
  },
  bridge: { t0: 0.36, t1: 0.52, height: 1.8 },
  slots: [
    { id: 'plat_n', kind: 'platform', pos: vec3(-6.2, 2.15, 3.6) },
    { id: 'plat_e', kind: 'platform', pos: vec3(1.6, 2.25, 3.9), lockable: true },
    { id: 'plat_s', kind: 'platform', pos: vec3(7.4, 2.1, -1.8) },
    { id: 'g1', kind: 'ground', pos: vec3(-9.0, 0.05, 2.2) },
    { id: 'g2', kind: 'ground', pos: vec3(-3.4, 0.05, 3.1) },
    { id: 'g3', kind: 'ground', pos: vec3(2.2, 0.05, 2.6) },
    { id: 'g4', kind: 'ground', pos: vec3(9.2, 0.05, 1.4) },
    { id: 'g5', kind: 'ground', pos: vec3(-1.2, 0.05, -3.6) },
  ],
  obstacles: [
    { id: 'gate', kind: 'gate', pos: vec3(6.6, 0.7, -0.2), size: vec3(1.6, 1.6, 0.45), opaque: true, destructible: true, hp: 80 },
    { id: 'pylon_l', kind: 'pylon', pos: vec3(-0.6, 0.9, -2.2), size: vec3(0.45, 1.8, 0.45), opaque: true },
    { id: 'pylon_r', kind: 'pylon', pos: vec3(1.4, 0.9, 0.2), size: vec3(0.45, 1.8, 0.45), opaque: true },
    { id: 'crate_a', kind: 'crate', pos: vec3(-8.2, 0.35, -1.4), size: vec3(0.8, 0.7, 0.8), opaque: true },
    { id: 'crate_b', kind: 'crate', pos: vec3(10.2, 0.35, 2.4), size: vec3(0.7, 0.7, 0.7), opaque: true },
    { id: 'crate_c', kind: 'crate', pos: vec3(-2.8, 0.3, -4.2), size: vec3(0.6, 0.6, 0.6), opaque: true },
  ],
  accel: { id: 'accel', pos: vec3(-5.6, 0.2, 1.15), duration: 5, multiplier: 2.4 },
  gate: { pos: vec3(6.6, 0.7, -0.2), hp: 80 },
  astralGate: { pos: vec3(13.6, 1.4, 6.4), t: 0.98 },
  crates: [vec3(-8.2, 0.35, -1.4), vec3(10.2, 0.35, 2.4), vec3(-2.8, 0.3, -4.2)],
  camera: { pos: vec3(0.4, 16.8, 15.2), target: vec3(0.2, 0.4, 1.4), fov: 42 },
  music: 'music.bastion.battle',
};

export const BATTLEFIELDS: Record<string, BattlefieldDef> = {
  highway: HIGHWAY,
};

export function getBattlefield(id: string): BattlefieldDef {
  return BATTLEFIELDS[id] ?? HIGHWAY;
}

export const PATH_IDS: PathId[] = ['main', 'feederA', 'feederB', 'reroute'];
