// Shared month utility used across Dashboard, Budget, Reports

export function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7) + '-01'
}

export function formatMonthLabel(monthStr) {
  // monthStr = "2026-05-01"
  const date = new Date(monthStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatMonthShort(monthStr) {
  const date = new Date(monthStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export function getPreviousMonth(monthStr) {
  const date = new Date(monthStr + 'T12:00:00')
  date.setMonth(date.getMonth() - 1)
  return date.toISOString().slice(0, 7) + '-01'
}

export function getNextMonth(monthStr) {
  const date = new Date(monthStr + 'T12:00:00')
  date.setMonth(date.getMonth() + 1)
  return date.toISOString().slice(0, 7) + '-01'
}

export function isCurrentMonth(monthStr) {
  return monthStr === getCurrentMonth()
}

export function isFutureMonth(monthStr) {
  return monthStr > getCurrentMonth()
}

// Generate last N months as array of "YYYY-MM-01" strings
export function getLastNMonths(n = 6) {
  const months = []
  const current = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(current.getFullYear(), current.getMonth() - i, 1)
    months.unshift(d.toISOString().slice(0, 7) + '-01')
  }
  return months
}
