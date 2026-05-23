import styles from './SignUpPrompt.module.css'

export default function SignUpPrompt({ onSignUp, onClose, reason }) {
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose}>×</button>
        <div className={styles.icon}>🔒</div>
        <h2>Create a free account</h2>
        <p>{reason || 'Sign up to unlock this feature and save your data permanently.'}</p>
        <ul className={styles.perks}>
          <li><span>✓</span> Save your budget data permanently</li>
          <li><span>✓</span> Access reports and exports</li>
          <li><span>✓</span> Track multiple months</li>
          <li><span>✓</span> Set and track savings goals</li>
          <li><span>✓</span> Financial health score history</li>
        </ul>
        <button className={styles.signUpBtn} onClick={onSignUp}>Create free account →</button>
        <div className={styles.signin}>Already have an account? <span onClick={onSignUp}>Sign in</span></div>
      </div>
    </div>
  )
}
