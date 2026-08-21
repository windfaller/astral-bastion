import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { BattleEvent, Vec3 } from '../game/types';
import type { BattleSim, SimUnit } from '../game/systems/battle';
import { buildBattlefieldPaths, samplePath, tangentAt } from '../game/systems/pathfinding';
import { CHARACTERS } from '../game/data/characters';
import { ENEMIES } from '../game/data/enemies';
import { AnimQueue, poseFor, type AnimSpeed } from './animations';
import { createVfx } from './vfx';
import { play } from '../audio/cues';
import { assetUrl } from '../ui/Art';

const SLOT_LAYER = 2;
const UNIT_LAYER = 3;

export interface BoardHandle {
  screenToWorld: (x: number, y: number) => Vec3 | null;
  pickSlot: (x: number, y: number) => string | null;
  pickUnit: (x: number, y: number) => string | null;
  pickAccel: (x: number, y: number) => boolean;
}

interface Props {
  sim: BattleSim;
  version: number;
  anim: AnimQueue;
  speed: AnimSpeed;
  reduced: boolean;
  onReady?: (h: BoardHandle) => void;
  onSlotHit?: (id: string) => void;
  onUnitHit?: (id: string) => void;
  onAccel?: () => void;
  onGround?: (p: Vec3) => void;
  selected?: string | null;
}

function artUrl(kind: 'char' | 'enemy' | 'boss', id: string, file = 'full.webp'): string {
  if (kind === 'char') return assetUrl(`assets/characters/${id}/${file}`);
  if (kind === 'boss') return assetUrl(`assets/boss/${id}.webp`);
  return assetUrl(`assets/enemies/${id}.webp`);
}

function loadTex(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
}

function hash01(i: number, salt = 1): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeAsphaltTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#10141c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const g = 16 + ((i * 17) % 30);
    ctx.fillStyle = `rgba(${g},${g + 3},${g + 8},${0.07 + (i % 5) * 0.018})`;
    ctx.fillRect((i * 37) % 256, (i * 91) % 256, 2, 2);
  }
  ctx.strokeStyle = 'rgba(90,140,170,0.07)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 48) % 256, 0);
    ctx.lineTo((i * 48 + 36) % 256, 256);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 1.4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWindowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0b1018';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 5; y < 122; y += 8) {
    for (let x = 4; x < 60; x += 7) {
      const lit = ((x * 13 + y * 17) % 10) > 3;
      if (!lit) continue;
      const warm = ((x + y) % 7) === 0;
      ctx.fillStyle = warm ? '#ffd8a0' : '#c8e4ff';
      ctx.globalAlpha = 0.28 + ((x * y) % 5) * 0.1;
      ctx.fillRect(x, y, 3, 4);
    }
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(2, 4);
  return t;
}

function makeGroundTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0a0e16';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(40,70,90,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 16, 0);
    ctx.lineTo(i * 16, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * 16);
    ctx.lineTo(256, i * 16);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeCoreSprite(): THREE.CanvasTexture {
  const sc = document.createElement('canvas');
  sc.width = 128;
  sc.height = 48;
  const sctx = sc.getContext('2d')!;
  const g = sctx.createRadialGradient(64, 24, 4, 64, 24, 60);
  g.addColorStop(0, 'rgba(126,249,255,0.55)');
  g.addColorStop(1, 'rgba(126,249,255,0)');
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, 128, 48);
  sctx.fillStyle = '#e8ffff';
  sctx.font = 'bold 18px "Noto Sans TC", sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('CORE', 64, 30);
  return new THREE.CanvasTexture(sc);
}

function pathCurve(pts: Vec3[], yOff = 0): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p.x, p.y + yOff, p.z)),
    false,
    'catmullrom',
    0.15,
  );
}

function extrudeRibbon(curve: THREE.CatmullRomCurve3, width: number, thickness: number, steps: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hw = width * 0.5;
  const ht = thickness * 0.5;
  shape.moveTo(-hw, -ht);
  shape.lineTo(hw, -ht);
  shape.lineTo(hw, ht);
  shape.lineTo(-hw, ht);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { steps, bevelEnabled: false, extrudePath: curve });
}

export function Board({ sim, version, anim, speed, reduced, onReady, onSlotHit, onUnitHit, onAccel, onGround, selected }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const state = useRef({ sim, anim, speed, selected, version, onSlotHit, onUnitHit, onAccel, onGround });
  state.current = { sim, anim, speed, selected, version, onSlotHit, onUnitHit, onAccel, onGround };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x152033);
    scene.fog = new THREE.Fog(0x152033, 36, 78);

    const renderer = new THREE.WebGLRenderer({ antialias: !reduced, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, reduced ? 1.25 : 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = !reduced;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';

    const cam = new THREE.PerspectiveCamera(42, el.clientWidth / Math.max(1, el.clientHeight), 0.1, 120);
    const basePos = new THREE.Vector3(0.55, 12.6, 18.4);
    const look = new THREE.Vector3(0.15, 0.55, 1.2);
    cam.position.copy(basePos);
    cam.lookAt(look);
    cam.layers.enable(SLOT_LAYER);
    cam.layers.enable(UNIT_LAYER);

    scene.add(new THREE.AmbientLight(0x7d8eaa, 0.82));
    scene.add(new THREE.HemisphereLight(0xc5d6f0, 0x1a2436, 0.58));
    const moon = new THREE.DirectionalLight(0xc5d4ff, 1.22);
    moon.position.set(-8, 18, 6);
    if (!reduced) {
      moon.castShadow = true;
      moon.shadow.mapSize.set(1024, 1024);
    }
    scene.add(moon);
    const cyan = new THREE.PointLight(0x3cefff, 1.45, 30);
    cyan.position.set(0, 3, 0);
    scene.add(cyan);
    const fill = new THREE.DirectionalLight(0x4a6a88, 0.38);
    fill.position.set(4, 8, -10);
    scene.add(fill);

    const bf = sim.bf;
    const paths = buildBattlefieldPaths(bf);

    const backdropMat = new THREE.MeshBasicMaterial({
      color: 0x5a6a7c,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      fog: false,
      depthTest: false,
    });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(88, 50), backdropMat);
    backdrop.position.set(0, 7.2, -36);
    backdrop.renderOrder = -20;
    cam.add(backdrop);
    scene.add(cam);
    void (async () => {
      const tex = (await loadTex(assetUrl('assets/bg/battlefield.webp'))) ?? (await loadTex(assetUrl('assets/bg/title.webp')));
      if (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        scene.background = tex;
        scene.backgroundIntensity = 0.34;
        scene.fog = new THREE.Fog(new THREE.Color(0x1c2838), 38, 86);
        backdropMat.map = tex;
        backdropMat.color.setHex(0x667788);
        backdropMat.needsUpdate = true;
      }
    })();

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(28, reduced ? 24 : 48),
      new THREE.MeshStandardMaterial({
        color: 0x101820,
        map: makeGroundTex(),
        roughness: 0.88,
        metalness: 0.12,
        emissive: 0x061018,
        emissiveIntensity: 0.18,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.36;
    ground.receiveShadow = true;
    scene.add(ground);

    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.8, 0.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x161e2a, roughness: 0.55, metalness: 0.28, emissive: 0x0a1824, emissiveIntensity: 0.2 }),
    );
    plaza.position.set(-11.2, -0.28, 6.4);
    scene.add(plaza);

    const winTex = makeWindowTex();
    const buildMat = new THREE.MeshStandardMaterial({
      color: 0x141c28,
      map: winTex,
      emissive: 0x8fb8d8,
      emissiveMap: winTex,
      emissiveIntensity: 0.55,
      roughness: 0.78,
      metalness: 0.18,
    });
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x7ef9ff,
      emissive: 0x3cefff,
      emissiveIntensity: 1.15,
      roughness: 0.35,
      metalness: 0.4,
    });
    const buildingCount = reduced ? 10 : 22;
    for (let i = 0; i < buildingCount; i++) {
      const a = (i / buildingCount) * Math.PI * 2 + hash01(i, 2) * 0.18;
      const rad = 16.2 + hash01(i, 3) * 3.4 + (i % 5) * 0.35;
      const w = 1.15 + hash01(i, 4) * 1.35;
      const d = 1.05 + hash01(i, 5) * 1.1;
      const h = 3.4 + hash01(i, 6) * (reduced ? 6 : 10);
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildMat);
      box.position.set(Math.cos(a) * rad, h * 0.5 - 0.34, Math.sin(a) * rad);
      box.rotation.y = a + 0.4;
      box.castShadow = !reduced;
      scene.add(box);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.07, d * 0.92), stripMat);
      strip.position.set(box.position.x, h * 0.22 + hash01(i, 7) * h * 0.4, box.position.z);
      strip.rotation.y = box.rotation.y;
      scene.add(strip);
      if (!reduced && i % 4 === 0) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.35, d * 0.55), stripMat);
        cap.position.set(box.position.x, h - 0.12, box.position.z);
        scene.add(cap);
      }
    }
    if (!reduced) {
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI * 0.15 + i * 0.22 + hash01(i, 9) * 0.05;
        const rad = 20.5 + (i % 3) * 0.8;
        const h = 7 + hash01(i, 10) * 8;
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.6 + (i % 3) * 0.4, h, 1.3), buildMat);
        box.position.set(Math.cos(a) * rad - 2, h * 0.5 - 0.3, Math.sin(a) * rad - 6);
        scene.add(box);
      }
    }

    const asphalt = makeAsphaltTex();
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x1a2230,
      map: asphalt,
      roughness: 0.38,
      metalness: 0.46,
      emissive: 0x081018,
      emissiveIntensity: 0.22,
    });
    const feederMat = roadMat.clone();
    feederMat.color = new THREE.Color(0x161c26);

    const mainCurve = pathCurve(paths.main.points, 0.02);
    const mainRoad = new THREE.Mesh(extrudeRibbon(mainCurve, 2.15, 0.32, reduced ? 64 : 140), roadMat);
    mainRoad.receiveShadow = true;
    mainRoad.castShadow = !reduced;
    scene.add(mainRoad);

    const feederACurve = pathCurve(paths.feederA.points, 0.02);
    const feederBCurve = pathCurve(paths.feederB.points, 0.02);
    scene.add(new THREE.Mesh(extrudeRibbon(feederACurve, 1.28, 0.2, reduced ? 36 : 70), feederMat));
    scene.add(new THREE.Mesh(extrudeRibbon(feederBCurve, 1.28, 0.2, reduced ? 36 : 70), feederMat));

    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xd6e4f0, transparent: true, opacity: 0.4 });
    for (const off of [-1.08, 1.08]) {
      const pts: THREE.Vector3[] = [];
      const steps = reduced ? 24 : 40;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = samplePath(paths.main, t);
        const tan = tangentAt(paths.main, t);
        pts.push(new THREE.Vector3(p.x - tan.z * off, p.y + 0.2, p.z + tan.x * off));
      }
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15), reduced ? 40 : 80, 0.03, 5, false), edgeMat));
    }

    const dashMat = new THREE.MeshBasicMaterial({ color: 0xe8f2ff, transparent: true, opacity: 0.62 });
    const dashGeo = new THREE.BoxGeometry(0.46, 0.035, 0.075);
    const dashCount = reduced ? 12 : 22;
    for (let i = 1; i < dashCount; i++) {
      const t = i / dashCount;
      const p = samplePath(paths.main, t);
      const tan = tangentAt(paths.main, t);
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(p.x, p.y + 0.2, p.z);
      const flat = new THREE.Vector3(tan.x, 0, tan.z);
      if (flat.lengthSq() > 1e-6) dash.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), flat.normalize());
      scene.add(dash);
    }

    function tubeFrom(id: keyof typeof paths, color: number, radius: number): THREE.Mesh {
      const pts = paths[id].points.map((p) => new THREE.Vector3(p.x, p.y + 0.22, p.z));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
      const geo = new THREE.TubeGeometry(curve, reduced ? 80 : 160, radius, reduced ? 6 : 10, false);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.3,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      return mesh;
    }

    const mainTube = tubeFrom('main', 0x3cefff, 0.09);
    tubeFrom('feederA', 0x5b8cff, 0.055);
    tubeFrom('feederB', 0x7a5bff, 0.055);

    const b0 = samplePath(paths.main, bf.bridge.t0);
    const b1 = samplePath(paths.main, bf.bridge.t1);
    const bridgeLen = Math.hypot(b1.x - b0.x, b1.z - b0.z) + 1.6;
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(bridgeLen, 0.28, 2.55),
      new THREE.MeshStandardMaterial({ color: 0x3d4a62, metalness: 0.58, roughness: 0.3, emissive: 0x102030, emissiveIntensity: 0.25 }),
    );
    bridge.position.set((b0.x + b1.x) / 2, bf.bridge.height - 0.28, (b0.z + b1.z) / 2);
    bridge.rotation.y = Math.atan2(b1.x - b0.x, b1.z - b0.z);
    bridge.castShadow = !reduced;
    scene.add(bridge);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2a3548, metalness: 0.28, roughness: 0.62 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x3a4658, metalness: 0.35, roughness: 0.5 });
    const pillarTs: number[] = [];
    for (let i = 0; i <= (reduced ? 8 : 14); i++) pillarTs.push(i / (reduced ? 8 : 14));
    for (const extra of [bf.bridge.t0, (bf.bridge.t0 + bf.bridge.t1) / 2, bf.bridge.t1]) pillarTs.push(extra);
    const seenP = new Set<string>();
    for (const t of pillarTs) {
      const p = samplePath(paths.main, t);
      if (p.y < 0.38 && (t < bf.bridge.t0 - 0.02 || t > bf.bridge.t1 + 0.02)) continue;
      const key = `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
      if (seenP.has(key)) continue;
      seenP.add(key);
      const top = p.y - 0.12;
      const h = Math.max(0.7, top + 0.36);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, h, reduced ? 6 : 10), pillarMat);
      pillar.position.set(p.x, h * 0.5 - 0.36, p.z);
      pillar.castShadow = !reduced;
      scene.add(pillar);
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.22, 0.16, 8), capMat);
      capital.position.set(p.x, top, p.z);
      scene.add(capital);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.14, 8), capMat);
      base.position.set(p.x, -0.28, p.z);
      scene.add(base);
    }

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x6a7c94,
      roughness: 0.28,
      metalness: 0.82,
      emissive: 0x123848,
      emissiveIntensity: 0.35,
    });
    const railCapMat = new THREE.MeshStandardMaterial({ color: 0x7ef9ff, emissive: 0x3cefff, emissiveIntensity: 0.85 });
    const postGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.62, 5);
    const railSteps = reduced ? 18 : 32;
    for (const side of [-1.12, 1.12]) {
      const railPts: THREE.Vector3[] = [];
      for (let i = 0; i <= railSteps; i++) {
        const t = i / railSteps;
        const p = samplePath(paths.main, t);
        const tan = tangentAt(paths.main, t);
        const x = p.x - tan.z * side;
        const z = p.z + tan.x * side;
        railPts.push(new THREE.Vector3(x, p.y + 0.58, z));
        if (i % 2 === 0) {
          const post = new THREE.Mesh(postGeo, railMat);
          post.position.set(x, p.y + 0.38, z);
          scene.add(post);
        }
      }
      const railCurve = new THREE.CatmullRomCurve3(railPts, false, 'catmullrom', 0.15);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(railCurve, reduced ? 40 : 80, 0.032, 5, false), railMat));
      const capPts = railPts.map((p) => p.clone().setY(p.y + 0.05));
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(capPts, false, 'catmullrom', 0.15), reduced ? 40 : 80, 0.016, 5, false), railCapMat));
    }

    const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x2c3648, metalness: 0.68, roughness: 0.32 });
    const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xd6eeff, emissive: 0x9ad8ff, emissiveIntensity: 2.2 });
    const lampTs = reduced ? [0.12, 0.5, 0.84] : [0.08, 0.22, 0.38, 0.52, 0.68, 0.84, 0.96];
    for (const t of lampTs) {
      const p = samplePath(paths.main, t);
      const tan = tangentAt(paths.main, t);
      const sx = p.x - tan.z * 1.28;
      const sz = p.z + tan.x * 1.28;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.062, 2.35, 6), lampPoleMat);
      pole.position.set(sx, p.y + 1.18, sz);
      scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.045, 0.05), lampPoleMat);
      arm.position.set(sx + tan.z * 0.28, p.y + 2.32, sz - tan.x * 0.28);
      const flat = new THREE.Vector3(tan.z, 0, -tan.x);
      if (flat.lengthSq() > 1e-6) arm.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), flat.normalize());
      scene.add(arm);
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.16), lampHeadMat);
      fixture.position.set(sx + tan.z * 0.55, p.y + 2.24, sz - tan.x * 0.55);
      scene.add(fixture);
      if (!reduced) {
        const lamp = new THREE.PointLight(0xb8dcff, 0.4, 5.6);
        lamp.position.set(sx + tan.z * 0.5, p.y + 2.2, sz - tan.x * 0.5);
        scene.add(lamp);
      }
    }

    for (const ob of bf.obstacles.filter((o) => o.kind === 'pylon' || o.kind === 'crate')) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(ob.size.x, ob.size.y, ob.size.z),
        new THREE.MeshStandardMaterial({ color: ob.kind === 'pylon' ? 0x5c6b82 : 0x8a6a3a, roughness: 0.55, metalness: ob.kind === 'pylon' ? 0.35 : 0.1 }),
      );
      mesh.position.set(ob.pos.x, ob.pos.y, ob.pos.z);
      mesh.castShadow = true;
      scene.add(mesh);
    }

    const gateGroupMesh = new THREE.Group();
    gateGroupMesh.position.set(bf.gate.pos.x, 0, bf.gate.pos.z);
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x9aa8c2, metalness: 0.58, roughness: 0.28, emissive: 0x223344, emissiveIntensity: 0.35 });
    const gpL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.9, 0.36), gateMat);
    gpL.position.set(-0.72, 0.95, 0);
    const gpR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.9, 0.36), gateMat);
    gpR.position.set(0.72, 0.95, 0);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.28, 0.4), gateMat);
    lintel.position.set(0, 1.85, 0);
    gateGroupMesh.add(gpL, gpR, lintel);
    scene.add(gateGroupMesh);
    const gate = gateGroupMesh;

    const platMeshes: Record<string, THREE.Mesh> = {};
    const emptyRings: Record<string, THREE.Mesh> = {};
    for (const sl of bf.slots) {
      const isP = sl.kind === 'platform';
      const g = isP ? new THREE.CylinderGeometry(1.05, 1.15, 0.28, 12) : new THREE.CylinderGeometry(0.85, 0.9, 0.14, 12);
      const m = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({
          color: isP ? 0x1b3a4a : 0x243044,
          emissive: isP ? 0x0a6a88 : 0x102030,
          emissiveIntensity: 0.45,
        }),
      );
      m.position.set(sl.pos.x, isP ? sl.pos.y - 0.85 : 0.02, sl.pos.z);
      scene.add(m);
      platMeshes[sl.id] = m;
      if (isP) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, sl.pos.y - 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x2a3548 }));
        stem.position.set(sl.pos.x, (sl.pos.y - 0.2) / 2, sl.pos.z);
        scene.add(stem);
        const pulse = new THREE.Mesh(
          new THREE.TorusGeometry(1.08, 0.05, 8, reduced ? 20 : 32),
          new THREE.MeshBasicMaterial({ color: 0x3cefff, transparent: true, opacity: 0.55, depthWrite: false }),
        );
        pulse.rotation.x = Math.PI / 2;
        pulse.position.set(sl.pos.x, sl.pos.y - 0.68, sl.pos.z);
        scene.add(pulse);
        emptyRings[sl.id] = pulse;
      }
    }

    const accel = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45),
      new THREE.MeshStandardMaterial({ color: 0x7ef9ff, emissive: 0x3cefff, emissiveIntensity: 1.2 }),
    );
    accel.position.set(bf.accel.pos.x, 0.7, bf.accel.pos.z);
    scene.add(accel);

    const gateGroup = new THREE.Group();
    gateGroup.position.set(bf.astralGate.pos.x, bf.astralGate.pos.y, bf.astralGate.pos.z);
    const torusMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7ef9ff, emissiveIntensity: 2.2, metalness: 0.4, roughness: 0.16 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.13, 10, reduced ? 28 : 56), torusMat);
    ring.rotation.y = 0.55;
    gateGroup.add(ring);
    const ringMid = new THREE.Mesh(
      new THREE.TorusGeometry(1.52, 0.06, 8, reduced ? 22 : 44),
      new THREE.MeshStandardMaterial({ color: 0xdfffff, emissive: 0xb8ffff, emissiveIntensity: 1.9, metalness: 0.35, roughness: 0.2 }),
    );
    ringMid.rotation.x = 0.4;
    gateGroup.add(ringMid);
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.045, 8, reduced ? 18 : 36),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7ef9ff, emissiveIntensity: 2.0 }),
    );
    innerRing.rotation.z = 0.3;
    gateGroup.add(innerRing);
    const innerDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.42, reduced ? 20 : 36),
      new THREE.MeshBasicMaterial({ color: 0x3cefff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
    );
    gateGroup.add(innerDisc);
    const glowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.95, reduced ? 16 : 28),
      new THREE.MeshBasicMaterial({ color: 0x7ef9ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    );
    glowDisc.position.z = -0.04;
    gateGroup.add(glowDisc);
    if (!reduced) {
      const portal = new THREE.PointLight(0x7ef9ff, 1.05, 10);
      portal.position.set(0, 0.15, 0);
      gateGroup.add(portal);
    }
    scene.add(gateGroup);

    type Bill = {
      group: THREE.Group;
      plane: THREE.Sprite | THREE.Mesh;
      shadow: THREE.Mesh;
      label: THREE.Sprite;
      flash: number;
      bob: number;
      billboard: boolean;
    };
    const units = new Map<string, Bill>();

    const slotHits: THREE.Mesh[] = [];
    for (const sl of bf.slots) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
      h.position.set(sl.pos.x, sl.kind === 'platform' ? sl.pos.y : 0.3, sl.pos.z);
      h.userData.slotId = sl.id;
      h.layers.set(SLOT_LAYER);
      scene.add(h);
      slotHits.push(h);
    }
    const accelHit = new THREE.Mesh(new THREE.SphereGeometry(0.7), new THREE.MeshBasicMaterial({ visible: false }));
    accelHit.position.copy(accel.position);
    accelHit.userData.accel = true;
    accelHit.layers.set(SLOT_LAYER);
    scene.add(accelHit);

    const vfx = createVfx(scene, reduced);
    let composer: EffectComposer | null = null;
    if (!reduced) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, cam));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), 0.38, 0.48, 0.84));
      composer.addPass(new OutputPass());
    }
    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();
    raycaster.layers.enable(SLOT_LAYER);
    const rayUnits = new THREE.Raycaster();
    rayUnits.layers.enable(UNIT_LAYER);
    const pointer = new THREE.Vector2();

    let yaw = 0;
    let zoom = 1;
    let dolly = 0;
    let dollyT = 0;
    let dragging = false;
    let lastX = 0;
    const seenEvents = new Set<number>();

    const texCache = new Map<string, Promise<THREE.Texture | null>>();
    function tex(url: string): Promise<THREE.Texture | null> {
      let p = texCache.get(url);
      if (!p) {
        p = loadTex(url);
        texCache.set(url, p);
      }
      return p;
    }

    function applyBillboardMat(mat: THREE.SpriteMaterial, map: THREE.Texture | null): void {
      mat.map = map;
      mat.transparent = true;
      mat.alphaTest = 0.08;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    }

    function makeBillboard(color: string, name: string, size: { w: number; h: number }, valk: boolean): Bill {
      const group = new THREE.Group();
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 384;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(128, 300, 70, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(128, 40);
      ctx.bezierCurveTo(200, 40, 220, 160, 190, 250);
      ctx.lineTo(66, 250);
      ctx.bezierCurveTo(36, 160, 56, 40, 128, 40);
      ctx.fill();
      ctx.fillStyle = '#e8f4ff';
      ctx.font = 'bold 28px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name.slice(0, 6), 128, 200);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const plane = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.08,
          depthWrite: true,
          color: 0xffffff,
        }),
      );
      plane.scale.set(size.w, size.h, 1);
      plane.position.y = size.h * 0.5 + 0.16;
      group.add(plane);
      const pick = new THREE.Mesh(
        new THREE.PlaneGeometry(size.w, size.h),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
      );
      pick.position.y = size.h * 0.5 + 0.16;
      pick.layers.set(UNIT_LAYER);
      pick.userData.pick = true;
      group.add(pick);

      if (valk) {
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.46, 0.52, 0.18, 6),
          new THREE.MeshStandardMaterial({ color: 0x1a3a4a, metalness: 0.55, roughness: 0.32, emissive: 0x0a6a88, emissiveIntensity: 0.55 }),
        );
        pad.position.y = 0.1;
        group.add(pad);
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.5, 0.028, 6, 6),
          new THREE.MeshStandardMaterial({ color: 0x7ef9ff, emissive: 0x3cefff, emissiveIntensity: 1.05 }),
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.2;
        group.add(rim);
      } else {
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.4, 0.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x1a1218, metalness: 0.22, roughness: 0.72, emissive: 0x220811, emissiveIntensity: 0.32 }),
        );
        pad.position.y = 0.06;
        group.add(pad);
      }

      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(0.42, size.w * 0.24), 12),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.02;
      group.add(shadow);
      const sc = document.createElement('canvas');
      sc.width = 128;
      sc.height = 32;
      const sctx = sc.getContext('2d')!;
      sctx.fillStyle = 'rgba(0,0,0,0.45)';
      sctx.fillRect(0, 0, 128, 32);
      sctx.fillStyle = '#d7e7ff';
      sctx.font = '16px sans-serif';
      sctx.textAlign = 'center';
      sctx.fillText(name, 64, 22);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), transparent: true }));
      spr.scale.set(1.4, 0.35, 1);
      spr.position.y = size.h + 0.52;
      group.add(spr);
      return { group, plane, shadow, label: spr, flash: 0, bob: Math.random() * 10, billboard: true };
    }

    function makeCore(): Bill {
      const group = new THREE.Group();
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.46, 1),
        new THREE.MeshStandardMaterial({
          color: 0x7ef9ff,
          emissive: 0x3cefff,
          emissiveIntensity: 2.1,
          roughness: 0.16,
          metalness: 0.42,
          transparent: true,
          opacity: 0.94,
        }),
      );
      orb.position.y = 0.62;
      orb.layers.set(UNIT_LAYER);
      group.add(orb);
      const inner = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.22, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }),
      );
      inner.position.y = 0.62;
      group.add(inner);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.03, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x7ef9ff, transparent: true, opacity: 0.55 }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.62;
      group.add(halo);
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 12),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.02;
      group.add(shadow);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeCoreSprite(), transparent: true, depthWrite: false }));
      spr.scale.set(1.15, 0.42, 1);
      spr.position.y = 1.42;
      group.add(spr);
      if (!reduced) {
        const glow = new THREE.PointLight(0x3cefff, 1.15, 7.5);
        glow.position.set(0, 0.75, 0);
        group.add(glow);
      }
      return { group, plane: orb, shadow, label: spr, flash: 0, bob: Math.random() * 10, billboard: false };
    }

    function unitSize(u: SimUnit): { w: number; h: number } {
      if (u.charId) return { w: 2.2, h: 3.2 };
      if (u.enemyId === 'yamato') return { w: 2.4, h: 3.4 };
      return { w: 1.6, h: 2.2 };
    }

    function ensureUnit(u: SimUnit): Bill {
      let b = units.get(u.id);
      if (b) return b;
      if (u.kind === 'core') {
        b = makeCore();
        units.set(u.id, b);
        scene.add(b.group);
        return b;
      }
      const color = u.charId ? CHARACTERS[u.charId].color : u.enemyId ? ENEMIES[u.enemyId].color : '#888';
      const name = u.charId ? CHARACTERS[u.charId].name : u.enemyId ? ENEMIES[u.enemyId].name : u.name;
      b = makeBillboard(color, name, unitSize(u), !!u.charId);
      units.set(u.id, b);
      scene.add(b.group);
      let url = '';
      if (u.charId) url = artUrl('char', u.charId, 'full.webp');
      else if (u.enemyId === 'yamato') url = artUrl('boss', sim.bossPhase === 2 ? 'yamato-phase2' : 'yamato-phase1');
      else if (u.enemyId) url = artUrl('enemy', u.enemyId);
      if (url) {
        const bill = b;
        void tex(url).then((t) => {
          if (t && bill.plane instanceof THREE.Sprite) {
            applyBillboardMat(bill.plane.material, t);
          }
        });
      }
      return b;
    }

    const handle: BoardHandle = {
      screenToWorld(x, y) {
        const r = el.getBoundingClientRect();
        pointer.x = ((x - r.left) / r.width) * 2 - 1;
        pointer.y = -((y - r.top) / r.height) * 2 + 1;
        raycaster.setFromCamera(pointer, cam);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, hit);
        return hit ? { x: hit.x, y: 0, z: hit.z } : null;
      },
      pickSlot(x, y) {
        const r = el.getBoundingClientRect();
        pointer.x = ((x - r.left) / r.width) * 2 - 1;
        pointer.y = -((y - r.top) / r.height) * 2 + 1;
        raycaster.setFromCamera(pointer, cam);
        const hits = raycaster.intersectObjects(slotHits, false);
        return hits[0]?.object.userData.slotId ?? null;
      },
      pickUnit(x, y) {
        const r = el.getBoundingClientRect();
        pointer.x = ((x - r.left) / r.width) * 2 - 1;
        pointer.y = -((y - r.top) / r.height) * 2 + 1;
        rayUnits.setFromCamera(pointer, cam);
        const meshes = [...units.values()].flatMap((b) => b.group.children.filter((c) => c.userData.pick));
        const hits = rayUnits.intersectObjects(meshes, false);
        if (!hits[0]) return null;
        for (const [id, b] of units) {
          if (hits[0].object.parent === b.group) return id;
        }
        return null;
      },
      pickAccel(x, y) {
        const r = el.getBoundingClientRect();
        pointer.x = ((x - r.left) / r.width) * 2 - 1;
        pointer.y = -((y - r.top) / r.height) * 2 + 1;
        raycaster.setFromCamera(pointer, cam);
        return raycaster.intersectObject(accelHit, false).length > 0;
      },
    };
    onReady?.(handle);

    function onPtr(e: PointerEvent): void {
      if (e.type === 'pointerdown') {
        dragging = true;
        lastX = e.clientX;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }
      if (e.type === 'pointerup' || e.type === 'pointercancel') dragging = false;
      if (e.type === 'pointermove' && dragging && e.buttons === 2) {
        yaw = Math.max(-18, Math.min(18, yaw + (e.clientX - lastX) * 0.12));
        lastX = e.clientX;
      }
    }
    function onWheel(e: WheelEvent): void {
      e.preventDefault();
      zoom = Math.max(0.75, Math.min(1.4, zoom + (e.deltaY > 0 ? 0.04 : -0.04)));
    }
    function onClick(e: MouseEvent): void {
      const slot = handle.pickSlot(e.clientX, e.clientY);
      if (slot) {
        state.current.onSlotHit?.(slot);
        return;
      }
      if (handle.pickAccel(e.clientX, e.clientY)) {
        state.current.onAccel?.();
        return;
      }
      const u = handle.pickUnit(e.clientX, e.clientY);
      if (u) {
        state.current.onUnitHit?.(u);
        dollyT = 1;
        return;
      }
      const w = handle.screenToWorld(e.clientX, e.clientY);
      if (w) state.current.onGround?.(w);
    }
    function onContext(e: Event): void {
      e.preventDefault();
    }
    let tDist = 0;
    function onTouch(e: TouchEvent): void {
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        zoom = Math.max(0.75, Math.min(1.4, zoom + (d - (tDist || d)) * 0.004));
        tDist = d;
      } else tDist = 0;
    }

    el.addEventListener('pointerdown', onPtr);
    el.addEventListener('pointermove', onPtr);
    el.addEventListener('pointerup', onPtr);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('click', onClick);
    el.addEventListener('contextmenu', onContext);
    el.addEventListener('touchmove', onTouch, { passive: true });

    let raf = 0;
    const tmp = new THREE.Vector3();

    function applyEvent(ev: BattleEvent): void {
      const key = ev.tick * 1000 + ev.type.length + (ev.amount ?? 0);
      if (seenEvents.has(key + ((ev.time * 10) | 0))) return;
      seenEvents.add(((ev.time * 100) | 0) * 17 + ev.tick + ev.type.charCodeAt(0));
      const from = ev.pos ? new THREE.Vector3(ev.pos.x, ev.pos.y + 0.9, ev.pos.z) : null;
      const to = ev.endPos ? new THREE.Vector3(ev.endPos.x, ev.endPos.y + 0.6, ev.endPos.z) : null;
      if (ev.type === 'PROJECTILE_FIRED' && from && to) {
        if (ev.skillId === 'rail' || ev.skillId === 'starfault' || ev.sourceId === 'eve') {
          vfx.rail(from, to, ev.skillId === 'starfault' ? 0xb8ffff : 0x7ef9ff);
        } else {
          vfx.beam(from, to, ev.pierce ? 0x7ef9ff : 0xffd27a, ev.pierce ? 0.35 : 0.2);
        }
        if (ev.skillId === 'rail' || ev.skillId === 'starfault') play('sfx.eve.railgun');
      }
      if (ev.type === 'UNIT_HIT' && ev.pos) {
        const hp = new THREE.Vector3(ev.pos.x, ev.pos.y + 0.8, ev.pos.z);
        vfx.sparks(hp, 0xffe08a, 8);
        vfx.burst(hp, 0xffe08a, 5);
      }
      if (ev.type === 'TELEGRAPH' && ev.pos) {
        vfx.telegraph(new THREE.Vector3(ev.pos.x, ev.pos.y, ev.pos.z), ev.sourceId === 'aria' ? 2.2 : 2.6, ev.sourceId === 'aria' ? 0xfb7185 : 0xffaa66, 1.5);
      }
      if (ev.type === 'ARIA_MARK_DETONATE' && ev.pos) {
        const p = new THREE.Vector3(ev.pos.x, 0.4, ev.pos.z);
        vfx.burst(p, 0xfb7185, 16);
        vfx.sparks(p, 0xff99aa, 12);
        vfx.ring(new THREE.Vector3(ev.pos.x, 0.05, ev.pos.z), 0xff99aa, 3.2, 0.4);
      }
      if (ev.type === 'SKILL_CAST' && ev.sourceId === 'rin') {
        play('sfx.rin.slash');
        if (ev.pos) {
          const rin = units.get('rin');
          const origin = rin ? rin.group.position.clone() : new THREE.Vector3(ev.pos.x - 0.8, ev.pos.y, ev.pos.z);
          vfx.slash(origin, new THREE.Vector3(ev.pos.x, ev.pos.y + 0.35, ev.pos.z));
        }
      }
      if (ev.type === 'SKILL_CAST' && ev.sourceId === 'mio') play('sfx.mio.barrier');
      if ((ev.type === 'SKILL_CAST' || ev.type === 'ULT_CAST') && ev.sourceId === 'mio') {
        const c = state.current.sim.core.pos;
        const ult = ev.type === 'ULT_CAST' || ev.skillId === 'mio_ult';
        vfx.dome(new THREE.Vector3(c.x, c.y, c.z), ult ? 4.4 : 2.6, 0xff9ad4, ult ? 2.15 : 1.6);
      }
      if (ev.type === 'CORE_DAMAGED' && ev.pos) {
        vfx.burst(new THREE.Vector3(ev.pos.x, ev.pos.y + 0.6, ev.pos.z), 0xff4466, 10);
        vfx.sparks(new THREE.Vector3(ev.pos.x, ev.pos.y + 0.6, ev.pos.z), 0xff6688, 8);
        play('sfx.core.damage');
      }
      if (ev.type === 'LINK_TRIGGERED') {
        play('sfx.ult');
        dollyT = 2.0;
      }
      if (ev.type === 'BOSS_PHASE_CHANGED') {
        play('sfx.boss.phase');
        dollyT = 2.4;
      }
      if (ev.type === 'ACCEL_ACTIVATED') vfx.ring(new THREE.Vector3(bf.accel.pos.x, 0.1, bf.accel.pos.z), 0x7ef9ff, 2.4, 0.8);
      if (ev.type === 'GATE_DESTROYED') vfx.burst(new THREE.Vector3(bf.gate.pos.x, 1, bf.gate.pos.z), 0xcccccc, 18);
      if (ev.type === 'UNIT_KNOCKED_BACK' && ev.pos) vfx.burst(new THREE.Vector3(ev.pos.x, 0.5, ev.pos.z), 0x7ecbff, 5);
    }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      const st = state.current;
      const snap = st.sim;
      st.anim.update(dt);
      const live = st.anim.items;
      for (const it of live) applyEvent(it.event);
      for (const ev of snap.events.slice(-8)) applyEvent(ev);

      accel.rotation.y += dt * 1.6;
      accel.visible = !snap.accelUsed || snap.time < snap.accelUntil;
      (accel.material as THREE.MeshStandardMaterial).emissiveIntensity = snap.time < snap.accelUntil ? 2.2 : 1.1;
      gate.visible = !snap.gateDestroyed;
      ring.rotation.z += dt * 0.55;
      ringMid.rotation.y += dt * 0.72;
      innerRing.rotation.x += dt * 0.9;
      gateGroup.rotation.y += dt * 0.28;
      (innerDisc.material as THREE.MeshBasicMaterial).opacity = 0.24 + Math.sin(clock.elapsedTime * 2.2) * 0.08;
      (glowDisc.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(clock.elapsedTime * 1.6) * 0.04;
      (mainTube.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 3) * 0.2;

      if (snap.destroyedSegment) {
        (mainTube.material as THREE.MeshStandardMaterial).color.setHex(0x3a6070);
      }

      const all: SimUnit[] = [snap.core, ...snap.valkyries.filter((v) => v.deployed || (!v.dead && v.undeployUntil > snap.time)), ...snap.aliveEnemies()];
      const liveIds = new Set(all.map((u) => u.id));
      for (const u of all) {
        const b = ensureUnit(u);
        const ev = live.find((i) => i.event.sourceId === u.id || i.event.targetId === u.id)?.event;
        const pose = u.dead ? 'down' : poseFor(ev, u.id);
        b.bob += dt;
        let yOff = Math.sin(b.bob * 2.1) * 0.05;
        let zRot = 0;
        let xOff = 0;
        if (pose === 'attack') {
          xOff = Math.sin(clock.elapsedTime * 18) * 0.08;
          yOff += 0.06;
        } else if (pose === 'skill') {
          yOff += 0.18;
          zRot = Math.sin(clock.elapsedTime * 10) * 0.15;
        } else if (pose === 'hit') {
          b.flash = 0.2;
        } else if (pose === 'down') {
          zRot = 0.9;
          yOff = -0.35;
        } else if (pose === 'victory') {
          yOff += 0.25 + Math.sin(clock.elapsedTime * 6) * 0.08;
        }
        if (u.charId === 'rin' && ev?.type === 'SKILL_CAST') xOff += 0.4;
        b.group.position.set(u.pos.x + xOff, u.pos.y + yOff, u.pos.z);
        if (b.billboard) {
          if (b.plane instanceof THREE.Sprite) {
            (b.plane.material as THREE.SpriteMaterial).rotation = zRot;
          } else {
            b.plane.quaternion.copy(cam.quaternion);
            b.plane.rotateZ(zRot);
          }
          const mat = b.plane.material as THREE.SpriteMaterial | THREE.MeshBasicMaterial;
          if (b.flash > 0) {
            b.flash -= dt;
            mat.color.setHex(0xffe6e6);
          } else {
            mat.color.setHex(0xffffff);
          }
          if (st.selected === u.id) {
            mat.color.setHex(0xc6f6ff);
            dollyT = Math.max(dollyT, 0.35);
          }
        } else {
          b.plane.rotation.y += dt * 0.9;
          b.plane.rotation.x = 0.15;
          if (b.plane.material && 'emissiveIntensity' in (b.plane.material as THREE.MeshStandardMaterial)) {
            (b.plane.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.0 + Math.sin(clock.elapsedTime * 3.2) * 0.35;
          }
        }
      }
      for (const [id, b] of units) {
        if (!liveIds.has(id) && id !== 'core') {
          b.group.visible = false;
        } else b.group.visible = true;
      }

      const occupied = new Set(snap.valkyries.filter((v) => v.deployed && !v.dead && v.slotId).map((v) => v.slotId as string));
      for (const sl of bf.slots) {
        const m = platMeshes[sl.id];
        const jammed = snap.platforms.find((p) => p.id === sl.id)?.jammed;
        const locked = snap.slotLocked === sl.id;
        const empty = sl.kind === 'platform' && !occupied.has(sl.id) && !locked && !jammed;
        (m.material as THREE.MeshStandardMaterial).emissive.setHex(locked ? 0x661122 : jammed ? 0x665500 : sl.kind === 'platform' ? 0x0a6a88 : 0x102030);
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = empty ? 0.55 + Math.sin(clock.elapsedTime * 2.6) * 0.35 : 0.45;
        const ringM = emptyRings[sl.id];
        if (ringM) {
          ringM.visible = empty;
          if (empty) {
            const pulse = 0.32 + Math.sin(clock.elapsedTime * 2.5) * 0.24;
            (ringM.material as THREE.MeshBasicMaterial).opacity = pulse;
            const s = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.07;
            ringM.scale.set(s, s, 1);
          }
        }
      }

      for (const mark of snap.ariaMarks) {
        vfx.ring(new THREE.Vector3(mark.pos.x, 0.04, mark.pos.z), 0xfb7185, mark.radius, 0.2);
      }

      if (anim.cinematic) dollyT = Math.max(dollyT, 1.15);
      dolly = THREE.MathUtils.lerp(dolly, dollyT > 0 ? 0.22 : 0, dt * 3);
      if (dollyT > 0) dollyT -= dt;
      const yawR = (yaw * Math.PI) / 180;
      const z = zoom * (1 - dolly);
      tmp.set(basePos.x, basePos.y * z + 2 * dolly, basePos.z * z);
      tmp.x = basePos.x * Math.cos(yawR) - basePos.z * Math.sin(yawR) * 0.25;
      cam.position.lerp(tmp, 0.12);
      cam.lookAt(look);

      vfx.update(dt, reduced);
      if (composer) composer.render();
      else renderer.render(scene, cam);
    };
    loop();

    const onResize = () => {
      const w = el.clientWidth;
      const h = Math.max(1, el.clientHeight);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      el.removeEventListener('pointerdown', onPtr);
      el.removeEventListener('pointermove', onPtr);
      el.removeEventListener('pointerup', onPtr);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('click', onClick);
      el.removeEventListener('contextmenu', onContext);
      el.removeEventListener('touchmove', onTouch);
      composer?.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={wrap} className="board-root" />;
}
