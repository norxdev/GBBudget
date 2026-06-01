import { useState } from 'react'
import ShareCard from '../../components/ShareCard'
import styles from './Tool.module.css'

function calc({ target, current, monthly, targetDate }) {
  if (!target) return null
  const t = Number(target)
  const c = Number(current) || 0
  const m = Number(monthly) || 0
  const needed = t - c
  if (needed <= 0) return { alreadyDone: true, target: t, current: c }

  let months = null, projectedDate = null, requiredMonthly = null

  if (m > 0) {
    months = Math.ceil(needed / m)
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    projectedDate = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  if (targetDate) {
    const now = new Date()
    const end = new Date(targetDate)
    const monthsToTarget = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()))
    requiredMonthly = Math.ceil(needed / monthsToTarget)
  }

  return {
    needed: Math.round(needed),
    months, projectedDate, requiredMonthly,
    pct: Math.min(Math.round((c / t) * 100), 100),
    alreadyDone: false, target: t, current: c,
  }
}

const GOAL_TYPES = [
  { id: 'house',     label: 'House'          },
  { id: 'car',       label: 'Car'            },
  { id: 'vacation',  label: 'Vacation'       },
  { id: 'emergency', label: 'Emergency Fund' },
  { id: 'education', label: 'Education'      },
  { id: 'other',     label: 'Other'          },
]

export default function SavingsGoalCalc({ isGuest, onTabChange }) {
  const [goalType, setGoalType] = useState('house')
  const [form, setForm] = useState({ target: '', current: '', monthly: '', targetDate: '' })
  const [result, setResult] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const selected = GOAL_TYPES.find(g => g.id === goalType)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); setResult(null) }

  function analyze() {
    setResult(calc(form))
    setShowShare(false)
    setTimeout(() => document.getElementById('tool-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  function reset() { setForm({ target: '', current: '', monthly: '', targetDate: '' }); setResult(null); setShowShare(false) }

  const canAnalyze = form.target && (form.monthly || form.targetDate)

  function formatMonths(m) {
    if (!m) return ''
    if (m >= 12) return `${Math.floor(m / 12)} yr ${m % 12} mo`
    return `${m} months`
  }

  const shareUrl = result && !result.alreadyDone && result.projectedDate
    ? `https://norxdev.github.io/GBBudget/?tool=savings&label=${encodeURIComponent(selected.label)}&date=${encodeURIComponent(result.projectedDate)}&pct=${result.pct}`
    : ''

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Savings Goal Calculator</h1>
          <p>Find out when you'll reach your goal and how much to save each month</p>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.inputPanel}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>What are you saving for?</div>
            <div className={styles.typeGrid}>
              {GOAL_TYPES.map(g => (
                <button key={g.id} className={`${styles.typeBtn} ${goalType === g.id ? styles.typeActive : ''}`}
                  onClick={() => { setGoalType(g.id); setResult(null) }}>
                  <span className={styles.typeLabel}>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Goal Details</div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Target amount *</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="50000" value={form.target} onChange={e => setField('target', e.target.value)} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Already saved</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="0" value={form.current} onChange={e => setField('current', e.target.value)} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Monthly savings amount</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="500" value={form.monthly} onChange={e => setField('monthly', e.target.value)} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Target date <span className={styles.optional}>(optional)</span></label>
                <input type="date" value={form.targetDate} onChange={e => setField('targetDate', e.target.value)} className={styles.dateInput} />
                <div className={styles.fieldHint}>Shows required monthly savings</div>
              </div>
            </div>
            <button className={styles.analyzeBtn} onClick={analyze} disabled={!canAnalyze}>
              Calculate
            </button>
          </div>
        </div>

        <div className={styles.resultPanel} id="tool-result">
          {!result ? (
            <div className={styles.emptyResult}>
              <div className={styles.emptyIcon}>🎯</div>
              <h3>Ready to calculate</h3>
              <p>Enter your goal details to see your savings timeline.</p>
            </div>
          ) : result.alreadyDone ? (
            <div className={styles.successCard}>
              <div className={styles.successIcon}>🎉</div>
              <h3>Goal already reached!</h3>
              <p>You've already saved ${Number(result.current).toLocaleString()} which meets your ${Number(result.target).toLocaleString()} goal.</p>
            </div>
          ) : (
            <>
              <div className={styles.resultCard}>
                <div className={styles.resultLabel}>{result.pct}% there — {selected.label}</div>
                <div className={styles.progressBarLarge}>
                  <div className={styles.progressFill} style={{ width: result.pct + '%' }} />
                </div>
                <div className={styles.progressLabels}>
                  <span>${Number(form.current || 0).toLocaleString()} saved</span>
                  <span>${result.needed.toLocaleString()} to go</span>
                </div>
              </div>

              <div className={styles.metricsGrid}>
                {result.projectedDate && (
                  <div className={styles.metricCard}>
                    <div className={styles.metricValue} style={{ color: 'var(--accent)' }}>{result.projectedDate}</div>
                    <div className={styles.metricLabel}>Projected completion</div>
                    <div className={styles.metricSub}>{formatMonths(result.months)} from now</div>
                  </div>
                )}
                {result.requiredMonthly && (
                  <div className={styles.metricCard}>
                    <div className={styles.metricValue} style={{ color: 'var(--accent)' }}>${result.requiredMonthly.toLocaleString()}/mo</div>
                    <div className={styles.metricLabel}>Needed for target date</div>
                    <div className={styles.metricSub}>
                      {form.monthly && Number(form.monthly) < result.requiredMonthly
                        ? `$${result.requiredMonthly - Number(form.monthly)}/mo short`
                        : 'You can make it!'}
                    </div>
                  </div>
                )}
              </div>

              {form.monthly && result.requiredMonthly && Number(form.monthly) < result.requiredMonthly && (
                <div className={styles.gapCard}>
                  <div className={styles.gapTitle}>To hit your target date</div>
                  <p>You need <strong>${result.requiredMonthly.toLocaleString()}/mo</strong> but saving <strong>${Number(form.monthly).toLocaleString()}/mo</strong> — a gap of <strong>${(result.requiredMonthly - Number(form.monthly)).toLocaleString()}/mo</strong>.</p>
                </div>
              )}

              <button className={styles.shareToggleBtn} onClick={() => setShowShare(s => !s)}>
                {showShare ? 'Hide share options' : 'Share this result'}
              </button>
              {showShare && shareUrl && (
                <ShareCard
                  url={shareUrl}
                  twitterText={`I'm saving for ${selected.label} — on track to reach my goal ${result.projectedDate ? `by ${result.projectedDate}` : 'soon'}! Calculated with Clarity:`}
                  whatsappText={`Check out my ${selected.label} savings timeline on Clarity:`}
                />
              )}

              <button className={styles.resetBtn} onClick={reset}>Calculate another goal</button>

              {!isGuest && (
                <div className={styles.ctaBanner}>
                  <span>Track this goal in your dashboard</span>
                  <button onClick={() => onTabChange('goals')}>Open Goals</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
