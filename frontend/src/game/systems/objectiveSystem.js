import { lostKingdom } from '../data/missions/lostKingdom.js'

export function completeObjective(state, objectiveId) {
  if (!Object.hasOwn(state.objectives, objectiveId) || state.objectives[objectiveId]) {
    return state
  }

  const objectives = { ...state.objectives, [objectiveId]: true }
  const completed = lostKingdom.objectives.every(({ id }) => objectives[id])
  return {
    ...state,
    objectives,
    status: completed ? 'victory' : state.status,
  }
}
