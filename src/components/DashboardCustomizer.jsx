import { useState } from 'react'
import { ALL_KPIS, WIDGET_LABELS, DEFAULT_PREFS } from '../lib/dashboardPrefs'
import { isPremium } from '../lib/plans'
import styles from './DashboardCustomizer.module.css'

export default function DashboardCustomizer({ prefs, onUpdate, onClose, profile, onUpgrade }) {
  const premium = isPremium(profile)
  const [localPrefs, setLocalPrefs] = useState({ ...prefs })
  const [dragOver, setDragOver] = useState(null)
  const [dragging, setDragging] = useState(null)

  function update(key, value) {
    setLocalPrefs(p => ({ ...p, [key]: value }))
  }

  function toggleKPI(id) {
    if (!premium) { onUpgrade(); return }
    const current = localPrefs.selectedKPIs || DEFAULT_PREFS.selectedKPIs
    if (current.includes(id)) {
      if (current.length <= 2) return // minimum 2 KPIs
      update('selectedKPIs', current.filter(k => k !== id))
    } else {
      if (current.length >= 6) return // maximum 6 KPIs
      update('selectedKPIs', [...current, id])
    }
  }

  function handleDragStart(e, id) {
    if (!premium) { e.preventDefault(); onUpgrade(); return }
    setDragging(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, id) {
    e.preventDefault()
    setDragOver(id)
  }

  function handleDrop(e, targetId) {
    e.preventDefault()
    if (!dragging || dragging === targetId) { setDragging(null); setDragOver(null); return }
    const order = [...(localPrefs.widgetOrder || DEFAULT_PREFS.widgetOrder)]
    const fromIdx = order.indexOf(dragging)
    const toIdx = order.indexOf(targetId)
    order.splice(fromIdx, 1)
    order.splice(toIdx, 0, dragging)
    update('widgetOrder', order)
    setDragging(null)
    setDragOver(null)
  }

  function handleSave() {
    onUpdate(localPrefs)
    onClose()
  }

  function handleReset() {
    setLocalPrefs({ ...DEFAULT_PREFS })
  }

  const widgetOrder = localPrefs.widgetOrder || DEFAULT_PREFS.widgetOrder
  const selectedKPIs = localPrefs.selectedKPIs || DEFAULT_PREFS.selectedKPIs

  // Free toggles
  const FREE_TOGGLES = [
    { key: 'showHealthScore', label: 'Health Score card' },
    { key: 'showKPIs',        label: 'Key metrics row' },
    { key: 'showInsights',    label: 'Insights panel' },
    { key: 'showGoals',       label: 'Savings goals preview' },
    { key: 'showGreeting',    label: 'Greeting message' },
  ]

  // Premium toggles
  const PREMIUM_TOGGLES = [
    { key: 'showFramework', label: '50/30/20 framework' },
    { key: 'showCharts',    label: 'Charts section' },
  ]

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>Customize Dashboard</div>
            <div className={styles.drawerSub}>Changes save when you click Apply</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.drawerBody}>

          {/* Section visibility — free */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Section Visibility</div>
            <div className={styles.sectionHint}>Choose which sections to show on your dashboard</div>
            {FREE_TOGGLES.map(t => (
              <div key={t.key} className={styles.toggleRow}>
                <span className={styles.toggleLabel}>{t.label}</span>
                <button
                  className={`${styles.toggle} ${localPrefs[t.key] !== false ? styles.toggleOn : ''}`}
                  onClick={() => update(t.key, localPrefs[t.key] === false ? true : false)}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
            ))}
            {PREMIUM_TOGGLES.map(t => (
              <div key={t.key} className={`${styles.toggleRow} ${!premium ? styles.lockedRow : ''}`} onClick={!premium ? onUpgrade : undefined}>
                <span className={styles.toggleLabel}>
                  {t.label}
                  {!premium && <span className={styles.lockTag}>Premium</span>}
                </span>
                <button
                  className={`${styles.toggle} ${premium && localPrefs[t.key] !== false ? styles.toggleOn : ''} ${!premium ? styles.toggleLocked : ''}`}
                  onClick={e => { e.stopPropagation(); if (!premium) { onUpgrade(); return } update(t.key, localPrefs[t.key] === false ? true : false) }}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
            ))}
          </div>

          {/* Widget order — premium */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>
              Section Order
              {!premium && <span className={styles.premiumPill}>Premium</span>}
            </div>
            <div className={styles.sectionHint}>
              {premium ? 'Drag to reorder sections' : 'Upgrade to reorder sections'}
            </div>
            <div className={styles.orderList}>
              {widgetOrder.map(id => (
                <div
                  key={id}
                  className={`${styles.orderItem} ${!premium ? styles.orderItemLocked : ''} ${dragOver === id ? styles.orderItemDragOver : ''} ${dragging === id ? styles.orderItemDragging : ''}`}
                  draggable={premium}
                  onDragStart={e => handleDragStart(e, id)}
                  onDragOver={e => handleDragOver(e, id)}
                  onDrop={e => handleDrop(e, id)}
                  onDragEnd={() => { setDragging(null); setDragOver(null) }}
                  onClick={!premium ? onUpgrade : undefined}
                >
                  <span className={styles.dragHandle}>{premium ? '⠿' : '🔒'}</span>
                  <span className={styles.orderLabel}>{WIDGET_LABELS[id]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* KPI selection — premium */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>
              Key Metrics
              {!premium && <span className={styles.premiumPill}>Premium</span>}
            </div>
            <div className={styles.sectionHint}>
              {premium
                ? `Select up to 6 metrics to display (${selectedKPIs.length}/6 selected)`
                : 'Upgrade to choose which metrics to display'}
            </div>
            <div className={styles.kpiGrid}>
              {ALL_KPIS.map(kpi => {
                const selected = selectedKPIs.includes(kpi.id)
                const maxed = selectedKPIs.length >= 6 && !selected
                return (
                  <button
                    key={kpi.id}
                    className={`${styles.kpiChip} ${selected ? styles.kpiChipOn : ''} ${!premium ? styles.kpiChipLocked : ''} ${maxed ? styles.kpiChipMaxed : ''}`}
                    onClick={() => toggleKPI(kpi.id)}
                    title={!premium ? 'Upgrade to customize metrics' : maxed ? 'Max 6 metrics selected' : ''}
                  >
                    {!premium && <span className={styles.chipLock}>🔒</span>}
                    {kpi.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chart preferences — premium */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>
              Chart Preferences
              {!premium && <span className={styles.premiumPill}>Premium</span>}
            </div>

            <div className={`${styles.prefRow} ${!premium ? styles.prefRowLocked : ''}`} onClick={!premium ? onUpgrade : undefined}>
              <span className={styles.prefLabel}>History range</span>
              <div className={styles.segmented}>
                {[3, 6, 12].map(n => (
                  <button
                    key={n}
                    className={`${styles.segBtn} ${localPrefs.chartRange === n ? styles.segBtnOn : ''}`}
                    onClick={e => { e.stopPropagation(); if (!premium) { onUpgrade(); return } update('chartRange', n) }}
                  >
                    {n}mo
                  </button>
                ))}
              </div>
            </div>

            <div className={`${styles.prefRow} ${!premium ? styles.prefRowLocked : ''}`} onClick={!premium ? onUpgrade : undefined}>
              <span className={styles.prefLabel}>Category chart</span>
              <div className={styles.segmented}>
                {['donut', 'bar'].map(t => (
                  <button
                    key={t}
                    className={`${styles.segBtn} ${localPrefs.categoryChartType === t ? styles.segBtnOn : ''}`}
                    onClick={e => { e.stopPropagation(); if (!premium) { onUpgrade(); return } update('categoryChartType', t) }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!premium && (
            <div className={styles.upgradeBanner}>
              <div className={styles.upgradeBannerTitle}>Unlock full customization</div>
              <div className={styles.upgradeBannerSub}>Reorder sections, choose metrics, and set chart preferences with Premium.</div>
              <button className={styles.upgradeBtn} onClick={onUpgrade}>Upgrade — $1/month →</button>
            </div>
          )}
        </div>

        <div className={styles.drawerFooter}>
          <button className={styles.resetBtn} onClick={handleReset}>Reset to default</button>
          <button className={styles.applyBtn} onClick={handleSave}>Apply changes</button>
        </div>
      </div>
    </div>
  )
}
