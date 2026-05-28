import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getAllBudgetEntries } from '../lib/localStorage'
import { getCurrentMonth } from '../lib/months'
import { buildAffordabilityShareUrl } from '../lib/share'
import ShareCard from '../components/ShareCard'
import styles from './Affordability.module.css'

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

  let score = 100
  if (recurringVsIncome > 15) score -= Math.min(40, (recurringVsIncome - 15) * 4)
  if (newCashFlow < 0) score -= 30
  if (priceVsIncome > 3) score -= Math.min(20, (priceVsIncome - 3) * 5)
  const savingsRate = savings / income
  if (savingsRate < 0.10) score -= 10
  score = Math.max(0, Math.round(score))

  let verdict = '', verdictColor = ''
  if (score >= 75) { verdict = 'Looks affordable'; verdictColor = 'green' }
  else if (score >= 50) { verdict = 'Proceed with caution'; verdictColor = 'amber' }
  else { verdict = 'Financially risky right now'; verdictColor = 'red' }

  const warnings = [], positives = []
  if (newCashFlow < 0) warnings.push(`This would put you $${Math.abs(Math.round(newCashFlow)).toLocaleString()} in the red each month.`)
  if (recurringVsIncome > 20) warnings.push(`The recurring cost is ${Math.round(recurringVsIncome)}% of your income — above the recommended 15%.`)
  if (priceVsIncome > 6) warnings.push(`The price is ${Math.round(priceVsIncome)}x your monthly income — consider a less expensive option.`)
  if (savingsRate < 0.10) warnings.push(`Your current savings rate is low. Adding this purchase increases financial risk.`)
  if (monthsToSaveDown && monthsToSaveDown > 24) warnings.push(`It would take ~${monthsToSaveDown} months to save the down payment at your current rate.`)
  if (newCashFlow > 0) positives.push(`You'd still have $${Math.round(newCashFlow).toLocaleString()}/mo in cash flow after this purchase.`)
  if (recurringVsIncome <= 10) positives.push(`The recurring cost is only ${Math.round(recurringVsIncome)}% of income — well within healthy range.`)
  if (savingsRate >= 0.20) positives.push(`Your savings rate of ${Math.round(savingsRate * 100)}% gives you a solid financial cushion.`)
  if (monthsToSaveDown && monthsToSaveDown <= 6) positives.push(`You could save the down payment in just ${monthsToSaveDown} months.`)

  return {
    score, verdict, verdictColor, warnings, positives,
    recurringVsIncome: Math.round(recurringVsIncome),
    newCashFlow: Math.round(newCashFlow),
    monthsToSaveDown,
    currentCashFlow: Math.round(currentCashFlow),
    priceVsIncome: Math.round(priceVsIncome * 10) / 10,
  }
}

export default function Affordability({ session, isGuest, profile, showToast, initialShareParams }) {
  const [form, setForm] = useState({ purchasePrice: '', recurringCost: '', downPayment: '', monthlyIncome: '', monthlyExpenses: '', monthlySavings: '' })
  const [result, setResult] = useState(initialShareParams?.tool === 'afford' ? initialShareParams : null)
  const [loadedFromBudget, setLoadedFromBudget] = useState(false)
  const [loadingBudget, setLoadingBudget] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [purchaseLabel, setPurchaseLabel] = useState('')

  useEffect(() => {
    if (session || isGuest) loadBudgetData()
  }, [session, isGuest])

  // If arriving via share link, show result immediately
  useEffect(() => {
    if (initialShareParams?.tool === 'afford') {
      setResult(initialShareParams)
    }
  }, [initialShareParams])

  async function loadBudgetData() {
    setLoadingBudget(true)
    let data = []
    if (isGuest) {
      data = getAllBudgetEntries().filter(e => e.month === getCurrentMonth())
    } else if (session) {
      const res = await supabase.from('budget_entries').select('*')
        .eq('user_id', session.user.id).eq('month', getCurrentMonth())
      data = res.data || []
    }
    if (data.length > 0) {
      const income = data.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0)
      const expenses = data.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
      const savings = data.filter(e => e.entry_type === 'savings').reduce((s, e) => s + Number(e.amount), 0)
      setForm(f => ({ ...f, monthlyIncome: income || '', monthlyExpenses: expenses || '', monthlySavings: savings || '' }))
      setLoadedFromBudget(true)
    }
    setLoadingBudget(false)
  }

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); setResult(null) }

  function analyze() {
    const r = calcAffordability(form)
    setResult(r)
    setShowShare(false)
    setTimeout(() => { document.getElementById('afford-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 100)
  }

  function reset() {
    setForm({ purchasePrice: '', recurringCost: '', downPayment: '', monthlyIncome: '', monthlyExpenses: '', monthlySavings: '' })
    setResult(null); setLoadedFromBudget(false); setShowShare(false); setPurchaseLabel('')
  }

  const shareUrl = result ? buildAffordabilityShareUrl(result, purchaseLabel || 'a purchase') : ''
  const twitterText = result ? `I used Clarity to check if I can afford ${purchaseLabel || 'a purchase'}. Affordability score: ${result.score}/100 — ${result.verdict}.` : ''
  const whatsappText = result ? `Check out my affordability score on Clarity: ${result.score}/100 — ${result.verdict}. Try it yourself:` : ''

  const canAnalyze = form.purchasePrice && form.monthlyIncome

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Affordability Analyzer</h1>
          <p>See the real financial impact of any purchase before you commit</p>
        </div>
      </div>

      {loadedFromBudget && (
        <div className={styles.budgetBanner}>
          Budget data loaded automatically from this month.
          <button onClick={reset}>Reset</button>
        </div>
      )}

      <div className={styles.layout}>
        {/* Inputs */}
        <div className={styles.inputPanel}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Purchase Details</div>
            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label>What are you buying?</label>
                <input placeholder="e.g. Car, vacation, laptop..." value={purchaseLabel} onChange={e => setPurchaseLabel(e.target.value)} />
              </div>
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
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label>Monthly ongoing cost <span className={styles.labelHint}>(payments, insurance, maintenance, etc.)</span></label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="400" value={form.recurringCost} onChange={e => setField('recurringCost', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardTitle}>Your Financial Situation</div>
              {!loadedFromBudget && (
                <button className={styles.loadBtn} onClick={loadBudgetData} disabled={loadingBudget}>
                  {loadingBudget ? 'Loading...' : 'Load from Budget'}
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
            Analyze
          </button>
        </div>

        {/* Result */}
        <div className={styles.resultPanel} id="afford-result">
          {!result ? (
            <div className={styles.emptyResult}>
              <div className={styles.emptyIcon}>—</div>
              <h3>Ready to analyze</h3>
              <p>Fill in the purchase details and your financial situation, then click Analyze.</p>
              {!session && !isGuest && (
                <div className={styles.anonNote}>
                  Create a free account to auto-load your budget data into this tool.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className={`${styles.scoreCard} ${styles['score_' + result.verdictColor]}`}>
                <div className={styles.scoreLabel}>Affordability Score {purchaseLabel ? `— ${purchaseLabel}` : ''}</div>
                <div className={styles.scoreNum}>{result.score}</div>
                <div className={styles.scoreVerdict}>{result.verdict}</div>
                <div className={styles.scoreMeter}>
                  <div className={styles.scoreFill} style={{ width: result.score + '%' }} />
                </div>
              </div>

              <div className={styles.metricsGrid}>
                {[
                  { label: 'Monthly Cash Flow After', value: (result.newCashFlow >= 0 ? '+' : '') + '$' + result.newCashFlow.toLocaleString(), color: result.newCashFlow >= 0 ? 'var(--accent)' : 'var(--red)', sub: result.newCashFlow >= 0 ? 'You stay in the green' : 'Cash flow goes negative' },
                  { label: 'Recurring Cost vs Income', value: result.recurringVsIncome + '%', color: result.recurringVsIncome <= 15 ? 'var(--accent)' : result.recurringVsIncome <= 25 ? 'var(--amber)' : 'var(--red)', sub: 'Recommended: under 15%' },
                  { label: 'Price vs Monthly Income', value: result.priceVsIncome + 'x', color: result.priceVsIncome <= 3 ? 'var(--accent)' : result.priceVsIncome <= 6 ? 'var(--amber)' : 'var(--red)', sub: 'Healthy range: under 3–4x' },
                  ...(result.monthsToSaveDown ? [{ label: 'Months to Save Down Payment', value: result.monthsToSaveDown + ' mo', color: result.monthsToSaveDown <= 12 ? 'var(--accent)' : result.monthsToSaveDown <= 24 ? 'var(--amber)' : 'var(--red)', sub: result.monthsToSaveDown <= 12 ? 'Very achievable' : 'Long timeline' }] : []),
                ].map(m => (
                  <div key={m.label} className={styles.metricCard}>
                    <div className={styles.metricValue} style={{ color: m.color }}>{m.value}</div>
                    <div className={styles.metricLabel}>{m.label}</div>
                    <div className={styles.metricSub}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {result.warnings.length > 0 && (
                <div className={styles.insightSection}>
                  <div className={styles.insightHeader} style={{ color: 'var(--red)' }}>Things to consider</div>
                  {result.warnings.map((w, i) => <div key={i} className={styles.insightItem} style={{ borderLeftColor: 'var(--red)' }}>{w}</div>)}
                </div>
              )}

              {result.positives.length > 0 && (
                <div className={styles.insightSection}>
                  <div className={styles.insightHeader} style={{ color: 'var(--accent)' }}>Working in your favour</div>
                  {result.positives.map((p, i) => <div key={i} className={styles.insightItem} style={{ borderLeftColor: 'var(--accent)' }}>{p}</div>)}
                </div>
              )}

              {/* Share */}
              <button className={styles.shareToggleBtn} onClick={() => setShowShare(s => !s)}>
                {showShare ? 'Hide share options' : 'Share this result'}
              </button>
              {showShare && (
                <ShareCard
                  url={shareUrl}
                  twitterText={twitterText}
                  whatsappText={whatsappText}
                />
              )}

              <button className={styles.resetBtn} onClick={reset}>Analyze something else</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
