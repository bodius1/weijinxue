export const BASE_POINTS_PER_CHAR = 10

/** @type {Record<number, number>} */
export const MULTIPLIER_TIERS = {
  0: 1,
  3: 1.5,
  6: 2,
  10: 3,
  15: 5,
}

/**
 * @param {number} streak
 */
export function getMultiplier(streak) {
  let m = 1
  for (const [min, val] of Object.entries(MULTIPLIER_TIERS)) {
    if (streak >= Number(min)) m = val
  }
  return m
}

/**
 * @param {number} streak
 */
export function pointsForChar(streak) {
  return BASE_POINTS_PER_CHAR * getMultiplier(streak)
}
