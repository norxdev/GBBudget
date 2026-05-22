import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentMonth, formatMonthLabel, getLastNMonths, formatMonthShort } from '../lib/months'
import MonthSelector from '../components/MonthSelector'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
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

export default function Dashboard({ session, onUpgrade, onTabChange }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const [entries, setEntries] = useState([])
  const [goals, setGoals] = useState([])
  const [historyData, setHistoryData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const last6 = getLastNMonths(6)

      const [{ data: entriesData }, { data: goalsData }, { data: histData }] = await Promise.all([
        supabase.from('budget_entries').select('*').eq('user_id', session.user.id).eq('month', month),
        supabase.from('savings_goals').select('*').eq('user_id', session.user.id).limit(3),
        supabase.from('budget_entries').select('*').eq('user_id', session.user.id).in('month', last6)
      ])

      setEntries(entriesData || [])
      setGoals(goalsData || [])

      // Build 6-month history for bar chart
      const byMonth = {}
      last6.forEach(m => { byMonth[m] = { income: 0, expenses: 0 } })
      ;(histData || []).forEach(e => {
        if (!byMonth[e.month]) return
        if (e.entry_type === 'income') byMonth[e.month].income += Number(e.amount)
        if (e.entry_type === 'expense') byMonth[e.month].expenses += Number(e.amount)
      })
      setHistoryData(last6.map(m => ({ month: m, ...byMonth[m] })))
      setLoading(false)
    }
    load()
  }, [session, month])

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
  const catLabels = Object.keys(catTotals)

  const donutData = {
    labels: catLabels,
    datasets: [{ data: catLabels.map(c => catTotals[c]), backgroundColor: catLabels.map(c => CAT_COLORS[c] || '#95A5A6'), borderWidth: 0, hoverOffset: 4 }]
  }

  const barData = {
    labels: historyData.map(d => formatMonthShort(d.month)),
    datasets: [
      { label: 'Income', data: historyData.map(d => d.income), backgroundColor: '#2D6A4F', borderRadius: 6, borderSkipped: false },
      { label: 'Expenses', data: historyData.map(d => d.expenses), backgroundColor: '#E5E3DC', borderRadius: 6, borderSkipped: false }
    ]
  }

  const chartOptions = { responsive: true, plugins: { legend: { labels: { font: { family: 'DM Sans', size: 11 }, usePointStyle: true, pointStyleWidth: 8, padding: 12 } } } }
  const barOptions = { ...chartOptions, scales: { x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } }, y: { grid: { color: '#F0EFE9' }, ticks: { font: { family: 'DM Sans', size: 11 }, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } } } }

  const hasData = entries.length > 0
  const diningEntry = expenses.find(e => e.category === 'Dining')
  const subTotal = expenses.filter(e => e.category === 'Subscriptions').reduce((s, e) => s + Number(e.amount), 0)

  if (loading) return <div className={styles.loading}>Loading dashboard...</div>

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1>Dashboard 👋</h1>
          <p>Your financial snapshot</p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {!hasData && (
        <div className={styles.emptyBanner}>
          <span>📊</span>
          <div>
            <strong>No budget data for {formatMonthLabel(month)}.</strong>
            <span> Head to the <button onClick={() => onTabChange('budget')}>Budget tab</button> to add your income and expenses.</span>
          </div>
        </div>
      )}

      {/* Health + KPIs */}
      <div className={styles.healthRow}>
        <div className={styles.healthCard}>
          <div className={styles.healthLabel}>Budget Health Score</div>
          <div className={styles.healthScore}>{score}</div>
          <div className={styles.healthGrade}>
            <span className={styles.gradeBadge}>{grade}</span>
            <span className={styles.gradeDesc}>{score >= 80 ? 'Great shape!' : score >= 60 ? 'Good — room to grow' : 'Needs attention'}</span>
          </div>
          <div className={styles.healthDesc}>
            {score >= 80 ? "You're managing your budget excellently. Keep it up!" : score >= 60 ? "You're managing well. Focus on savings and discretionary spend to improve." : "Let's work on getting your budget balanced. Start with tracking all expenses."}
          </div>
          <div className={styles.subScores}>
            {[
              { label: 'Savings rate', val: Math.min(savingsRate * 5, 100) },
              { label: 'Needs ratio', val: needsRatio <= 50 ? 100 : Math.max(0, 100 - (needsRatio - 50) * 4) },
              { label: 'Wants ratio', val: wantsRatio <= 30 ? 100 : Math.max(0, 100 - (wantsRatio - 30) * 4) },
              { label: 'Goal progress', val: goals.length > 0 ? Math.round(goals.reduce((s, g) => s + (g.current_amount / g.target_amount) * 100, 0) / goals.length) : 0 },
            ].map(({ label, val }) => (
              <div key={label} className={styles.subScoreRow}>
                <span className={styles.subLabel}>{label}</span>
                <div className={styles.subBar}><div className={styles.subFill} style={{ width: Math.min(val, 100) + '%' }} /></div>
                <span className={styles.subVal}>{Math.round(val)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.kpiGrid}>
          {[
            { icon: '💰', label: 'Monthly Income', value: '$' + income.toLocaleString(), color: '#D8EDE4' },
            { icon: '💸', label: 'Total Expenses', value: '$' + totalExpenses.toLocaleString(), color: '#FDEEE9' },
            { icon: '🏦', label: 'Monthly Savings', value: '$' + savings.toLocaleString(), color: '#D8EDE4' },
            { icon: '📊', label: 'Savings Rate', value: income > 0 ? Math.round(savings / income * 100) + '%' : '0%', color: '#FBF3DC' },
            { icon: '💵', label: 'Remaining', value: '$' + remaining.toLocaleString(), color: remaining >= 0 ? '#D8EDE4' : '#FDECEA' },
            { icon: '🎯', label: 'Active Goals', value: goals.length + ' goals', color: '#D6EAF8' },
          ].map(kpi => (
            <div key={kpi.label} className={styles.kpiCard}>
              <div className={styles.kpiTop}><div className={styles.kpiIcon} style={{ background: kpi.color }}>{kpi.icon}</div></div>
              <div className={styles.kpiValue}>{kpi.value}</div>
              <div className={styles.kpiLabel}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 50/30/20 */}
      <div className={styles.frameworkCard}>
        <div className={styles.chartHeader}>
          <div>
            <div className={styles.chartTitle}>50/30/20 Rule</div>
            <div className={styles.chartSubtitle}>How your spending aligns with the recommended framework</div>
          </div>
          <div className={styles.chartTag}>Best Practice Framework</div>
        </div>
        <div className={styles.frameworkBars}>
          {[
            { icon: '🏠', name: 'Needs', actual: needsRatio, target: 50, color: 'var(--accent)', desc: 'Housing, food, transport, healthcare' },
            { icon: '🎉', name: 'Wants', actual: wantsRatio, target: 30, color: 'var(--blue)', desc: 'Entertainment, dining, subscriptions' },
            { icon: '💰', name: 'Savings', actual: savingsRate, target: 20, color: 'var(--amber)', desc: 'All savings and goal contributions' },
          ].map(fb => (
            <div key={fb.name} className={styles.fbItem}>
              <div className={styles.fbLabel}>
                <span className={styles.fbName}>{fb.icon} {fb.name}</span>
                <span className={styles.fbVals}>{fb.actual}% <span>/ {fb.target}% target</span></span>
              </div>
              <div className={styles.fbTrack}><div className={styles.fbFill} style={{ width: Math.min(fb.actual, 100) + '%', background: fb.color }} /></div>
              <div className={styles.fbDesc}>{fb.actual <= fb.target ? '✅ Within target — great discipline!' : `⚠️ ${fb.actual - fb.target}% over target`} · {fb.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div><div className={styles.chartTitle}>Spending by Category</div><div className={styles.chartSubtitle}>{formatMonthLabel(month)}</div></div>
          </div>
          {catLabels.length > 0 ? <Doughnut data={donutData} options={{ ...chartOptions, cutout: '68%' }} /> : <div className={styles.noChart}>Add expenses to see breakdown</div>}
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div><div className={styles.chartTitle}>Income vs Expenses</div><div className={styles.chartSubtitle}>Last 6 months</div></div>
          </div>
          <Bar data={barData} options={barOptions} />
        </div>
      </div>

      {/* Insights */}
      <div className={styles.sectionHeader}><div className={styles.sectionTitle}>💡 Insights & Recommendations</div></div>
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
            <h4>Dining spend is in check 🎉</h4>
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
            <p>Your subscription spend is well managed. That's money that can go toward your goals.</p>
          </div>
        )}
        <div className={styles.insightCard}>
          <div className={styles.insightType} style={{ color: savingsRate >= 20 ? 'var(--accent)' : 'var(--amber)' }}><div className={styles.insightDot} style={{ background: savingsRate >= 20 ? 'var(--accent)' : 'var(--amber)' }} />{savingsRate >= 20 ? 'Doing Well' : 'Opportunity'}</div>
          <h4>{savingsRate >= 20 ? 'Savings rate above target 🎉' : 'Boost your savings rate'}</h4>
          <p>{savingsRate >= 20 ? `At ${savingsRate}%, you're saving above the recommended 20%. Excellent!` : `You're saving ${savingsRate}% of income. The goal is 20%. Try reducing one discretionary category.`}</p>
        </div>
      </div>

      {/* Goals preview */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>🎯 Savings Goals</div>
        <div className={styles.sectionAction} onClick={() => onTabChange('goals')}>View all →</div>
      </div>
      {goals.length === 0 ? (
        <div className={styles.emptyGoals} onClick={() => onTabChange('goals')}>+ Add your first savings goal →</div>
      ) : (
        <div className={styles.goalsGrid}>
          {goals.map(g => {
            const pct = Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100)
            const rem = g.target_amount - g.current_amount
            const months = g.monthly_contribution > 0 ? Math.ceil(rem / g.monthly_contribution) : null
            return (
              <div key={g.id} className={styles.goalCard}>
                <div className={styles.goalTop}><div className={styles.goalIcon}>{g.emoji || '🎯'}</div><div className={styles.goalPct}>{pct}%</div></div>
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
}
