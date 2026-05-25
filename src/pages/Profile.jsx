import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Profile.module.css'

const MONTHLY_PRICE_ID = 'price_1TaijAHR1jh700B41LgzGpoZ'
const ANNUAL_PRICE_ID = 'price_1TaijLHR1jh700B4BaGxGXyD'

const SUBJECT_OPTIONS = [
  'Billing question',
  'Bug report',
  'Feature request',
  'Account issue',
  'General question',
  'Other',
]

export default function Profile({ session, profile, onSignOut, showToast, onProfileUpdate }) {
  const [activeSection, setActiveSection] = useState('account')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [email, setEmail] = useState(session.user.email || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [billing, setBilling] = useState('monthly')
  const [contactSubject, setContactSubject] = useState(SUBJECT_OPTIONS[0])
  const [contactMessage, setContactMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [sendingContact, setSendingContact] = useState(false)

  const isPremium = profile?.plan === 'premium'
  const displayName = profile?.full_name || session.user.email.split('@')[0]
  const initials = displayName.slice(0, 2).toUpperCase()

  async function saveName() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', session.user.id)
    if (error) showToast('Error saving name')
    else { showToast('Name updated!'); onProfileUpdate?.() }
    setSaving(false)
  }

  async function saveEmail() {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ email })
    if (error) showToast('Error: ' + error.message)
    else showToast('Check your new email to confirm the change')
    setSaving(false)
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) { showToast('Passwords do not match'); return }
    if (newPassword.length < 6) { showToast('Password must be at least 6 characters'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) showToast('Error: ' + error.message)
    else { showToast('Password updated!'); setNewPassword(''); setConfirmPassword('') }
    setSaving(false)
  }

  async function handleUpgrade() {
    showToast('Redirecting to checkout...')
    try {
      const priceId = billing === 'monthly' ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, userId: session.user.id, email: session.user.email }
      })
      if (error) throw error
      if (data?.url) window.location.href = data.url
    } catch (e) {
      showToast('Checkout unavailable — please try again')
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
      showToast('Portal unavailable — please try again')
    }
  }

  async function sendContactMessage() {
    if (!contactMessage.trim()) { showToast('Please enter a message'); return }
    setSendingContact(true)
    const { error } = await supabase.from('contact_messages').insert({
      user_id: session.user.id,
      subject: contactSubject,
      message: contactMessage.trim(),
    })
    if (error) {
      showToast('Failed to send — please try again')
    } else {
      showToast('Message sent! We\'ll get back to you soon.')
      setContactMessage('')
      setContactSubject(SUBJECT_OPTIONS[0])
    }
    setSendingContact(false)
  }

  const sections = [
    { id: 'account', label: 'Account' },
    { id: 'security', label: 'Security' },
    { id: 'plan', label: 'Plan & Billing' },
    { id: 'contact', label: 'Contact Us' },
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

          {/* Plan & Billing */}
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
                    <p>Upgrade to Premium to unlock unlimited budgeting, full reports, spending history, and more.</p>
                  </div>

                  <div className={styles.pricingToggle}>
                    <button className={billing === 'monthly' ? styles.toggleActive : ''} onClick={() => setBilling('monthly')}>Monthly</button>
                    <button className={billing === 'annual' ? styles.toggleActive : ''} onClick={() => setBilling('annual')}>
                      Annual <span className={styles.saveBadge}>Save 33%</span>
                    </button>
                  </div>

                  <div className={styles.priceDisplay}>
                    <span className={styles.priceNum}>{billing === 'monthly' ? '$1' : '$8'}</span>
                    <span className={styles.pricePer}>{billing === 'monthly' ? '/month' : '/year · just $0.67/month'}</span>
                  </div>

                  {/* Comparison table */}
                  <div className={styles.compareTable}>
                    <div className={styles.compareHeader}>
                      <div className={styles.compareFeature}></div>
                      <div className={styles.compareCol}>Free</div>
                      <div className={`${styles.compareCol} ${styles.comparePremium}`}>Premium</div>
                    </div>
                    {[
                      { feature: 'Budget rows per month', free: '10 rows', premium: 'Unlimited' },
                      { feature: 'Savings goals', free: '3 goals', premium: 'Unlimited' },
                      { feature: 'Budget history', free: 'Current month', premium: '12 months' },
                      { feature: 'Category budget limits', free: '—', premium: '✓' },
                      { feature: 'Spending trend reports', free: '—', premium: '✓' },
                      { feature: 'Goal projections', free: '—', premium: '✓' },
                      { feature: 'All CSV exports', free: 'Monthly only', premium: 'All reports' },
                      { feature: 'Affordability analyzer', free: '✓', premium: '✓' },
                      { feature: 'Financial health score', free: '✓', premium: '✓' },
                    ].map(row => (
                      <div key={row.feature} className={styles.compareRow}>
                        <div className={styles.compareFeature}>{row.feature}</div>
                        <div className={styles.compareCol} style={{ color: row.free === '—' ? 'var(--text-light)' : 'var(--text-muted)' }}>{row.free}</div>
                        <div className={`${styles.compareCol} ${styles.comparePremium}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>{row.premium}</div>
                      </div>
                    ))}
                  </div>

                  <button className={styles.primaryBtn} onClick={handleUpgrade}>
                    Upgrade to Premium →
                  </button>
                  <div className={styles.planNote}>Cancel anytime · Secure payment via Stripe</div>
                </>
              )}
            </div>
          )}

          {/* Contact Us */}
          {activeSection === 'contact' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Contact Us</div>
              <p className={styles.contactIntro}>
                Have a question, found a bug, or want to request a feature? Send us a message and we'll get back to you.
              </p>

              <div className={styles.field}>
                <label>Subject</label>
                <select
                  value={contactSubject}
                  onChange={e => setContactSubject(e.target.value)}
                  className={styles.selectField}
                >
                  {SUBJECT_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className={styles.field}>
                <label>Message</label>
                <textarea
                  value={contactMessage}
                  onChange={e => setContactMessage(e.target.value)}
                  placeholder="Describe your question or issue in as much detail as possible..."
                  rows={6}
                  className={styles.textarea}
                />
                <div className={styles.fieldHint}>{contactMessage.length}/1000 characters</div>
              </div>

              <button
                className={styles.primaryBtn}
                onClick={sendContactMessage}
                disabled={sendingContact || !contactMessage.trim()}
              >
                {sendingContact ? 'Sending...' : 'Send message'}
              </button>

              <div className={styles.contactNote}>
                Messages are linked to your account ({session.user.email}) so we can follow up directly.
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
