/**
 * Type Siege — Audio System
 *
 * Lightweight procedural sound effects built on the Web Audio API.
 * No external audio files or dependencies — all sounds are synthesised
 * from oscillators and noise buffers at runtime.
 *
 * Usage:
 *   import { sfx } from "./audio";
 *   sfx.type();     // tiny blip on each correct keystroke
 *   sfx.kill();     // crunch + noise on enemy death
 *   sfx.resume();   // must be called after the first user gesture
 *
 * Author: progharshith (https://github.com/progharshith)
 */

/** Shared AudioContext — created lazily on first sound request. */
let ctx: AudioContext | null = null;

/** Return the shared AudioContext, creating it if necessary (SSR-safe). */
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

/**
 * Play a short oscillator tone with an exponential gain fade-out.
 * @param freq     Frequency in Hz.
 * @param duration Duration in seconds.
 * @param type     Oscillator waveform shape.
 * @param gain     Peak gain level.
 */
function blip(freq: number, duration = 0.06, type: OscillatorType = "square", gain = 0.06) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

/**
 * Play a burst of white noise with a linear amplitude decay.
 * Used for explosion / damage thumps.
 * @param duration Duration in seconds.
 * @param gain     Peak gain level.
 */
function noise(duration = 0.2, gain = 0.15) {
  const c = getCtx();
  if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buf.getChannelData(0);
  /** Fill with white noise that tapers linearly to silence. */
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.destination);
  src.start();
}

/** Named sound effects exposed to the rest of the codebase. */
export const sfx = {
  /** Tiny randomised blip for each correct keystroke — keeps it from feeling monotonous. */
  type: () => blip(660 + Math.random() * 80, 0.03, "square", 0.03),

  /** Short triangle blip when a multi-HP enemy loses one HP but survives. */
  hit: () => blip(880, 0.05, "triangle", 0.07),

  /** Low sawtooth crunch + noise burst when an enemy dies. */
  kill: () => { blip(420, 0.08, "sawtooth", 0.08); noise(0.15, 0.08); },

  /** Rising tone played when the combo milestone is hit; pitch scales with combo tier. */
  combo: (n: number) => blip(400 + n * 60, 0.1, "sine", 0.08),

  /** Low buzz for a missed keystroke. */
  miss: () => blip(140, 0.12, "sawtooth", 0.08),

  /** Heavy noise + low tone when an enemy breaches the base. */
  damage: () => { noise(0.25, 0.12); blip(110, 0.2, "sawtooth", 0.1); },

  /** Descending three-note sequence when the player loses. */
  gameover: () => {
    blip(440, 0.2, "sine", 0.1);
    setTimeout(() => blip(330, 0.25, "sine", 0.1), 180);
    setTimeout(() => blip(220, 0.4, "sine", 0.1), 380);
  },

  /**
   * Resume a suspended AudioContext.
   * Must be called in response to a user gesture (e.g. first keypress)
   * due to browser autoplay policy.
   */
  resume: () => { const c = getCtx(); if (c && c.state === "suspended") c.resume(); },
};
