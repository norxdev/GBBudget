// Sharing utilities - encodes results in URL, no sensitive data exposed

const BASE_URL = 'https://norxdev.github.io/GBBudget'

// Affordability share
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

// Health score share
export function buildHealthShareUrl(score, grade, savingsRate) {
  const params = new URLSearchParams({
    tool: 'health',
    score,
    grade,
    sr: savingsRate,
  })
  return `${BASE_URL}?${params.toString()}`
}

// Parse share params from URL on load
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
    return {
      tool: 'health',
      score: Number(params.get('score')),
      grade: params.get('grade'),
      savingsRate: Number(params.get('sr')),
    }
  }

  return null
}

// Social share helpers
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
    // Fallback
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return true
  }
}
