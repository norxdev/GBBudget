import styles from './MonthSelector.module.css'
import {
  formatMonthLabel,
  getPreviousMonth,
  getNextMonth,
  isFutureMonth,
  isCurrentMonth
} from '../lib/months'
import { canViewHistory } from '../lib/plans'

export default function MonthSelector({ month, onChange, profile, onUpgrade }) {
  const prev = getPreviousMonth(month)
  const next = getNextMonth(month)
  const future = isFutureMonth(next)
  const current = isCurrentMonth(month)
  // Fix #5: lock fires any time history not allowed, not just on current month
  const historyAllowed = canViewHistory(profile)

  function handlePrev() {
    if (!historyAllowed) {
      onUpgrade?.()
      return
    }
    onChange(prev)
  }

  return (
    <div className={styles.selector}>
      <button
        className={`${styles.arrow} ${!historyAllowed ? styles.locked : ''}`}
        onClick={handlePrev}
        title={!historyAllowed ? 'Upgrade to view history' : 'Previous month'}
      >
        {!historyAllowed ? '🔒' : '‹'}
      </button>
      <div className={styles.label}>
        <span className={styles.monthName}>{formatMonthLabel(month)}</span>
        {current && <span className={styles.currentBadge}>Current</span>}
      </div>
      <button
        className={`${styles.arrow} ${future ? styles.disabled : ''}`}
        onClick={() => !future && onChange(next)}
        disabled={future}
        title="Next month"
      >
        ›
      </button>
    </div>
  )
}
