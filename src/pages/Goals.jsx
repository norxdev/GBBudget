import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Goals.module.css'

const EMOJIS = ['🚨','✈️','🚗','🏠','💍','📱','🎓','🐾','🏖️','💻','🎯','💰']

export default function Goals({ session, showToast, onUpgrade }) {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '🎯', description: '', target_amount: '', current_amount: '', monthly_contribution: '', target_date: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [session])

  async function load() {
    const { data } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at')
    setGoals(data || [])
    setLoading(false)
  }

  async function saveGoal() {
    if (!form.name || !form.target_amount) { showToast('Name and target amount are required'); return }
    setSaving(true)
    await supabase.from('savings_goals').insert({
      user_id: session.user.id,
      name: form.name,
      emoji: form.emoji,
      description: form.description,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount) || 0,
      monthly_contribution: Number(form.monthly_contribution) || 0,
      target_date: form.target_date || null,
    })
    setForm({ name: '', emoji: '🎯', description: '', target_amount: '', current_amount: '', monthly_contribution: '', target_date: '' })
    setShowForm(false)
    setSaving(false)
    showToast('Goal added!')
    load()
  }

  async function deleteGoal(id) {
    await supabase.from('savings_goals').delete().eq('id', id)
    showToast('Goal removed')
    load()
  }

  if (loading) return <div className={styles.loading}>Loading goals...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Savings Goals</h1>
          <p>Track your progress toward the things that matter most</p>
        </div>
        <button className={styles.addGoalBtn} onClick={() => setShowForm(true)}>+ New Goal</button>
      </div>

      {/* Add Goal Form */}
      {showForm && (
        <div className={styles.formCard}>
          <h3>New Savings Goal</h3>
          <div className={styles.emojiRow}>
            {EMOJIS.map(e => (
              <button
                key={e}
                className={`${styles.emojiBtn} ${form.emoji === e ? styles.emojiActive : ''}`}
                onClick={() => setForm(f => ({ ...f, emoji: e }))}
              >{e}</button>
            ))}
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Goal name *</label>
              <input placeholder="e.g. Emergency Fund" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label>Description</label>
              <input placeholder="Optional note" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label>Target amount *</label>
              <input type="number" placeholder="10000" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label>Already saved</label>
              <input type="number" placeholder="0" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label>Monthly contribution</label>
              <input type="number" placeholder="200" value={form.monthly_contribution} onChange={e => setForm(f => ({ ...f, monthly_contribution: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label>Target date</label>
              <input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
            </div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            <button className={styles.saveGoalBtn} onClick={saveGoal} disabled={saving}>{saving ? 'Saving...' : 'Add Goal'}</button>
          </div>
        </div>
      )}

      {goals.length === 0 && !showForm ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎯</div>
          <h3>No savings goals yet</h3>
          <p>Add your first goal to start tracking your progress</p>
          <button onClick={() => setShowForm(true)}>+ Add a goal</button>
        </div>
      ) : (
        <div className={styles.goalsGrid}>
          {goals.map(g => {
            const pct = Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100)
            const remaining = g.target_amount - g.current_amount
            const months = g.monthly_contribution > 0 ? Math.ceil(remaining / g.monthly_contribution) : null
            return (
              <div key={g.id} className={styles.goalCard}>
                <div className={styles.goalTop}>
                  <div className={styles.goalIcon}>{g.emoji || '🎯'}</div>
                  <button className={styles.goalDel} onClick={() => deleteGoal(g.id)}>×</button>
                </div>
                <h3 className={styles.goalName}>{g.name}</h3>
                {g.description && <p className={styles.goalDesc}>{g.description}</p>}
                <div className={styles.goalAmountsRow}>
                  <div>
                    <div className={styles.gaLabel}>Saved</div>
                    <div className={styles.gaVal}>${Number(g.current_amount).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={styles.gaLabel}>Target</div>
                    <div className={styles.gaVal}>${Number(g.target_amount).toLocaleString()}</div>
                  </div>
                </div>
                <div className={styles.goalBar}>
                  <div className={styles.goalFill} style={{ width: pct + '%' }} />
                </div>
                <div className={styles.goalMeta}>
                  <span>{pct}% complete</span>
                  {months && <span>~{months} mo remaining</span>}
                </div>
                {g.monthly_contribution > 0 && (
                  <div className={styles.goalContrib}>Contributing <strong>${Number(g.monthly_contribution).toLocaleString()}/mo</strong></div>
                )}
              </div>
            )
          })}

          {/* Add card */}
          <div className={styles.addCard} onClick={() => setShowForm(true)}>
            <div className={styles.addIcon}>＋</div>
            <p>Add a new goal</p>
          </div>
        </div>
      )}

      {/* Premium banner */}
      <div className={styles.premiumBanner}>
        <div>
          <div className={styles.premiumLabel}>Premium Feature</div>
          <div className={styles.premiumTitle}>Unlimited goals + compound interest projections</div>
          <div className={styles.premiumDesc}>Connect bank accounts, track unlimited goals, and see projected growth over time.</div>
        </div>
        <button className={styles.upgradeBtn} onClick={onUpgrade}>Upgrade →</button>
      </div>
    </div>
  )
}
