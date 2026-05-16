import { useState } from 'react'
import styles from './UpgradeModal.module.css'

export default function UpgradeModal({ onClose, showToast }) {
  const [billing, setBilling] = useState('monthly')

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose}>×</button>
        <h2>Upgrade to Premium</h2>
        <p>Unlock advanced analytics, unlimited goals, and full reporting.</p>

        <div className={styles.toggle}>
          <button className={billing === 'monthly' ? styles.active : ''} onClick={() => setBilling('monthly')}>Monthly</button>
          <button className={billing === 'annual' ? styles.active : ''} onClick={() => setBilling('annual')}>
            Annual <span className={styles.saveBadge}>Save 25%</span>
          </button>
        </div>

        <div className={styles.price}>
          <span className={styles.amount}>{billing === 'monthly' ? '$9' : '$7'}</span>
          <span className={styles.period}>
            {billing === 'monthly' ? '/month' : '/month · billed $81/year'}
          </span>
        </div>
        {billing === 'annual' && <div className={styles.saving}>You save $27/year</div>}

        <ul className={styles.features}>
          {[
            'Everything in Free',
            'Unlimited savings goals with projections',
            '6-month & annual trend reports',
            'Net worth tracker',
            'CSV/bank data upload',
            'Multiple budget frameworks (Dave Ramsey, FIRE)',
            'Priority email support',
          ].map(f => (
            <li key={f}><span className={styles.check}>✓</span>{f}</li>
          ))}
        </ul>

        <button
          className={styles.ctaBtn}
          onClick={() => { showToast('Payments coming soon!'); onClose() }}
        >
          Get Premium →
        </button>
        <div className={styles.note}>Cancel anytime · 7-day free trial · No credit card required</div>
      </div>
    </div>
  )
}
