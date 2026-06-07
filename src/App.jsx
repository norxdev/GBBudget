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
  const [isSharedLink, setIsSharedLink] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const hasCheckout = urlParams.has('checkout')
    const hasTool = urlParams.has('tool')

    if (hasTool && !hasCheckout) {
      const shareParams = parseShareParams()
      if (shareParams) {
        setInitialShareParams(shareParams)
        setIsSharedLink(true)
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

  // Fix #2: if a shared link is detected and no session, auto-enter guest mode
  // so the user lands on the tool instead of the login page
  if (session || guestMode || isSharedLink) {
    return (
      <AppShell
        session={session}
        isGuest={!session}
        isSharedLink={isSharedLink}
        onSignOut={() => { setGuestMode(false); setIsSharedLink(false) }}
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
