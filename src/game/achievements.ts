/**
 * Type Siege — Achievements
 *
 * Pure client-side achievement definitions.
 * Each achievement has a `check` function called after every kill or
 * significant state change; when it returns true the achievement is
 * unlocked and persisted via localStorage.
 *
 * To add a new achievement, push an entry to ACHIEVEMENTS with a unique
 * `id`, a display `name`, a short `desc`, and a `check` predicate.
 *
 * Author: progharshith (https://github.com/progharshith)
 */

/** Shape passed to every achievement check function. */
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  check: (s: AchStats) => boolean;
}

/** Snapshot of relevant game stats evaluated after each kill. */
export interface AchStats {
  score: number;
  combo: number;
  bestCombo: number;
  wave: number;
  kills: number;
  /** Percentage of correct keystrokes [0–100]. */
  accuracy: number;
  /** Words per minute (keysCorrect / 5 / minutes elapsed). */
  wpm: number;
  /** True if the player has not missed a single key this run. */
  perfectRun: boolean;
  difficulty: string;
}

/** All available achievements. Order determines display order in the pause menu. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-blood",      name: "First Blood",      desc: "Destroy your first enemy.",                           check: s => s.kills >= 1 },
  { id: "warming-up",       name: "Warming Up",        desc: "Reach a 10x combo.",                                  check: s => s.bestCombo >= 10 },
  { id: "on-fire",          name: "On Fire",           desc: "Reach a 25x combo.",                                  check: s => s.bestCombo >= 25 },
  { id: "unstoppable",      name: "Unstoppable",       desc: "Reach a 50x combo.",                                  check: s => s.bestCombo >= 50 },
  { id: "wave-rider",       name: "Wave Rider",        desc: "Survive to wave 10.",                                 check: s => s.wave >= 10 },
  { id: "veteran",          name: "Veteran",           desc: "Survive to wave 20.",                                 check: s => s.wave >= 20 },
  { id: "centurion",        name: "Centurion",         desc: "Score 100 kills in one run.",                         check: s => s.kills >= 100 },
  { id: "speed-demon",      name: "Speed Demon",       desc: "Hit 80 WPM.",                                         check: s => s.wpm >= 80 },
  { id: "marksman",         name: "Marksman",          desc: "Finish a run with 95%+ accuracy.",                    check: s => s.accuracy >= 95 && s.kills >= 20 },
  { id: "high-score",       name: "Score Hunter",      desc: "Score over 25,000.",                                  check: s => s.score >= 25000 },
  { id: "insane-survivor",  name: "Insane Survivor",   desc: "Reach wave 5 on Insane.",                             check: s => s.difficulty === "insane" && s.wave >= 5 },
];

/** localStorage key for persisting unlocked achievement IDs across sessions. */
const KEY = "type-siege-achievements";

/** Load the set of unlocked achievement IDs from localStorage (SSR-safe). */
export function loadUnlocked(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); }
  catch { return new Set(); }
}

/** Persist the full set of unlocked achievement IDs to localStorage. */
export function saveUnlocked(set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify([...set]));
}
