import * as THREE from 'three';

export interface VfxSystem {
  group: THREE.Group;
  burst: (pos: THREE.Vector3, color: number, n?: number) => void;
  beam: (from: THREE.Vector3, to: THREE.Vector3, color: number, life?: number) => void;
  ring: (pos: THREE.Vector3, color: number, radius: number, life?: number) => void;
  update: (dt: number, reduced: boolean) => void;
  clear: () => void;
}

interface Particle {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  life: number;
  max: number;
}

export function createVfx(scene: THREE.Scene, reduced: boolean): VfxSystem {
  const group = new THREE.Group();
  scene.add(group);
  const parts: Particle[] = [];
  const geo = new THREE.SphereGeometry(0.08, reduced ? 4 : 8, reduced ? 4 : 8);
  const beamGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, reduced ? 4 : 8);

  function burst(pos: THREE.Vector3, color: number, n = 10): void {
    const count = reduced ? Math.min(4, n) : n;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      group.add(mesh);
      parts.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4),
        life: 0.45,
        max: 0.45,
      });
    }
  }

  function beam(from: THREE.Vector3, to: THREE.Vector3, color: number, life = 0.28): void {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(beamGeo, mat);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    group.add(mesh);
    parts.push({ mesh, vel: new THREE.Vector3(), life, max: life });
  }

  function ring(pos: THREE.Vector3, color: number, radius: number, life = 0.8): void {
    const g = new THREE.RingGeometry(radius * 0.7, radius, reduced ? 16 : 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos);
    mesh.position.y = 0.08;
    group.add(mesh);
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.15, reduced ? 12 : 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    );
    cyl.position.copy(pos);
    group.add(cyl);
    parts.push({ mesh, vel: new THREE.Vector3(), life, max: life });
    parts.push({ mesh: cyl, vel: new THREE.Vector3(), life, max: life });
  }

  function update(dt: number, _reduced: boolean): void {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const mat = (p.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat && 'opacity' in mat) mat.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) {
        group.remove(p.mesh);
        parts.splice(i, 1);
      }
    }
  }

  function clear(): void {
    while (parts.length) {
      const p = parts.pop()!;
      group.remove(p.mesh);
    }
  }

  return { group, burst, beam, ring, update, clear };
}
