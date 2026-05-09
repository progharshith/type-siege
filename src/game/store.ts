/**
 * Type Siege — Zustand Game Store
 *
 * Single source of truth for all runtime game state that React components
 * need to render the HUD, overlays, and toasts.
 *
 * The GameEngine writes to this store via `setStats` / `setPhase` etc.;
 * React components read from it using `useGame(selector)`.
 *
 * High-score persistence: stored in localStorage under `type-siege-highscore`.
 *
 * Author: progharshith (https://github.com/progharshith)
 */

import { create } from "zustand";
import type { Difficulty, Pack } from "./words";
import { loadUnlocked, saveUnlocked } from "./achievements";

/** Possible game lifecycle phases. */
export type Phase = "playing" | "paused" | "gameover";

/** All power-up kinds that can be held in the inventory. */
export type PowerKind = "slowmo" | "freeze" | "nuke" | "autocomplete" | "shield";

/** A transient notification displayed in the bottom-right toast stack. */
export interface Toast {
  id: number;
  title: string;
  body?: string;
  /** Controls the toast border/text colour scheme. */
  tone: "info" | "achievement" | "powerup";
}

/** Full shape of the game store state + action methods. */
interface GameState {
  phase: Phase;
  difficulty: Difficulty;
  pack: Pack;
  /** True when the current run is a Daily Challenge (seeded word sequence). */
  isDaily: boolean;
  score: number;
  combo: number;
  bestCombo: number;
  health: number;
  maxHealth: number;
  wave: number;
  kills: number;
  keysTyped: number;
  keysCorrect: number;
  /** Timestamp from `performance.now()` when the current run started. */
  startTime: number;
  highScore: number;
  /** True until the player makes their first miss this run. */
  perfectRun: boolean;
  /** Inventory of queued power-ups (max 3 slots). */
  powerups: PowerKind[];
  /** Set of achievement IDs earned across all runs (persisted). */
  unlocked: Set<string>;
  /** Active toast notifications. Auto-dismissed after 3.5 s. */
  toasts: Toast[];

  setPhase: (p: Phase) => void;
  setDifficulty: (d: Difficulty) => void;
  setPack: (p: Pack, daily?: boolean) => void;
  setStats: (s: Partial<GameState>) => void;
  addPowerup: (k: PowerKind) => void;
  consumePowerup: (slot: number) => PowerKind | null;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  unlockAchievement: (id: string, name: string) => void;
  reset: (opts?: { difficulty?: Difficulty; pack?: Pack; isDaily?: boolean }) => void;
}

/** localStorage key for persisting the all-time high score. */
const HS_KEY = "type-siege-highscore";

/** Load the stored high score on module init (SSR-safe). */
const initialHigh =
  typeof window !== "undefined" ? Number(localStorage.getItem(HS_KEY) || 0) : 0;

/** Monotonically increasing ID for toast deduplication. */
let toastSeq = 1;

export const useGame = create<GameState>((set, get) => ({
  phase: "playing",
  difficulty: "easy",
  pack: "classic",
  isDaily: false,
  score: 0,
  combo: 0,
  bestCombo: 0,
  health: 100,
  maxHealth: 100,
  wave: 1,
  kills: 0,
  keysTyped: 0,
  keysCorrect: 0,
  startTime: typeof performance !== "undefined" ? performance.now() : 0,
  highScore: initialHigh,
  perfectRun: true,
  powerups: [],
  unlocked: loadUnlocked(),
  toasts: [],

  /** Transition to a new phase; persist high score if game just ended. */
  setPhase: (phase) => {
    if (phase === "gameover") {
      const { score, highScore } = get();
      if (score > highScore) {
        if (typeof window !== "undefined") localStorage.setItem(HS_KEY, String(score));
        set({ highScore: score });
      }
    }
    set({ phase });
  },

  setDifficulty: (difficulty) => set({ difficulty }),
  setPack: (pack, isDaily = false) => set({ pack, isDaily }),

  /** Merge a partial stats update into the store (used by the engine). */
  setStats: (s) => set(s),

  /** Add a power-up to the inventory (no-op if all 3 slots are full). */
  addPowerup: (k) => {
    const cur = get().powerups;
    if (cur.length >= 3) return;
    set({ powerups: [...cur, k] });
    get().pushToast({ title: "Power-up!", body: powerLabel(k), tone: "powerup" });
  },

  /** Remove and return the power-up at `slot`, or null if the slot is empty. */
  consumePowerup: (slot) => {
    const cur = get().powerups;
    if (slot < 0 || slot >= cur.length) return null;
    const next = cur.slice();
    const [k] = next.splice(slot, 1);
    set({ powerups: next });
    return k;
  },

  /** Show a toast notification; auto-dismiss it after 3.5 seconds. */
  pushToast: (t) => {
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().dismissToast(id), 3500);
  },

  dismissToast: (id) =>
    set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  /** Unlock an achievement by ID and show a toast. Skips if already unlocked. */
  unlockAchievement: (id, name) => {
    const u = get().unlocked;
    if (u.has(id)) return;
    const next = new Set(u); next.add(id);
    saveUnlocked(next);
    set({ unlocked: next });
    get().pushToast({ title: "Achievement unlocked", body: name, tone: "achievement" });
  },

  /**
   * Reset all per-run state for a fresh game.
   * Preserves difficulty/pack from opts or falls back to current values.
   */
  reset: (opts) =>
    set({
      phase: "playing",
      difficulty: opts?.difficulty ?? get().difficulty,
      pack: opts?.pack ?? get().pack,
      isDaily: opts?.isDaily ?? false,
      score: 0,
      combo: 0,
      bestCombo: 0,
      health: 100,
      maxHealth: 100,
      wave: 1,
      kills: 0,
      keysTyped: 0,
      keysCorrect: 0,
      startTime: performance.now(),
      perfectRun: true,
      powerups: [],
    }),
}));

/** Human-readable label for a power-up kind (shown in toasts and tooltips). */
export function powerLabel(k: PowerKind): string {
  switch (k) {
    case "slowmo": return "Slow Motion (5s)";
    case "freeze": return "Freeze All (3s)";
    case "nuke": return "Nuke";
    case "autocomplete": return "Auto-Complete Word";
    case "shield": return "Combo Shield (10s)";
  }
}
