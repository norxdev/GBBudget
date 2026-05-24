import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentMonth, formatMonthLabel, getLastNMonths, formatMonthShort } from '../lib/months'
import { isPremium } from '../lib/plans'
import MonthSelector from '../components/MonthSelector'
import styles from './Reports.module.css'

function toCSV(rows) {
  return rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function Reports({ session, profile, showToast, onUpgrade }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const [entries, setEntries] = useState([])
  const [historyEntries, setHistoryEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState(null)
  const premium = isPremium(profile)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const last6 = getLastNMonths(6)
      const [{ data: monthData }, { data: histData }] = await Promise.all([
        supabase.from('budget_entries').select('*')
          .eq('user_id', session.user.id).eq('month', month).order('entry_type'),
        supabase.from('budget_entries').select('*')
          .eq('user_id', session.user.id).in('month', last6)
      ])
      setEntries(monthData || [])
      setHistoryEntries(histData || [])
      setLoading(false)
    }
    load()
  }, [session, month])

  const income = entries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0)
  const monthLabel = formatMonthLabel(month)
  const monthSlug = month.slice(0, 7)

  // --- CSV generators ---
  function getBudgetCSV() {
    const headers = ['Description', 'Category', 'Type', 'Frequency', 'Amount', '% of Income']
    const rows = entries.map(e => [
      e.description, e.category, e.entry_type, e.frequency,
      Number(e.amount).toFixed(2),
      income > 0 ? ((Number(e.amount) / income) * 100).toFixed(1) + '%' : 'N/A'
    ])
    return toCSV([headers, ...rows])
  }

  function getCategoryCSV() {
    const cats = {}
    entries.filter(e => e.entry_type === 'expense').forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + Number(e.amount)
    })
    const headers = ['Category', 'Total Spent', '% of Income', 'vs Budget Limit']
    const rows = Object.entries(cats).map(([cat, total]) => {
      const catEntries = entries.filter(e => e.category === cat)
      const limit = catEntries.find(e => e.budget_limit)?.budget_limit
      return [
        cat,
        '$' + total.toFixed(2),
        income > 0 ? ((total / income) * 100).toFixed(1) + '%' : 'N/A',
        limit ? (total > limit ? `Over by $${(total - limit).toFixed(2)}` : `Under by $${(limit - total).toFixed(2)}`) : 'No limit set'
      ]
    })
    return toCSV([headers, ...rows])
  }

  function getTrendCSV() {
    const last6 = getLastNMonths(6)
    const headers = ['Month', 'Income', 'Expenses', 'Savings', 'Savings Rate', 'Net']
    const rows = last6.map(m => {
      const mEntries = historyEntries.filter(e => e.month === m)
      const inc = mEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0)
      const exp = mEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
      const sav = mEntries.filter(e => e.entry_type === 'savings').reduce((s, e) => s + Number(e.amount), 0)
      return [
        formatMonthLabel(m),
        '$' + inc.toFixed(2),
        '$' + exp.toFixed(2),
        '$' + sav.toFixed(2),
        inc > 0 ? ((sav / inc) * 100).toFixed(1) + '%' : '0%',
        '$' + (inc - exp - sav).toFixed(2)
      ]
    })
    return toCSV([headers, ...rows])
  }

  function getAnnualCSV() {
    const headers = ['Metric', 'Value']
    const totalInc = historyEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0)
    const totalExp = historyEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
    const totalSav = historyEntries.filter(e => e.entry_type === 'savings').reduce((s, e) => s + Number(e.amount), 0)
    const rows = [
      ['Total Income (6 months)', '$' + totalInc.toFixed(2)],
      ['Total Expenses (6 months)', '$' + totalExp.toFixed(2)],
      ['Total Savings (6 months)', '$' + totalSav.toFixed(2)],
      ['Average Savings Rate', totalInc > 0 ? ((totalSav / totalInc) * 100).toFixed(1) + '%' : '0%'],
      ['Net Cash Flow', '$' + (totalInc - totalExp - totalSav).toFixed(2)],
    ]
    return toCSV([headers, ...rows])
  }

  // --- Report data for inline display ---
  function getBudgetData() {
    return entries.map(e => ({
      description: e.description,
      category: e.category,
      type: e.entry_type,
      frequency: e.frequency,
      amount: '$' + Number(e.amount).toLocaleString(),
      pct: income > 0 ? ((Number(e.amount) / income) * 100).toFixed(1) + '%' : '—',
      entryType: e.entry_type,
    }))
  }

  function getCategoryData() {
    const cats = {}
    entries.filter(e => e.entry_type === 'expense').forEach(e => {
      if (!cats[e.category]) cats[e.category] = { total: 0, limit: e.budget_limit || null }
      cats[e.category].total += Number(e.amount)
    })
    return Object.entries(cats).map(([cat, data]) => ({
      category: cat,
      total: '$' + data.total.toFixed(2),
      pct: income > 0 ? ((data.total / income) * 100).toFixed(1) + '%' : '—',
      limit: data.limit ? '$' + Number(data.limit).toFixed(2) : '—',
      status: data.limit
        ? data.total > data.limit ? 'over' : data.total >= data.limit * 0.8 ? 'near' : 'ok'
        : null
    }))
  }

  function getTrendData() {
    return getLastNMonths(6).map(m => {
      const mEntries = historyEntries.filter(e => e.month === m)
      const inc = mEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0)
      const exp = mEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
      const sav = mEntries.filter(e => e.entry_type === 'savings').reduce((s, e) => s + Number(e.amount), 0)
      return {
        month: formatMonthShort(m),
        income: '$' + inc.toLocaleString(),
        expenses: '$' + exp.toLocaleString(),
        savings: '$' + sav.toLocaleString(),
        rate: inc > 0 ? ((sav / inc) * 100).toFixed(1) + '%' : '0%',
        net: (inc - exp - sav >= 0 ? '+' : '') + '$' + (inc - exp - sav).toLocaleString(),
        netPositive: inc - exp - sav >= 0,
      }
    })
  }

  function getAnnualData() {
    const totalInc = historyEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0)
    const totalExp = historyEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
    const totalSav = historyEntries.filter(e => e.entry_type === 'savings').reduce((s, e) => s + Number(e.amount), 0)
    const net = totalInc - totalExp - totalSav
    return [
      { label: 'Total Income', value: '$' + totalInc.toLocaleString(), color: 'var(--accent)' },
      { label: 'Total Expenses', value: '$' + totalExp.toLocaleString(), color: 'var(--red)' },
      { label: 'Total Savings', value: '$' + totalSav.toLocaleString(), color: 'var(--blue)' },
      { label: 'Avg Savings Rate', value: totalInc > 0 ? ((totalSav / totalInc) * 100).toFixed(1) + '%' : '0%', color: 'var(--accent)' },
      { label: 'Net Cash Flow', value: (net >= 0 ? '+' : '') + '$' + net.toLocaleString(), color: net >= 0 ? 'var(--accent)' : 'var(--red)' },
    ]
  }

  const REPORTS = [
    {
      id: 'budget',
      icon: '≋',
      title: 'Monthly Budget',
      desc: `Full income, expenses, and savings for ${monthLabel}`,
      free: true,
      csvFn: getBudgetCSV,
      csvFile: `clarity-budget-${monthSlug}.csv`,
    },
    {
      id: 'category',
      icon: '◈',
      title: 'Category Summary',
      desc: 'Spend per category with % of income and budget limit status',
      free: false,
      csvFn: getCategoryCSV,
      csvFile: `clarity-categories-${monthSlug}.csv`,
    },
    {
      id: 'trend',
      icon: '↗',
      title: '6-Month Trend',
      desc: 'Income, expenses, and savings changes over the last 6 months',
      free: false,
      csvFn: getTrendCSV,
      csvFile: `clarity-trends-${monthSlug}.csv`,
    },
    {
      id: 'annual',
      icon: '◉',
      title: '6-Month Summary',
      desc: 'High-level financial summary across the last 6 months',
      free: false,
      csvFn: getAnnualCSV,
      csvFile: `clarity-summary-${monthSlug}.csv`,
    },
  ]

  function handleCardClick(reportId) {
    setActiveReport(activeReport === reportId ? null : reportId)
  }

  function handleExport(report) {
    if (!report.free && !premium) {
      onUpgrade()
      return
    }
    downloadCSV(report.csvFn(), report.csvFile)
    showToast('CSV downloaded!')
  }

  if (loading) return <div className={styles.loading}>Loading reports...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Reports</h1>
          <p>Click any report to view it inline. Export to CSV anytime.</p>
        </div>
        <MonthSelector month={month} onChange={setMonth} profile={profile} onUpgrade={onUpgrade} />
      </div>

      <div className={styles.reportsList}>
        {REPORTS.map(report => {
          const isOpen = activeReport === report.id
          const locked = !report.free && !premium

          return (
            <div key={report.id} className={`${styles.reportItem} ${isOpen ? styles.reportOpen : ''} ${locked ? styles.reportLocked : ''}`}>

              {/* Card header — always visible */}
              <div className={styles.reportHeader} onClick={() => handleCardClick(report.id)}>
                <div className={styles.reportHeaderLeft}>
                  <div className={styles.reportIcon}>{report.icon}</div>
                  <div>
                    <div className={styles.reportTitle}>
                      {report.title}
                      {locked && <span className={styles.premiumTag}>Premium</span>}
                    </div>
                    <div className={styles.reportDesc}>{report.desc}</div>
                  </div>
                </div>
                <div className={styles.reportHeaderRight}>
                  <button
                    className={`${styles.exportBtn} ${locked ? styles.exportBtnLocked : ''}`}
                    onClick={e => { e.stopPropagation(); handleExport(report) }}
                  >
                    {locked ? '🔒 Export' : '↓ Export CSV'}
                  </button>
                  <div className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>›</div>
                </div>
              </div>

              {/* Accordion body — shows when open */}
              {isOpen && (
                <div className={styles.reportBody}>
                  {locked ? (
                    <div className={styles.lockedBody}>
                      <div className={styles.lockedIcon}>🔒</div>
                      <h3>Premium feature</h3>
                      <p>Upgrade to view and export this report.</p>
                      <button className={styles.upgradeBtn} onClick={onUpgrade}>Upgrade to Premium →</button>
                    </div>
                  ) : (
                    <>
                      {/* Monthly Budget */}
                      {report.id === 'budget' && (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr><th>Description</th><th>Category</th><th>Type</th><th>Frequency</th><th>Amount</th><th>% of Income</th></tr>
                            </thead>
                            <tbody>
                              {getBudgetData().length === 0
                                ? <tr><td colSpan={6} className={styles.emptyRow}>No data for this month</td></tr>
                                : getBudgetData().map((r, i) => (
                                  <tr key={i}>
                                    <td>{r.description}</td>
                                    <td><span className={`${styles.typePill} ${styles['type_' + r.entryType]}`}>{r.category}</span></td>
                                    <td style={{ textTransform: 'capitalize' }}>{r.type}</td>
                                    <td style={{ textTransform: 'capitalize' }}>{r.frequency}</td>
                                    <td><strong>{r.amount}</strong></td>
                                    <td>{r.pct}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Category Summary */}
                      {report.id === 'category' && (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr><th>Category</th><th>Total Spent</th><th>% of Income</th><th>Budget Limit</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                              {getCategoryData().length === 0
                                ? <tr><td colSpan={5} className={styles.emptyRow}>No expense data for this month</td></tr>
                                : getCategoryData().map((r, i) => (
                                  <tr key={i}>
                                    <td><strong>{r.category}</strong></td>
                                    <td>{r.total}</td>
                                    <td>{r.pct}</td>
                                    <td>{r.limit}</td>
                                    <td>
                                      {r.status && (
                                        <span className={r.status === 'over' ? styles.overBadge : r.status === 'near' ? styles.nearBadge : styles.okBadge}>
                                          {r.status === 'over' ? 'Over' : r.status === 'near' ? 'Near limit' : 'On track'}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* 6-Month Trend */}
                      {report.id === 'trend' && (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr><th>Month</th><th>Income</th><th>Expenses</th><th>Savings</th><th>Rate</th><th>Net</th></tr>
                            </thead>
                            <tbody>
                              {getTrendData().map((r, i) => (
                                <tr key={i}>
                                  <td><strong>{r.month}</strong></td>
                                  <td>{r.income}</td>
                                  <td>{r.expenses}</td>
                                  <td>{r.savings}</td>
                                  <td>{r.rate}</td>
                                  <td style={{ color: r.netPositive ? 'var(--accent)' : 'var(--red)', fontWeight: 600 }}>{r.net}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Annual Summary */}
                      {report.id === 'annual' && (
                        <div className={styles.summaryCards}>
                          {getAnnualData().map((item, i) => (
                            <div key={i} className={styles.summaryMetric}>
                              <div className={styles.summaryValue} style={{ color: item.color }}>{item.value}</div>
                              <div className={styles.summaryLabel}>{item.label}</div>
                              <div className={styles.summaryNote}>Last 6 months</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className={styles.reportFooter}>
                        <button className={styles.exportBtnFull} onClick={() => handleExport(report)}>
                          ↓ Export to CSV
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
