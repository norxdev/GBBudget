import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { parseShareParams } from './lib/share'
import LoginPage from './pages/LoginPage'
import AppShell from './pages/AppShell'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guestMode, setGuestMode] = useState(false)
  const [initialShareParams, setInitialShareParams] = useState(null)

  useEffect(() => {
    // Parse URL params first — but only treat as share params if they
    // contain 'tool' key, not checkout keys, to avoid conflicts
    const urlParams = new URLSearchParams(window.location.search)
    const hasCheckout = urlParams.has('checkout')
    const hasTool = urlParams.has('tool')

    if (hasTool && !hasCheckout) {
      const shareParams = parseShareParams()
      if (shareParams) {
        setInitialShareParams(shareParams)
        window.history.replaceState({}, '', window.location.pathname)
      }
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          await supabase.auth.signOut()
          setSession(null)
        } else {
          setSession(session)
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) setGuestMode(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg)',
        fontFamily: "'Instrument Serif', serif", fontSize: '32px', color: 'var(--text-muted)'
      }}>
        Clarity
      </div>
    )
  }

  if (session || guestMode) {
    return (
      <AppShell
        session={session}
        isGuest={!session}
        onSignOut={() => setGuestMode(false)}
        initialShareParams={initialShareParams}
      />
    )
  }

  return (
    <LoginPage
      onGuestMode={() => setGuestMode(true)}
      initialShareParams={initialShareParams}
    />
  )
}
