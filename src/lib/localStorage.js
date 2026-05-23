// Guest localStorage data layer
// Mirrors the Supabase data model so components work identically

const PREFIX = 'clarity_guest_'

export function guestGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function guestSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch { return false }
}

export function guestDelete(key) {
  try {
    localStorage.removeItem(PREFIX + key)
    return true
  } catch { return false }
}

export function guestClear() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .forEach(k => localStorage.removeItem(k))
}

// Budget entries
export function getBudgetEntries(month) {
  const all = guestGet('budget_entries') || []
  return all.filter(e => e.month === month)
}

export function saveBudgetEntries(month, entries) {
  const all = guestGet('budget_entries') || []
  const otherMonths = all.filter(e => e.month !== month)
  guestSet('budget_entries', [...otherMonths, ...entries.map(e => ({ ...e, month }))])
}

export function deleteBudgetEntry(id) {
  const all = guestGet('budget_entries') || []
  guestSet('budget_entries', all.filter(e => e.id !== id))
}

export function getAllBudgetEntries() {
  return guestGet('budget_entries') || []
}

// Savings goals
export function getGoals() {
  return guestGet('savings_goals') || []
}

export function saveGoal(goal) {
  const goals = getGoals()
  const exists = goals.find(g => g.id === goal.id)
  if (exists) {
    guestSet('savings_goals', goals.map(g => g.id === goal.id ? goal : g))
  } else {
    guestSet('savings_goals', [...goals, { ...goal, id: goal.id || crypto.randomUUID(), created_at: new Date().toISOString() }])
  }
}

export function deleteGoal(id) {
  guestSet('savings_goals', getGoals().filter(g => g.id !== id))
}

// Check if guest has any data worth saving
export function guestHasData() {
  const entries = getAllBudgetEntries()
  const goals = getGoals()
  return entries.length > 0 || goals.length > 0
}
