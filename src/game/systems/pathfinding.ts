import type { BattlefieldDef, PathId, Vec3 } from '../types';
import { lerp3, sub, len, vec3, dist } from '../types';

export interface SampledPath {
  id: PathId;
  points: Vec3[];
  cum: number[];
  length: number;
  mergeInto?: { path: PathId; t: number };
}

function catmull(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) };
}

function densify(ctrl: Vec3[], segs = 12): Vec3[] {
  if (ctrl.length < 2) return ctrl.map((p) => ({ ...p }));
  const out: Vec3[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let s = 0; s < segs; s++) {
      out.push(catmull(p0, p1, p2, p3, s / segs));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

export function buildPath(id: PathId, ctrl: Vec3[], mergeInto?: { path: PathId; t: number }): SampledPath {
  const points = densify(ctrl, 14);
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  }
  return { id, points, cum, length: cum[cum.length - 1] || 1, mergeInto };
}

export function samplePath(path: SampledPath, t: number): Vec3 {
  const tt = Math.max(0, Math.min(1, t));
  const target = tt * path.length;
  const cum = path.cum;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const a = path.points[i - 1];
  const b = path.points[i];
  const span = cum[i] - cum[i - 1] || 1;
  const u = (target - cum[i - 1]) / span;
  return lerp3(a, b, u);
}

export function tangentAt(path: SampledPath, t: number): Vec3 {
  const a = samplePath(path, Math.max(0, t - 0.01));
  const b = samplePath(path, Math.min(1, t + 0.01));
  const d = sub(b, a);
  const l = len(d) || 1;
  return { x: d.x / l, y: d.y / l, z: d.z / l };
}

export function nearestT(path: SampledPath, pos: Vec3): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.points.length; i++) {
    const d = dist(path.points[i], pos);
    if (d < bestD) {
      bestD = d;
      best = path.cum[i] / path.length;
    }
  }
  return best;
}

export function worldToPathT(bf: BattlefieldDef, paths: Record<PathId, SampledPath>, pos: Vec3): { pathId: PathId; t: number } {
  let best: { pathId: PathId; t: number; d: number } = { pathId: 'main', t: 0, d: Infinity };
  (Object.keys(paths) as PathId[]).forEach((id) => {
    const p = paths[id];
    const t = nearestT(p, pos);
    const s = samplePath(p, t);
    const d = dist(s, pos);
    if (d < best.d) best = { pathId: id, t, d };
  });
  return { pathId: best.pathId, t: best.t };
}

export function buildBattlefieldPaths(bf: BattlefieldDef): Record<PathId, SampledPath> {
  const out = {} as Record<PathId, SampledPath>;
  (Object.keys(bf.paths) as PathId[]).forEach((id) => {
    const def = bf.paths[id];
    if (!def) return;
    out[id] = buildPath(id, def.points, def.mergeInto);
  });
  return out;
}

export function aabbOverlapsRay(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  size: Vec3,
): number | null {
  const min = vec3(center.x - size.x / 2, center.y - size.y / 2, center.z - size.z / 2);
  const max = vec3(center.x + size.x / 2, center.y + size.y / 2, center.z + size.z / 2);
  let tmin = 0;
  let tmax = 1e6;
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = dir[axis];
    if (Math.abs(d) < 1e-8) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
      continue;
    }
    const inv = 1 / d;
    let t1 = (min[axis] - origin[axis]) * inv;
    let t2 = (max[axis] - origin[axis]) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
}

export function onBridge(bf: BattlefieldDef, pathId: PathId, t: number): boolean {
  return pathId === 'main' && t >= bf.bridge.t0 && t <= bf.bridge.t1;
}

export function meleeCanEnter(bf: BattlefieldDef, pathId: PathId, t: number, fromGround: boolean): boolean {
  if (!fromGround) return true;
  if (onBridge(bf, pathId, t)) return false;
  return true;
}
