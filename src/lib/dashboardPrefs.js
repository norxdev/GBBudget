// Default dashboard preferences
export const DEFAULT_PREFS = {
  // Widget visibility (free)
  showHealthScore: true,
  showKPIs: true,
  showInsights: true,
  showGoals: true,
  // Widget visibility (premium)
  showFramework: true,
  showCharts: true,
  showGreeting: true,
  // Widget order (premium) - array of widget IDs
  widgetOrder: ['health', 'kpis', 'framework', 'charts', 'insights', 'goals'],
  // KPI selection (premium) - which 6 to show
  selectedKPIs: ['income', 'expenses', 'savings', 'savingsRate', 'remaining', 'goals'],
  // Chart preferences (premium)
  chartRange: 6, // months
  categoryChartType: 'donut', // donut | bar
}

export const ALL_KPIS = [
  { id: 'income',       label: 'Monthly Income' },
  { id: 'expenses',     label: 'Total Expenses' },
  { id: 'savings',      label: 'Monthly Savings' },
  { id: 'savingsRate',  label: 'Savings Rate' },
  { id: 'remaining',    label: 'Remaining' },
  { id: 'goals',        label: 'Active Goals' },
  { id: 'largestExp',   label: 'Largest Expense' },
  { id: 'avgDaily',     label: 'Avg Daily Spend' },
  { id: 'needsRatio',   label: 'Needs Ratio' },
  { id: 'wantsRatio',   label: 'Wants Ratio' },
]

export const WIDGET_LABELS = {
  health:    'Health Score',
  kpis:      'Key Metrics',
  framework: '50/30/20 Framework',
  charts:    'Charts',
  insights:  'Insights',
  goals:     'Savings Goals',
}

export function mergePrefs(saved) {
  return { ...DEFAULT_PREFS, ...(saved || {}) }
}

export function isKPISelected(prefs, id) {
  return (prefs.selectedKPIs || DEFAULT_PREFS.selectedKPIs).includes(id)
}
