import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Dashboard from './Dashboard'
import Budget from './Budget'
import Goals from './Goals'
import Reports from './Reports'
import UpgradeModal from '../components/UpgradeModal'
import Toast from '../components/Toast'
import styles from './AppShell.module.css'

export default function AppShell({ session }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [toast, setToast] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (data) setProfile(data)
    }
    loadProfile()
  }, [session])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const displayName = profile?.full_name || session.user.email.split('@')[0]
  const initials = displayName.slice(0, 2).toUpperCase()

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'budget', label: 'Budget' },
    { id: 'goals', label: 'Savings Goals' },
    { id: 'reports', label: 'Reports' },
  ]

  const sharedProps = {
    session,
    showToast,
    onUpgrade: () => setShowUpgrade(true),
    onTabChange: setActiveTab,
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.topnav}>
        <div className={styles.navLogo}>Clarity</div>
        <div className={styles.navTabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.navTab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.navRight}>
          <div className={styles.navUser} onClick={() => setShowUpgrade(true)}>
            <div className={styles.avatar}>{initials}</div>
            <span className={styles.userName}>{displayName}</span>
            <span className={styles.badgeFree}>Free</span>
          </div>
          <button className={styles.signOutBtn} onClick={handleSignOut} title="Sign out">
            ↪
          </button>
        </div>
      </nav>

      <div className={styles.content}>
        {activeTab === 'dashboard' && <Dashboard {...sharedProps} />}
        {activeTab === 'budget'    && <Budget    {...sharedProps} />}
        {activeTab === 'goals'     && <Goals     {...sharedProps} />}
        {activeTab === 'reports'   && <Reports   {...sharedProps} />}
      </div>

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} showToast={showToast} />
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}
