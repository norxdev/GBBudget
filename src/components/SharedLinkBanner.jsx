import { useState } from 'react'
import styles from './SharedLinkBanner.module.css'

export default function SharedLinkBanner({ onSignUp, onDismiss }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div className={styles.banner}>
      <div className={styles.left}>
        <span className={styles.icon}>🔗</span>
        <div>
          <strong>You're viewing a shared result.</strong>
          <span className={styles.sub}> Create a free account to run your own analysis and track your finances over time.</span>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.signUpBtn} onClick={onSignUp}>Create free account</button>
        <button className={styles.dismissBtn} onClick={handleDismiss}>✕</button>
      </div>
    </div>
  )
}
