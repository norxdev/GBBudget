import { useState } from 'react'
import ToolsHub from './tools/ToolsHub'
import DebtPayoff from './tools/DebtPayoff'
import SavingsGoalCalc from './tools/SavingsGoalCalc'
import BudgetHealthCheck from './tools/BudgetHealthCheck'
import Affordability from './Affordability'
import styles from './Tools.module.css'

export default function Tools({ session, isGuest, profile, showToast, onUpgrade, onTabChange, initialShareParams }) {
  const [activeTool, setActiveTool] = useState(
    initialShareParams?.tool === 'afford' ? 'affordability' : null
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
      {activeTool && (
        <div className={styles.backBar}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← All Tools
          </button>
          <span className={styles.backLabel}>
            {activeTool === 'affordability' && 'Affordability Analyzer'}
            {activeTool === 'debt'          && 'Debt Payoff Calculator'}
            {activeTool === 'savings'       && 'Savings Goal Calculator'}
            {activeTool === 'health'        && 'Budget Health Check'}
          </span>
        </div>
      )}

      {!activeTool && (
        <ToolsHub onSelectTool={handleSelectTool} />
      )}
      {activeTool === 'affordability' && (
        <Affordability {...sharedProps} initialShareParams={initialShareParams} />
      )}
      {activeTool === 'debt' && (
        <DebtPayoff {...sharedProps} />
      )}
      {activeTool === 'savings' && (
        <SavingsGoalCalc {...sharedProps} />
      )}
      {activeTool === 'health' && (
        <BudgetHealthCheck {...sharedProps} />
      )}
    </div>
  )
}
