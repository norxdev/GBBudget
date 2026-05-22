import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentMonth } from '../lib/months'
import styles from './Affordability.module.css'

const PURCHASE_TYPES = [
  { id: 'car', label: 'Car', icon: '🚗', hasRecurring: true, recurringLabel: 'Monthly payment + insurance + gas' },
  { id: 'home', label: 'Home', icon: '🏠', hasRecurring: true, recurringLabel: 'Monthly mortgage + taxes + insurance' },
  { id: 'vacation', label: 'Vacation', icon: '✈️', hasRecurring: false, recurringLabel: '' },
  { id: 'electronics', label: 'Electronics', icon: '💻', hasRecurring: false, recurringLabel: '' },
  { id: 'membership', label: 'Membership', icon: '🎟️', hasRecurring: true, recurringLabel: 'Monthly membership cost' },
  { id: 'other', label: 'Other', icon: '📦', hasRecurring: true, recurringLabel: 'Ongoing monthly cost' },
]

function calcAffordability({ purchasePrice, recurringCost, monthlyIncome, monthlyExpenses, monthlySavings, downPayment }) {
  if (!monthlyIncome || monthlyIncome === 0) return null

  const price = Number(purchasePrice) || 0
  const recurring = Number(recurringCost) || 0
  const income = Number(monthlyIncome)
  const expenses = Number(monthlyExpenses) || 0
  const savings = Number(monthlySavings) || 0
  const down = Number(downPayment) || 0

  const currentCashFlow = income - expenses - savings
  const newCashFlow = currentCashFlow - recurring
  const priceVsIncome = price / income
  const recurringVsIncome = (recurring / income) * 100
  const monthsToSaveDown = down > 0 && currentCashFlow > 0 ? Math.ceil(down / currentCashFlow) : null
  const monthsToSaveFull = price > 0 && currentCashFlow > 0 ? Math.ceil(price / currentCashFlow) : null

  // Score 0-100
  let score = 100

  // Penalise if recurring cost > 15% of income
  if (recurringVsIncome > 15) score -= Math.min(40, (recurringVsIncome - 15) * 4)
  // Penalise if cash flow goes negative
  if (newCashFlow < 0) score -= 30
  // Penalise if purchase price > 3x monthly income
  if (priceVsIncome > 3) score -= Math.min(20, (priceVsIncome - 3) * 5)
  // Penalise if current savings rate already low
  const savingsRate = savings / income
  if (savingsRate < 0.10) score -= 10

  score = Math.max(0, Math.round(score))

  let verdict = ''
  let verdictColor = ''
  if (score >= 75) { verdict = 'Looks affordable'; verdictColor = 'green' }
  else if (score >= 50) { verdict = 'Proceed with caution'; verdictColor = 'amber' }
  else { verdict = 'Financially risky right now'; verdictColor = 'red' }

  const warnings = []
  const positives = []

  if (newCashFlow < 0) warnings.push(`This purchase would put you $${Math.abs(Math.round(newCashFlow)).toLocaleString()} in the red each month.`)
  if (recurringVsIncome > 20) warnings.push(`The recurring cost is ${Math.round(recurringVsIncome)}% of your income — above the recommended 15%.`)
  if (priceVsIncome > 6) warnings.push(`The purchase price is ${Math.round(priceVsIncome)}× your monthly income — consider a less expensive option.`)
  if (savingsRate < 0.10) warnings.push(`Your current savings rate is low. Adding this purchase increases financial risk.`)
  if (monthsToSaveDown && monthsToSaveDown > 24) warnings.push(`It would take ~${monthsToSaveDown} months to save the down payment at your current rate.`)

  if (newCashFlow > 0) positives.push(`You'd still have $${Math.round(newCashFlow).toLocaleString()}/mo in cash flow after this purchase.`)
  if (recurringVsIncome <= 10) positives.push(`The recurring cost is only ${Math.round(recurringVsIncome)}% of income — well within healthy range.`)
  if (savingsRate >= 0.20) positives.push(`Your strong savings rate (${Math.round(savingsRate * 100)}%) gives you a good financial cushion.`)
  if (monthsToSaveDown && monthsToSaveDown <= 6) positives.push(`You could save the down payment in just ${monthsToSaveDown} months!`)

  return {
    score, verdict, verdictColor,
    warnings, positives,
    recurringVsIncome: Math.round(recurringVsIncome),
    newCashFlow: Math.round(newCashFlow),
    monthsToSaveDown,
    monthsToSaveFull,
    currentCashFlow: Math.round(currentCashFlow),
    priceVsIncome: Math.round(priceVsIncome * 10) / 10,
  }
}

export default function Affordability({ session }) {
  const [purchaseType, setPurchaseType] = useState('car')
  const [form, setForm] = useState({
    purchasePrice: '',
    recurringCost: '',
    downPayment: '',
    monthlyIncome: '',
    monthlyExpenses: '',
    monthlySavings: '',
  })
  const [result, setResult] = useState(null)
  const [loadedFromBudget, setLoadedFromBudget] = useState(false)
  const [loadingBudget, setLoadingBudget] = useState(false)

  const selectedType = PURCHASE_TYPES.find(t => t.id === purchaseType)

  // Auto-load budget data if logged in
  useEffect(() => {
    if (session) {
      loadBudgetData()
    }
  }, [session])

  async function loadBudgetData() {
    setLoadingBudget(true)
    const { data } = await supabase
      .from('budget_entries').select('*')
      .eq('user_id', session.user.id)
      .eq('month', getCurrentMonth())

    if (data && data.length > 0) {
      const income = data.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0)
      const expenses = data.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
      const savings = data.filter(e => e.entry_type === 'savings').reduce((s, e) => s + Number(e.amount), 0)
      setForm(f => ({ ...f, monthlyIncome: income || '', monthlyExpenses: expenses || '', monthlySavings: savings || '' }))
      setLoadedFromBudget(true)
    }
    setLoadingBudget(false)
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setResult(null)
  }

  function analyze() {
    const r = calcAffordability(form)
    setResult(r)
    // Scroll to result on mobile
    setTimeout(() => {
      document.getElementById('affordability-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  function reset() {
    setForm({ purchasePrice: '', recurringCost: '', downPayment: '', monthlyIncome: '', monthlyExpenses: '', monthlySavings: '' })
    setResult(null)
    setLoadedFromBudget(false)
  }

  const canAnalyze = form.purchasePrice && form.monthlyIncome

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Can I Afford This? 🤔</h1>
          <p>Analyze any purchase and see the real impact on your finances</p>
        </div>
      </div>

      {session && loadedFromBudget && (
        <div className={styles.budgetBanner}>
          ✅ <strong>Budget data loaded automatically</strong> from your {new Date().toLocaleDateString('en-US', { month: 'long' })} budget. You can adjust below.
          <button onClick={reset}>Reset</button>
        </div>
      )}

      <div className={styles.layout}>
        {/* LEFT — Inputs */}
        <div className={styles.inputPanel}>

          {/* Purchase type */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>What are you buying?</div>
            <div className={styles.typeGrid}>
              {PURCHASE_TYPES.map(t => (
                <button
                  key={t.id}
                  className={`${styles.typeBtn} ${purchaseType === t.id ? styles.typeActive : ''}`}
                  onClick={() => { setPurchaseType(t.id); setResult(null) }}
                >
                  <span className={styles.typeIcon}>{t.icon}</span>
                  <span className={styles.typeLabel}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Purchase details */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>{selectedType.icon} {selectedType.label} Details</div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Purchase price *</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="25000" value={form.purchasePrice} onChange={e => setField('purchasePrice', e.target.value)} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Down payment</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="0" value={form.downPayment} onChange={e => setField('downPayment', e.target.value)} />
                </div>
              </div>
              {selectedType.hasRecurring && (
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Monthly ongoing cost <span className={styles.labelHint}>({selectedType.recurringLabel})</span></label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputPrefix}>$</span>
                    <input type="number" placeholder="400" value={form.recurringCost} onChange={e => setField('recurringCost', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Financial situation */}
          <div className={styles.card}>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardTitle}>Your Financial Situation</div>
              {session && !loadedFromBudget && (
                <button className={styles.loadBtn} onClick={loadBudgetData} disabled={loadingBudget}>
                  {loadingBudget ? 'Loading...' : '⚡ Load from Budget'}
                </button>
              )}
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Monthly income (after tax) *</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="5000" value={form.monthlyIncome} onChange={e => setField('monthlyIncome', e.target.value)} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Monthly expenses</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="3000" value={form.monthlyExpenses} onChange={e => setField('monthlyExpenses', e.target.value)} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Monthly savings</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="500" value={form.monthlySavings} onChange={e => setField('monthlySavings', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <button className={styles.analyzeBtn} onClick={analyze} disabled={!canAnalyze}>
            Analyze Affordability →
          </button>
        </div>

        {/* RIGHT — Result */}
        <div className={styles.resultPanel} id="affordability-result">
          {!result ? (
            <div className={styles.emptyResult}>
              <div className={styles.emptyIcon}>🧮</div>
              <h3>Ready to analyze</h3>
              <p>Fill in the purchase details and your financial situation, then click Analyze.</p>
              {!session && (
                <div className={styles.anonNote}>
                  💡 <strong>Tip:</strong> Create a free account to auto-load your budget data into this tool.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Score */}
              <div className={`${styles.scoreCard} ${styles['score_' + result.verdictColor]}`}>
                <div className={styles.scoreLabel}>Affordability Score</div>
                <div className={styles.scoreNum}>{result.score}</div>
                <div className={styles.scoreVerdict}>{result.verdict}</div>
                <div className={styles.scoreMeter}>
                  <div className={styles.scoreFill} style={{ width: result.score + '%' }} />
                </div>
              </div>

              {/* Key metrics */}
              <div className={styles.metricsGrid}>
                {[
                  {
                    label: 'Monthly Cash Flow After',
                    value: (result.newCashFlow >= 0 ? '+' : '') + '$' + result.newCashFlow.toLocaleString(),
                    color: result.newCashFlow >= 0 ? 'var(--accent)' : 'var(--red)',
                    sub: result.newCashFlow >= 0 ? 'You stay in the green' : 'You go cash flow negative'
                  },
                  {
                    label: 'Recurring Cost vs Income',
                    value: result.recurringVsIncome + '%',
                    color: result.recurringVsIncome <= 15 ? 'var(--accent)' : result.recurringVsIncome <= 25 ? 'var(--amber)' : 'var(--red)',
                    sub: 'Recommended: under 15%'
                  },
                  {
                    label: 'Price vs Monthly Income',
                    value: result.priceVsIncome + 'x',
                    color: result.priceVsIncome <= 3 ? 'var(--accent)' : result.priceVsIncome <= 6 ? 'var(--amber)' : 'var(--red)',
                    sub: 'Healthy range: under 3–4x'
                  },
                  ...(result.monthsToSaveDown ? [{
                    label: 'Months to Save Down Payment',
                    value: result.monthsToSaveDown + ' mo',
                    color: result.monthsToSaveDown <= 12 ? 'var(--accent)' : result.monthsToSaveDown <= 24 ? 'var(--amber)' : 'var(--red)',
                    sub: result.monthsToSaveDown <= 12 ? 'Very achievable' : result.monthsToSaveDown <= 24 ? 'Moderate timeline' : 'Long timeline'
                  }] : []),
                ].map(m => (
                  <div key={m.label} className={styles.metricCard}>
                    <div className={styles.metricValue} style={{ color: m.color }}>{m.value}</div>
                    <div className={styles.metricLabel}>{m.label}</div>
                    <div className={styles.metricSub}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className={styles.insightSection}>
                  <div className={styles.insightHeader} style={{ color: 'var(--red)' }}>⚠️ Things to consider</div>
                  {result.warnings.map((w, i) => (
                    <div key={i} className={styles.insightItem} style={{ borderLeftColor: 'var(--red)' }}>{w}</div>
                  ))}
                </div>
              )}

              {/* Positives */}
              {result.positives.length > 0 && (
                <div className={styles.insightSection}>
                  <div className={styles.insightHeader} style={{ color: 'var(--accent)' }}>✅ Working in your favour</div>
                  {result.positives.map((p, i) => (
                    <div key={i} className={styles.insightItem} style={{ borderLeftColor: 'var(--accent)' }}>{p}</div>
                  ))}
                </div>
              )}

              <button className={styles.resetBtn} onClick={reset}>← Analyze something else</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
