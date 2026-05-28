import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentMonth, formatMonthLabel, getLastNMonths, formatMonthShort } from '../lib/months'
import { getAllBudgetEntries } from '../lib/localStorage'
import MonthSelector from '../components/MonthSelector'
import DashboardCustomizer from '../components/DashboardCustomizer'
import { buildHealthShareUrl } from '../lib/share'
import ShareCard from '../components/ShareCard'
import { Doughnut, Bar } from 'react-chartjs-2'
import { mergePrefs, WIDGET_LABELS } from '../lib/dashboardPrefs'
import { isPremium } from '../lib/plans'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement
} from 'chart.js'
import styles from './Dashboard.module.css'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

function calcHealthScore({ income, needs, wants, savings }) {
  if (!income || income === 0) return { score: 0, grade: 'N/A', savingsRate: 0, needsRatio: 0, wantsRatio: 0 }
  const savingsRate = savings / income
  const needsRatio = needs / income
  const wantsRatio = wants / income
  const savingsScore = Math.min(savingsRate / 0.20, 1) * 100
  const needsScore = needsRatio <= 0.50 ? 100 : Math.max(0, 100 - (needsRatio - 0.50) * 400)
  const wantsScore = wantsRatio <= 0.30 ? 100 : Math.max(0, 100 - (wantsRatio - 0.30) * 400)
  const score = Math.round(savingsScore * 0.4 + needsScore * 0.35 + wantsScore * 0.25)
  let grade = 'F'
  if (score >= 90) grade = 'A'
  else if (score >= 80) grade = 'B+'
  else if (score >= 70) grade = 'B'
  else if (score >= 60) grade = 'C+'
  else if (score >= 50) grade = 'C'
  else if (score >= 40) grade = 'D'
  return { score, grade, savingsRate: Math.round(savingsRate * 100), needsRatio: Math.round(needsRatio * 100), wantsRatio: Math.round(wantsRatio * 100) }
}

const NEEDS_CATS = ['Housing', 'Food', 'Transport', 'Healthcare']
const WANTS_CATS = ['Entertainment', 'Subscriptions', 'Dining', 'Shopping', 'Other']
const CAT_COLORS = {
  Housing: '#2D6A4F', Food: '#D4A017', Transport: '#2471A3',
  Healthcare: '#27AE60', Entertainment: '#8E44AD',
  Subscriptions: '#E76F51', Dining: '#E67E22', Shopping: '#C0392B', Other: '#95A5A6'
}

export default function Dashboard({ session, isGuest, profile, onUpgrade, onTabChange, initialShareParams }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const [entries, setEntries] = useState([])
  const [goals, setGoals] = useState([])
  const [historyData, setHistoryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showHealthShare, setShowHealthShare] = useState(false)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [prefsSaving, setPrefsSaving] = useState(false) // fix #4 — was unused
  const [prefs, setPrefs] = useState(() => mergePrefs(profile?.dashboard_preferences))
  const premium = isPremium(profile)

  useEffect(() => {
    if (profile?.dashboard_preferences) {
      setPrefs(mergePrefs(profile.dashboard_preferences))
    }
  }, [profile])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const range = premium ? (prefs.chartRange || 6) : 6
      const lastN = getLastNMonths(range)

      if (isGuest) {
        const all = getAllBudgetEntries()
        setEntries(all.filter(e => e.month === month))
        setGoals([])
        const byMonth = {}
        lastN.forEach(m => { byMonth[m] = { income: 0, expenses: 0 } })
        all.forEach(e => {
          if (!byMonth[e.month]) return
          if (e.entry_type === 'income') byMonth[e.month].income += Number(e.amount)
          if (e.entry_type === 'expense') byMonth[e.month].expenses += Number(e.amount)
        })
        setHistoryData(lastN.map(m => ({ month: m, ...byMonth[m] })))
      } else {
        const [{ data: entriesData }, { data: goalsData }, { data: histData }] = await Promise.all([
          supabase.from('budget_entries').select('*').eq('user_id', session.user.id).eq('month', month),
          supabase.from('savings_goals').select('*').eq('user_id', session.user.id).limit(3),
          supabase.from('budget_entries').select('*').eq('user_id', session.user.id).in('month', lastN)
        ])
        setEntries(entriesData || [])
        setGoals(goalsData || [])
        const byMonth = {}
        lastN.forEach(m => { byMonth[m] = { income: 0, expenses: 0 } })
        ;(histData || []).forEach(e => {
          if (!byMonth[e.month]) return
          if (e.entry_type === 'income') byMonth[e.month].income += Number(e.amount)
          if (e.entry_type === 'expense') byMonth[e.month].expenses += Number(e.amount)
        })
        setHistoryData(lastN.map(m => ({ month: m, ...byMonth[m] })))
      }
      setLoading(false)
    }
    load()
  }, [session, month, isGuest, prefs.chartRange])

  async function handlePrefsUpdate(newPrefs) {
    setPrefs(newPrefs)
    if (session && !isGuest) {
      setPrefsSaving(true)
      await supabase.from('profiles')
        .update({ dashboard_preferences: newPrefs })
        .eq('id', session.user.id)
      setPrefsSaving(false)
    }
  }

  const income = entries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0)
  const expenses = entries.filter(e => e.entry_type === 'expense')
  const savings = entries.filter(e => e.entry_type === 'savings').reduce((s, e) => s + Number(e.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const needs = expenses.filter(e => NEEDS_CATS.includes(e.category)).reduce((s, e) => s + Number(e.amount), 0)
  const wants = expenses.filter(e => WANTS_CATS.includes(e.category)).reduce((s, e) => s + Number(e.amount), 0)
  const { score, grade, savingsRate, needsRatio, wantsRatio } = calcHealthScore({ income, needs, wants, savings })
  const remaining = income - totalExpenses - savings

  const catTotals = {}
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount) })
  const largestCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()

  const KPI_DATA = {
    income:      { icon: '↑', label: 'Monthly Income',    value: '$' + income.toLocaleString(),                                  color: '#D8EDE4' },
    expenses:    { icon: '↓', label: 'Total Expenses',    value: '$' + totalExpenses.toLocaleString(),                            color: '#FDEEE9' },
    savings:     { icon: 'S', label: 'Monthly Savings',   value: '$' + savings.toLocaleString(),                                  color: '#D8EDE4' },
    savingsRate: { icon: '%', label: 'Savings Rate',      value: income > 0 ? Math.round(savings / income * 100) + '%' : '0%',   color: '#FBF3DC' },
    remaining:   { icon: '=', label: 'Remaining',         value: '$' + remaining.toLocaleString(),                                color: remaining >= 0 ? '#D8EDE4' : '#FDECEA' },
    goals:       { icon: 'G', label: 'Active Goals',      value: goals.length + ' goals',                                        color: '#D6EAF8' },
    largestExp:  { icon: '!', label: 'Largest Expense',   value: largestCat ? largestCat[0] : '—',                               color: '#FDEEE9' },
    avgDaily:    { icon: '~', label: 'Avg Daily Spend',   value: '$' + Math.round(totalExpenses / daysInMonth).toLocaleString(), color: '#FBF3DC' },
    needsRatio:  { icon: 'N', label: 'Needs Ratio',       value: needsRatio + '%',                                                color: '#D8EDE4' },
    wantsRatio:  { icon: 'W', label: 'Wants Ratio',       value: wantsRatio + '%',                                               color: '#D6EAF8' },
  }

  const selectedKPIIds = prefs.selectedKPIs || ['income','expenses','savings','savingsRate','remaining','goals']
  const catLabels = Object.keys(catTotals)

  const donutData = {
    labels: catLabels,
    datasets: [{ data: catLabels.map(c => catTotals[c]), backgroundColor: catLabels.map(c => CAT_COLORS[c] || '#95A5A6'), borderWidth: 0, hoverOffset: 4 }]
  }
  const barData = {
    labels: historyData.map(d => formatMonthShort(d.month)),
    datasets: [
      { label: 'Income',   data: historyData.map(d => d.income),   backgroundColor: '#2D6A4F', borderRadius: 6, borderSkipped: false },
      { label: 'Expenses', data: historyData.map(d => d.expenses), backgroundColor: '#E5E3DC', borderRadius: 6, borderSkipped: false }
    ]
  }
  const chartOptions = { responsive: true, plugins: { legend: { labels: { font: { family: 'DM Sans', size: 11 }, usePointStyle: true, pointStyleWidth: 8, padding: 12 } } } }
  const barOptions = { ...chartOptions, scales: { x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } }, y: { grid: { color: '#F0EFE9' }, ticks: { font: { family: 'DM Sans', size: 11 }, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } } } }

  const hasData = entries.length > 0
  const diningEntry = expenses.find(e => e.category === 'Dining')
  const subTotal = expenses.filter(e => e.category === 'Subscriptions').reduce((s, e) => s + Number(e.amount), 0)

  // Fix #7 — each widget is now truly independent, health and kpis can be reordered separately
  const widgetOrder = premium
    ? (prefs.widgetOrder || ['health','kpis','framework','charts','insights','goals'])
    : ['health','kpis','framework','charts','insights','goals']

  // Fix #11 — greeting toggle now actually changes the heading
  const greetingText = prefs.showGreeting !== false
    ? `Good morning, ${profile?.full_name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'there'}`
    : 'Dashboard'

  function renderWidget(id) {
    switch(id) {
      case 'health':
        return prefs.showHealthScore === false ? null : (
          <div key="health" className={styles.healthCard}>
            <div className={styles.healthLabel}>Budget Health Score</div>
            <div className={styles.healthScore}>{score}</div>
            <div className={styles.healthGrade}>
              <span className={styles.gradeBadge}>{grade}</span>
              <span className={styles.gradeDesc}>{score >= 80 ? 'Great shape!' : score >= 60 ? 'Good — room to grow' : 'Needs attention'}</span>
            </div>
            <div className={styles.healthDesc}>
              {score >= 80 ? "You're managing your budget excellently." : score >= 60 ? "Focus on savings and discretionary spend to improve." : "Let's work on getting your budget balanced."}
            </div>
            <div className={styles.subScores}>
              {[
                { label: 'Savings rate', val: Math.min(savingsRate * 5, 100) },
                { label: 'Needs ratio',  val: needsRatio <= 50 ? 100 : Math.max(0, 100 - (needsRatio - 50) * 4) },
                { label: 'Wants ratio',  val: wantsRatio <= 30 ? 100 : Math.max(0, 100 - (wantsRatio - 30) * 4) },
                { label: 'Goal progress',val: goals.length > 0 ? Math.round(goals.reduce((s, g) => s + (g.current_amount / g.target_amount) * 100, 0) / goals.length) : 0 },
              ].map(({ label, val }) => (
                <div key={label} className={styles.subScoreRow}>
                  <span className={styles.subLabel}>{label}</span>
                  <div className={styles.subBar}><div className={styles.subFill} style={{ width: Math.min(val, 100) + '%' }} /></div>
                  <span className={styles.subVal}>{Math.round(val)}</span>
                </div>
              ))}
            </div>
            <button className={styles.shareHealthBtn} onClick={() => setShowHealthShare(s => !s)}>
              {showHealthShare ? 'Hide share' : 'Share your score'}
            </button>
            {showHealthShare && (
              <div style={{ marginTop: '12px' }}>
                <ShareCard
                  url={buildHealthShareUrl(score, grade, savingsRate)}
                  twitterText={`My financial health score is ${score}/100 (${grade}) on Clarity. Check yours:`}
                  whatsappText={`My Clarity financial health score: ${score}/100 — ${grade}. See yours:`}
                />
              </div>
            )}
          </div>
        )

      case 'kpis':
        return prefs.showKPIs === false ? null : (
          <div key="kpis" className={styles.kpiGrid}>
            {selectedKPIIds.map(id => {
              const kpi = KPI_DATA[id]
              if (!kpi) return null
              return (
                <div key={id} className={styles.kpiCard}>
                  <div className={styles.kpiTop}><div className={styles.kpiIcon} style={{ background: kpi.color }}>{kpi.icon}</div></div>
                  <div className={styles.kpiValue}>{kpi.value}</div>
                  <div className={styles.kpiLabel}>{kpi.label}</div>
                </div>
              )
            })}
          </div>
        )

      case 'framework':
        return prefs.showFramework === false ? null : (
          <div key="framework" className={styles.frameworkCard}>
            <div className={styles.chartHeader}>
              <div><div className={styles.chartTitle}>50/30/20 Rule</div><div className={styles.chartSubtitle}>How your spending aligns with the recommended framework</div></div>
              <div className={styles.chartTag}>Best Practice</div>
            </div>
            <div className={styles.frameworkBars}>
              {[
                { name: 'Needs',   actual: needsRatio, target: 50, color: 'var(--accent)', desc: 'Housing, food, transport, healthcare' },
                { name: 'Wants',   actual: wantsRatio, target: 30, color: 'var(--blue)',   desc: 'Entertainment, dining, subscriptions' },
                { name: 'Savings', actual: savingsRate, target: 20, color: 'var(--amber)', desc: 'All savings and goal contributions' },
              ].map(fb => (
                <div key={fb.name} className={styles.fbItem}>
                  <div className={styles.fbLabel}>
                    <span className={styles.fbName}>{fb.name}</span>
                    <span className={styles.fbVals}>{fb.actual}% <span>/ {fb.target}% target</span></span>
                  </div>
                  <div className={styles.fbTrack}><div className={styles.fbFill} style={{ width: Math.min(fb.actual, 100) + '%', background: fb.color }} /></div>
                  <div className={styles.fbDesc}>{fb.actual <= fb.target ? 'Within target' : `${fb.actual - fb.target}% over target`} · {fb.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'charts':
        return prefs.showCharts === false ? null : (
          <div key="charts" className={styles.chartsRow}>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div><div className={styles.chartTitle}>Spending by Category</div><div className={styles.chartSubtitle}>{formatMonthLabel(month)}</div></div>
              </div>
              {catLabels.length > 0
                ? (prefs.categoryChartType === 'bar'
                    ? <Bar data={donutData} options={chartOptions} />
                    : <Doughnut data={donutData} options={{ ...chartOptions, cutout: '68%' }} />)
                : <div className={styles.noChart}>Add expenses to see breakdown</div>}
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div><div className={styles.chartTitle}>Income vs Expenses</div><div className={styles.chartSubtitle}>Last {prefs.chartRange || 6} months</div></div>
              </div>
              <Bar data={barData} options={barOptions} />
            </div>
          </div>
        )

      case 'insights':
        return prefs.showInsights === false ? null : (
          <div key="insights">
            <div className={styles.sectionHeader}><div className={styles.sectionTitle}>Insights & Recommendations</div></div>
            <div className={styles.insightsRow}>
              {diningEntry && Number(diningEntry.amount) > 400 ? (
                <div className={styles.insightCard}>
                  <div className={styles.insightType} style={{ color: 'var(--red)' }}><div className={styles.insightDot} style={{ background: 'var(--red)' }} />Needs Attention</div>
                  <h4>Dining spend is high</h4>
                  <p>You've spent ${Number(diningEntry.amount).toLocaleString()} on dining this month. Consider setting a monthly limit.</p>
                </div>
              ) : (
                <div className={styles.insightCard}>
                  <div className={styles.insightType} style={{ color: 'var(--accent)' }}><div className={styles.insightDot} style={{ background: 'var(--accent)' }} />Doing Well</div>
                  <h4>Dining spend is in check</h4>
                  <p>Your dining expenses look reasonable this month. Keep it up!</p>
                </div>
              )}
              {subTotal > 100 ? (
                <div className={styles.insightCard}>
                  <div className={styles.insightType} style={{ color: 'var(--amber)' }}><div className={styles.insightDot} style={{ background: 'var(--amber)' }} />Opportunity</div>
                  <h4>Review your subscriptions</h4>
                  <p>You're spending ${subTotal}/mo on subscriptions. Auditing these could free up cash for savings goals.</p>
                </div>
              ) : (
                <div className={styles.insightCard}>
                  <div className={styles.insightType} style={{ color: 'var(--accent)' }}><div className={styles.insightDot} style={{ background: 'var(--accent)' }} />Doing Well</div>
                  <h4>Subscriptions are lean</h4>
                  <p>Your subscription spend is well managed.</p>
                </div>
              )}
              <div className={styles.insightCard}>
                <div className={styles.insightType} style={{ color: savingsRate >= 20 ? 'var(--accent)' : 'var(--amber)' }}>
                  <div className={styles.insightDot} style={{ background: savingsRate >= 20 ? 'var(--accent)' : 'var(--amber)' }} />
                  {savingsRate >= 20 ? 'Doing Well' : 'Opportunity'}
                </div>
                <h4>{savingsRate >= 20 ? 'Savings rate above target' : 'Boost your savings rate'}</h4>
                <p>{savingsRate >= 20 ? `At ${savingsRate}%, you're above the recommended 20%.` : `You're saving ${savingsRate}% of income. The goal is 20%.`}</p>
              </div>
            </div>
          </div>
        )

      case 'goals':
        return prefs.showGoals === false ? null : (
          <div key="goals">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Savings Goals</div>
              <div className={styles.sectionAction} onClick={() => onTabChange('goals')}>View all</div>
            </div>
            {goals.length === 0 ? (
              <div className={styles.emptyGoals} onClick={() => onTabChange('goals')}>Add your first savings goal</div>
            ) : (
              <div className={styles.goalsGrid}>
                {goals.map(g => {
                  const pct = Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100)
                  const rem = g.target_amount - g.current_amount
                  const months = g.monthly_contribution > 0 ? Math.ceil(rem / g.monthly_contribution) : null
                  return (
                    <div key={g.id} className={styles.goalCard}>
                      <div className={styles.goalTop}>
                        <div className={styles.goalIcon}>{g.emoji || '◎'}</div>
                        <div className={styles.goalPct}>{pct}%</div>
                      </div>
                      <div className={styles.goalName}>{g.name}</div>
                      <div className={styles.goalAmounts}>${Number(g.current_amount).toLocaleString()} of ${Number(g.target_amount).toLocaleString()}</div>
                      <div className={styles.goalBar}><div className={styles.goalFill} style={{ width: pct + '%' }} /></div>
                      {months && <div className={styles.goalEta}>~{months} months to completion</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (loading) return <div className={styles.loading}>Loading dashboard...</div>

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1>{greetingText}</h1>
          <p>
            Your financial snapshot for {formatMonthLabel(month)}
            {prefsSaving && <span className={styles.savingPrefs}> · Saving...</span>}
          </p>
        </div>
        <div className={styles.headerRight}>
          <MonthSelector month={month} onChange={setMonth} profile={profile} onUpgrade={onUpgrade} />
          <button className={styles.customizeBtn} onClick={() => setShowCustomizer(true)}>
            Customize
          </button>
        </div>
      </div>

      {!hasData && (
        <div className={styles.emptyBanner}>
          <span>No budget data for {formatMonthLabel(month)}.</span>
          <button onClick={() => onTabChange('budget')}>Add budget data</button>
        </div>
      )}

      {/* Render widgets in user-defined order — each is now truly independent (#7) */}
      {widgetOrder.map(id => renderWidget(id))}

      {showCustomizer && (
        <DashboardCustomizer
          prefs={prefs}
          profile={profile}
          onUpdate={handlePrefsUpdate}
          onClose={() => setShowCustomizer(false)}
          onUpgrade={() => { setShowCustomizer(false); onUpgrade() }}
        />
      )}
    </div>
  )
}
