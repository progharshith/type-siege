/**
 * Type Siege — Main Game Component
 *
 * Renders the full-screen game view: a canvas managed by GameEngine,
 * a top HUD bar, an HP bar, power-up slots, toast notifications, and
 * the pause / game-over overlay panels.
 *
 * All game logic lives in GameEngine; this component only reads from the
 * Zustand store and forwards user interactions back to the engine or store.
 *
 * Author: progharshith (https://github.com/progharshith)
 */

import { useEffect, useRef } from "react";
import { GameEngine } from "@/game/engine";
import { useGame, powerLabel, type PowerKind } from "@/game/store";
import { getDailyChallenge, type Difficulty, type Pack } from "@/game/words";
import { ACHIEVEMENTS } from "@/game/achievements";

/** Difficulty selector options shown in the pause menu. */
const DIFFS: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "insane", label: "Insane" },
];

/** Word-pack selector options shown in the pause menu. */
const PACKS: { id: Pack; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "code", label: "Code" },
  { id: "symbols", label: "Symbols" },
  { id: "daily", label: "Daily" },
];

/** Short three-letter glyphs displayed on the power-up slot buttons. */
const POWER_GLYPH: Record<PowerKind, string> = {
  slowmo: "SLO", freeze: "FRZ", nuke: "NUK", autocomplete: "ACX", shield: "SHD",
};

/** Top-level game component. Mount once and it self-manages the engine lifecycle. */
export function TypeSiege() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  /** Read every HUD value from the store with fine-grained selectors. */
  const phase = useGame((s) => s.phase);
  const difficulty = useGame((s) => s.difficulty);
  const pack = useGame((s) => s.pack);
  const isDaily = useGame((s) => s.isDaily);
  const score = useGame((s) => s.score);
  const combo = useGame((s) => s.combo);
  const bestCombo = useGame((s) => s.bestCombo);
  const health = useGame((s) => s.health);
  const maxHealth = useGame((s) => s.maxHealth);
  const wave = useGame((s) => s.wave);
  const kills = useGame((s) => s.kills);
  const keysTyped = useGame((s) => s.keysTyped);
  const keysCorrect = useGame((s) => s.keysCorrect);
  const startTime = useGame((s) => s.startTime);
  const highScore = useGame((s) => s.highScore);
  const powerups = useGame((s) => s.powerups);
  const toasts = useGame((s) => s.toasts);
  const unlocked = useGame((s) => s.unlocked);

  /** Create the engine on mount, reset store state, and clean up on unmount. */
  useEffect(() => {
    if (!canvasRef.current) return;
    const eng = new GameEngine(canvasRef.current);
    engineRef.current = eng;
    useGame.getState().reset();
    eng.start(useGame.getState().difficulty, useGame.getState().pack);
    return () => eng.destroy();
  }, []);

  /** Keep the engine's internal pause flag in sync with the store phase. */
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setPaused(phase === "paused");
  }, [phase]);

  /**
   * (Re)start the game with optional overrides for difficulty, pack, and daily mode.
   * When daily mode is selected the difficulty and seed come from getDailyChallenge().
   */
  const restart = (opts?: { difficulty?: Difficulty; pack?: Pack; daily?: boolean }) => {
    const d = opts?.difficulty ?? difficulty;
    const isD = opts?.daily ?? false;
    let p = opts?.pack ?? pack;
    let chosenDiff = d;
    let seed: number | undefined;
    if (isD) {
      const ch = getDailyChallenge();
      chosenDiff = ch.difficulty;
      seed = ch.seed;
      p = "daily";
    }
    useGame.getState().reset({ difficulty: chosenDiff, pack: p, isDaily: isD });
    engineRef.current?.start(chosenDiff, p, seed);
  };

  /** Derived stats computed from raw store values. */
  const accuracy = keysTyped > 0 ? Math.round((keysCorrect / keysTyped) * 100) : 100;
  const elapsedMin = startTime ? (performance.now() - startTime) / 60000 : 0;
  const wpm = elapsedMin > 0 ? Math.round((keysCorrect / 5) / elapsedMin) : 0;
  const hpPct = Math.max(0, Math.min(1, health / maxHealth));
  const lowHp = hpPct < 0.3;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#111] text-neutral-100 select-none font-mono">
      {/* Full-screen canvas — the engine draws directly onto this element. */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* TOP HUD — single line, flat, no panels */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-4 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        <div className="flex items-center gap-6">
          <Stat label="Score" value={score.toLocaleString()} emphasis />
          <Stat label="Wave" value={wave} />
          <Stat label="Combo" value={`×${combo}`} accent={combo >= 5} />
        </div>

        <div className="flex items-center gap-6">
          <Stat label="WPM" value={wpm} />
          <Stat label="Acc" value={`${accuracy}%`} />
          <Stat label="Kills" value={kills} />
          {highScore > 0 && <Stat label="Best" value={highScore.toLocaleString()} />}
          <button
            onClick={() => useGame.getState().setPhase(phase === "paused" ? "playing" : "paused")}
            className="pointer-events-auto border border-neutral-700 px-2 py-1 text-[10px] tracking-[0.2em] text-neutral-300 hover:bg-neutral-800"
          >
            {phase === "paused" ? "Resume" : "Pause"}
          </button>
        </div>
      </div>

      {/* HP BAR — single horizontal line below the HUD; turns red when HP < 30% */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-10 px-6">
        <div className="h-[3px] w-full bg-neutral-800">
          <div
            className="h-full transition-[width] duration-150"
            style={{
              width: `${hpPct * 100}%`,
              background: lowHp ? "#e5484d" : "#e5e5e5",
            }}
          />
        </div>
      </div>

      {/* POWER-UP SLOTS — bottom-left, three slots (hotkeys 1 / 2 / 3) */}
      <div className="pointer-events-none absolute bottom-6 left-6 z-10 flex items-end gap-2">
        {[0, 1, 2].map((i) => {
          const k = powerups[i];
          return (
            <button
              key={i}
              disabled={!k}
              onClick={() => {
                const used = useGame.getState().consumePowerup(i);
                if (used) (engineRef.current as any)?.activatePower?.(used);
              }}
              className={`pointer-events-auto h-12 w-12 border text-[10px] tracking-[0.15em] transition ${
                k
                  ? "border-neutral-500 text-neutral-100 hover:bg-neutral-100 hover:text-neutral-900"
                  : "border-neutral-800 text-neutral-700"
              }`}
              title={k ? powerLabel(k) : "Empty"}
            >
              {k ? POWER_GLYPH[k] : i + 1}
            </button>
          );
        })}
      </div>

      {/* HINT LINE — bottom-center, reminds players of the core controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-7 z-10 text-center text-[10px] uppercase tracking-[0.3em] text-neutral-600">
        Type · Esc pause · 1 2 3 power-ups
      </div>

      {/* TOASTS — bottom-right stack; auto-dismiss after 3.5 s */}
      <div className="pointer-events-none absolute bottom-6 right-6 z-20 flex flex-col items-end gap-1.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] ${
              t.tone === "achievement"
                ? "border-neutral-100 text-neutral-100"
                : t.tone === "powerup"
                ? "border-neutral-400 text-neutral-200"
                : "border-neutral-700 text-neutral-400"
            }`}
          >
            <span className="text-neutral-500">{t.title}</span>
            {t.body && <span className="ml-2 normal-case tracking-normal">{t.body}</span>}
          </div>
        ))}
      </div>

      {/* PAUSE OVERLAY — difficulty / pack selectors + achievements list */}
      {phase === "paused" && (
        <Overlay>
          <div className="w-full max-w-lg">
            <div className="text-[11px] uppercase tracking-[0.4em] text-neutral-500">Type Siege</div>
            <h2 className="mt-2 text-5xl font-bold tracking-tight text-neutral-100">Paused</h2>

            <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {/* Difficulty selector — changing restarts the run immediately. */}
              <Pill label="Difficulty">
                {DIFFS.map((d) => (
                  <Tab
                    key={d.id}
                    active={d.id === difficulty && !isDaily}
                    onClick={() => restart({ difficulty: d.id, pack })}
                  >
                    {d.label}
                  </Tab>
                ))}
              </Pill>
              {/* Pack selector — Daily always uses today's seeded settings. */}
              <Pill label="Pack">
                {PACKS.map((p) => (
                  <Tab
                    key={p.id}
                    active={p.id === "daily" ? isDaily : p.id === pack && !isDaily}
                    onClick={() => restart(p.id === "daily" ? { daily: true } : { pack: p.id })}
                  >
                    {p.label}
                  </Tab>
                ))}
              </Pill>
            </div>

            {/* Achievements list — scrollable, locked ones are dimmed. */}
            <div className="mt-10">
              <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                Achievements · {unlocked.size}/{ACHIEVEMENTS.length}
              </div>
              <div className="max-h-48 overflow-y-auto border border-neutral-800">
                {ACHIEVEMENTS.map((a) => {
                  const got = unlocked.has(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`flex items-baseline gap-3 border-b border-neutral-900 px-3 py-1.5 text-xs ${
                        got ? "text-neutral-100" : "text-neutral-600"
                      }`}
                    >
                      <span className="w-3 text-center">{got ? "■" : "□"}</span>
                      <span className="font-semibold">{a.name}</span>
                      <span className="text-[11px] text-neutral-500">{a.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <ActionBtn primary onClick={() => useGame.getState().setPhase("playing")}>Resume</ActionBtn>
              <ActionBtn onClick={() => restart()}>Restart</ActionBtn>
            </div>
          </div>
        </Overlay>
      )}

      {/* GAME OVER OVERLAY — final stats summary + replay / daily buttons */}
      {phase === "gameover" && (
        <Overlay>
          <div className="w-full max-w-lg">
            <div className="text-[11px] uppercase tracking-[0.4em] text-neutral-500">Run Ended</div>
            <h2 className="mt-2 text-5xl font-bold tracking-tight text-neutral-100">Game Over</h2>

            <dl className="mt-10 grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-4">
              <Result label="Score" value={score.toLocaleString()} />
              <Result label="Wave" value={wave} />
              <Result label="Kills" value={kills} />
              <Result label="Best Combo" value={`×${bestCombo}`} />
              <Result label="WPM" value={wpm} />
              <Result label="Accuracy" value={`${accuracy}%`} />
              <Result label="Mode" value={isDaily ? "Daily" : difficulty} />
              <Result label="Best" value={highScore.toLocaleString()} />
            </dl>

            <div className="mt-10 flex flex-wrap gap-3">
              <ActionBtn primary onClick={() => restart()}>Play again</ActionBtn>
              <ActionBtn onClick={() => restart({ daily: true })}>Daily challenge</ActionBtn>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

/** A single labelled stat in the top HUD. */
function Stat({
  label, value, emphasis, accent,
}: { label: string; value: string | number; emphasis?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] tracking-[0.2em] text-neutral-500">{label}</span>
      <span
        className={`tabular-nums ${
          emphasis ? "text-base font-semibold text-neutral-100" : "text-sm text-neutral-200"
        } ${accent ? "text-amber-300" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Full-screen semi-opaque backdrop used by the pause and game-over panels. */
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#111]/95 px-6 font-mono">
      {children}
    </div>
  );
}

/** Labelled group of toggle tabs (e.g. difficulty or pack selector). */
function Pill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-neutral-500">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

/** Individual toggle button inside a Pill group. */
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] transition ${
        active
          ? "border-neutral-100 bg-neutral-100 text-neutral-900"
          : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

/** Primary or secondary action button in overlay panels. */
function ActionBtn({
  children, onClick, primary,
}: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`border px-5 py-2 text-[11px] uppercase tracking-[0.2em] transition ${
        primary
          ? "border-neutral-100 bg-neutral-100 text-neutral-900 hover:bg-neutral-300"
          : "border-neutral-700 text-neutral-200 hover:border-neutral-400"
      }`}
    >
      {children}
    </button>
  );
}

/** A single labelled stat in the game-over summary grid. */
function Result({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-neutral-100">{value}</div>
    </div>
  );
}
