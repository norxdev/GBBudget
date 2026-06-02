import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Dashboard from './Dashboard'
import Budget from './Budget'
import Goals from './Goals'
import Reports from './Reports'
import Tools from './Tools'
import Profile from './Profile'
import UpgradeModal from '../components/UpgradeModal'
import Toast from '../components/Toast'
import GuestBanner from '../components/GuestBanner'
import SignUpPrompt from '../components/SignUpPrompt'
import styles from './AppShell.module.css'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'budget',    label: 'Budget',    icon: '≋' },
  { id: 'goals',     label: 'Goals',     icon: '◎' },
  { id: 'tools',     label: 'Tools',     icon: '⚡' },
  { id: 'reports',   label: 'Reports',   icon: '↓' },
]

export default function AppShell({ session, isGuest, onSignOut, initialShareParams }) {
  const [activeTab, setActiveTab] = useState(
    initialShareParams?.tool ? 'tools' : 'dashboard'
  )
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false)
  const [signUpPromptReason, setSignUpPromptReason] = useState('')
  const [toast, setToast] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (session) loadProfile()
  }, [session])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success' && session) {
      setTimeout(() => loadProfile(), 2500)
      window.history.replaceState({}, '', window.location.pathname)
      showToast('Welcome to Premium!')
    }
    if (params.get('checkout') === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname)
      showToast('Checkout cancelled')
    }
  }, [session])

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single()
    if (data) setProfile(data)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function requireAuth(reason, callback) {
    if (isGuest) {
      setSignUpPromptReason(reason)
      setShowSignUpPrompt(true)
      return false
    }
    callback?.()
    return true
  }

  function handleTabChange(tab) {
    if (isGuest && tab === 'reports') {
      setSignUpPromptReason('Reports are available to registered users. Create a free account to access monthly exports, category summaries, and more.')
      setShowSignUpPrompt(true)
      return
    }
    setActiveTab(tab)
    setShowProfile(false)
  }

  function handleSignOut() {
    if (session) supabase.auth.signOut()
    else onSignOut()
  }

  function handleSignUpFromPrompt() {
    setShowSignUpPrompt(false)
    handleSignOut()
  }

  const displayName = isGuest ? 'Guest' : (profile?.full_name || session?.user?.email?.split('@')[0] || 'User')
  const initials = isGuest ? 'G' : displayName.slice(0, 2).toUpperCase()
  const userIsPremium = profile?.plan === 'premium'

  const sharedProps = {
    session, isGuest, profile, showToast,
    onUpgrade: () => setShowUpgrade(true),
    onTabChange: handleTabChange,
    requireAuth,
    initialShareParams,
    onProfileUpdate: loadProfile,
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.topnav}>
        <div className={styles.navLogo}>Clarity</div>
        <div className={styles.navTabs}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`${styles.navTab} ${activeTab === tab.id && !showProfile ? styles.active : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
              {isGuest && tab.id === 'reports' && <span className={styles.lockDot} />}
            </button>
          ))}
        </div>
        <div className={styles.navRight}>
          <div
            className={`${styles.navUser} ${showProfile ? styles.navUserActive : ''}`}
            onClick={() => { setShowProfile(p => !p); setActiveTab('') }}
          >
            <div className={styles.avatar}>{initials}</div>
            <span className={styles.userName}>{displayName}</span>
            {isGuest
              ? <span className={styles.badgeGuest}>Guest</span>
              : <span className={`${styles.badgeFree} ${userIsPremium ? styles.badgePremium : ''}`}>
                  {userIsPremium ? 'Pro' : 'Free'}
                </span>
            }
          </div>
        </div>
      </nav>

      {isGuest && <GuestBanner onSignUp={handleSignUpFromPrompt} />}

      <div className={styles.content}>
        {showProfile && session && (
          <Profile
            session={session}
            profile={profile}
            onSignOut={handleSignOut}
            showToast={showToast}
            onProfileUpdate={loadProfile}
            onUpgrade={() => setShowUpgrade(true)}
          />
        )}
        {showProfile && isGuest && (
          <div style={{ padding: '60px 28px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Create an account to manage your profile.</p>
            <button onClick={handleSignUpFromPrompt} style={{ background: 'var(--text)', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Create free account</button>
          </div>
        )}
        {!showProfile && activeTab === 'dashboard' && <Dashboard {...sharedProps} />}
        {!showProfile && activeTab === 'budget'    && <Budget    {...sharedProps} />}
        {!showProfile && activeTab === 'goals'     && <Goals     {...sharedProps} />}
        {!showProfile && activeTab === 'tools'     && <Tools     {...sharedProps} />}
        {!showProfile && activeTab === 'reports' && !isGuest && <Reports {...sharedProps} />}
      </div>

      {/* Mobile bottom nav — 5 tabs */}
      <nav className={styles.bottomNav}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.bottomNavTab} ${activeTab === tab.id && !showProfile ? styles.active : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className={styles.bottomNavIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {showUpgrade && (
        <UpgradeModal
          session={session}
          profile={profile}
          onClose={() => setShowUpgrade(false)}
          showToast={showToast}
          onSuccess={loadProfile}
        />
      )}
      {showSignUpPrompt && (
        <SignUpPrompt
          reason={signUpPromptReason}
          onSignUp={handleSignUpFromPrompt}
          onClose={() => setShowSignUpPrompt(false)}
        />
      )}
      {toast && <Toast message={toast} />}
    </div>
  )
}
