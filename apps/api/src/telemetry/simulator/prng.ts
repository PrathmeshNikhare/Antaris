/**
 * Seedable Pseudo-Random Number Generator (Mulberry32)
 * Provides deterministic pseudo-random sequences for repeatable baseline telemetry and noise.
 */
export class PRNG {
  private seed: number;

  constructor(seed = 123456789) {
    this.seed = seed >>> 0;
  }

  /**
   * Returns a uniform pseudo-random number in [0, 1)
   */
  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random float between [min, max)
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Generates normally-distributed numbers (Gaussian) using Box-Muller transform
   * @param mean Center of distribution
   * @param stdDev Standard deviation
   */
  gaussian(mean = 0, stdDev = 1): number {
    let u1 = this.next();
    let u2 = this.next();
    // Avoid log(0)
    while (u1 === 0) u1 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}
