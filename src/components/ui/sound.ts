// Ambient sound, synthesized with WebAudio. No audio files.
//
// Off by default and persisted in localStorage. The AudioContext is created
// only from a user gesture: the footer toggle, or the first pointer or key
// press when the stored preference is already on. The tab going hidden mutes
// everything and suspends the context.
//
//   pad     two detuned sawtooths through a low-pass filter whose cutoff an
//           LFO sweeps, at a low level, with a slow breathing of the volume
//   whoosh  filtered noise whose band-pass sweeps up and back down
//   chime   two sines in a fifth, with a short attack and a long decay

const STORAGE_KEY = "kfyi-sound";

let enabled = false;
let loaded = false;
let hidden = false;
let watching = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let padStop: (() => void) | null = null;
let noise: AudioBuffer | null = null;
let chimeCount = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    enabled = false;
  }
}

function persist(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the preference lasts for this page only.
  }
}

function watchVisibility() {
  if (watching) return;
  watching = true;
  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    if (hidden) {
      master.gain.setTargetAtTime(0, now, 0.04);
      const current = ctx;
      window.setTimeout(() => {
        if (hidden) void current.suspend();
      }, 250);
    } else if (enabled) {
      void ctx.resume();
      master.gain.setTargetAtTime(1, now, 0.5);
    }
  });
}

function context(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  watchVisibility();
  return ctx;
}

function startPad(ac: AudioContext, out: GainNode): () => void {
  const level = ac.createGain();
  level.gain.value = 0.04;

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 330;
  filter.Q.value = 0.9;

  const low = ac.createOscillator();
  low.type = "sawtooth";
  low.frequency.value = 110;
  low.detune.value = -7;

  const high = ac.createOscillator();
  high.type = "sawtooth";
  high.frequency.value = 110;
  high.detune.value = 8;

  // The filter cutoff drifts up and down once a quarter minute.
  const lfo = ac.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.06;
  const lfoDepth = ac.createGain();
  lfoDepth.gain.value = 170;
  lfo.connect(lfoDepth).connect(filter.frequency);

  // The level breathes, so the pad never sits still.
  const breath = ac.createOscillator();
  breath.type = "sine";
  breath.frequency.value = 0.035;
  const breathDepth = ac.createGain();
  breathDepth.gain.value = 0.012;
  breath.connect(breathDepth).connect(level.gain);

  low.connect(filter);
  high.connect(filter);
  filter.connect(level).connect(out);

  const now = ac.currentTime;
  low.start(now);
  high.start(now);
  lfo.start(now);
  breath.start(now);

  return () => {
    for (const node of [low, high, lfo, breath]) {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
      node.disconnect();
    }
    lfoDepth.disconnect();
    breathDepth.disconnect();
    filter.disconnect();
    level.disconnect();
  };
}

function start() {
  const ac = context();
  if (!ac || !master) return;
  void ac.resume();
  if (!padStop) padStop = startPad(ac, master);
  const now = ac.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(hidden ? 0 : 1, now, 0.7);
}

function stop() {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(0, now, 0.25);
  const current = ctx;
  window.setTimeout(() => {
    if (!enabled) void current.suspend();
  }, 1400);
}

function ready(): AudioContext | null {
  if (!enabled || hidden || !ctx || !master || ctx.state !== "running") return null;
  return ctx;
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise;
  const seconds = 1.4;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noise = buffer;
  return buffer;
}

/** A flight starts: filtered noise sweeps up, then settles. */
function whoosh() {
  const ac = ready();
  if (!ac || !master) return;
  const t = ac.currentTime;
  const source = ac.createBufferSource();
  source.buffer = noiseBuffer(ac);

  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.1;
  band.frequency.setValueAtTime(160, t);
  band.frequency.exponentialRampToValueAtTime(2200, t + 0.45);
  band.frequency.exponentialRampToValueAtTime(240, t + 1.2);

  const level = ac.createGain();
  level.gain.setValueAtTime(0.0001, t);
  level.gain.exponentialRampToValueAtTime(0.1, t + 0.18);
  level.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);

  source.connect(band).connect(level).connect(master);
  source.start(t);
  source.stop(t + 1.25);
  source.onended = () => {
    source.disconnect();
    band.disconnect();
    level.disconnect();
  };
}

// C6+G6, D6+A6, B5+F#6: a small rotation so repeated chimes do not sound identical.
const CHORDS: [number, number][] = [
  [1046.5, 1568.0],
  [1174.7, 1760.0],
  [987.8, 1480.0],
];

/** A cited sentence lands: a soft bell. */
function chime() {
  const ac = ready();
  if (!ac || !master) return;
  const notes = CHORDS[chimeCount % CHORDS.length];
  chimeCount += 1;
  const t = ac.currentTime;

  const level = ac.createGain();
  level.gain.setValueAtTime(0.0001, t);
  level.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
  level.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  level.connect(master);

  notes.forEach((frequency, i) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const part = ac.createGain();
    part.gain.value = i === 0 ? 1 : 0.5;
    osc.connect(part).connect(level);
    osc.start(t + i * 0.03);
    osc.stop(t + 1.7);
    osc.onended = () => {
      osc.disconnect();
      part.disconnect();
      if (i === notes.length - 1) level.disconnect();
    };
  });
}

export const sound = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get(): boolean {
    load();
    return enabled;
  },
  getServer(): boolean {
    return false;
  },
  /** Call from a user gesture. */
  set(on: boolean) {
    load();
    enabled = on;
    persist(on);
    if (on) start();
    else stop();
    notify();
  },
  /** Call from a user gesture. */
  toggle() {
    load();
    sound.set(!enabled);
  },
  /** Call from the first user gesture: starts the pad if the stored preference is on. */
  arm() {
    load();
    if (enabled && !padStop) start();
  },
  whoosh,
  chime,
};
