/**
 * PLACEHOLDER — global / public “Monkeytype-style” counters (total learners, total reviews, etc.)
 *
 * Do NOT implement writes from this client:
 * - Users could spoof increments or corrupt public totals.
 *
 * Planned approach (TODO):
 * - Aggregate signed-in user data from Firestore (users/*/stats/summary) via Firebase Cloud Functions
 *   on a schedule, or use BigQuery export + scheduled queries.
 * - Alternatively, maintain a single `public_stats/global` document updated ONLY by a Cloud Function
 *   with Admin SDK, after validating inputs from trusted triggers.
 * - Firebase Analytics (GA4) can feed BigQuery for anonymous funnel / DAU; combine with secure aggregates for a public dashboard.
 *
 * Future public dashboard (safe to show only after server-side aggregation):
 * - Total study sessions completed
 * - Total reviews / flashcard ratings / quiz answers
 * - Total characters typed
 * - Approximate active learners (DAU/WAU from Analytics or aggregated counts)
 * - Total study time (sum of user-contributed seconds must be validated server-side)
 */

export const GLOBAL_STATS_PLACEHOLDER = true
