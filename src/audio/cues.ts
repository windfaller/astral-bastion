export type CueId =
  | 'music.bastion.prep'
  | 'music.bastion.battle'
  | 'music.bastion.critical'
  | 'music.bastion.boss'
  | 'music.bastion.victory'
  | 'sfx.rin.slash'
  | 'sfx.eve.railgun'
  | 'sfx.mio.barrier'
  | 'sfx.link.ready'
  | 'sfx.core.damage'
  | 'sfx.ui.click'
  | 'sfx.deploy'
  | 'sfx.ult'
  | 'sfx.boss.phase';

export const CUE_TABLE: Record<CueId, { kind: 'music' | 'sfx'; note: string }> = {
  'music.bastion.prep': { kind: 'music', note: 'prep pulse' },
  'music.bastion.battle': { kind: 'music', note: 'battle ost stand-in' },
  'music.bastion.critical': { kind: 'music', note: 'critical ost' },
  'music.bastion.boss': { kind: 'music', note: 'yamato theme' },
  'music.bastion.victory': { kind: 'music', note: 'victory fanfare' },
  'sfx.rin.slash': { kind: 'sfx', note: 'crescent slash' },
  'sfx.eve.railgun': { kind: 'sfx', note: 'rail charge' },
  'sfx.mio.barrier': { kind: 'sfx', note: 'foxfire ward' },
  'sfx.link.ready': { kind: 'sfx', note: 'link chime' },
  'sfx.core.damage': { kind: 'sfx', note: 'core hit' },
  'sfx.ui.click': { kind: 'sfx', note: 'ui' },
  'sfx.deploy': { kind: 'sfx', note: 'deploy' },
  'sfx.ult': { kind: 'sfx', note: 'ult' },
  'sfx.boss.phase': { kind: 'sfx', note: 'phase shift' },
};

let ctx: AudioContext | null = null;
let muted = false;
let musicTimer: number | null = null;
let currentMusic: CueId | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function setMuted(v: boolean): void {
  muted = v;
  if (v) stopMusic();
}

export function isMuted(): boolean {
  return muted;
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.05, at = 0): void {
  const c = ac();
  if (!c || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime + at;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.04): void {
  const c = ac();
  if (!c || muted) return;
  const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  const g = c.createGain();
  src.buffer = n;
  g.gain.value = gain;
  src.connect(g);
  g.connect(c.destination);
  src.start();
}

export function play(cueId: CueId): void {
  if (muted) return;
  if (cueId.startsWith('music.')) {
    startMusic(cueId);
    return;
  }
  switch (cueId) {
    case 'sfx.rin.slash':
      beep(620, 0.08, 'sawtooth', 0.06);
      beep(880, 0.1, 'square', 0.04, 0.05);
      break;
    case 'sfx.eve.railgun':
      beep(180, 0.16, 'sawtooth', 0.07);
      beep(1400, 0.08, 'square', 0.05, 0.12);
      noise(0.12, 0.03);
      break;
    case 'sfx.mio.barrier':
      beep(420, 0.2, 'sine', 0.05);
      beep(630, 0.25, 'sine', 0.04, 0.05);
      break;
    case 'sfx.link.ready':
      beep(520, 0.12, 'triangle', 0.05);
      beep(780, 0.16, 'triangle', 0.05, 0.1);
      beep(1040, 0.2, 'sine', 0.04, 0.2);
      break;
    case 'sfx.core.damage':
      beep(90, 0.18, 'square', 0.07);
      noise(0.15, 0.05);
      break;
    case 'sfx.ui.click':
      beep(700, 0.04, 'square', 0.03);
      break;
    case 'sfx.deploy':
      beep(300, 0.08, 'triangle', 0.05);
      beep(500, 0.1, 'sine', 0.04, 0.06);
      break;
    case 'sfx.ult':
      beep(240, 0.2, 'sawtooth', 0.06);
      beep(480, 0.22, 'triangle', 0.05, 0.1);
      break;
    case 'sfx.boss.phase':
      beep(70, 0.4, 'sawtooth', 0.08);
      beep(110, 0.5, 'square', 0.05, 0.1);
      noise(0.3, 0.06);
      break;
  }
}

function startMusic(id: CueId): void {
  if (currentMusic === id) return;
  stopMusic();
  currentMusic = id;
  const c = ac();
  if (!c || muted) return;
  const roots: Record<string, number> = {
    'music.bastion.prep': 196,
    'music.bastion.battle': 220,
    'music.bastion.critical': 233,
    'music.bastion.boss': 155,
    'music.bastion.victory': 262,
  };
  const root = roots[id] ?? 220;
  const pulse = () => {
    if (muted || currentMusic !== id) return;
    beep(root, 0.18, 'sine', 0.03);
    beep(root * 1.5, 0.16, 'triangle', 0.02, 0.08);
    if (id === 'music.bastion.boss') beep(root * 0.5, 0.3, 'sawtooth', 0.025, 0.02);
    if (id === 'music.bastion.victory') {
      beep(root * 5 / 4, 0.2, 'sine', 0.03, 0.1);
      beep(root * 1.5, 0.24, 'sine', 0.03, 0.2);
    }
  };
  pulse();
  musicTimer = window.setInterval(pulse, id === 'music.bastion.critical' ? 420 : 700);
}

export function stopMusic(): void {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  currentMusic = null;
}
