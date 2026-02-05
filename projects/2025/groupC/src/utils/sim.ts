export type ClampOpts = { min?: number; max?: number };

export function clamp(x: number, opts: ClampOpts = {}): number {
  if (typeof opts.min === "number") x = Math.max(opts.min, x);
  if (typeof opts.max === "number") x = Math.min(opts.max, x);
  return x;
}

export class RandomWalk {
  constructor(
    public value: number,
    private step: number,
    private clampOpts: ClampOpts = {}
  ) {}

  tick(): number {
    const delta = (Math.random() * 2 - 1) * this.step;
    this.value = clamp(this.value + delta, this.clampOpts);
    return this.value;
  }
}

export function rareToggle(current: boolean, p: number): boolean {
  if (p <= 0) return current;
  if (p >= 1) return !current;
  return Math.random() < p ? !current : current;
}

export function smoothTo(current: number, target: number, alpha: number): number {
  const a = clamp(alpha, { min: 0, max: 1 });
  return current + (target - current) * a;
}

export function every(ms: number, fn: () => void): () => void {
  const t = setInterval(fn, ms);
  if (typeof t.unref === "function") t.unref();
  return () => clearInterval(t);
}
