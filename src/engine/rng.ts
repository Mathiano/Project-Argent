export interface RNG {
  next(): number;
}

// mulberry32 — single uint32 seed, fast, good enough for sims.
export function mulberry32(seed: number): RNG {
  let s = seed >>> 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function rngPick<T>(rng: RNG, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('rngPick: empty array');
  const i = Math.floor(rng.next() * arr.length);
  return arr[i]!;
}

export function rngInt(rng: RNG, n: number): number {
  return Math.floor(rng.next() * n);
}

export function fixedRng(values: readonly number[]): RNG {
  let i = 0;
  return {
    next(): number {
      const v = values[i % values.length]!;
      i += 1;
      return v;
    },
  };
}
