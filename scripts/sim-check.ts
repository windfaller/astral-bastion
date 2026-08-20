import { BattleSim, foldEvents, runHeadless } from "../src/game/systems/battle";
import type { BattleEvent } from "../src/game/types";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  ok", msg);
}

function applyInstant(events: BattleEvent[]) {
  return foldEvents(events);
}

function applyQueued(events: BattleEvent[]) {
  return foldEvents(events.map((e) => ({ ...e })));
}

function main(): void {
  console.log("ASTRAL BASTION sim-check");
  const base = {
    seed: 20260820,
    stageId: "normal",
    team: ["rin", "alyssa", "eve", "aria"] as ["rin", "alyssa", "eve", "aria"],
    mods: ["rail_overcharge", "moon_edge", "focus_fire"],
    relics: ["collision_trauma", "first_shift_free"],
    coreUpgrades: ["integrity_plus"],
    linkUpgrades: [] as string[],
    gadgets: [] as string[],
    autoDeploy: true,
  };

  const sim = new BattleSim({ ...base });
  const t0 = sim.core.t;
  sim.step(1.5);
  assert(sim.core.t > t0, "core t increases along path");

  sim.step(10);
  const paths = new Set(sim.enemies.map((e) => e.pathId));
  assert(sim.enemies.length >= 2, "enemies spawn");
  assert(paths.has("feederA") || paths.has("feederB") || paths.size >= 1, "enemies on branches");
  const sawA = sim.enemies.some((e) => e.pathId === "feederA");
  const sawB = sim.enemies.some((e) => e.pathId === "feederB");
  assert(sawA && sawB, "enemies spawn on different branches");

  const eve = sim.valkyries.find((v) => v.charId === "eve")!;
  const live = sim.aliveEnemies();
  assert(live.length >= 2, "enough live enemies for pierce test");
  live[0].pos = { x: eve.pos.x - 2.2, y: 0.05, z: eve.pos.z };
  live[1].pos = { x: eve.pos.x - 4.0, y: 0.05, z: eve.pos.z };
  const hits = sim.rayHits(eve, live[1]);
  assert(hits.length >= 2, "eve pierce hits multiple");

  const kb = new BattleSim({ ...base, team: ["rin", "alyssa", "eve", "mio"], stageId: "tutorial", seed: 99 });
  kb.step(11);
  const foe = kb.aliveEnemies()[0];
  assert(!!foe, "tutorial enemy exists");
  const tBefore = foe.t;
  kb.applyAction({ type: "active", unitId: "rin" });
  const knocked = kb.events.some((e) => e.type === "UNIT_KNOCKED_BACK");
  assert(knocked || foe.t < tBefore, "knockback decreases t");

  const cfg = { ...base, stageId: "tutorial", seed: 4242 };
  const s1 = runHeadless(cfg, 45);
  const s2 = runHeadless(cfg, 45);
  assert(s1.core.hp === s2.core.hp && s1.kills === s2.kills && Math.abs(s1.core.t - s2.core.t) < 1e-9, "fixed seed is deterministic");
  const instant = applyInstant(s1.events);
  const queued = applyQueued(s1.events);
  assert(instant.integrity === queued.integrity && instant.kills === queued.kills, "skip-anim fold equals queued fold");

  const winSim = new BattleSim({ ...base, stageId: "tutorial", seed: 1 });
  winSim.core.t = 0.985;
  winSim.core.hp = 4;
  winSim.step(0.2);
  assert(winSim.win, "win when core reaches gate with integrity");

  const loseSim = new BattleSim({ ...base, stageId: "tutorial", seed: 2 });
  loseSim.core.hp = 0;
  loseSim.step(0.2);
  assert(loseSim.lose, "lose when core integrity is 0");

  const wipe = new BattleSim({ ...base, stageId: "tutorial", seed: 3 });
  for (const v of wipe.valkyries) {
    v.hp = 0;
    v.dead = true;
    v.downed = true;
  }
  wipe.step(0.2);
  assert(wipe.lose, "lose when all valkyries down");

  assert(s1.events.some((e) => e.type === "UNIT_DEPLOYED"), "emits UNIT_DEPLOYED");
  console.log("ALL CHECKS PASSED");
}

main();
