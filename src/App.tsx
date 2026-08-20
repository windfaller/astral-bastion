import { useEffect, useMemo, useState } from 'react';
import type { CharId, ScreenId, SettingsState } from './game/types';
import { BattleSim } from './game/systems/battle';
import { applyClearRewards, DEFAULT_META, DEFAULT_SETTINGS, loadSave, writeSave, type SaveBlob } from './game/systems/save';
import { afterBattleWin, applyEventChoice, currentNode, ensureEvent, newRun, pickReward, prepareBattle, restPick } from './game/systems/run';
import { getStage, RUN_NODES } from './game/data/stages';
import { EVENT_BY_ID } from './game/data/events';
import { CHARACTERS } from './game/data/characters';
import { setMuted, play, stopMusic } from './audio/cues';
import { MainMenu } from './ui/MainMenu';
import { TeamCompose } from './ui/TeamCompose';
import { Collection } from './ui/Collection';
import { RunMap } from './ui/RunMap';
import { Prep } from './ui/Prep';
import { BattleScreen } from './ui/BattleScreen';
import { Reward } from './ui/Reward';
import { EventScreen } from './ui/EventScreen';
import { RestScreen } from './ui/RestScreen';
import { Victory } from './ui/Victory';
import { Defeat } from './ui/Defeat';
import { Settings } from './ui/Settings';

export function App() {
  const initial = useMemo(() => loadSave(), []);
  const [meta, setMeta] = useState(initial.meta);
  const [run, setRun] = useState(initial.run);
  const [settings, setSettings] = useState<SettingsState>(initial.settings);
  const [screen, setScreen] = useState<ScreenId>('menu');
  const [teamPick, setTeamPick] = useState<CharId[]>(['rin', 'alyssa', 'eve']);
  const [sim, setSim] = useState<BattleSim | null>(null);
  const [loseReason, setLoseReason] = useState<string | undefined>();

  useEffect(() => {
    const blob: SaveBlob = { meta, run, settings };
    writeSave(blob);
  }, [meta, run, settings]);

  useEffect(() => {
    setMuted(settings.mute);
  }, [settings.mute]);

  useEffect(() => {
    if (screen === 'menu' || screen === 'team' || screen === 'prep' || screen === 'map') play('music.bastion.prep');
    if (screen === 'victory') play('music.bastion.victory');
    return () => undefined;
  }, [screen]);

  function persistMeta(next: typeof meta): void {
    setMeta(next);
  }

  function startRun(): void {
    const r = newRun(teamPick, (Date.now() ^ 0x9e3779b9) >>> 0, meta.difficulty);
    setRun(r);
    setScreen('map');
  }

  function enterNode(): void {
    if (!run) return;
    const node = currentNode(run);
    if (!node) return;
    if (node.kind === 'battle' || node.kind === 'boss') {
      setScreen('prep');
      return;
    }
    if (node.kind === 'reward') {
      const stage = run.lastResult === 'win' && RUN_NODES[run.nodeIndex - 1]?.stageId ? getStage(RUN_NODES[run.nodeIndex - 1].stageId!) : null;
      const offers = run.pendingRewards;
      if (!offers && stage) {
        const next = afterBattleWin({ ...run, nodeIndex: run.nodeIndex - 1 });
        setRun(next);
      }
      setScreen('reward');
      return;
    }
    if (node.kind === 'event') {
      setScreen('event');
      return;
    }
    if (node.kind === 'rest') {
      setScreen('rest');
      return;
    }
    if (node.kind === 'victory') {
      persistMeta(applyClearRewards(meta));
      setScreen('victory');
    }
  }

  function beginBattle(): void {
    if (!run) return;
    const prep = prepareBattle(run);
    if (!prep) return;
    const s = new BattleSim({
      seed: prep.seed,
      stageId: prep.stage.id,
      team: prep.team,
      mods: prep.mods,
      relics: prep.relics,
      coreUpgrades: prep.coreUpgrades,
      linkUpgrades: prep.linkUpgrades,
      gadgets: prep.gadgets,
      extraMutators: prep.extraMutators,
      integrityBonus: prep.integrityBonus,
      secondWindUsed: prep.secondWindUsed,
    });
    for (const id of prep.stage.waves.flatMap((w) => w.spawns.map((sp) => sp.enemy))) {
      if (!meta.seenEnemies.includes(id)) persistMeta({ ...meta, seenEnemies: [...meta.seenEnemies, id] });
    }
    setSim(s);
    setScreen('battle');
  }

  function finishBattle(win: boolean): void {
    if (!run) return;
    if (!win) {
      setLoseReason(sim?.loseReason);
      setRun({ ...run, active: false, lastResult: 'lose' });
      setSim(null);
      setScreen('defeat');
      return;
    }
    let next = afterBattleWin({ ...run, secondWindUsed: sim?.secondWindUsed ?? run.secondWindUsed });
    setSim(null);
    const node = currentNode(next);
    if (next.pendingRewards?.length) {
      setRun(next);
      setScreen('reward');
      return;
    }
    if (node?.kind === 'victory') {
      persistMeta(applyClearRewards(meta));
      setRun({ ...next, active: false });
      setScreen('victory');
      return;
    }
    setRun(next);
    setScreen('map');
  }

  const node = run ? currentNode(run) : undefined;
  const stage = node?.stageId ? getStage(node.stageId) : undefined;

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu
          hasRun={!!run?.active}
          onContinue={() => setScreen('map')}
          onNew={() => {
            setTeamPick(meta.unlockedChars.slice(0, 3) as CharId[]);
            setScreen('team');
          }}
          onCollection={() => setScreen('collection')}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'team' && (
        <TeamCompose
          unlocked={meta.unlockedChars}
          team={teamPick}
          onToggle={(id) => {
            setTeamPick((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length < 4 ? [...t, id] : t));
          }}
          onStart={startRun}
          onBack={() => setScreen('menu')}
        />
      )}
      {screen === 'collection' && <Collection meta={meta} onBack={() => setScreen('menu')} />}
      {screen === 'settings' && (
        <Settings
          settings={settings}
          onChange={setSettings}
          onBack={() => setScreen('menu')}
        />
      )}
      {screen === 'map' && run && <RunMap run={run} onEnter={enterNode} onMenu={() => setScreen('menu')} />}
      {screen === 'prep' && run && stage && <Prep stage={stage} run={run} onFight={beginBattle} onBack={() => setScreen('map')} />}
      {screen === 'battle' && sim && (
        <BattleScreen
          sim={sim}
          speed={settings.animSpeed}
          music={stage?.music ?? 'music.bastion.battle'}
          onEnd={finishBattle}
          onAbort={() => {
            stopMusic();
            setSim(null);
            setScreen('defeat');
          }}
          onSpeed={(s) => setSettings({ ...settings, animSpeed: s })}
        />
      )}
      {screen === 'reward' && run?.pendingRewards && (
        <Reward
          offers={run.pendingRewards}
          onPick={(id) => {
            const next = pickReward(run, id);
            if (id in CHARACTERS && !meta.seenChars.includes(id as CharId)) persistMeta({ ...meta, seenChars: [...meta.seenChars, id as CharId] });
            setRun(next);
            setScreen('map');
          }}
        />
      )}
      {screen === 'event' && run && (
        <EventScreen
          event={EVENT_BY_ID[run.pendingEvent ?? currentNode(run)?.eventPool?.[0] ?? 'shrine']}
          onChoose={(cid) => {
            const eid = run.pendingEvent ?? currentNode(run)?.eventPool?.[0] ?? 'shrine';
            setRun(applyEventChoice(run, eid, cid, meta.unlockedChars));
            setScreen('map');
          }}
        />
      )}
      {screen === 'rest' && run && (
        <RestScreen
          onPick={(k) => {
            setRun(restPick(run, k));
            setScreen('map');
          }}
        />
      )}
      {screen === 'victory' && (
        <Victory
          onDone={() => {
            setRun(null);
            setScreen('menu');
          }}
        />
      )}
      {screen === 'defeat' && (
        <Defeat
          reason={loseReason}
          onDone={() => {
            setRun(null);
            setScreen('menu');
          }}
        />
      )}
    </div>
  );
}
