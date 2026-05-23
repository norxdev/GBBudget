import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './LoginPage.module.css'

export default function LoginPage({ onGuestMode }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setMessage(''); setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
      })
      if (error) { setError(error.message) }
      else { setMessage('Account created! Check your email to confirm, then sign in.'); setMode('login') }
    }
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.logo}>
          <div className={styles.wordmark}>Clarity</div>
          <div className={styles.tagline}>Your personal budget, made simple.</div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className={styles.cardSub}>{mode === 'login' ? 'Sign in to your account to continue' : 'Start budgeting smarter in minutes'}</p>

          {error && <div className={styles.errorBanner}>{error}</div>}
          {message && <div className={styles.successBanner}>{message}</div>}

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className={styles.formGroup}>
                <label>Full name</label>
                <input type="text" placeholder="Alex Smith" value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
            )}
            <div className={styles.formGroup}>
              <label>Email address</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className={styles.divider}><span>or</span></div>

          <button className={styles.guestBtn} onClick={onGuestMode}>
            Try without an account
          </button>
          <div className={styles.guestNote}>
            Your data saves to this browser only — create an account anytime to keep it permanently.
          </div>
        </div>

        <div className={styles.footer}>
          {mode === 'login' ? (
            <>Don't have an account? <span onClick={() => { setMode('signup'); setError(''); setMessage('') }}>Create one free →</span></>
          ) : (
            <>Already have an account? <span onClick={() => { setMode('login'); setError(''); setMessage('') }}>Sign in →</span></>
          )}
        </div>
      </div>
    </div>
  )
}
