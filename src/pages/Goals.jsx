import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getGoals, saveGoal, deleteGoal as deleteGuestGoal } from '../lib/localStorage'
import { isPremium, canAddGoal } from '../lib/plans'
import styles from './Goals.module.css'

const EMOJIS = ['★','◎','◆','▲','●','■','◐','◑','◒','◓','⬟','⬡']
const FREE_GOAL_LIMIT = 3

export default function Goals({ session, isGuest, profile, showToast, onUpgrade }) {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '★', description: '', target_amount: '', current_amount: '', monthly_contribution: '', target_date: '' })
  const [saving, setSaving] = useState(false)
  const premium = isPremium(profile)

  useEffect(() => { load() }, [session, isGuest])

  async function load() {
    setLoading(true)
    if (isGuest) {
      setGoals(getGoals())
    } else {
      const { data } = await supabase.from('savings_goals').select('*').eq('user_id', session.user.id).order('created_at')
      setGoals(data || [])
    }
    setLoading(false)
  }

  function handleAddGoalClick() {
    if (!canAddGoal(profile, goals.length)) {
      onUpgrade()
      showToast(`Free plan is limited to ${FREE_GOAL_LIMIT} goals — upgrade for unlimited`)
      return
    }
    setShowForm(true)
  }

  async function handleSaveGoal() {
    if (!form.name || !form.target_amount) { showToast('Name and target amount are required'); return }
    if (!canAddGoal(profile, goals.length)) { onUpgrade(); return }
    setSaving(true)
    const goal = {
      id: crypto.randomUUID(),
      name: form.name, emoji: form.emoji, description: form.description,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount) || 0,
      monthly_contribution: Number(form.monthly_contribution) || 0,
      target_date: form.target_date || null,
    }
    if (isGuest) {
      saveGoal(goal)
      setGoals(getGoals())
      showToast('Goal saved locally — create an account to keep it permanently')
    } else {
      await supabase.from('savings_goals').insert({ ...goal, user_id: session.user.id })
      await load()
      showToast('Goal added!')
    }
    setForm({ name: '', emoji: '★', description: '', target_amount: '', current_amount: '', monthly_contribution: '', target_date: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleDeleteGoal(id) {
    if (isGuest) {
      deleteGuestGoal(id)
      setGoals(getGoals())
    } else {
      await supabase.from('savings_goals').delete().eq('id', id)
      await load()
    }
    showToast('Goal removed')
  }

  if (loading) return <div className={styles.loading}>Loading goals...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Savings Goals</h1>
          <p>Track your progress toward the things that matter most</p>
        </div>
        <div className={styles.headerRight}>
          {!premium && !isGuest && (
            <span className={styles.goalCount}>{goals.length}/{FREE_GOAL_LIMIT} goals</span>
          )}
          <button className={styles.addGoalBtn} onClick={handleAddGoalClick}>+ New Goal</button>
        </div>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h3>New Savings Goal</h3>
          <div className={styles.emojiRow}>
            {EMOJIS.map(e => (
              <button key={e} className={`${styles.emojiBtn} ${form.emoji === e ? styles.emojiActive : ''}`} onClick={() => setForm(f => ({ ...f, emoji: e }))}>{e}</button>
            ))}
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}><label>Goal name *</label><input placeholder="Emergency Fund" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className={styles.formGroup}><label>Description</label><input placeholder="Optional note" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className={styles.formGroup}><label>Target amount *</label><input type="number" placeholder="10000" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} /></div>
            <div className={styles.formGroup}><label>Already saved</label><input type="number" placeholder="0" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} /></div>
            <div className={styles.formGroup}><label>Monthly contribution</label><input type="number" placeholder="200" value={form.monthly_contribution} onChange={e => setForm(f => ({ ...f, monthly_contribution: e.target.value }))} /></div>
            <div className={styles.formGroup}><label>Target date</label><input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} /></div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            <button className={styles.saveGoalBtn} onClick={handleSaveGoal} disabled={saving}>{saving ? 'Saving...' : 'Add Goal'}</button>
          </div>
        </div>
      )}

      {goals.length === 0 && !showForm ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◎</div>
          <h3>No savings goals yet</h3>
          <p>Add your first goal to start tracking your progress</p>
          <button onClick={handleAddGoalClick}>+ Add a goal</button>
        </div>
      ) : (
        <div className={styles.goalsGrid}>
          {goals.map(g => {
            const pct = Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100)
            const rem = g.target_amount - g.current_amount
            const months = g.monthly_contribution > 0 ? Math.ceil(rem / g.monthly_contribution) : null
            return (
              <div key={g.id} className={styles.goalCard}>
                <div className={styles.goalTop}>
                  <div className={styles.goalIcon}>{g.emoji || '★'}</div>
                  <button className={styles.goalDel} onClick={() => handleDeleteGoal(g.id)}>×</button>
                </div>
                <h3 className={styles.goalName}>{g.name}</h3>
                {g.description && <p className={styles.goalDesc}>{g.description}</p>}
                <div className={styles.goalAmountsRow}>
                  <div><div className={styles.gaLabel}>Saved</div><div className={styles.gaVal}>${Number(g.current_amount).toLocaleString()}</div></div>
                  <div style={{ textAlign: 'right' }}><div className={styles.gaLabel}>Target</div><div className={styles.gaVal}>${Number(g.target_amount).toLocaleString()}</div></div>
                </div>
                <div className={styles.goalBar}><div className={styles.goalFill} style={{ width: pct + '%' }} /></div>
                <div className={styles.goalMeta}>
                  <span>{pct}% complete</span>
                  {months && <span>~{months} mo remaining</span>}
                </div>
                {g.monthly_contribution > 0 && (
                  <div className={styles.goalContrib}>Contributing <strong>${Number(g.monthly_contribution).toLocaleString()}/mo</strong></div>
                )}
                {/* Premium: goal projection */}
                {premium && g.monthly_contribution > 0 && months && (
                  <div className={styles.goalProjection}>
                    On track to complete {months <= 1 ? 'next month' : `in ${months} months`}
                    {g.target_date && ` · Target: ${new Date(g.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                  </div>
                )}
              </div>
            )
          })}
          <div className={styles.addCard} onClick={handleAddGoalClick}>
            <div className={styles.addIcon}>+</div>
            <p>{isGuest && goals.length >= FREE_GOAL_LIMIT ? 'Sign up to add more goals' : !premium && goals.length >= FREE_GOAL_LIMIT ? 'Upgrade for more goals' : 'Add a new goal'}</p>
          </div>
        </div>
      )}

      {!premium && !isGuest && (
        <div className={styles.premiumBanner}>
          <div>
            <div className={styles.premiumLabel}>Premium Feature</div>
            <div className={styles.premiumTitle}>Unlimited goals + projections</div>
            <div className={styles.premiumDesc}>Free plan includes {FREE_GOAL_LIMIT} goals. Upgrade for unlimited goals, detailed projections, and compound interest calculations.</div>
          </div>
          <button className={styles.upgradeBtn} onClick={onUpgrade}>Upgrade</button>
        </div>
      )}
    </div>
  )
}
