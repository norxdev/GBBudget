import styles from './ToolsHub.module.css'

const TOOLS = [
  {
    id: 'affordability',
    icon: '◎',
    title: 'Affordability Analyzer',
    desc: 'See the real financial impact of any purchase before you commit',
    tag: null,
    free: true,
  },
  {
    id: 'debt',
    icon: '📅',
    title: 'Debt Payoff Calculator',
    desc: 'Find out when you\'ll be debt free and how much interest you\'ll pay',
    tag: 'Popular',
    free: true,
  },
  {
    id: 'savings',
    icon: '🎯',
    title: 'Savings Goal Calculator',
    desc: 'See when you\'ll reach your goal and how much to save each month',
    tag: null,
    free: true,
  },
  {
    id: 'health',
    icon: '❓',
    title: 'Budget Health Check',
    desc: '5 quick questions to score your financial health — no account needed',
    tag: 'Shareable',
    free: true,
  },
]

export default function ToolsHub({ onSelectTool }) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Financial Tools</h1>
        <p>Free calculators and analyzers — no account needed. Get instant results you can share.</p>
      </div>

      <div className={styles.grid}>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={styles.toolCard}
            onClick={() => onSelectTool(tool.id)}
          >
            <div className={styles.toolTop}>
              <div className={styles.toolIcon}>{tool.icon}</div>
              {tool.tag && <span className={styles.toolTag}>{tool.tag}</span>}
            </div>
            <div className={styles.toolTitle}>{tool.title}</div>
            <div className={styles.toolDesc}>{tool.desc}</div>
            <div className={styles.toolCta}>Try it →</div>
          </button>
        ))}
      </div>

      <div className={styles.footer}>
        All tools work without an account. Create a free account to save results and track progress over time.
      </div>
    </div>
  )
}
