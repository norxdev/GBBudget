import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getBudgetEntries, saveBudgetEntries, deleteBudgetEntry } from '../lib/localStorage'
import { getCurrentMonth, formatMonthLabel, isFutureMonth } from '../lib/months'
import MonthSelector from '../components/MonthSelector'
import styles from './Budget.module.css'

const INCOME_CATS = ['Employment', 'Freelance', 'Investment', 'Rental', 'Other']
const EXPENSE_CATS = ['Housing', 'Food', 'Transport', 'Healthcare', 'Entertainment', 'Subscriptions', 'Dining', 'Shopping', 'Other']
const SAVINGS_CATS = ['Emergency', 'Investment', 'Travel', 'Major Purchase', 'Retirement', 'Other']

function emptyRow(type) {
  return {
    id: crypto.randomUUID(),
    description: '',
    category: type === 'income' ? 'Employment' : type === 'expense' ? 'Housing' : 'Emergency',
    entry_type: type, frequency: 'recurring', amount: '', isNew: true
  }
}

export default function Budget({ session, isGuest, showToast }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const readOnly = isFutureMonth(month)

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

  function addRow(type) { if (!readOnly) setEntries(prev => [...prev, emptyRow(type)]) }
  function updateRow(id, field, value) { if (!readOnly) setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value, dirty: true } : e)) }

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
        description: entry.description, category: entry.category,
        entry_type: entry.entry_type, frequency: entry.frequency,
        amount: Number(String(entry.amount).replace(/[^0-9.]/g, ''))
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

  if (loading) return <div className={styles.loading}>Loading budget...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Monthly Budget</h1>
          <p>{formatMonthLabel(month)}{readOnly ? ' — view only' : ''}</p>
        </div>
        <div className={styles.headerRight}>
          <MonthSelector month={month} onChange={setMonth} />
          {!readOnly && (
            <button className={styles.saveBtn} onClick={saveAll} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {readOnly && <div className={styles.readOnlyBanner}>Viewing a past month — editing is disabled to preserve historical data.</div>}

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

      <BudgetSection title="Income" icon="+" total={'$' + totalIncome.toLocaleString() + '/mo'} rows={income} cats={INCOME_CATS} onAdd={() => addRow('income')} onUpdate={updateRow} onDelete={deleteRow} readOnly={readOnly} />
      <BudgetSection title="Expenses" icon="-" total={'$' + totalExpenses.toLocaleString() + '/mo'} rows={expenses} cats={EXPENSE_CATS} onAdd={() => addRow('expense')} onUpdate={updateRow} onDelete={deleteRow} readOnly={readOnly} />
      <BudgetSection title="Savings Allocations" icon="S" total={'$' + totalSavings.toLocaleString() + '/mo'} rows={savings} cats={SAVINGS_CATS} onAdd={() => addRow('savings')} onUpdate={updateRow} onDelete={deleteRow} readOnly={readOnly} />
    </div>
  )
}

function BudgetSection({ title, icon, total, rows, cats, onAdd, onUpdate, onDelete, readOnly }) {
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
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '38%' }}>Description</th>
              <th style={{ width: '22%' }}>Category</th>
              <th style={{ width: '16%' }}>Frequency</th>
              <th style={{ width: '18%' }}>Amount</th>
              {!readOnly && <th style={{ width: '6%' }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className={styles.emptyRow}>{readOnly ? 'No entries for this month' : 'No entries yet — click "+ Add row" to start'}</td></tr>}
            {rows.map(row => (
              <tr key={row.id}>
                <td><input type="text" value={row.description} placeholder="e.g. Salary, Rent..." onChange={e => onUpdate(row.id, 'description', e.target.value)} readOnly={readOnly} /></td>
                <td><select value={row.category} onChange={e => onUpdate(row.id, 'category', e.target.value)} disabled={readOnly}>{cats.map(c => <option key={c}>{c}</option>)}</select></td>
                <td><select value={row.frequency} onChange={e => onUpdate(row.id, 'frequency', e.target.value)} disabled={readOnly}><option value="recurring">Recurring</option><option value="one-time">One-time</option></select></td>
                <td><input type="text" value={row.amount} placeholder="0" onChange={e => onUpdate(row.id, 'amount', e.target.value)} readOnly={readOnly} /></td>
                {!readOnly && <td className={styles.delCell}><button className={styles.delBtn} onClick={() => onDelete(row)}>×</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.mobileRows}>
        {rows.length === 0 && <div className={styles.mobileEmptyRow}>{readOnly ? 'No entries for this month' : 'Tap "+ Add row" to start'}</div>}
        {rows.map(row => (
          <div key={row.id} className={styles.mobileRow}>
            <div className={styles.mobileRowTop}>
              <input type="text" value={row.description} placeholder="Description..." onChange={e => onUpdate(row.id, 'description', e.target.value)} readOnly={readOnly} />
              {!readOnly && <button className={styles.delBtn} onClick={() => onDelete(row)}>×</button>}
            </div>
            <div className={styles.mobileRowBottom}>
              <select value={row.category} onChange={e => onUpdate(row.id, 'category', e.target.value)} disabled={readOnly}>{cats.map(c => <option key={c}>{c}</option>)}</select>
              <select value={row.frequency} onChange={e => onUpdate(row.id, 'frequency', e.target.value)} disabled={readOnly}><option value="recurring">Recurring</option><option value="one-time">One-time</option></select>
              <input type="text" value={row.amount} placeholder="Amount" onChange={e => onUpdate(row.id, 'amount', e.target.value)} readOnly={readOnly} style={{ gridColumn: 'span 2' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
