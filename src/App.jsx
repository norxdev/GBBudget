import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import AppShell from './pages/AppShell'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        supabase.auth.signOut()
        setSession(null)
      } else {
        // Verify session is still valid against Supabase
        supabase.auth.getUser().then(({ data: { user }, error }) => {
          if (error || !user) {
            supabase.auth.signOut()
            setSession(null)
          } else {
            setSession(session)
          }
          setLoading(false)
        })
      }
      if (error || !session) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        fontFamily: "'Instrument Serif', serif",
        fontSize: '28px',
        color: 'var(--text-muted)'
      }}>
        Clarity
      </div>
    )
  }

  return session ? <AppShell session={session} /> : <LoginPage />
}
