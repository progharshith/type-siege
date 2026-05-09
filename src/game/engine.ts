/**
 * Type Siege — Game Engine
 *
 * Pure-canvas rendering and game logic, fully decoupled from React.
 * The engine pushes state updates into the Zustand store; React components
 * read from the store reactively and never touch the canvas directly.
 *
 * Lifecycle:
 *   new GameEngine(canvas) → start() → [game loop] → destroy()
 *
 * Author: progharshith (https://github.com/progharshith)
 */

import { sfx } from "./audio";
import { useGame, type PowerKind } from "./store";
import { pickWord, type Difficulty, type Pack } from "./words";
import { ACHIEVEMENTS } from "./achievements";

/** All possible enemy archetypes with distinct behaviours and visuals. */
type EnemyKind = "basic" | "fast" | "tank" | "shield" | "exploder" | "boss";

/** A single enemy entity tracked by the engine. */
interface Enemy {
  alive: boolean;
  kind: EnemyKind;
  x: number; y: number;
  /** The word the player must type to destroy this enemy. */
  word: string;
  /** Number of characters the player has correctly typed so far. */
  typed: number;
  /** Remaining hit points (tank = 2, boss = 4, others = 1). */
  hp: number;
  /** Original HP used for pip rendering and score multipliers. */
  totalHp: number;
  /** Shield enemies require one correct hit to break the shield first. */
  shielded: boolean;
  radius: number;
  color: string;
  /** Pixels per second toward the base. */
  speed: number;
}

/** A small square that flies outward after a kill or damage event. */
interface Particle {
  alive: boolean;
  x: number; y: number;
  /** Velocity in px/s. */
  vx: number; vy: number;
  /** Remaining lifetime in seconds. */
  life: number; maxLife: number;
  color: string;
  size: number;
}

/** Floating score / status text that drifts upward then fades. */
interface FloatText {
  alive: boolean;
  x: number; y: number;
  /** Upward drift velocity in px/s. */
  vy: number;
  /** Remaining lifetime in seconds. */
  life: number;
  text: string;
  color: string;
}

/** Per-difficulty tuning: spawn rate, movement speed, enemy cap, boss frequency. */
const DIFF_CFG: Record<Difficulty, { spawnEvery: number; speed: number; maxAlive: number; bossEvery: number }> = {
  easy:   { spawnEvery: 1.6, speed: 22, maxAlive: 4, bossEvery: 8 },
  medium: { spawnEvery: 1.1, speed: 34, maxAlive: 6, bossEvery: 6 },
  hard:   { spawnEvery: 0.75, speed: 48, maxAlive: 9, bossEvery: 5 },
  insane: { spawnEvery: 0.5, speed: 68, maxAlive: 12, bossEvery: 4 },
};

/** Accent colors for each enemy kind (used for particles and word highlights). */
const KIND_COLORS: Record<EnemyKind, string> = {
  basic: "#22d3ee",
  fast: "#f472b6",
  tank: "#a78bfa",
  shield: "#34d399",
  exploder: "#fb923c",
  boss: "#ef4444",
};

/** Full list of power-up kinds that can drop from enemies. */
const POWER_KINDS: PowerKind[] = ["slowmo", "freeze", "nuke", "autocomplete", "shield"];

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** Device pixel ratio (capped at 2 for perf). */
  private dpr = 1;
  /** Logical canvas dimensions. */
  private w = 0;
  private h = 0;
  /** Center of the canvas — the player's base position. */
  private cx = 0;
  private cy = 0;

  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  /** Words currently assigned to alive enemies, to avoid duplicates. */
  private takenWords = new Set<string>();
  /** Index into `enemies` of the enemy the player is currently typing at. */
  private lockedIndex = -1;

  private rafId = 0;
  private lastTs = 0;
  /** Accumulates time until the next enemy should spawn. */
  private spawnTimer = 0;
  private waveKills = 0;
  /** Kills required to advance to the next wave. Scales with wave number. */
  private waveKillTarget = 6;
  /** Camera shake magnitude in pixels. Decays exponentially. */
  private shake = 0;
  /** Red flash intensity [0–1]. Decays linearly. */
  private flash = 0;
  private running = false;
  private paused = false;

  /** Time scale applied to enemy movement (1 = normal, 0.35 = slow-mo). */
  private timeScale = 1;
  /** Remaining slow-motion seconds. */
  private slowmoTimer = 0;
  /** Remaining freeze seconds (enemies don't move). */
  private freezeTimer = 0;
  /** Remaining combo-shield seconds (misses don't break combo). */
  private shieldTimer = 0;

  /** Tracks kills since last power-up drop; drops every 8 kills. */
  private killsSinceLastPower = 0;

  private difficulty: Difficulty = "easy";
  private pack: Pack = "classic";
  /** Optional seed for the daily-challenge word sequence. */
  private dailySeed: number | undefined;
  /** Drives any time-varying background animations. */
  private bgPhase = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKey);
  }

  /** Stop the loop and remove all event listeners. Call this on component unmount. */
  destroy() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKey);
  }

  /** Reset all game state and begin (or restart) the animation loop. */
  start(difficulty: Difficulty, pack: Pack, dailySeed?: number) {
    this.difficulty = difficulty;
    this.pack = pack;
    this.dailySeed = dailySeed;
    this.enemies = [];
    this.particles = [];
    this.floats = [];
    this.takenWords.clear();
    this.lockedIndex = -1;
    this.spawnTimer = 0;
    this.waveKills = 0;
    this.waveKillTarget = 6;
    this.shake = 0;
    this.flash = 0;
    this.timeScale = 1;
    this.slowmoTimer = 0;
    this.freezeTimer = 0;
    this.shieldTimer = 0;
    this.killsSinceLastPower = 0;
    this.lastTs = performance.now();
    this.paused = false;
    if (!this.running) {
      this.running = true;
      this.rafId = requestAnimationFrame(this.loop);
    }
    sfx.resume();
  }

  /** Toggle the pause state; resets the timestamp so dt doesn't spike on resume. */
  setPaused(p: boolean) { this.paused = p; this.lastTs = performance.now(); }

  /** Pick a fresh word that isn't already assigned to another alive enemy. */
  private nextWord(): string {
    return pickWord(this.difficulty, this.pack === "daily" ? "classic" : this.pack, this.takenWords, this.dailySeed);
  }

  /** Keyboard handler: routes Escape, hotkeys 1-3, Backspace, and typing characters. */
  private onKey = (e: KeyboardEvent) => {
    const phase = useGame.getState().phase;
    if (phase === "gameover") return;

    if (e.key === "Escape") {
      useGame.getState().setPhase(phase === "paused" ? "playing" : "paused");
      this.setPaused(phase !== "paused");
      return;
    }
    if (phase !== "playing") return;

    /** Power-up hotkeys: 1 activates slot 0, 2 activates slot 1, 3 activates slot 2. */
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      const slot = Number(e.key) - 1;
      const k = useGame.getState().consumePowerup(slot);
      if (k) this.activatePower(k);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      /** Step back one character on the currently locked enemy. */
      if (this.lockedIndex >= 0) {
        const en = this.enemies[this.lockedIndex];
        if (en && en.typed > 0) en.typed--;
        if (en && en.typed === 0) this.lockedIndex = -1;
      }
      return;
    }
    if (e.key.length !== 1) return;
    this.handleChar(e.key);
  };

  /** Apply a power-up effect immediately. */
  private activatePower(k: PowerKind) {
    sfx.combo(3);
    switch (k) {
      case "slowmo":
        this.slowmoTimer = 5;
        this.spawnFloat(this.cx, this.cy - 80, "SLOW MOTION", "#22d3ee");
        break;
      case "freeze":
        this.freezeTimer = 3;
        this.spawnFloat(this.cx, this.cy - 80, "FREEZE", "#a5f3fc");
        break;
      case "nuke":
        /** Instantly kill every alive enemy and shake the screen. */
        this.spawnFloat(this.cx, this.cy - 80, "NUKE", "#f472b6");
        this.shake = 28;
        this.flash = 0.7;
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.alive) continue;
          this.spawnParticles(e.x, e.y, e.color, 18);
          this.takenWords.delete(e.word);
          e.alive = false;
          const st = useGame.getState();
          st.setStats({ score: st.score + 50, kills: st.kills + 1 });
        }
        this.lockedIndex = -1;
        break;
      case "autocomplete":
        /** Instantly destroy the locked enemy, or the nearest one if none is locked. */
        if (this.lockedIndex >= 0) this.killEnemy(this.lockedIndex);
        else {
          let best = -1, bd = Infinity;
          for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.alive) continue;
            const d = (e.x - this.cx) ** 2 + (e.y - this.cy) ** 2;
            if (d < bd) { bd = d; best = i; }
          }
          if (best >= 0) this.killEnemy(best);
        }
        break;
      case "shield":
        this.shieldTimer = 10;
        this.spawnFloat(this.cx, this.cy - 80, "COMBO SHIELD", "#facc15");
        break;
    }
  }

  /**
   * Handle a single typed character.
   * If locked onto an enemy, advance or fail that word.
   * Otherwise, scan all enemies whose first letter matches and lock onto the closest.
   */
  private handleChar(ch: string) {
    const st = useGame.getState();
    st.setStats({ keysTyped: st.keysTyped + 1 });

    if (this.lockedIndex >= 0) {
      const en = this.enemies[this.lockedIndex];
      if (!en || !en.alive) { this.lockedIndex = -1; }
      else {
        if (en.word[en.typed] === ch) {
          en.typed++;
          sfx.type();
          useGame.getState().setStats({ keysCorrect: useGame.getState().keysCorrect + 1 });
          if (en.typed >= en.word.length) this.killEnemy(this.lockedIndex);
          return;
        } else {
          this.miss(en.x, en.y);
          return;
        }
      }
    }

    /** Find the closest enemy whose word starts with the typed character. */
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      if (e.typed !== 0) continue;
      if (e.word[0] !== ch) continue;
      const dx = e.x - this.cx, dy = e.y - this.cy;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = i; }
    }
    if (best >= 0) {
      this.lockedIndex = best;
      const en = this.enemies[best];
      en.typed = 1;
      sfx.type();
      useGame.getState().setStats({ keysCorrect: useGame.getState().keysCorrect + 1 });
      if (en.typed >= en.word.length) this.killEnemy(best);
    } else {
      /** No matching enemy — register a miss at the base reticle. */
      this.miss(this.cx, this.cy - 60);
    }
  }

  /** Register a missed keystroke: break combo, flash, spawn "MISS" text. */
  private miss(x: number, y: number) {
    this.flash = Math.max(this.flash, 0.4);
    sfx.miss();
    const st = useGame.getState();
    st.setStats({ perfectRun: false });
    if (this.shieldTimer > 0) {
      this.spawnFloat(x, y, "SHIELDED", "#facc15");
      return;
    }
    if (st.combo > 0) st.setStats({ combo: 0 });
    this.spawnFloat(x, y, "MISS", "#ef4444");
  }

  /**
   * Attempt to kill enemy at `idx`.
   * Multi-HP enemies (tank, boss) lose one HP and get a new word instead of dying.
   * On death: update store, spawn particles, potentially drop a power-up, advance wave.
   */
  private killEnemy(idx: number) {
    const en = this.enemies[idx];
    if (!en) return;
    this.takenWords.delete(en.word);
    en.hp--;
    if (en.hp > 0) {
      /** Enemy survives — reset typing progress and assign a fresh word. */
      en.typed = 0;
      en.word = this.nextWord();
      this.takenWords.add(en.word);
      sfx.hit();
      this.spawnParticles(en.x, en.y, en.color, 8);
      this.lockedIndex = -1;
      return;
    }
    en.alive = false;
    this.lockedIndex = -1;
    sfx.kill();
    this.shake = Math.min(12, this.shake + 3 + en.totalHp);
    this.spawnParticles(en.x, en.y, en.color, 10 + en.totalHp * 2);

    /** Exploders blast nearby enemies outward on death. */
    if (en.kind === "exploder") {
      for (const other of this.enemies) {
        if (!other.alive || other === en) continue;
        const dx = other.x - en.x, dy = other.y - en.y;
        const d = Math.hypot(dx, dy);
        if (d < 200) { other.x += (dx / d) * 80; other.y += (dy / d) * 80; }
      }
      this.spawnParticles(en.x, en.y, "#fb923c", 14);
    }

    const st = useGame.getState();
    const newCombo = st.combo + 1;
    /** Score = word length × 10 × combo multiplier. */
    const points = en.word.length * 10 * Math.max(1, newCombo);
    st.setStats({
      score: st.score + points,
      combo: newCombo,
      bestCombo: Math.max(st.bestCombo, newCombo),
      kills: st.kills + 1,
    });
    /** Play a combo escalation sound every 5 kills in a combo. */
    if (newCombo > 1 && newCombo % 5 === 0) sfx.combo(newCombo / 5);
    this.spawnFloat(en.x, en.y - 20, `+${points}${newCombo > 1 ? `  x${newCombo}` : ""}`, en.color);

    /** Drop a random power-up every 8 kills. */
    this.killsSinceLastPower++;
    if (this.killsSinceLastPower >= 8) {
      this.killsSinceLastPower = 0;
      const k = POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)];
      useGame.getState().addPowerup(k);
    }

    /** Advance wave counter when enough enemies have been defeated. */
    this.waveKills++;
    if (this.waveKills >= this.waveKillTarget) {
      const wave = useGame.getState().wave + 1;
      useGame.getState().setStats({ wave });
      this.waveKills = 0;
      this.waveKillTarget = 6 + wave * 2;
      this.spawnFloat(this.cx, this.cy - 120, `WAVE ${wave}`, "#facc15");
    }

    this.checkAchievements();
  }

  /** Evaluate all unearned achievements against current stats and unlock any that qualify. */
  private checkAchievements() {
    const st = useGame.getState();
    const acc = st.keysTyped > 0 ? Math.round((st.keysCorrect / st.keysTyped) * 100) : 100;
    const elapsedMin = st.startTime ? (performance.now() - st.startTime) / 60000 : 0;
    const wpm = elapsedMin > 0 ? Math.round((st.keysCorrect / 5) / elapsedMin) : 0;
    const stats = {
      score: st.score, combo: st.combo, bestCombo: st.bestCombo,
      wave: st.wave, kills: st.kills, accuracy: acc, wpm,
      perfectRun: st.perfectRun, difficulty: st.difficulty,
    };
    for (const a of ACHIEVEMENTS) {
      if (st.unlocked.has(a.id)) continue;
      if (a.check(stats)) st.unlockAchievement(a.id, a.name);
    }
  }

  /** Burst `n` particles at (x, y) in a random spread. Reuses dead slots for perf. */
  private spawnParticles(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const p = this.getParticle();
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 220;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = p.maxLife = 0.4 + Math.random() * 0.5;
      p.color = color;
      p.size = 1 + Math.random() * 3;
      p.alive = true;
    }
  }

  /** Spawn a floating text label that drifts upward over ~1.2 s. */
  private spawnFloat(x: number, y: number, text: string, color: string) {
    const f = this.getFloat();
    f.x = x; f.y = y; f.vy = -40; f.life = 1.2; f.text = text; f.color = color; f.alive = true;
  }

  /** Return a dead Particle slot, or create a new one if none exist. */
  private getParticle(): Particle {
    for (const p of this.particles) if (!p.alive) return p;
    const p: Particle = { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: "#fff", size: 2 };
    this.particles.push(p);
    return p;
  }

  /** Return a dead FloatText slot, or create a new one if none exist. */
  private getFloat(): FloatText {
    for (const f of this.floats) if (!f.alive) return f;
    const f: FloatText = { alive: false, x: 0, y: 0, vy: 0, life: 0, text: "", color: "#fff" };
    this.floats.push(f);
    return f;
  }

  /**
   * Spawn a new enemy at a random Y position entering from the left or right edge.
   * Kind probabilities are weighted; boss can only appear when no other enemies are alive.
   */
  private spawnEnemy() {
    const cfg = DIFF_CFG[this.difficulty];
    const aliveCount = this.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
    if (aliveCount >= cfg.maxAlive) return;

    const wave = useGame.getState().wave;
    const roll = Math.random();
    let kind: EnemyKind = "basic";
    if (wave % cfg.bossEvery === 0 && Math.random() < 0.18 && aliveCount === 0) kind = "boss";
    else if (roll < 0.55) kind = "basic";
    else if (roll < 0.75) kind = "fast";
    else if (roll < 0.87) kind = "tank";
    else if (roll < 0.94) kind = "exploder";
    else kind = "shield";

    const fromLeft = Math.random() < 0.5;
    const word = this.nextWord();
    this.takenWords.add(word);

    /** Speed multiplier per kind relative to the difficulty base speed. */
    const speedMul =
      kind === "fast" ? 1.6 : kind === "tank" ? 0.55 :
      kind === "boss" ? 0.4 : kind === "exploder" ? 0.85 : 1;

    const e: Enemy = {
      alive: true,
      kind,
      x: fromLeft ? -30 : this.w + 30,
      y: 100 + Math.random() * Math.max(80, this.h - 220),
      word,
      typed: 0,
      hp: kind === "tank" ? 2 : kind === "boss" ? 4 : 1,
      totalHp: kind === "tank" ? 2 : kind === "boss" ? 4 : 1,
      shielded: kind === "shield",
      radius: kind === "boss" ? 36 : kind === "tank" ? 26 : kind === "fast" ? 14 : 20,
      color: KIND_COLORS[kind],
      /** Speed scales up by 6% per wave to keep pressure increasing. */
      speed: cfg.speed * speedMul * (1 + (wave - 1) * 0.06),
    };
    /** Reuse the first dead slot to avoid unbounded array growth. */
    for (let i = 0; i < this.enemies.length; i++) {
      if (!this.enemies[i].alive) { this.enemies[i] = e; return; }
    }
    this.enemies.push(e);
  }

  /** Sync the canvas resolution to the element's CSS size × device pixel ratio. */
  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.floor(r.width * this.dpr);
    this.canvas.height = Math.floor(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cx = this.w / 2; this.cy = this.h / 2;
  };

  /** RAF loop: skip physics when paused but always redraw (so the pause overlay is visible). */
  private loop = (ts: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.paused) { this.draw(0); return; }
    /** Cap dt to 50 ms to prevent spiral-of-death after tab blur. */
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.update(dt);
    this.draw(dt);
  };

  /** Advance all simulation timers and positions by `dt` seconds. */
  private update(dt: number) {
    /** Tick power-up timers in real (unscaled) time. */
    if (this.slowmoTimer > 0) { this.slowmoTimer -= dt; if (this.slowmoTimer <= 0) this.timeScale = 1; }
    if (this.freezeTimer > 0) this.freezeTimer -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    this.timeScale = this.slowmoTimer > 0 ? 0.35 : 1;
    /** enemyDt = 0 when frozen, otherwise scaled for slow-mo. */
    const enemyDt = this.freezeTimer > 0 ? 0 : dt * this.timeScale;

    /** Advance spawn timer and spawn as many enemies as fit in the elapsed time. */
    this.spawnTimer += enemyDt;
    const cfg = DIFF_CFG[this.difficulty];
    const wave = useGame.getState().wave;
    /** Spawn interval shrinks by 8% per wave. */
    const interval = cfg.spawnEvery / (1 + (wave - 1) * 0.08);
    while (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this.spawnEnemy();
    }

    /** Move every alive enemy straight toward the base. */
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const dx = this.cx - e.x;
      const dy = this.cy - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.speed * enemyDt;
      e.y += (dy / d) * e.speed * enemyDt;

      /** Enemy reached the base — deal damage and remove it. */
      if (d < 50) {
        e.alive = false;
        this.takenWords.delete(e.word);
        if (this.lockedIndex === i) this.lockedIndex = -1;
        const dmg = e.kind === "boss" ? 30 : e.kind === "exploder" ? 20 : e.kind === "tank" ? 18 : 10;
        const st = useGame.getState();
        const newHealth = Math.max(0, st.health - dmg);
        st.setStats({ health: newHealth, combo: 0, perfectRun: false });
        this.shake = Math.min(26, this.shake + 12);
        this.flash = 0.6;
        sfx.damage();
        this.spawnParticles(this.cx, this.cy, "#ef4444", 30);
        if (newHealth <= 0) { sfx.gameover(); st.setPhase("gameover"); this.checkAchievements(); }
      }
    }

    /** Advance particles: fade, move, and apply drag. */
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
    }
    /** Advance floating text: fade and drift upward with gentle deceleration. */
    for (const f of this.floats) {
      if (!f.alive) continue;
      f.life -= dt;
      if (f.life <= 0) { f.alive = false; continue; }
      f.y += f.vy * dt; f.vy *= 0.98;
    }
    /** Decay shake and flash each frame. */
    this.shake *= Math.pow(0.001, dt);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.bgPhase += dt;
  }

  /** Render one frame. `_dt` is unused but kept for signature consistency. */
  private draw(_dt: number) {
    const ctx = this.ctx;
    /** Apply random camera shake offset. */
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;

    /** Flat dark background — no gradients to keep the look sharp. */
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, this.w, this.h);

    /** Subtle tint overlays during power-up effects. */
    if (this.slowmoTimer > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.freezeTimer > 0) {
      ctx.fillStyle = "rgba(180,210,230,0.05)";
      ctx.fillRect(0, 0, this.w, this.h);
    }

    ctx.save();
    ctx.translate(sx, sy);

    const st = useGame.getState();
    const hpPct = st.health / st.maxHealth;
    const lowHp = hpPct < 0.3;

    /** Player base: square reticle with crosshair extensions. Turns red when HP is low. */
    ctx.save();
    const baseColor = lowHp ? "#e5484d" : "#e5e5e5";
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;
    const r = 18;
    ctx.strokeRect(this.cx - r, this.cy - r, r * 2, r * 2);
    ctx.beginPath();
    ctx.moveTo(this.cx - r - 8, this.cy); ctx.lineTo(this.cx - r - 2, this.cy);
    ctx.moveTo(this.cx + r + 2, this.cy); ctx.lineTo(this.cx + r + 8, this.cy);
    ctx.moveTo(this.cx, this.cy - r - 8); ctx.lineTo(this.cx, this.cy - r - 2);
    ctx.moveTo(this.cx, this.cy + r + 2); ctx.lineTo(this.cx, this.cy + r + 8);
    ctx.stroke();
    /** Outer square indicates the combo shield is active. */
    if (this.shieldTimer > 0) {
      ctx.strokeStyle = "#e5e5e5";
      ctx.lineWidth = 1;
      ctx.strokeRect(this.cx - r - 6, this.cy - r - 6, (r + 6) * 2, (r + 6) * 2);
    }
    ctx.restore();

    /** Draw each alive enemy: silhouette shape + word label + HP pips. */
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;

      const dx = this.cx - e.x, dy = this.cy - e.y;
      const dist = Math.hypot(dx, dy);
      /** Enemies close to the base flash red as a danger warning. */
      const danger = dist < 180;
      const fill = danger ? "#e5484d" : "#9a9a9a";

      ctx.fillStyle = fill;
      ctx.beginPath();
      /** Each kind has a distinct geometric silhouette. */
      if (e.kind === "boss") {
        ctx.rect(e.x - e.radius, e.y - e.radius, e.radius * 2, e.radius * 2);
      } else if (e.kind === "tank") {
        ctx.rect(e.x - e.radius, e.y - e.radius * 0.7, e.radius * 2, e.radius * 1.4);
      } else if (e.kind === "fast") {
        ctx.moveTo(e.x - e.radius, e.y);
        ctx.lineTo(e.x, e.y - e.radius);
        ctx.lineTo(e.x + e.radius, e.y);
        ctx.lineTo(e.x, e.y + e.radius);
      } else if (e.kind === "exploder") {
        ctx.moveTo(e.x, e.y - e.radius);
        ctx.lineTo(e.x + e.radius, e.y);
        ctx.lineTo(e.x, e.y + e.radius);
        ctx.lineTo(e.x - e.radius, e.y);
        ctx.closePath();
      } else {
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      /** Shield enemies get an extra ring around their silhouette. */
      if (e.shielded) {
        ctx.strokeStyle = "#e5e5e5";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      /** Word label: typed portion is gold, remaining is white/grey.
       *  A yellow underline marks the currently locked target. */
      const isLocked = i === this.lockedIndex;
      const labelY = e.y - e.radius - 14;
      ctx.font = "600 17px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "alphabetic";
      const totalW = ctx.measureText(e.word).width;
      let tx = e.x - totalW / 2;

      const typed = e.word.slice(0, e.typed);
      const rest = e.word.slice(e.typed);

      ctx.fillStyle = "#f5d36b";
      ctx.fillText(typed, tx, labelY);
      tx += ctx.measureText(typed).width;
      ctx.fillStyle = isLocked ? "#ffffff" : "#d4d4d4";
      ctx.fillText(rest, tx, labelY);

      if (isLocked) {
        ctx.strokeStyle = "#f5d36b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.x - totalW / 2, labelY + 4);
        ctx.lineTo(e.x + totalW / 2, labelY + 4);
        ctx.stroke();
      }

      /** HP pips below the enemy: filled = remaining HP, hollow = lost HP. */
      if (e.totalHp > 1) {
        for (let k = 0; k < e.totalHp; k++) {
          ctx.fillStyle = k < e.hp ? "#d4d4d4" : "#3a3a3a";
          ctx.fillRect(e.x - (e.totalHp * 4) + k * 8, e.y + e.radius + 6, 5, 2);
        }
      }
    }

    /** Particles: monochrome squares that fade out as their lifetime drops. */
    for (const p of this.particles) {
      if (!p.alive) continue;
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = "#d4d4d4";
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    /** Floating score / status text — fades in over the first second of life. */
    for (const f of this.floats) {
      if (!f.alive) continue;
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.fillStyle = "#f5f5f5";
      ctx.font = "600 14px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.textAlign = "start";
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    /** Full-screen red flash on damage — subtle and non-distracting. */
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(229, 72, 77, ${this.flash * 0.22})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  /** Draw a rounded rectangle path (used internally, kept for potential future use). */
  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
