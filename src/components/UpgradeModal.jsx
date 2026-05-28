import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './UpgradeModal.module.css'

const MONTHLY_PRICE_ID = 'price_1TaijAHR1jh700B41LgzGpoZ'
const ANNUAL_PRICE_ID  = 'price_1TaijLHR1jh700B4BaGxGXyD'

export default function UpgradeModal({ session, profile, onClose, showToast, onSuccess }) {
  const [billing, setBilling] = useState('monthly')
  const [loading, setLoading] = useState(false)

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handleUpgrade() {
    if (!session) {
      showToast('Please sign in to upgrade')
      onClose()
      return
    }
    setLoading(true)
    showToast('Redirecting to checkout...')
    try {
      const priceId = billing === 'monthly' ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, userId: session.user.id, email: session.user.email }
      })
      if (error) throw error
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (e) {
      showToast('Checkout unavailable — please try again')
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose}>×</button>
        <h2>Upgrade to Premium</h2>
        <p>Unlock unlimited budgeting, full reports, spending history, and more.</p>

        <div className={styles.toggle}>
          <button className={billing === 'monthly' ? styles.active : ''} onClick={() => setBilling('monthly')}>
            Monthly
          </button>
          <button className={billing === 'annual' ? styles.active : ''} onClick={() => setBilling('annual')}>
            Annual <span className={styles.saveBadge}>Save 33%</span>
          </button>
        </div>

        <div className={styles.price}>
          <span className={styles.amount}>{billing === 'monthly' ? '$1' : '$8'}</span>
          <span className={styles.period}>
            {billing === 'monthly' ? '/month' : '/year · just $0.67/month'}
          </span>
        </div>

        <ul className={styles.features}>
          {[
            { text: 'Unlimited budget rows',         free: false },
            { text: 'Unlimited savings goals',        free: false },
            { text: '12 months of budget history',   free: false },
            { text: 'Category budget limits',         free: false },
            { text: '6-month trend reports',          free: false },
            { text: 'All CSV exports',                free: false },
            { text: 'Goal projections',               free: false },
            { text: 'Affordability analyzer',         free: true  },
            { text: 'Financial health score',         free: true  },
          ].map(f => (
            <li key={f.text}>
              <span className={f.free ? styles.checkMuted : styles.check}>✓</span>
              <span style={{ color: f.free ? 'var(--text-muted)' : 'var(--text)' }}>{f.text}</span>
              {f.free && <span className={styles.freeTag}>Free</span>}
            </li>
          ))}
        </ul>

        <button
          className={styles.ctaBtn}
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? 'Redirecting...' : 'Get Premium →'}
        </button>
        <div className={styles.note}>Cancel anytime · Secure payment via Stripe</div>
      </div>
    </div>
  )
}
