/**
 * Type Siege — Word Datasets
 *
 * All typing vocabulary, organised by difficulty and word pack.
 * The engine calls `pickWord` each time it needs a fresh word for a
 * new enemy, and `getDailyChallenge` to get today's seeded settings.
 *
 * Packs
 * -----
 *   classic  — Common English words and gaming vocabulary.
 *   code     — Programming keywords and idioms.
 *   symbols  — Alphanumeric codes and special-character strings.
 *   daily    — Draws from the classic pool with a date-seeded RNG so every
 *              player worldwide sees the same sequence on the same day.
 *
 * Author: progharshith (https://github.com/progharshith)
 */

export type Difficulty = "easy" | "medium" | "hard" | "insane";
export type Pack = "classic" | "code" | "symbols" | "daily";

/** Classic vocabulary: short everyday and gaming words. */
const CLASSIC: Record<Difficulty, string[]> = {
  easy: [
    "cat","dog","run","jump","sky","fire","ice","sun","moon","star",
    "code","game","play","fast","slow","hit","kill","life","die","win",
    "red","blue","gold","dark","void","arc","bow","axe","map","key",
    "ship","wave","beam","lock","rage","epic","loot","raid","node","byte",
  ],
  medium: [
    "shadow","plasma","cipher","matrix","vector","portal","glitch","syntax",
    "binary","kernel","engine","reactor","circuit","neuron","quantum","photon",
    "phantom","specter","viper","raptor","mirage","ember","frost","crimson",
    "warden","ranger","sentry","vandal","echelon","oracle","cobalt","obsidian",
  ],
  hard: [
    "obfuscate","asynchronous","neutralizer","catastrophe","transmission",
    "pyrotechnic","manipulator","cryptography","exoskeleton","pyromancer",
    "electromagnetic","superposition","reverberation","incandescent",
    "subterranean","luminescence","metamorphosis","hieroglyphic","penultimate",
    "extraterrestrial","constellation","decentralized","interstellar",
  ],
  insane: [
    "Schadenfreude!","quantum-entangled","404_NOT_FOUND","SEGFAULT::0xDEAD",
    "[Object{Object}]","npm::install","async/await<T>","super(props);",
    "Hyperbolic*Tangent","Ω-collapse_v3","NaN+Infinity","throw_new_Error",
    "git::push--force","sudo::rm-rf/","kernel_panic!!","CTRL+ALT+DEL",
    "0xCAFEBABE","Promise.reject()","while(true){}","stackoverflow_42",
  ],
};

/** Code pack: programming keywords and common expressions. */
const CODE: Record<Difficulty, string[]> = {
  easy: ["let","var","int","str","map","set","arr","ref","new","get","try","for","let","def","var","fn","obj","key","val","nil"],
  medium: ["return","import","export","const","async","await","class","yield","throw","catch","static","public","private","module","switch","while","break","render","effect","reduce"],
  hard: ["useEffect","useMemo","interface","Promise.all","Object.keys","JSON.parse","Array.from","prototype","constructor","typescript","subscribe","middleware","reconcile","memoization","virtualDOM","destructure","serialize","callback"],
  insane: ["() => Promise.resolve()","Array<T>.flatMap()","Object.entries(obj)","useState<number>(0)","throw new TypeError()","await fetch(`/api/${id}`)","class extends Component {}","[...new Set(arr)]","z.object({}).parse(x)","Record<string, never>"],
};

/** Symbols pack: alphanumeric codes and special-character challenges. */
const SYMBOLS: Record<Difficulty, string[]> = {
  easy: ["a1","b2","c3","d4","x9","y8","z7","q1","r2","s3","t4","u5","v6","w7","p0","o9","n8","m7","l6","k5"],
  medium: ["alpha-7","beta_42","gamma:9","delta!1","echo+0","fox-x2","hop=3","ion#4","jet@5","kilo*6","lima/7","mike?8","nova%9","ohm&0","papa^1","quark$2","romeo~3","sierra|4","tango>5","union<6"],
  hard: ["[a-z]+@9","{key:val}","#tag::42","<<shift>>","->arrow<-","2*pi/r^2","sum(1..n)","max(a,b,c)","f(x)=x^2","rgb(255,0,0)"],
  insane: ["~!@#$%^&*","λx.x*x+1","∑(n=1→∞)","∂f/∂x≈0","≡≠≤≥±√","⌘+⇧+P","¯\\_(ツ)_/¯","⟨bra|ket⟩","∀x∃y:P(x,y)","((λ)(λ))"],
};

/** Lookup table mapping pack name to its word lists. */
const PACKS = { classic: CLASSIC, code: CODE, symbols: SYMBOLS };

/**
 * Derive an integer seed from today's UTC date.
 * All players share the same seed on the same calendar day.
 */
function dailySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * Returns a closure that produces uniform floats in [0, 1).
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Return the difficulty and seed for today's Daily Challenge.
 * The difficulty is randomly selected using today's date seed so it
 * changes daily but is consistent across all players.
 */
export function getDailyChallenge(): { difficulty: Difficulty; seed: number } {
  const seed = dailySeed();
  const rng = mulberry32(seed);
  const diffs: Difficulty[] = ["easy", "medium", "hard", "insane"];
  return { difficulty: diffs[Math.floor(rng() * diffs.length)], seed };
}

/**
 * Pick a word from the specified difficulty/pack pool that isn't already
 * assigned to a live enemy.
 *
 * If `seed` is provided the selection uses the seeded PRNG (Daily mode);
 * otherwise it falls back to `Math.random`. After 30 failed attempts it
 * returns any word from the pool to avoid an infinite loop.
 */
export function pickWord(diff: Difficulty, pack: Pack, taken: Set<string>, seed?: number): string {
  const pool = pack === "daily" ? CLASSIC[diff] : PACKS[pack][diff];
  /** Offset the seed by taken.size so each successive pick is distinct. */
  const rng = seed != null ? mulberry32(seed + taken.size * 1013) : Math.random;
  for (let i = 0; i < 30; i++) {
    const w = pool[Math.floor(rng() * pool.length)];
    if (!taken.has(w)) return w;
  }
  /** Fallback: pool exhausted — allow a duplicate rather than stalling. */
  return pool[Math.floor(Math.random() * pool.length)];
}
