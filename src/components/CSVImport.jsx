import { useState, useRef } from 'react'
import { isPremium } from '../lib/plans'
import styles from './CSVImport.module.css'

const FREE_ROW_LIMIT = 10

const EXPENSE_CATS = ['Housing','Food','Transport','Healthcare','Entertainment','Subscriptions','Dining','Shopping','Other']
const INCOME_CATS  = ['Employment','Freelance','Investment','Rental','Other']
const SAVINGS_CATS = ['Emergency','Investment','Travel','Major Purchase','Retirement','Other']
const ENTRY_TYPES  = ['income','expense','savings']
const FREQUENCIES  = ['recurring','one-time']

function guessField(header) {
  const h = header.toLowerCase().trim()
  if (['description','name','item','details','memo','narration','payee','note'].some(k => h.includes(k))) return 'description'
  if (['amount','sum','value','price','cost','debit','credit','payment'].some(k => h.includes(k))) return 'amount'
  if (['type','kind','flow','direction','in/out','inout','category type'].some(k => h.includes(k))) return 'entry_type'
  if (['category','cat','group','tag','label'].some(k => h.includes(k))) return 'category'
  if (['frequency','freq','recurring','schedule'].some(k => h.includes(k))) return 'frequency'
  return 'ignore'
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  const rows = lines.slice(1).map(line => {
    const vals = []
    let inQuote = false, cur = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    vals.push(cur.trim())
    return headers.reduce((obj, h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, ''); return obj }, {})
  }).filter(r => Object.values(r).some(v => v))
  return { headers, rows }
}

function cleanAmount(val) {
  if (!val) return ''
  return String(val).replace(/[$,\s]/g, '')
}

function matchCategory(val) {
  if (!val) return 'Other'
  const v = val.toLowerCase()
  if (['rent','mortgage','housing','home'].some(k => v.includes(k))) return 'Housing'
  if (['grocery','groceries','supermarket','food'].some(k => v.includes(k))) return 'Food'
  if (['dining','restaurant','cafe','coffee','takeout','eat'].some(k => v.includes(k))) return 'Dining'
  if (['transport','gas','fuel','uber','lyft','car','transit','parking'].some(k => v.includes(k))) return 'Transport'
  if (['netflix','spotify','subscription','hulu','disney','amazon prime'].some(k => v.includes(k))) return 'Subscriptions'
  if (['health','gym','medical','doctor','pharmacy'].some(k => v.includes(k))) return 'Healthcare'
  if (['salary','payroll','paycheck','wage'].some(k => v.includes(k))) return 'Employment'
  if (['freelance','contract','consulting','gig'].some(k => v.includes(k))) return 'Freelance'
  if (['entertainment','movie','game','fun'].some(k => v.includes(k))) return 'Entertainment'
  if (['shopping','amazon','retail','clothes'].some(k => v.includes(k))) return 'Shopping'
  if (['emergency','rainy day'].some(k => v.includes(k))) return 'Emergency'
  if (['invest','stock','fund','401k','retirement'].some(k => v.includes(k))) return 'Investment'
  return 'Other'
}

function guessEntryType(val) {
  if (!val) return null // null = unknown, shown as warning
  const v = val.toLowerCase().trim()
  if (['income','in','credit','deposit','salary','earning','received','revenue'].some(k => v.includes(k))) return 'income'
  if (['saving','savings','save','transfer to savings'].some(k => v.includes(k))) return 'savings'
  if (['expense','out','debit','payment','spend','cost','charge'].some(k => v.includes(k))) return 'expense'
  return null // couldn't determine
}

function downloadTemplate() {
  const csv = [
    'Description,Amount,Type,Category,Frequency',
    'Salary,5000,income,Employment,recurring',
    'Rent,2200,expense,Housing,recurring',
    'Groceries,400,expense,Food,recurring',
    'Emergency Fund,300,savings,Emergency,recurring',
    'Freelance work,800,income,Freelance,one-time',
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'clarity-budget-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function CSVImport({ profile, month, existingRowCount, onImport, onClose, onUpgrade }) {
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [globalType, setGlobalType] = useState('expense')
  const [useGlobalType, setUseGlobalType] = useState(false)
  const [importMode, setImportMode] = useState('add')
  const [preview, setPreview] = useState([])
  const [rowOverrides, setRowOverrides] = useState({}) // per-row type overrides
  const fileRef = useRef()
  const premium = isPremium(profile)

  // How many rows can still be added
  const existingCount = importMode === 'replace' ? 0 : (existingRowCount || 0)
  const availableRows = premium ? Infinity : Math.max(0, FREE_ROW_LIMIT - existingCount)
  const atLimit = !premium && existingCount >= FREE_ROW_LIMIT && importMode === 'add'

  function handleFile(e) {
    const f = e.target.files?.[0] || e
    if (!f || !f.name) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = evt => {
      const { headers, rows } = parseCSV(evt.target.result)
      if (!headers.length) return
      const guessed = {}
      headers.forEach(h => { guessed[h] = guessField(h) })
      setMapping(guessed)
      setParsed({ headers, rows })
      const hasTypeCol = Object.values(guessed).includes('entry_type')
      setUseGlobalType(!hasTypeCol)
      setStep('map')
    }
    reader.readAsText(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function buildPreview() {
    const descKey  = Object.keys(mapping).find(h => mapping[h] === 'description')
    const amtKey   = Object.keys(mapping).find(h => mapping[h] === 'amount')
    const typeKey  = Object.keys(mapping).find(h => mapping[h] === 'entry_type')
    const catKey   = Object.keys(mapping).find(h => mapping[h] === 'category')
    const freqKey  = Object.keys(mapping).find(h => mapping[h] === 'frequency')

    const rows = parsed.rows.map((row, i) => {
      const desc    = descKey  ? row[descKey]  : ''
      const amtRaw  = amtKey   ? row[amtKey]   : ''
      const typeRaw = typeKey  ? row[typeKey]  : ''
      const catRaw  = catKey   ? row[catKey]   : ''
      const freqRaw = freqKey  ? row[freqKey]  : ''

      const detectedType = useGlobalType ? globalType : guessEntryType(typeRaw)
      const entryType    = detectedType || 'expense' // fallback
      const needsReview  = !useGlobalType && detectedType === null

      const amount    = cleanAmount(amtRaw)
      const category  = catRaw ? matchCategory(catRaw) : (entryType === 'income' ? 'Employment' : entryType === 'savings' ? 'Emergency' : 'Other')
      const frequency = freqRaw && FREQUENCIES.includes(freqRaw.toLowerCase()) ? freqRaw.toLowerCase() : 'recurring'

      return { _id: i, description: desc, amount, entry_type: entryType, category, frequency, needsReview, _typeRaw: typeRaw }
    }).filter(r => r.description && r.amount && !isNaN(Number(r.amount)) && Number(r.amount) > 0)

    setPreview(rows)
    setRowOverrides({})
    setStep('preview')
  }

  function setRowType(id, type) {
    setRowOverrides(o => ({ ...o, [id]: type }))
  }

  // Apply overrides
  const finalPreview = preview.map(r => ({
    ...r,
    entry_type: rowOverrides[r._id] ?? r.entry_type,
  }))

  const needsReviewCount = finalPreview.filter(r => r.needsReview && !rowOverrides[r._id]).length
  const totalRows = finalPreview.length

  // Row limit logic
  const rowsAllowed  = premium ? totalRows : Math.min(totalRows, availableRows)
  const rowsTruncated = totalRows - rowsAllowed
  const rowsToImport  = finalPreview.slice(0, rowsAllowed)
  const overLimit     = !premium && rowsTruncated > 0

  function handleConfirmImport() {
    onImport({ rows: rowsToImport, mode: importMode })
    setStep('done')
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Import CSV</div>
            <div className={styles.modalSub}>
              {step === 'upload'  && 'Upload a CSV file to import budget data'}
              {step === 'map'     && 'Map your columns to budget fields'}
              {step === 'preview' && 'Review and confirm what will be imported'}
              {step === 'done'    && 'Import complete'}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.steps}>
          {['Upload','Map','Preview','Done'].map((s, i) => {
            const ids = ['upload','map','preview','done']
            const active = ids.indexOf(step) >= i
            return (
              <div key={s} className={`${styles.step} ${active ? styles.stepActive : ''}`}>
                <div className={styles.stepDot}>{i + 1}</div>
                <div className={styles.stepLabel}>{s}</div>
                {i < 3 && <div className={styles.stepLine} />}
              </div>
            )
          })}
        </div>

        <div className={styles.modalBody}>

          {/* STEP 1 — Upload */}
          {step === 'upload' && (
            <div className={styles.uploadStep}>
              {atLimit && (
                <div className={styles.limitBanner}>
                  You've reached the {FREE_ROW_LIMIT}-row limit for the free plan.
                  <button onClick={onUpgrade}>Upgrade to import more →</button>
                </div>
              )}
              <div
                className={styles.dropZone}
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className={styles.dropIcon}>↑</div>
                <div className={styles.dropTitle}>Click to upload or drag & drop</div>
                <div className={styles.dropSub}>CSV files only · Max {FREE_ROW_LIMIT} rows on free plan</div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
              </div>
              <div className={styles.templateSection}>
                <div className={styles.templateTitle}>Don't have a CSV?</div>
                <div className={styles.templateDesc}>Download our template — fill in your data and import it back. The Type column should say <strong>income</strong>, <strong>expense</strong>, or <strong>savings</strong>.</div>
                <button className={styles.templateBtn} onClick={downloadTemplate}>Download template</button>
              </div>
            </div>
          )}

          {/* STEP 2 — Map */}
          {step === 'map' && parsed && (
            <div className={styles.mapStep}>
              <div className={styles.mapInfo}>
                Found <strong>{parsed.rows.length} rows</strong> and <strong>{parsed.headers.length} columns</strong> in {file?.name}
                {!premium && importMode === 'add' && (
                  <span className={styles.rowAvail}> · {availableRows} row{availableRows !== 1 ? 's' : ''} available on your plan</span>
                )}
              </div>

              <div className={styles.mapTable}>
                <div className={styles.mapTableHeader}>
                  <div>Your column</div>
                  <div>Maps to</div>
                  <div>Sample value</div>
                </div>
                {parsed.headers.map(h => (
                  <div key={h} className={styles.mapRow}>
                    <div className={styles.mapColName}>{h}</div>
                    <div>
                      <select
                        className={styles.mapSelect}
                        value={mapping[h] || 'ignore'}
                        onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                      >
                        <option value="ignore">— Ignore —</option>
                        <option value="description">Description</option>
                        <option value="amount">Amount</option>
                        <option value="entry_type">Type (income / expense / savings)</option>
                        <option value="category">Category</option>
                        <option value="frequency">Frequency</option>
                      </select>
                    </div>
                    <div className={styles.mapSample}>{parsed.rows[0]?.[h] || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Type explanation box */}
              <div className={styles.typeExplainer}>
                <div className={styles.typeExplainerTitle}>How type is detected</div>
                {useGlobalType ? (
                  <p>No type column found — all rows will be set to the type you choose below.</p>
                ) : (
                  <p>The <strong>Type</strong> column will be read automatically. Values like "income", "salary", "credit" → <span className={styles.pill} style={{background:'var(--accent-light)',color:'var(--accent)'}}>income</span>. Values like "savings", "save" → <span className={styles.pill} style={{background:'var(--blue-light)',color:'var(--blue)'}}>savings</span>. Everything else → <span className={styles.pill} style={{background:'var(--accent2-light)',color:'var(--accent2)'}}>expense</span>. You can fix individual rows in the next step.</p>
                )}
              </div>

              <div className={styles.globalType}>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={useGlobalType} onChange={e => setUseGlobalType(e.target.checked)} />
                  <span>Set all rows to one type instead</span>
                </label>
                {useGlobalType && (
                  <div className={styles.typeSelect}>
                    {ENTRY_TYPES.map(t => (
                      <button
                        key={t}
                        className={`${styles.typeChip} ${globalType === t ? styles.typeChipOn : ''}`}
                        onClick={() => setGlobalType(t)}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.importMode}>
                <div className={styles.importModeTitle}>How should we handle existing data?</div>
                <div className={styles.importModeOptions}>
                  {[
                    { val: 'add',     label: 'Add to existing',  desc: 'Keep current entries, add imported rows alongside them' },
                    { val: 'replace', label: 'Replace existing', desc: 'Delete current month\'s data and replace with import' },
                  ].map(opt => (
                    <label key={opt.val} className={`${styles.modeOption} ${importMode === opt.val ? styles.modeOptionOn : ''}`}>
                      <input type="radio" name="mode" value={opt.val} checked={importMode === opt.val} onChange={() => setImportMode(opt.val)} />
                      <div>
                        <div className={styles.modeLabel}>{opt.label}</div>
                        <div className={styles.modeDesc}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                className={styles.primaryBtn}
                onClick={buildPreview}
                disabled={!Object.values(mapping).includes('description') || !Object.values(mapping).includes('amount')}
              >
                Preview import →
              </button>
              {!Object.values(mapping).includes('description') && <div className={styles.mapHint}>Map at least Description and Amount to continue</div>}
            </div>
          )}

          {/* STEP 3 — Preview */}
          {step === 'preview' && (
            <div className={styles.previewStep}>

              {/* Row limit warning */}
              {overLimit && (
                <div className={styles.limitWarning}>
                  <div>
                    Your file has <strong>{totalRows} rows</strong> but you can only import <strong>{rowsAllowed}</strong> more
                    {importMode === 'add' ? ` (${existingCount} rows already in budget, ${FREE_ROW_LIMIT} row limit)` : ` (free plan limit)`}.
                  </div>
                  <button className={styles.upgradeInline} onClick={() => { onClose(); onUpgrade() }}>
                    Upgrade to import all {totalRows} rows →
                  </button>
                </div>
              )}

              {/* Needs review warning */}
              {needsReviewCount > 0 && (
                <div className={styles.reviewWarning}>
                  <strong>{needsReviewCount} row{needsReviewCount > 1 ? 's' : ''}</strong> couldn't be auto-classified as income, expense, or savings.
                  Please set the type using the dropdown on those rows before importing.
                </div>
              )}

              <div className={styles.previewInfo}>
                Importing <strong>{rowsToImport.length} row{rowsToImport.length !== 1 ? 's' : ''}</strong> as <strong>{importMode === 'replace' ? 'replacement' : 'addition'}</strong> to your budget
              </div>

              <div className={styles.previewTableWrap}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Type</th>
                      <th>Category</th>
                      <th>Frequency</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsToImport.map((r, i) => (
                      <tr key={i} className={r.needsReview && !rowOverrides[r._id] ? styles.reviewRow : ''}>
                        <td>{r.description}</td>
                        <td>
                          <select
                            className={`${styles.typeSelect2} ${styles['tsel_' + r.entry_type]}`}
                            value={rowOverrides[r._id] ?? r.entry_type}
                            onChange={e => setRowType(r._id, e.target.value)}
                          >
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                            <option value="savings">Savings</option>
                          </select>
                        </td>
                        <td>{r.category}</td>
                        <td style={{ textTransform: 'capitalize' }}>{r.frequency}</td>
                        <td><strong>${Number(r.amount).toLocaleString()}</strong></td>
                      </tr>
                    ))}
                    {overLimit && (
                      <tr className={styles.truncatedRow}>
                        <td colSpan={5}>+ {rowsTruncated} more row{rowsTruncated !== 1 ? 's' : ''} not imported — upgrade to include all</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.previewActions}>
                <button className={styles.backBtn} onClick={() => setStep('map')}>Back</button>
                <button
                  className={styles.primaryBtn}
                  onClick={handleConfirmImport}
                  disabled={needsReviewCount > 0}
                  title={needsReviewCount > 0 ? 'Fix unclassified rows first' : ''}
                >
                  Import {rowsToImport.length} rows
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — Done */}
          {step === 'done' && (
            <div className={styles.doneStep}>
              <div className={styles.doneIcon}>✓</div>
              <h3>Import complete</h3>
              <p>{rowsToImport.length} rows imported successfully to your {month} budget.</p>
              <button className={styles.primaryBtn} onClick={onClose}>View budget</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
