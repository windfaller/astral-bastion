import * as THREE from 'three';

export interface VfxSystem {
  group: THREE.Group;
  burst: (pos: THREE.Vector3, color: number, n?: number) => void;
  beam: (from: THREE.Vector3, to: THREE.Vector3, color: number, life?: number) => void;
  ring: (pos: THREE.Vector3, color: number, radius: number, life?: number) => void;
  rail: (from: THREE.Vector3, to: THREE.Vector3, color?: number) => void;
  slash: (origin: THREE.Vector3, toward: THREE.Vector3, color?: number) => void;
  dome: (pos: THREE.Vector3, radius?: number, color?: number, life?: number) => void;
  telegraph: (pos: THREE.Vector3, radius: number, color?: number, life?: number) => void;
  sparks: (pos: THREE.Vector3, color?: number, n?: number) => void;
  update: (dt: number, reduced: boolean) => void;
  clear: () => void;
}

interface Particle {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  life: number;
  max: number;
  spin?: THREE.Vector3;
  grow?: number;
  sx: number;
  sy: number;
  sz: number;
  disposeGeo: boolean;
}

const ZERO = new THREE.Vector3();

function opacityOf(mesh: THREE.Object3D, t: number): void {
  const m = mesh as THREE.Mesh;
  const mat = m.material as THREE.Material | THREE.Material[] | undefined;
  const apply = (x: THREE.Material) => {
    if ('opacity' in x) (x as THREE.MeshBasicMaterial).opacity = Math.max(0, t) * ((x.userData.baseOpacity as number) ?? 1);
  };
  if (Array.isArray(mat)) mat.forEach(apply);
  else if (mat) apply(mat);
}

function rememberOpacity(mesh: THREE.Mesh): void {
  const mat = mesh.material as THREE.MeshBasicMaterial;
  if (mat && 'opacity' in mat) mat.userData.baseOpacity = mat.opacity;
}

export function createVfx(scene: THREE.Scene, reduced: boolean): VfxSystem {
  const group = new THREE.Group();
  scene.add(group);
  const parts: Particle[] = [];
  const geo = new THREE.SphereGeometry(0.08, reduced ? 4 : 8, reduced ? 4 : 8);
  const beamGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, reduced ? 4 : 8);
  const streakGeo = new THREE.ConeGeometry(0.04, 0.22, 4);

  function spawn(mesh: THREE.Object3D, life: number, opts?: Partial<Particle>): void {
    group.add(mesh);
    const s = mesh.scale;
    parts.push({
      mesh,
      vel: opts?.vel ?? ZERO.clone(),
      life,
      max: life,
      spin: opts?.spin,
      grow: opts?.grow,
      sx: s.x,
      sy: s.y,
      sz: s.z,
      disposeGeo: opts?.disposeGeo ?? false,
    });
  }

  function kill(p: Particle): void {
    group.remove(p.mesh);
    const m = p.mesh as THREE.Mesh;
    if (p.disposeGeo && m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat && p.disposeGeo) mat.dispose();
    else if (mat && !p.disposeGeo) mat.dispose();
  }

  function burst(pos: THREE.Vector3, color: number, n = 10): void {
    const count = reduced ? Math.min(4, n) : n;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      rememberOpacity(mesh);
      spawn(mesh, 0.45, {
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4),
      });
    }
  }

  function orientBeam(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, lenScale = 1): number {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = Math.max(0.15, dir.length());
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.scale.set(1, len * lenScale, 1);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return len;
  }

  function beam(from: THREE.Vector3, to: THREE.Vector3, color: number, life = 0.28): void {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(beamGeo, mat);
    orientBeam(mesh, from, to);
    rememberOpacity(mesh);
    spawn(mesh, life);
  }

  function rail(from: THREE.Vector3, to: THREE.Vector3, color = 0x7ef9ff): void {
    const segs = reduced ? 6 : 12;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 1, segs),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    orientBeam(core, from, to);
    rememberOpacity(core);
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.2, 1, segs),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    orientBeam(glow, from, to);
    rememberOpacity(glow);
    const after = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.32, 1, segs),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    orientBeam(after, from, to, 1.03);
    rememberOpacity(after);
    spawn(core, 0.22, { disposeGeo: true });
    spawn(glow, 0.4, { disposeGeo: true });
    spawn(after, 0.78, { grow: 1.28, disposeGeo: true });
  }

  function slash(origin: THREE.Vector3, toward: THREE.Vector3, color = 0x9ad8ff): void {
    const dir = new THREE.Vector3().subVectors(toward, origin);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
    const geoC = new THREE.TorusGeometry(1.18, 0.085, reduced ? 6 : 10, reduced ? 16 : 28, Math.PI * 1.22);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geoC, mat);
    mesh.position.copy(origin);
    mesh.position.y += 0.9;
    const flat = new THREE.Vector3(dir.x, 0, dir.z);
    if (flat.lengthSq() < 1e-6) flat.set(1, 0, 0);
    flat.normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), flat);
    mesh.rotateX(0.38);
    rememberOpacity(mesh);
    spawn(mesh, 0.44, { spin: new THREE.Vector3(0, 0, 7.5), grow: 1.65, disposeGeo: true });

    const trail = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.04, 5, reduced ? 12 : 20, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({
        color: 0xe8f6ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    trail.position.copy(mesh.position);
    trail.quaternion.copy(mesh.quaternion);
    rememberOpacity(trail);
    spawn(trail, 0.32, { grow: 1.9, disposeGeo: true });
  }

  function dome(pos: THREE.Vector3, radius = 2.6, color = 0xff9ad4, life = 1.75): void {
    const segs = reduced ? 12 : 24;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, segs, reduced ? 8 : 16, 0, Math.PI * 2, 0, Math.PI * 0.64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.position.copy(pos);
    mesh.position.y += 0.04;
    rememberOpacity(mesh);
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.78, reduced ? 10 : 18, reduced ? 8 : 14),
      new THREE.MeshBasicMaterial({
        color: 0xffc6e8,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    inner.position.copy(mesh.position);
    rememberOpacity(inner);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.82, radius * 1.02, reduced ? 16 : 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.copy(pos);
    rim.position.y = 0.06;
    rememberOpacity(rim);
    spawn(mesh, life, { grow: 1.12, disposeGeo: true });
    spawn(inner, life, { grow: 1.06, disposeGeo: true });
    spawn(rim, life, { grow: 1.18, disposeGeo: true });
  }

  function telegraph(pos: THREE.Vector3, radius: number, color = 0xfb7185, life = 1.45): void {
    const h = 2.55;
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, h, reduced ? 12 : 28, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    cyl.position.copy(pos);
    cyl.position.y = h * 0.42;
    rememberOpacity(cyl);
    const cap = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.7, radius, reduced ? 16 : 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    cap.rotation.x = -Math.PI / 2;
    cap.position.copy(pos);
    cap.position.y = 0.07;
    rememberOpacity(cap);
    spawn(cyl, life, { disposeGeo: true });
    spawn(cap, life, { grow: 1.14, disposeGeo: true });
  }

  function ring(pos: THREE.Vector3, color: number, radius: number, life = 0.8): void {
    const g = new THREE.RingGeometry(radius * 0.7, radius, reduced ? 16 : 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(g, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos);
    mesh.position.y = 0.08;
    rememberOpacity(mesh);
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.15, reduced ? 12 : 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
    );
    cyl.position.copy(pos);
    rememberOpacity(cyl);
    spawn(mesh, life, { disposeGeo: true });
    spawn(cyl, life, { disposeGeo: true });
  }

  function sparks(pos: THREE.Vector3, color = 0xffe08a, n = 10): void {
    const count = reduced ? Math.min(5, n) : n;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(streakGeo, mat);
      mesh.position.copy(pos);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 6.2, 1.6 + Math.random() * 5.2, (Math.random() - 0.5) * 6.2);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize());
      rememberOpacity(mesh);
      spawn(mesh, 0.32 + Math.random() * 0.2, { vel });
    }
  }

  function update(dt: number, _reduced: boolean): void {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.spin) p.mesh.rotateZ(p.spin.z * dt);
      const fade = Math.max(0, p.life / p.max);
      if (p.grow) {
        const g = 1 + (1 - fade) * (p.grow - 1);
        p.mesh.scale.set(p.sx * g, p.sy * g, p.sz * g);
      }
      opacityOf(p.mesh, fade);
      if (p.life <= 0) {
        kill(p);
        parts.splice(i, 1);
      }
    }
  }

  function clear(): void {
    while (parts.length) {
      const p = parts.pop()!;
      kill(p);
    }
  }

  return { group, burst, beam, ring, rail, slash, dome, telegraph, sparks, update, clear };
}
