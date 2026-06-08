import { useState } from 'react'
import ToolsHub from './tools/ToolsHub'
import DebtPayoff from './tools/DebtPayoff'
import SavingsGoalCalc from './tools/SavingsGoalCalc'
import BudgetHealthCheck from './tools/BudgetHealthCheck'
import Affordability from './Affordability'
import styles from './Tools.module.css'

const TOOL_NAMES = {
  affordability: 'Affordability Analyzer',
  debt:          'Debt Payoff Calculator',
  savings:       'Savings Goal Calculator',
  health:        'Budget Health Check',
}

export default function Tools({ session, isGuest, profile, showToast, onUpgrade, onTabChange, initialShareParams }) {
  const [activeTool, setActiveTool] = useState(
    initialShareParams?.tool === 'afford'  ? 'affordability' :
    initialShareParams?.tool === 'debt'    ? 'debt' :
    initialShareParams?.tool === 'savings' ? 'savings' :
    initialShareParams?.tool === 'health'  ? 'health' : null
  )

  function handleSelectTool(id) {
    setActiveTool(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    setActiveTool(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const sharedProps = { session, isGuest, profile, showToast, onUpgrade, onTabChange }

  return (
    <div>
      {/* Back bar renders above content — not sticky, no overlap */}
      {activeTool && (
        <div className={styles.backBar}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← Tools
          </button>
          <span className={styles.separator}>/</span>
          <span className={styles.backLabel}>{TOOL_NAMES[activeTool]}</span>
        </div>
      )}

      <div className={styles.toolContent}>
        {!activeTool && <ToolsHub onSelectTool={handleSelectTool} />}

        {activeTool === 'affordability' && (
          <Affordability {...sharedProps} initialShareParams={initialShareParams} />
        )}
        {activeTool === 'debt' && (
          <DebtPayoff {...sharedProps} initialShareParams={initialShareParams} />
        )}
        {activeTool === 'savings' && (
          <SavingsGoalCalc {...sharedProps} initialShareParams={initialShareParams} />
        )}
        {activeTool === 'health' && (
          <BudgetHealthCheck {...sharedProps} initialShareParams={initialShareParams} />
        )}
      </div>
    </div>
  )
}
