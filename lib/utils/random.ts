/**
 * Cryptographically secure randomness helpers. Use these instead of Math.random()
 * for anything a person could exploit or dispute: passwords, tokens, ids, and
 * the order of exam questions. Works in the browser and in Node 19+ (globalThis.crypto).
 */

/** Uniform random integer in [0, maxExclusive) without modulo bias. */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("maxExclusive must be a positive integer")
  }
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive
  const buf = new Uint32Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % maxExclusive
  }
}

/** Random string drawn uniformly from `alphabet`. */
export function secureRandomString(length: number, alphabet: string): string {
  let out = ""
  for (let i = 0; i < length; i++) out += alphabet[secureRandomInt(alphabet.length)]
  return out
}

/** Unbiased Fisher–Yates shuffle. Returns a new array; the input is not mutated. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** One uniformly random element, or undefined for an empty list. */
export function pickRandom<T>(items: readonly T[]): T | undefined {
  return items.length ? items[secureRandomInt(items.length)] : undefined
}
