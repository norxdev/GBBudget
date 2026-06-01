import { useState } from 'react'
import ShareCard from '../../components/ShareCard'
import styles from './Tool.module.css'

function calcDebtPayoff({ balance, rate, payment, extra = 0 }) {
  if (!balance || !rate || !payment) return null
  const b = Number(balance)
  const r = Number(rate) / 100 / 12
  const p = Number(payment) + Number(extra || 0)
  if (p <= b * r) return { impossible: true }
  let remaining = b, months = 0, totalInterest = 0
  while (remaining > 0 && months < 1200) {
    const interest = remaining * r
    totalInterest += interest
    remaining = remaining + interest - p
    if (remaining < 0) remaining = 0
    months++
  }
  const payoffDate = new Date()
  payoffDate.setMonth(payoffDate.getMonth() + months)
  return {
    months,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(b + totalInterest),
    payoffDate: payoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    impossible: false,
  }
}

const DEBT_TYPES = [
  { id: 'mortgage', label: 'Mortgage',      defaultRate: 6.5,  defaultPayment: 1500 },
  { id: 'car',      label: 'Car Loan',      defaultRate: 7.0,  defaultPayment: 400  },
  { id: 'student',  label: 'Student Loan',  defaultRate: 5.5,  defaultPayment: 300  },
  { id: 'credit',   label: 'Credit Card',   defaultRate: 22.0, defaultPayment: 100  },
  { id: 'personal', label: 'Personal Loan', defaultRate: 10.0, defaultPayment: 200  },
  { id: 'other',    label: 'Other',         defaultRate: 8.0,  defaultPayment: 200  },
]

export default function DebtPayoff({ isGuest, onTabChange }) {
  const [debtType, setDebtType] = useState('mortgage')
  const [form, setForm] = useState({ balance: '', rate: '', payment: '', extra: '' })
  const [result, setResult] = useState(null)
  const [baseResult, setBaseResult] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const selected = DEBT_TYPES.find(d => d.id === debtType)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); setResult(null) }

  function useDefaults() {
    setForm(f => ({ ...f, rate: String(selected.defaultRate), payment: String(selected.defaultPayment) }))
  }

  function analyze() {
    const r = calcDebtPayoff(form)
    setResult(r)
    if (form.extra && Number(form.extra) > 0) {
      setBaseResult(calcDebtPayoff({ ...form, extra: 0 }))
    } else {
      setBaseResult(null)
    }
    setShowShare(false)
    setTimeout(() => document.getElementById('tool-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  function reset() { setForm({ balance: '', rate: '', payment: '', extra: '' }); setResult(null); setBaseResult(null); setShowShare(false) }

  const canAnalyze = form.balance && form.rate && form.payment

  const extraSavings = result && baseResult && !result.impossible && !baseResult.impossible
    ? { monthsSaved: baseResult.months - result.months, interestSaved: baseResult.totalInterest - result.totalInterest }
    : null

  function formatMonths(m) {
    if (m >= 12) return `${Math.floor(m / 12)}yr ${m % 12}mo`
    return `${m} months`
  }

  const shareUrl = result && !result.impossible
    ? `https://norxdev.github.io/GBBudget/?tool=debt&label=${encodeURIComponent(selected.label)}&payoff=${encodeURIComponent(result.payoffDate)}&months=${result.months}&interest=${result.totalInterest}`
    : ''

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Debt Payoff Calculator</h1>
          <p>See exactly when you'll be debt free and how much interest you'll pay</p>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.inputPanel}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Type of debt</div>
            <div className={styles.typeGrid}>
              {DEBT_TYPES.map(t => (
                <button key={t.id} className={`${styles.typeBtn} ${debtType === t.id ? styles.typeActive : ''}`}
                  onClick={() => { setDebtType(t.id); setResult(null) }}>
                  <span className={styles.typeLabel}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardTitle}>Debt Details</div>
              <button className={styles.defaultsBtn} onClick={useDefaults}>Use typical rates</button>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Current balance *</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="250000" value={form.balance} onChange={e => setField('balance', e.target.value)} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Annual interest rate *</label>
                <div className={styles.inputWrap}>
                  <input type="number" placeholder="6.5" step="0.1" value={form.rate} onChange={e => setField('rate', e.target.value)} />
                  <span className={styles.inputSuffix}>%</span>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Monthly payment *</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="1500" value={form.payment} onChange={e => setField('payment', e.target.value)} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Extra monthly payment <span className={styles.optional}>(optional)</span></label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>$</span>
                  <input type="number" placeholder="0" value={form.extra} onChange={e => setField('extra', e.target.value)} />
                </div>
                <div className={styles.fieldHint}>See how extra payments save you</div>
              </div>
            </div>
            <button className={styles.analyzeBtn} onClick={analyze} disabled={!canAnalyze}>
              Calculate payoff
            </button>
          </div>
        </div>

        <div className={styles.resultPanel} id="tool-result">
          {!result ? (
            <div className={styles.emptyResult}>
              <div className={styles.emptyIcon}>📅</div>
              <h3>Ready to calculate</h3>
              <p>Enter your debt details to see your payoff date and total interest cost.</p>
            </div>
          ) : result.impossible ? (
            <div className={styles.warningCard}>
              <h3>Payment too low</h3>
              <p>Your payment doesn't cover the monthly interest. You need at least <strong>${Math.ceil(Number(form.balance) * Number(form.rate) / 100 / 12).toLocaleString()}/mo</strong> to make progress.</p>
            </div>
          ) : (
            <>
              <div className={styles.resultCard}>
                <div className={styles.resultLabel}>Debt free by</div>
                <div className={styles.resultBig}>{result.payoffDate}</div>
                <div className={styles.resultSub}>{formatMonths(result.months)} from now</div>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <div className={styles.metricValue} style={{ color: 'var(--red)' }}>${result.totalInterest.toLocaleString()}</div>
                  <div className={styles.metricLabel}>Total interest paid</div>
                  <div className={styles.metricSub}>Cost of borrowing</div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricValue}>${result.totalPaid.toLocaleString()}</div>
                  <div className={styles.metricLabel}>Total amount paid</div>
                  <div className={styles.metricSub}>Principal + interest</div>
                </div>
              </div>

              <div className={styles.insightCard}>
                <div className={styles.insightTitle}>Where your money goes</div>
                <div className={styles.stackBar}>
                  <div className={styles.stackPrincipal} style={{ width: Math.round((Number(form.balance) / result.totalPaid) * 100) + '%' }} />
                  <div className={styles.stackInterest} style={{ width: Math.round((result.totalInterest / result.totalPaid) * 100) + '%' }} />
                </div>
                <div className={styles.stackLabels}>
                  <span><span className={styles.dot} style={{ background: 'var(--accent)' }} />Principal {Math.round((Number(form.balance) / result.totalPaid) * 100)}%</span>
                  <span><span className={styles.dot} style={{ background: 'var(--red)' }} />Interest {Math.round((result.totalInterest / result.totalPaid) * 100)}%</span>
                </div>
              </div>

              {extraSavings && extraSavings.monthsSaved > 0 && (
                <div className={styles.savingsCard}>
                  <div className={styles.savingsTitle}>Paying ${Number(form.extra).toLocaleString()} extra/mo saves you</div>
                  <div className={styles.savingsRow}>
                    <div className={styles.savingsStat}>
                      <div className={styles.savingsValue}>${extraSavings.interestSaved.toLocaleString()}</div>
                      <div className={styles.savingsLabel}>in interest</div>
                    </div>
                    <div className={styles.savingsDivider} />
                    <div className={styles.savingsStat}>
                      <div className={styles.savingsValue}>{formatMonths(extraSavings.monthsSaved)}</div>
                      <div className={styles.savingsLabel}>sooner</div>
                    </div>
                  </div>
                </div>
              )}

              <button className={styles.shareToggleBtn} onClick={() => setShowShare(s => !s)}>
                {showShare ? 'Hide share options' : 'Share this result'}
              </button>
              {showShare && (
                <ShareCard
                  url={shareUrl}
                  twitterText={`I'll be ${selected.label.toLowerCase()} free by ${result.payoffDate}! Calculated with Clarity:`}
                  whatsappText={`My ${selected.label} payoff date is ${result.payoffDate}. Check yours:`}
                />
              )}

              <button className={styles.resetBtn} onClick={reset}>Calculate another debt</button>

              {!isGuest && (
                <div className={styles.ctaBanner}>
                  <span>Track this alongside your full budget</span>
                  <button onClick={() => onTabChange('budget')}>Open Budget</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
