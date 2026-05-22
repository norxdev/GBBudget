import styles from './MonthSelector.module.css'
import {
  formatMonthLabel,
  getPreviousMonth,
  getNextMonth,
  isFutureMonth,
  isCurrentMonth
} from '../lib/months'

export default function MonthSelector({ month, onChange }) {
  const prev = getPreviousMonth(month)
  const next = getNextMonth(month)
  const future = isFutureMonth(next)
  const current = isCurrentMonth(month)

  return (
    <div className={styles.selector}>
      <button
        className={styles.arrow}
        onClick={() => onChange(prev)}
        title="Previous month"
      >
        ‹
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
