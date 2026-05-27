import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getBudgetEntries, saveBudgetEntries, deleteBudgetEntry } from '../lib/localStorage'
import { getCurrentMonth, formatMonthLabel, isFutureMonth } from '../lib/months'
import { isPremium, canAddBudgetRow } from '../lib/plans'
import MonthSelector from '../components/MonthSelector'
import CSVImport from '../components/CSVImport'
import styles from './Budget.module.css'

const INCOME_CATS = ['Employment', 'Freelance', 'Investment', 'Rental', 'Other']
const EXPENSE_CATS = ['Housing', 'Food', 'Transport', 'Healthcare', 'Entertainment', 'Subscriptions', 'Dining', 'Shopping', 'Other']
const SAVINGS_CATS = ['Emergency', 'Investment', 'Travel', 'Major Purchase', 'Retirement', 'Other']
const FREE_ROW_LIMIT = 10

function emptyRow(type) {
  return {
    id: crypto.randomUUID(),
    description: '',
    category: type === 'income' ? 'Employment' : type === 'expense' ? 'Housing' : 'Emergency',
    entry_type: type,
    frequency: 'recurring',
    amount: '',
    budget_limit: '',
    isNew: true
  }
}

export default function Budget({ session, isGuest, profile, showToast, onUpgrade }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const readOnly = isFutureMonth(month)
  const premium = isPremium(profile)
  const totalRows = entries.length

  useEffect(() => {
    async function load() {
      setLoading(true)
      if (isGuest) {
        setEntries(getBudgetEntries(month))
      } else {
        const { data } = await supabase
          .from('budget_entries').select('*')
          .eq('user_id', session.user.id).eq('month', month).order('created_at')
        setEntries(data || [])
      }
      setLoading(false)
    }
    load()
  }, [session, month, isGuest])

  const income = entries.filter(e => e.entry_type === 'income')
  const expenses = entries.filter(e => e.entry_type === 'expense')
  const savings = entries.filter(e => e.entry_type === 'savings')
  const totalIncome = income.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const totalSavings = savings.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const remaining = totalIncome - totalExpenses - totalSavings
  const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0

  function addRow(type) {
    if (readOnly) return
    if (!canAddBudgetRow(profile, totalRows)) {
      onUpgrade()
      showToast(`Free plan is limited to ${FREE_ROW_LIMIT} rows — upgrade for unlimited`)
      return
    }
    setEntries(prev => [...prev, emptyRow(type)])
  }

  function updateRow(id, field, value) {
    if (readOnly) return
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value, dirty: true } : e))
  }

  async function deleteRow(entry) {
    if (readOnly) return
    if (!entry.isNew) {
      if (isGuest) deleteBudgetEntry(entry.id)
      else await supabase.from('budget_entries').delete().eq('id', entry.id)
    }
    setEntries(prev => prev.filter(e => e.id !== entry.id))
    showToast('Row removed')
  }

  async function saveAll() {
    if (readOnly) return
    setSaving(true)

    if (isGuest) {
      const toSave = entries.filter(e => e.description && e.amount).map(e => ({
        ...e,
        amount: Number(String(e.amount).replace(/[^0-9.]/g, '')),
        isNew: false, dirty: false
      }))
      saveBudgetEntries(month, toSave)
      setEntries(toSave)
      setSaving(false)
      showToast('Saved locally — create an account to keep your data permanently')
      return
    }

    const dirty = entries.filter(e => e.dirty || e.isNew)
    for (const entry of dirty) {
      if (!entry.description || !entry.amount) continue
      const payload = {
        user_id: session.user.id, month,
        description: entry.description,
        category: entry.category,
        entry_type: entry.entry_type,
        frequency: entry.frequency,
        amount: Number(String(entry.amount).replace(/[^0-9.]/g, '')),
        ...(premium && entry.budget_limit ? { budget_limit: Number(String(entry.budget_limit).replace(/[^0-9.]/g, '')) } : {}),
      }
      if (entry.isNew) await supabase.from('budget_entries').insert(payload)
      else await supabase.from('budget_entries').update(payload).eq('id', entry.id)
    }
    const { data } = await supabase.from('budget_entries').select('*')
      .eq('user_id', session.user.id).eq('month', month).order('created_at')
    setEntries(data || [])
    setSaving(false)
    showToast('Budget saved!')
  }


  async function handleImport({ rows, mode }) {
    if (mode === 'replace' && !isGuest) {
      await supabase.from('budget_entries').delete()
        .eq('user_id', session.user.id).eq('month', month)
    }
    if (isGuest) {
      if (mode === 'replace') saveBudgetEntries(month, rows)
      else {
        const existing = getBudgetEntries(month)
        saveBudgetEntries(month, [...existing, ...rows.map(r => ({ ...r, id: crypto.randomUUID() }))])
      }
      setEntries(getBudgetEntries(month))
    } else {
      for (const row of rows) {
        await supabase.from('budget_entries').insert({
          user_id: session.user.id, month,
          description: row.description,
          category: row.category,
          entry_type: row.entry_type,
          frequency: row.frequency,
          amount: Number(row.amount),
        })
      }
      const { data } = await supabase.from('budget_entries').select('*')
        .eq('user_id', session.user.id).eq('month', month).order('created_at')
      setEntries(data || [])
    }
    showToast(`${rows.length} rows imported!`)
  }

  if (loading) return <div className={styles.loading}>Loading budget...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Monthly Budget</h1>
          <p>{formatMonthLabel(month)}{readOnly ? ' — view only' : ''}</p>
        </div>
        <div className={styles.headerRight}>
          <MonthSelector month={month} onChange={setMonth} profile={profile} onUpgrade={onUpgrade} />
          {!readOnly && (
            <button className={styles.importBtn} onClick={() => setShowImport(true)}>
              Import CSV
            </button>
          )}
          {!readOnly && (
            <button className={styles.saveBtn} onClick={saveAll} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {readOnly && <div className={styles.readOnlyBanner}>Viewing a past month — editing is disabled to preserve historical data.</div>}

      {/* Row usage indicator for free users */}
      {!premium && !isGuest && (
        <div className={`${styles.rowUsage} ${totalRows >= FREE_ROW_LIMIT ? styles.rowUsageFull : totalRows >= FREE_ROW_LIMIT * 0.8 ? styles.rowUsageWarning : ''}`}>
          <div className={styles.rowUsageBar}>
            <div className={styles.rowUsageFill} style={{ width: Math.min((totalRows / FREE_ROW_LIMIT) * 100, 100) + '%' }} />
          </div>
          <span>{totalRows}/{FREE_ROW_LIMIT} rows used</span>
          {totalRows >= FREE_ROW_LIMIT && (
            <button className={styles.rowUpgradeBtn} onClick={onUpgrade}>Upgrade for unlimited</button>
          )}
        </div>
      )}

      <div className={styles.summaryBar}>
        {[
          { label: 'Income', value: '$' + totalIncome.toLocaleString(), color: null },
          { label: 'Expenses', value: '$' + totalExpenses.toLocaleString(), color: 'var(--red)' },
          { label: 'Savings', value: '$' + totalSavings.toLocaleString(), color: null },
          { label: 'Remaining', value: '$' + remaining.toLocaleString(), color: remaining >= 0 ? 'var(--accent)' : 'var(--red)' },
          { label: 'Savings Rate', value: savingsRate + '%', color: 'var(--accent)' },
        ].map((item, i) => (
          <div key={i} className={styles.summaryItem}>
            <div className={styles.summaryLabel}>{item.label}</div>
            <div className={styles.summaryValue} style={{ color: item.color || 'var(--text)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <BudgetSection title="Income" icon="+" total={'$' + totalIncome.toLocaleString() + '/mo'} rows={income} cats={INCOME_CATS} onAdd={() => addRow('income')} onUpdate={updateRow} onDelete={deleteRow} readOnly={readOnly} premium={premium} showLimits={false} />
      <BudgetSection title="Expenses" icon="-" total={'$' + totalExpenses.toLocaleString() + '/mo'} rows={expenses} cats={EXPENSE_CATS} onAdd={() => addRow('expense')} onUpdate={updateRow} onDelete={deleteRow} readOnly={readOnly} premium={premium} showLimits={true} onUpgrade={onUpgrade} />
      <BudgetSection title="Savings Allocations" icon="S" total={'$' + totalSavings.toLocaleString() + '/mo'} rows={savings} cats={SAVINGS_CATS} onAdd={() => addRow('savings')} onUpdate={updateRow} onDelete={deleteRow} readOnly={readOnly} premium={premium} showLimits={false} />
    {showImport && (
        <CSVImport
          profile={profile}
          month={month}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}

function BudgetSection({ title, icon, total, rows, cats, onAdd, onUpdate, onDelete, readOnly, premium, showLimits, onUpgrade }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionLeft}>
          <span className={styles.sectionIcon}>{icon}</span>
          <span className={styles.sectionTitle}>{title}</span>
          <span className={styles.sectionTotal}>Total: <strong>{total}</strong></span>
        </div>
        {!readOnly && <button className={styles.addBtn} onClick={onAdd}>+ Add row</button>}
      </div>

      {/* Desktop table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: showLimits && premium ? '30%' : '38%' }}>Description</th>
              <th style={{ width: '20%' }}>Category</th>
              <th style={{ width: '14%' }}>Frequency</th>
              <th style={{ width: '14%' }}>Amount</th>
              {showLimits && premium && <th style={{ width: '14%' }}>Budget Limit</th>}
              {showLimits && premium && <th style={{ width: '8%' }}>vs Limit</th>}
              {!readOnly && <th style={{ width: '6%' }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className={styles.emptyRow}>{readOnly ? 'No entries for this month' : 'No entries yet — click "+ Add row" to start'}</td></tr>
            )}
            {rows.map(row => {
              const overLimit = showLimits && premium && row.budget_limit && Number(row.amount) > Number(row.budget_limit)
              const nearLimit = showLimits && premium && row.budget_limit && Number(row.amount) >= Number(row.budget_limit) * 0.8 && !overLimit
              return (
                <tr key={row.id} className={overLimit ? styles.rowOver : nearLimit ? styles.rowNear : ''}>
                  <td><input type="text" value={row.description} placeholder="e.g. Salary, Rent..." onChange={e => onUpdate(row.id, 'description', e.target.value)} readOnly={readOnly} /></td>
                  <td><select value={row.category} onChange={e => onUpdate(row.id, 'category', e.target.value)} disabled={readOnly}>{cats.map(c => <option key={c}>{c}</option>)}</select></td>
                  <td><select value={row.frequency} onChange={e => onUpdate(row.id, 'frequency', e.target.value)} disabled={readOnly}><option value="recurring">Recurring</option><option value="one-time">One-time</option></select></td>
                  <td><input type="text" value={row.amount} placeholder="0" onChange={e => onUpdate(row.id, 'amount', e.target.value)} readOnly={readOnly} /></td>
                  {showLimits && premium && (
                    <td><input type="text" value={row.budget_limit || ''} placeholder="No limit" onChange={e => onUpdate(row.id, 'budget_limit', e.target.value)} readOnly={readOnly} className={styles.limitInput} /></td>
                  )}
                  {showLimits && premium && (
                    <td className={styles.limitStatus}>
                      {row.budget_limit && row.amount ? (
                        <span className={overLimit ? styles.overBadge : nearLimit ? styles.nearBadge : styles.okBadge}>
                          {overLimit ? 'Over' : nearLimit ? 'Near' : 'OK'}
                        </span>
                      ) : null}
                    </td>
                  )}
                  {!readOnly && <td className={styles.delCell}><button className={styles.delBtn} onClick={() => onDelete(row)}>×</button></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Premium upsell for category limits */}
      {showLimits && !premium && !readOnly && rows.length > 0 && (
        <div className={styles.limitsUpsell}>
          <span>Set spending limits per category with</span>
          <button onClick={onUpgrade}>Premium</button>
        </div>
      )}

      {/* Mobile rows */}
      <div className={styles.mobileRows}>
        {rows.length === 0 && <div className={styles.mobileEmptyRow}>{readOnly ? 'No entries for this month' : 'Tap "+ Add row" to start'}</div>}
        {rows.map(row => {
          const overLimit = showLimits && premium && row.budget_limit && Number(row.amount) > Number(row.budget_limit)
          return (
            <div key={row.id} className={`${styles.mobileRow} ${overLimit ? styles.mobileRowOver : ''}`}>
              <div className={styles.mobileRowTop}>
                <input type="text" value={row.description} placeholder="Description..." onChange={e => onUpdate(row.id, 'description', e.target.value)} readOnly={readOnly} />
                {!readOnly && <button className={styles.delBtn} onClick={() => onDelete(row)}>×</button>}
              </div>
              <div className={styles.mobileRowBottom}>
                <select value={row.category} onChange={e => onUpdate(row.id, 'category', e.target.value)} disabled={readOnly}>{cats.map(c => <option key={c}>{c}</option>)}</select>
                <select value={row.frequency} onChange={e => onUpdate(row.id, 'frequency', e.target.value)} disabled={readOnly}><option value="recurring">Recurring</option><option value="one-time">One-time</option></select>
                <input type="text" value={row.amount} placeholder="Amount" onChange={e => onUpdate(row.id, 'amount', e.target.value)} readOnly={readOnly} style={{ gridColumn: showLimits && premium ? '1' : 'span 2' }} />
                {showLimits && premium && (
                  <input type="text" value={row.budget_limit || ''} placeholder="Limit" onChange={e => onUpdate(row.id, 'budget_limit', e.target.value)} readOnly={readOnly} />
                )}
              </div>
              {overLimit && <div className={styles.mobileOverWarning}>Over budget limit</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
