import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Reports.module.css'

const CURRENT_MONTH = new Date().toISOString().slice(0, 7) + '-01'
const MONTH_LABEL = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

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

export default function Reports({ session, showToast, onUpgrade }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('budget_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('month', CURRENT_MONTH)
        .order('entry_type')
      setEntries(data || [])
      setLoading(false)
    }
    load()
  }, [session])

  const income = entries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0)

  function handleBudgetExport() {
    const headers = ['Description', 'Category', 'Type', 'Frequency', 'Amount', '% of Income']
    const rows = entries.map(e => [
      e.description,
      e.category,
      e.entry_type,
      e.frequency,
      Number(e.amount).toFixed(2),
      income > 0 ? ((Number(e.amount) / income) * 100).toFixed(1) + '%' : 'N/A'
    ])
    downloadCSV(toCSV([headers, ...rows]), `clarity-budget-${CURRENT_MONTH.slice(0, 7)}.csv`)
    showToast('CSV downloaded!')
  }

  function handleCategoryExport() {
    const cats = {}
    entries.filter(e => e.entry_type === 'expense').forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + Number(e.amount)
    })
    const headers = ['Category', 'Total Spent', '% of Income']
    const rows = Object.entries(cats).map(([cat, total]) => [
      cat,
      '$' + total.toFixed(2),
      income > 0 ? ((total / income) * 100).toFixed(1) + '%' : 'N/A'
    ])
    downloadCSV(toCSV([headers, ...rows]), `clarity-categories-${CURRENT_MONTH.slice(0, 7)}.csv`)
    showToast('CSV downloaded!')
  }

  if (loading) return <div className={styles.loading}>Loading reports...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Reports & Exports</h1>
          <p>Download your financial data in useful formats</p>
        </div>
      </div>

      <div className={styles.reportsGrid}>
        {/* Free */}
        <div className={styles.reportCard} onClick={handleBudgetExport}>
          <div className={styles.reportIcon}>📋</div>
          <h4>Monthly Budget Export</h4>
          <p>Your full income, expenses, and savings for {MONTH_LABEL} as a CSV.</p>
          <div className={styles.downloadLink}>⬇ Download CSV</div>
        </div>

        <div className={styles.reportCard} onClick={handleCategoryExport}>
          <div className={styles.reportIcon}>📊</div>
          <h4>Category Summary</h4>
          <p>Total spend per category with % of income for {MONTH_LABEL}.</p>
          <div className={styles.downloadLink}>⬇ Download CSV</div>
        </div>

        {/* Premium */}
        {[
          { icon: '📈', title: '6-Month Trend Report', desc: 'Income, spending, and savings changes over 6 months.' },
          { icon: '🎯', title: 'Goals Progress Report', desc: 'All savings goals with contributions and projected completion dates.' },
          { icon: '💡', title: 'Annual Financial Summary', desc: 'Year-at-a-glance with health score history and biggest wins.' },
          { icon: '🏦', title: 'Net Worth Tracker', desc: 'Assets vs. liabilities over time. Track your wealth-building journey.' },
        ].map(r => (
          <div key={r.title} className={styles.premiumWrap}>
            <div className={`${styles.reportCard} ${styles.reportCardLocked}`}>
              <div className={styles.reportIcon}>{r.icon}</div>
              <h4>{r.title}</h4>
              <p>{r.desc}</p>
              <div className={styles.downloadLink}>⬇ Download CSV</div>
            </div>
            <div className={styles.premiumOverlay} onClick={onUpgrade}>
              <div className={styles.lockIcon}>🔒</div>
              <p>Premium feature</p>
              <div className={styles.upgradePill}>Upgrade to unlock</div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview table */}
      <div className={styles.previewCard}>
        <div className={styles.previewHeader}>
          <div className={styles.previewTitle}>Preview — Monthly Budget Export ({MONTH_LABEL})</div>
          <button className={styles.downloadBtn} onClick={handleBudgetExport}>⬇ Download CSV</button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th>Frequency</th>
                <th>Amount</th>
                <th>% of Income</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyRow}>No data for this month yet. Add entries in the Budget tab.</td></tr>
              ) : (
                entries.map(e => (
                  <tr key={e.id}>
                    <td>{e.description}</td>
                    <td>
                      <span className={`${styles.catPill} ${styles['cat_' + e.entry_type]}`}>
                        {e.category}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{e.entry_type}</td>
                    <td style={{ textTransform: 'capitalize' }}>{e.frequency}</td>
                    <td>${Number(e.amount).toLocaleString()}</td>
                    <td>{income > 0 ? ((Number(e.amount) / income) * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
