const BASE_URL = 'https://norxdev.github.io/GBBudget'

export function buildAffordabilityShareUrl(result, purchaseLabel) {
  const params = new URLSearchParams({
    tool: 'afford',
    score: result.score,
    verdict: result.verdictColor,
    label: purchaseLabel || 'Purchase',
    cf: result.newCashFlow,
    ri: result.recurringVsIncome,
    pvi: result.priceVsIncome,
  })
  return `${BASE_URL}?${params.toString()}`
}

export function buildHealthShareUrl(score, grade, savingsRate) {
  const params = new URLSearchParams({ tool: 'health', score, grade, sr: savingsRate })
  return `${BASE_URL}?${params.toString()}`
}

export function buildDebtShareUrl(result, debtType, balance) {
  const params = new URLSearchParams({
    tool: 'debt',
    type: debtType,
    months: result.months,
    date: result.payoffDate,
    interest: result.totalInterest,
  })
  return `${BASE_URL}?${params.toString()}`
}

export function buildSavingsShareUrl(result, goalType) {
  const params = new URLSearchParams({
    tool: 'savings',
    type: goalType,
    months: result.months || 0,
    date: result.projectedDate || '',
    pct: result.pct,
  })
  return `${BASE_URL}?${params.toString()}`
}

export function parseShareParams() {
  const params = new URLSearchParams(window.location.search)
  const tool = params.get('tool')
  if (!tool) return null
  if (tool === 'afford') {
    return {
      tool: 'afford',
      score: Number(params.get('score')),
      verdictColor: params.get('verdict'),
      newCashFlow: Number(params.get('cf')),
      recurringVsIncome: Number(params.get('ri')),
      priceVsIncome: Number(params.get('pvi')),
      label: params.get('label'),
    }
  }
  if (tool === 'health') {
    return { tool: 'health', score: Number(params.get('score')), grade: params.get('grade'), savingsRate: Number(params.get('sr')) }
  }
  if (tool === 'debt') {
    return { tool: 'debt', debtType: params.get('type'), months: Number(params.get('months')), payoffDate: params.get('date'), totalInterest: Number(params.get('interest')) }
  }
  if (tool === 'savings') {
    return { tool: 'savings', goalType: params.get('type'), months: Number(params.get('months')), projectedDate: params.get('date'), pct: Number(params.get('pct')) }
  }
  return null
}

export function shareToTwitter(text, url) {
  const encoded = encodeURIComponent(`${text} ${url}`)
  window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank')
}

export function shareToWhatsApp(text, url) {
  const encoded = encodeURIComponent(`${text} ${url}`)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return true
  }
}
