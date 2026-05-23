import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Profile.module.css'

const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SojIfHR1jh700B4Jaq0Ih26kK1Qv0dF0PknzsUKo3RcJkLSyzFQZo6HRWHwUctENxWEJPDHrDUSlQt75j9TuIRF00E5YQOfgs'
const MONTHLY_PRICE_ID = 'price_1TZxLzHR1jh700B4le19bfFX'
const ANNUAL_PRICE_ID = 'price_1TZxMCHR1jh700B4VvsXsezG'
const CUSTOMER_PORTAL = 'bpc_1Ta3KTHR1jh700B4VeskkOV9'

export default function Profile({ session, profile, onSignOut, showToast }) {
  const [activeSection, setActiveSection] = useState('account')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [email, setEmail] = useState(session.user.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [billing, setBilling] = useState('monthly')

  const isPremium = profile?.plan === 'premium'
  const displayName = profile?.full_name || session.user.email.split('@')[0]
  const initials = displayName.slice(0, 2).toUpperCase()

  async function saveName() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', session.user.id)
    if (error) { showToast('Error saving name'); } else { showToast('Name updated!') }
    setSaving(false)
  }

  async function saveEmail() {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ email })
    if (error) { showToast('Error: ' + error.message) } else { showToast('Check your new email to confirm the change') }
    setSaving(false)
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) { showToast('Passwords do not match'); return }
    if (newPassword.length < 6) { showToast('Password must be at least 6 characters'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { showToast('Error: ' + error.message) } else {
      showToast('Password updated!')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    }
    setSaving(false)
  }

  async function handleUpgrade() {
    // In production this would call your Supabase Edge Function
    // which creates a Stripe checkout session and returns the URL
    showToast('Redirecting to checkout...')
    try {
      const priceId = billing === 'monthly' ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, userId: session.user.id, email: session.user.email }
      })
      if (error) throw error
      if (data?.url) window.location.href = data.url
    } catch (e) {
      showToast('Checkout unavailable — Edge Function not deployed yet')
    }
  }

  async function handleManageSubscription() {
    showToast('Opening billing portal...')
    try {
      const { data, error } = await supabase.functions.invoke('create-portal', {
        body: { userId: session.user.id }
      })
      if (error) throw error
      if (data?.url) window.location.href = data.url
    } catch (e) {
      showToast('Portal unavailable — Edge Function not deployed yet')
    }
  }

  const sections = [
    { id: 'account', label: 'Account' },
    { id: 'security', label: 'Security' },
    { id: 'plan', label: 'Plan & Billing' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.avatar}>{initials}</div>
        <div>
          <h1>{displayName}</h1>
          <p>{session.user.email}</p>
        </div>
        {isPremium && <span className={styles.premiumBadge}>Premium</span>}
      </div>

      <div className={styles.layout}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          {sections.map(s => (
            <button
              key={s.id}
              className={`${styles.sidebarBtn} ${activeSection === s.id ? styles.sidebarActive : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          ))}
          <div className={styles.sidebarDivider} />
          <button className={styles.signOutBtn} onClick={onSignOut}>Sign out</button>
        </div>

        {/* Content */}
        <div className={styles.content}>

          {/* Account */}
          {activeSection === 'account' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Account Details</div>

              <div className={styles.field}>
                <label>Full name</label>
                <div className={styles.fieldRow}>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
                  <button className={styles.saveBtn} onClick={saveName} disabled={saving}>Save</button>
                </div>
              </div>

              <div className={styles.field}>
                <label>Email address</label>
                <div className={styles.fieldRow}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  <button className={styles.saveBtn} onClick={saveEmail} disabled={saving}>Save</button>
                </div>
                <div className={styles.fieldHint}>You'll receive a confirmation email to verify the change.</div>
              </div>
            </div>
          )}

          {/* Security */}
          {activeSection === 'security' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Change Password</div>
              <div className={styles.field}>
                <label>New password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
              </div>
              <div className={styles.field}>
                <label>Confirm new password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
              </div>
              <button className={styles.primaryBtn} onClick={savePassword} disabled={saving || !newPassword || !confirmPassword}>
                {saving ? 'Saving...' : 'Update password'}
              </button>
            </div>
          )}

          {/* Plan */}
          {activeSection === 'plan' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Plan & Billing</div>

              {isPremium ? (
                <div className={styles.currentPlan}>
                  <div className={styles.planBadge}>Premium</div>
                  <p>You have full access to all Clarity features.</p>
                  <button className={styles.portalBtn} onClick={handleManageSubscription}>
                    Manage subscription →
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.freePlan}>
                    <div className={styles.planLabel}>Current plan: <strong>Free</strong></div>
                    <p>Upgrade to Premium to unlock advanced analytics, unlimited goals, full reports, and more.</p>
                  </div>

                  <div className={styles.pricingToggle}>
                    <button className={billing === 'monthly' ? styles.toggleActive : ''} onClick={() => setBilling('monthly')}>Monthly</button>
                    <button className={billing === 'annual' ? styles.toggleActive : ''} onClick={() => setBilling('annual')}>
                      Annual <span className={styles.saveBadge}>Save 25%</span>
                    </button>
                  </div>

                  <div className={styles.priceDisplay}>
                    <span className={styles.priceNum}>{billing === 'monthly' ? '$9' : '$7'}</span>
                    <span className={styles.pricePer}>{billing === 'monthly' ? '/month' : '/month · billed $81/year'}</span>
                  </div>

                  <ul className={styles.featureList}>
                    {['Unlimited savings goals', '6-month trend reports', 'Net worth tracker', 'Bank data upload', 'Multiple budget frameworks', 'Priority support'].map(f => (
                      <li key={f}><span>✓</span>{f}</li>
                    ))}
                  </ul>

                  <button className={styles.primaryBtn} onClick={handleUpgrade}>
                    Upgrade to Premium →
                  </button>
                  <div className={styles.planNote}>7-day free trial · Cancel anytime · No credit card required to try</div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
