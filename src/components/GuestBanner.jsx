import { useState } from 'react'
import styles from './GuestBanner.module.css'

export default function GuestBanner({ onSignUp }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className={styles.banner}>
      <div className={styles.left}>
        <span className={styles.icon}>💾</span>
        <div>
          <strong>You're using Clarity as a guest.</strong>
          <span className={styles.sub}> Data is saved to this browser only and will be lost if you clear your cache.</span>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.signUpBtn} onClick={onSignUp}>Save my data →</button>
        <button className={styles.dismissBtn} onClick={() => setDismissed(true)}>✕</button>
      </div>
    </div>
  )
}
