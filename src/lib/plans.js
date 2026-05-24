// Plan limits and feature gates

export const PLAN_LIMITS = {
  free: {
    budgetRows: 10,
    goals: 3,
    historyMonths: 0, // current month only
    categoryLimits: false,
    trends: false,
    goalProjections: false,
    advancedExports: false,
  },
  premium: {
    budgetRows: Infinity,
    goals: Infinity,
    historyMonths: 12,
    categoryLimits: true,
    trends: true,
    goalProjections: true,
    advancedExports: true,
  }
}

export function getPlan(profile) {
  return profile?.plan === 'premium' ? 'premium' : 'free'
}

export function getLimits(profile) {
  return PLAN_LIMITS[getPlan(profile)]
}

export function isPremium(profile) {
  return profile?.plan === 'premium'
}

export function canAddBudgetRow(profile, currentRowCount) {
  const limits = getLimits(profile)
  return currentRowCount < limits.budgetRows
}

export function canAddGoal(profile, currentGoalCount) {
  const limits = getLimits(profile)
  return currentGoalCount < limits.goals
}

export function canViewHistory(profile) {
  return getLimits(profile).historyMonths > 0
}
