import { useState } from 'react'
import { copyToClipboard, shareToTwitter, shareToWhatsApp } from '../lib/share'
import styles from './ShareCard.module.css'

export default function ShareCard({ url, twitterText, whatsappText, onClose }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await copyToClipboard(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>Share your result</div>
      <div className={styles.urlBox}>
        <span className={styles.urlText}>{url.replace('https://', '')}</span>
        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div className={styles.socialRow}>
        <button className={styles.socialBtn} onClick={() => shareToTwitter(twitterText, url)}>
          <span>𝕏</span> Share on X
        </button>
        <button className={styles.socialBtn} onClick={() => shareToWhatsApp(whatsappText, url)}>
          <span>💬</span> WhatsApp
        </button>
      </div>
      <div className={styles.note}>No personal financial data is shared — only your score and result.</div>
    </div>
  )
}
