/**
 * Session sentence deck: Fisher–Yates with crypto RNG, no repeats until full pass.
 */

/**
 * @param {number} max exclusive upper bound (must be > 0)
 */
export function cryptoRandomInt(max) {
  if (max <= 0) return 0
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x1_0000_0000 / max) * max
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return buf[0] % max
}

/**
 * Fisher–Yates shuffle (crypto RNG).
 * @template T
 * @param {readonly T[]} arr
 */
export function fisherYatesShuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = cryptoRandomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Rotate shuffled order so each session starts at a different offset.
 * @param {number[]} order
 * @param {number} sessionSeed typically Date.now()
 */
function rotateOrder(order, sessionSeed) {
  if (order.length <= 1) return order
  const offset = Math.abs(Math.floor(sessionSeed)) % order.length
  if (offset === 0) return order
  return [...order.slice(offset), ...order.slice(0, offset)]
}

/**
 * Build index order 0..n-1, shuffled + rotated by session seed.
 * @param {number} length pool size
 * @param {number} [sessionSeed=Date.now()]
 */
export function buildShuffledIndexOrder(length, sessionSeed = Date.now()) {
  if (length <= 0) return []
  const indices = Array.from({ length }, (_, i) => i)
  return rotateOrder(fisherYatesShuffle(indices), sessionSeed)
}

/**
 * @template T
 * @param {readonly T[]} pool
 * @param {number} [sessionSeed]
 * @returns {{ pool: T[], order: number[], pointer: number, usedIndices: Set<number> }}
 */
export function createSentenceSessionDeck(pool, sessionSeed = Date.now()) {
  const rows = Array.isArray(pool) ? pool.filter(Boolean) : []
  return {
    pool: rows,
    order: buildShuffledIndexOrder(rows.length, sessionSeed),
    pointer: 0,
    usedIndices: new Set(),
  }
}

/**
 * Advance deck; reshuffles when the current pass is exhausted.
 * @template T
 * @param {{
 *   pool: T[],
 *   order: number[],
 *   pointer: number,
 *   usedIndices: Set<number>,
 * }} deck
 * @returns {T | null}
 */
export function takeFromSentenceSessionDeck(deck) {
  if (!deck.pool.length) return null

  if (deck.pointer >= deck.order.length) {
    const sessionSeed = Date.now()
    deck.order = buildShuffledIndexOrder(deck.pool.length, sessionSeed)
    deck.pointer = 0
    deck.usedIndices.clear()
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.log('%c[Sentences] Deck reshuffled — new pass', 'color: #D4A843', {
        poolSize: deck.pool.length,
        sessionSeed,
      })
    }
  }

  const poolIndex = deck.order[deck.pointer]
  deck.pointer += 1
  deck.usedIndices.add(poolIndex)
  return deck.pool[poolIndex] ?? null
}
