import { useState } from 'react'
import { buildHealthShareUrl } from '../../lib/share'
import ShareCard from '../../components/ShareCard'
import styles from './Tool.module.css'

const QUESTIONS = [
  {
    id: 'savings',
    question: 'What percentage of your income do you save each month?',
    options: [
      { label: 'Nothing', score: 0 },
      { label: 'Less than 5%', score: 10 },
      { label: '5–10%', score: 40 },
      { label: '10–20%', score: 70 },
      { label: '20% or more', score: 100 },
    ]
  },
  {
    id: 'emergency',
    question: 'How many months of expenses do you have saved as an emergency fund?',
    options: [
      { label: 'None', score: 0 },
      { label: 'Less than 1 month', score: 15 },
      { label: '1–2 months', score: 40 },
      { label: '3–5 months', score: 80 },
      { label: '6+ months', score: 100 },
    ]
  },
  {
    id: 'debt',
    question: 'How much of your income goes to debt payments (excluding mortgage)?',
    options: [
      { label: 'No debt payments', score: 100 },
      { label: 'Less than 10%', score: 80 },
      { label: '10–20%', score: 50 },
      { label: '20–35%', score: 20 },
      { label: 'More than 35%', score: 0 },
    ]
  },
  {
    id: 'budget',
    question: 'Do you track your spending and follow a budget?',
    options: [
      { label: 'No budget at all', score: 0 },
      { label: 'Loosely in my head', score: 25 },
      { label: 'Sometimes track it', score: 50 },
      { label: 'Track regularly', score: 75 },
      { label: 'Follow a detailed budget', score: 100 },
    ]
  },
  {
    id: 'goals',
    question: 'Do you have financial goals you are actively working toward?',
    options: [
      { label: 'No goals set', score: 0 },
      { label: 'Vague ideas, nothing tracked', score: 25 },
      { label: '1–2 goals with some savings', score: 60 },
      { label: 'Multiple goals actively tracked', score: 85 },
      { label: 'Goals with detailed plans', score: 100 },
    ]
  },
]

const WEIGHTS = { savings: 0.30, emergency: 0.25, debt: 0.20, budget: 0.15, goals: 0.10 }

function calcScore(answers) {
  return Math.round(
    QUESTIONS.reduce((total, q) => {
      const ans = answers[q.id]
      return total + (ans ? ans.score * WEIGHTS[q.id] : 0)
    }, 0)
  )
}

function getGrade(score) {
  if (score >= 90) return { grade: 'A',  label: 'Excellent',   bg: 'linear-gradient(135deg,#2D6A4F,#40916C)' }
  if (score >= 80) return { grade: 'B+', label: 'Very Good',   bg: 'linear-gradient(135deg,#2D6A4F,#40916C)' }
  if (score >= 70) return { grade: 'B',  label: 'Good',        bg: 'linear-gradient(135deg,#2D6A4F,#40916C)' }
  if (score >= 60) return { grade: 'C+', label: 'Fair',        bg: 'linear-gradient(135deg,#B7791F,#D4A017)' }
  if (score >= 50) return { grade: 'C',  label: 'Needs Work',  bg: 'linear-gradient(135deg,#B7791F,#D4A017)' }
  if (score >= 40) return { grade: 'D',  label: 'At Risk',     bg: 'linear-gradient(135deg,#9B2335,#C0392B)' }
  return              { grade: 'F',  label: 'Critical',    bg: 'linear-gradient(135deg,#7B1921,#9B2335)' }
}

function getInsights(answers) {
  const insights = []
  const s = answers.savings?.score || 0
  const e = answers.emergency?.score || 0
  const d = answers.debt?.score || 0
  const b = answers.budget?.score || 0

  if (s < 70) insights.push({ type: 'warning', text: 'Your savings rate is below the recommended 20%. Even small increases compound significantly over time.' })
  else insights.push({ type: 'good', text: 'Your savings rate is strong — you\'re building real financial security.' })

  if (e < 40) insights.push({ type: 'warning', text: 'Your emergency fund is underfunded. Aim for 3–6 months of expenses before investing elsewhere.' })
  else insights.push({ type: 'good', text: 'Your emergency fund gives you a solid safety net.' })

  if (d < 50) insights.push({ type: 'warning', text: 'High debt payments are limiting your flexibility. Consider paying down high-interest debt first.' })
  else if (d === 100) insights.push({ type: 'good', text: 'Being debt-free (outside mortgage) is a major financial advantage.' })

  if (b < 50) insights.push({ type: 'action', text: 'Tracking your spending is the single most impactful financial habit. Even 10 minutes a week makes a difference.' })

  return insights
}

export default function BudgetHealthCheck({ isGuest, onTabChange }) {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)

  const answered = Object.keys(answers).length
  const allAnswered = answered === QUESTIONS.length

  function selectAnswer(qId, option) {
    setAnswers(a => ({ ...a, [qId]: option }))
    if (currentQ < QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQ(q => q + 1), 280)
    }
  }

  function calculate() {
    const score = calcScore(answers)
    const { grade, label, bg } = getGrade(score)
    setResult({ score, grade, label, bg, insights: getInsights(answers) })
    setShowShare(false)
    setTimeout(() => document.getElementById('tool-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  function reset() {
    setAnswers({}); setResult(null); setCurrentQ(0); setShowShare(false)
  }

  const shareUrl = result ? buildHealthShareUrl(result.score, result.grade, 0) : ''

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Budget Health Check</h1>
          <p>5 quick questions to score your financial health — no account needed</p>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.inputPanel}>
          <div className={styles.quizProgress}>
            {QUESTIONS.map((q, i) => (
              <button key={q.id}
                className={`${styles.quizDot} ${answers[q.id] ? styles.quizDotDone : ''} ${currentQ === i ? styles.quizDotActive : ''}`}
                onClick={() => setCurrentQ(i)}
              />
            ))}
          </div>

          {QUESTIONS.map((q, i) => (
            <div key={q.id} className={styles.card} style={{ display: currentQ === i ? 'block' : 'none' }}>
              <div className={styles.questionNum}>Question {i + 1} of {QUESTIONS.length}</div>
              <div className={styles.questionText}>{q.question}</div>
              <div className={styles.optionsList}>
                {q.options.map(opt => (
                  <button key={opt.label}
                    className={`${styles.optionBtn} ${answers[q.id]?.label === opt.label ? styles.optionSelected : ''}`}
                    onClick={() => selectAnswer(q.id, opt)}
                  >
                    <span className={styles.optionCheck}>{answers[q.id]?.label === opt.label ? '●' : '○'}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {allAnswered && !result && (
            <button className={styles.analyzeBtn} onClick={calculate}>Get my score →</button>
          )}
        </div>

        <div className={styles.resultPanel} id="tool-result">
          {!result ? (
            <div className={styles.emptyResult}>
              <div className={styles.emptyIcon}>❓</div>
              <h3>Answer all 5 questions</h3>
              <p>Your financial health score will appear here. Takes less than a minute.</p>
              <div className={styles.quizAnsweredCount}>{answered}/{QUESTIONS.length} answered</div>
            </div>
          ) : (
            <>
              <div className={styles.scoreCard} style={{ background: result.bg }}>
                <div className={styles.scoreLabel}>Financial Health Score</div>
                <div className={styles.scoreNum}>{result.score}</div>
                <div className={styles.scoreGrade}>{result.grade} — {result.label}</div>
                <div className={styles.scoreMeter}>
                  <div className={styles.scoreFill} style={{ width: result.score + '%' }} />
                </div>
              </div>

              <div className={styles.answerSummary}>
                {QUESTIONS.map(q => {
                  const ans = answers[q.id]
                  return (
                    <div key={q.id} className={styles.answerRow}>
                      <div className={styles.answerQ}>{q.question}</div>
                      <div className={styles.answerA}>{ans?.label}</div>
                      <div className={styles.answerScore} style={{ color: ans?.score >= 70 ? 'var(--accent)' : ans?.score >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                        {ans?.score}/100
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className={styles.insightsList}>
                {result.insights.map((ins, i) => (
                  <div key={i} className={`${styles.insightItem} ${styles['ins_' + ins.type]}`}>
                    <span className={styles.insightIcon}>{ins.type === 'good' ? '✓' : ins.type === 'warning' ? '⚠' : '→'}</span>
                    {ins.text}
                  </div>
                ))}
              </div>

              <button className={styles.shareToggleBtn} onClick={() => setShowShare(s => !s)}>
                {showShare ? 'Hide share options' : 'Share your score'}
              </button>
              {showShare && (
                <ShareCard
                  url={shareUrl}
                  twitterText={`My financial health score is ${result.score}/100 (${result.grade}) — ${result.label}. What's yours?`}
                  whatsappText={`I just scored my financial health: ${result.score}/100 (${result.grade}). Try it:`}
                />
              )}

              <button className={styles.resetBtn} onClick={reset}>Retake the quiz</button>

              {isGuest && (
                <div className={styles.ctaBanner}>
                  <span>Track your score over time with a free account</span>
                  <button onClick={() => window.location.reload()}>Sign up free</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
