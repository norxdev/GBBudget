import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isPremium, canAddGoal } from '../../lib/plans'
import { buildSavingsShareUrl } from '../../lib/share'
import ShareCard from '../../components/ShareCard'
import styles from './Tool.module.css'

const FREE_GOAL_LIMIT = 3

function calcSavingsGoal({ target, current, monthly, targetDate }) {
  if (!target) return null
  const t = Number(target)
  const c = Number(current) || 0
  const m = Number(monthly) || 0
  const needed = t - c
  if (needed <= 0) return { alreadyDone: true, target: t, current: c }

  let months = null
  let requiredMonthly = null
  let projectedDate = null

  if (m > 0) {
    months = Math.ceil(needed / m)
    projectedDate = new Date()
    projectedDate.setMonth(projectedDate.getMonth() + months)
  }

  if (targetDate) {
    const now = new Date()
    const end = new Date(targetDate)
    const monthsToTarget = Math.max(1,
      (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
    )
    requiredMonthly = Math.ceil(needed / monthsToTarget)
  }

  const pct = Math.min(Math.round((c / t) * 100), 100)

  return {
    needed: Math.round(needed),
    months,
    projectedDate: projectedDate
      ? projectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : null,
    requiredMonthly,
    pct,
    alreadyDone: false,
    target: t,
    current: c,
  }
}

const GOAL_TYPES = [
  { id: 'house',     label: 'House deposit',  icon: '🏠', emoji: '🏠' },
  { id: 'car',       label: 'Car',            icon: '🚗', emoji: '🚗' },
  { id: 'vacation',  label: 'Vacation',       icon: '✈️', emoji: '✈️' },
  { id: 'emergency', label: 'Emergency Fund', icon: '🛡️', emoji: '🛡️' },
  { id: 'education', label: 'Education',      icon: '🎓', emoji: '🎓' },
  { id: 'other',     label: 'Other',          icon: '🎯', emoji: '🎯' },
]

export default function SavingsGoalCalc({ session, isGuest, profile, showToast, onTabChange, onUpgrade }) {
  const [goalType, setGoalType] = useState('house')
  const [goalName, setGoalName] = useState('')
  const [form, setForm] = useState({ target: '', current: '', monthly: '', targetDate: '' })
  const [result, setResult] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const [addingToGoals, setAddingToGoals] = useState(false)
  const [addedToGoals, setAddedToGoals] = useState(false)
  const selected = GOAL_TYPES.find(g => g.id === goalType)
  const premium = isPremium(profile)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); setResult(null) }

  function analyze() {
    setResult(calcSavingsGoal(form))
    setShowShare(false)
    setAddedToGoals(false)
    setTimeout(() => document.getElementById('tool-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  function reset() {
    setForm({ target: '', current: '', monthly: '', targetDate: '' })
    setGoalName('')
    setResult(null)
    setShowShare(false)
    setAddedToGoals(false)
  }

  async function handleAddToGoals() {
    if (isGuest) {
      showToast('Sign in to save this goal')
      return
    }

    setAddingToGoals(true)

    // Check current goal count
    const { data: existing } = await supabase
      .from('savings_goals')
      .select('id')
      .eq('user_id', session.user.id)

    const currentCount = existing?.length || 0

    if (!premium && currentCount >= FREE_GOAL_LIMIT) {
      showToast(`${FREE_GOAL_LIMIT}/${FREE_GOAL_LIMIT} goals used — upgrade for unlimited`)
      onUpgrade()
      setAddingToGoals(false)
      return
    }

    const { error } = await supabase.from('savings_goals').insert({
      user_id: session.user.id,
      name: goalName || selected.label,
      emoji: selected.emoji,
      description: result.projectedDate ? `Projected completion: ${result.projectedDate}` : null,
      target_amount: Number(form.target),
      current_amount: Number(form.current) || 0,
      monthly_contribution: Number(form.monthly) || 0,
      target_date: form.targetDate || null,
    })

    if (error) {
      showToast('Failed to save goal — please try again')
    } else {
      setAddedToGoals(true)
      showToast('Goal saved to your dashboard!')
    }
    setAddingToGoals(false)
  }

  const canAnalyze = form.target && (form.monthly || form.targetDate)

  const shareUrl = result && !result.alreadyDone && result.projectedDate
    ? buildSavingsShareUrl(result, selected.label)
    : ''

  function formatMonths(m) {
    if (!m) return ''
    if (m >= 12) return `${Math.floor(m / 12)} yr ${m % 12} mo`
    return `${m} months`
  }

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
                <button key={g.id}
                  className={`${styles.typeBtn} ${goalType === g.id ? styles.typeActive : ''}`}
                  onClick={() => { setGoalType(g.id); setResult(null) }}>
                  <span className={styles.typeIcon}>{g.icon}</span>
                  <span className={styles.typeLabel}>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Goal Details</div>
            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label>Goal name <span className={styles.optional}>(optional)</span></label>
                <input
                  type="text"
                  placeholder={`e.g. Japan vacation, Emergency fund...`}
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  className={styles.plainInput}
                />
              </div>
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
                <label>Monthly savings</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="500" value={form.monthly} onChange={e => setField('monthly', e.target.value)} />
                </div>
                <div className={styles.fieldHint}>How much you can save per month</div>
              </div>
              <div className={styles.formGroup}>
                <label>Target date <span className={styles.optional}>(optional)</span></label>
                <input type="date" value={form.targetDate} onChange={e => setField('targetDate', e.target.value)} className={styles.dateInput} />
                <div className={styles.fieldHint}>Calculate required monthly savings</div>
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
              <p>Enter your goal details to see your timeline and monthly savings targets.</p>
            </div>
          ) : result.alreadyDone ? (
            <div className={styles.successCard}>
              <div className={styles.successIcon}>🎉</div>
              <h3>Goal already reached!</h3>
              <p>You've already saved ${Number(result.current).toLocaleString()} which meets your ${Number(result.target).toLocaleString()} goal. Time to set a new one!</p>
            </div>
          ) : (
            <>
              <div className={styles.resultCard}>
                <div className={styles.resultLabel}>{result.pct}% there</div>
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
                    <div className={styles.metricLabel}>Required for target date</div>
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
                  <p>You need <strong>${result.requiredMonthly.toLocaleString()}/mo</strong> but saving <strong>${Number(form.monthly).toLocaleString()}/mo</strong> — gap of <strong>${(result.requiredMonthly - Number(form.monthly)).toLocaleString()}/mo</strong>.</p>
                </div>
              )}

              {/* Add to goals CTA */}
              {!addedToGoals ? (
                <button
                  className={styles.addToAppBtn}
                  onClick={handleAddToGoals}
                  disabled={addingToGoals}
                >
                  {addingToGoals ? 'Saving...' : `+ Track this goal in my dashboard`}
                </button>
              ) : (
                <div className={styles.addedSuccess}>
                  Goal saved to your dashboard — <button onClick={() => onTabChange('goals')}>view goals</button>
                </div>
              )}

              <button className={styles.shareToggleBtn} onClick={() => setShowShare(s => !s)}>
                {showShare ? 'Hide share options' : 'Share this result'}
              </button>
              {showShare && shareUrl && (
                <ShareCard
                  url={shareUrl}
                  twitterText={`I'm saving for ${selected.label} — on track to reach my goal ${result.projectedDate ? `by ${result.projectedDate}` : 'soon'}! Clarity:`}
                  whatsappText={`Check out my ${selected.label} savings goal timeline:`}
                />
              )}

              <button className={styles.resetBtn} onClick={reset}>Calculate another goal</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
