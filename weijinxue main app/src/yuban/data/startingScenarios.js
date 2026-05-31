/** @typedef {{ id: string, icon: string, label: string, desc: string }} StartingScenario */

/** @type {StartingScenario[]} */
export const SCENARIOS = [
  {
    id: 'arrival',
    icon: '🛬',
    label: 'Just arrived at the airport',
    desc: 'Practice greetings and asking for directions',
  },
  {
    id: 'work',
    icon: '🏢',
    label: 'First day at a new job',
    desc: 'Workplace vocabulary, introducing yourself',
  },
  {
    id: 'apartment',
    icon: '🏠',
    label: 'Moving into your apartment',
    desc: 'Daily life, meeting neighbors',
  },
  {
    id: 'cafe',
    icon: '☕',
    label: 'Meeting a friend at a café',
    desc: 'Casual conversation, ordering food',
  },
]

/** @param {string} id */
export function getScenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
}
