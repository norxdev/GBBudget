import { useState, useRef } from 'react'
import { isPremium } from '../lib/plans'
import styles from './CSVImport.module.css'

const FREE_ROW_LIMIT = 10

const EXPENSE_CATS = ['Housing','Food','Transport','Healthcare','Entertainment','Subscriptions','Dining','Shopping','Other']
const INCOME_CATS  = ['Employment','Freelance','Investment','Rental','Other']
const SAVINGS_CATS = ['Emergency','Investment','Travel','Major Purchase','Retirement','Other']
const ALL_CATS = [...new Set([...EXPENSE_CATS, ...INCOME_CATS, ...SAVINGS_CATS])]

const ENTRY_TYPES = ['income','expense','savings']
const FREQUENCIES = ['recurring','one-time']

// Fuzzy match a header to a known field
function guessField(header) {
  const h = header.toLowerCase().trim()
  if (['description','name','item','details','memo','narration','payee','note'].some(k => h.includes(k))) return 'description'
  if (['amount','sum','value','price','cost','debit','credit','payment'].some(k => h.includes(k))) return 'amount'
  if (['type','kind','flow','direction','in/out','inout'].some(k => h.includes(k))) return 'entry_type'
  if (['category','cat','group','tag','label'].some(k => h.includes(k))) return 'category'
  if (['frequency','freq','recurring','schedule'].some(k => h.includes(k))) return 'frequency'
  return 'ignore'
}

// Parse CSV text into array of objects
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
    return headers.reduce((obj, h, i) => { obj[h] = vals[i] || ''; return obj }, {})
  }).filter(r => Object.values(r).some(v => v))
  return { headers, rows }
}

// Clean amount string to number
function cleanAmount(val) {
  if (!val) return ''
  return String(val).replace(/[$,\s]/g, '')
}

// Fuzzy match category
function matchCategory(val) {
  if (!val) return 'Other'
  const v = val.toLowerCase()
  if (['rent','mortgage','housing','home'].some(k => v.includes(k))) return 'Housing'
  if (['grocery','groceries','supermarket','food'].some(k => v.includes(k))) return 'Food'
  if (['dining','restaurant','cafe','coffee','takeout','eat'].some(k => v.includes(k))) return 'Dining'
  if (['transport','gas','fuel','uber','lyft','car','transit','parking'].some(k => v.includes(k))) return 'Transport'
  if (['netflix','spotify','subscription','hulu','disney','amazon prime'].some(k => v.includes(k))) return 'Subscriptions'
  if (['health','gym','medical','doctor','pharmacy','insurance'].some(k => v.includes(k))) return 'Healthcare'
  if (['salary','payroll','paycheck','income','wage'].some(k => v.includes(k))) return 'Employment'
  if (['freelance','contract','consulting','gig'].some(k => v.includes(k))) return 'Freelance'
  if (['entertainment','movie','game','fun'].some(k => v.includes(k))) return 'Entertainment'
  if (['shopping','amazon','retail','clothes','clothing'].some(k => v.includes(k))) return 'Shopping'
  if (['emergency','savings','saving','rainy day'].some(k => v.includes(k))) return 'Emergency'
  if (['invest','stock','fund','etf','401k','retirement'].some(k => v.includes(k))) return 'Investment'
  return 'Other'
}

function guessEntryType(val) {
  if (!val) return 'expense'
  const v = val.toLowerCase()
  if (['income','in','credit','deposit','salary','earning','received'].some(k => v.includes(k))) return 'income'
  if (['saving','savings','transfer to savings'].some(k => v.includes(k))) return 'savings'
  return 'expense'
}

// Download template CSV
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

export default function CSVImport({ profile, month, onImport, onClose }) {
  const [step, setStep] = useState('upload') // upload | map | preview | done
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [globalType, setGlobalType] = useState('expense')
  const [useGlobalType, setUseGlobalType] = useState(false)
  const [importMode, setImportMode] = useState('add') // add | replace
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()
  const premium = isPremium(profile)

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = evt => {
      const { headers, rows } = parseCSV(evt.target.result)
      if (!headers.length) return
      // Auto-guess mapping
      const guessed = {}
      headers.forEach(h => { guessed[h] = guessField(h) })
      setMapping(guessed)
      setParsed({ headers, rows })
      // Check if there's a type column
      const hasTypeCol = Object.values(guessed).includes('entry_type')
      setUseGlobalType(!hasTypeCol)
      setStep('map')
    }
    reader.readAsText(f)
  }

  function buildPreview() {
    const rows = parsed.rows.map(row => {
      const desc   = mapping && Object.keys(mapping).find(h => mapping[h] === 'description') ? row[Object.keys(mapping).find(h => mapping[h] === 'description')] : ''
      const amtRaw = mapping && Object.keys(mapping).find(h => mapping[h] === 'amount')      ? row[Object.keys(mapping).find(h => mapping[h] === 'amount')]      : ''
      const typeRaw= mapping && Object.keys(mapping).find(h => mapping[h] === 'entry_type')  ? row[Object.keys(mapping).find(h => mapping[h] === 'entry_type')]  : ''
      const catRaw = mapping && Object.keys(mapping).find(h => mapping[h] === 'category')    ? row[Object.keys(mapping).find(h => mapping[h] === 'category')]    : ''
      const freqRaw= mapping && Object.keys(mapping).find(h => mapping[h] === 'frequency')   ? row[Object.keys(mapping).find(h => mapping[h] === 'frequency')]   : ''

      const entryType = useGlobalType ? globalType : guessEntryType(typeRaw)
      const amount    = cleanAmount(amtRaw)
      const category  = catRaw ? matchCategory(catRaw) : (entryType === 'income' ? 'Employment' : entryType === 'savings' ? 'Emergency' : 'Other')
      const frequency = freqRaw && FREQUENCIES.includes(freqRaw.toLowerCase()) ? freqRaw.toLowerCase() : 'recurring'

      return { description: desc, amount, entry_type: entryType, category, frequency, _raw: row }
    }).filter(r => r.description && r.amount && !isNaN(Number(r.amount)))

    setPreview(rows)
    setStep('preview')
  }

  const totalRows   = preview.length
  const limitedRows = !premium && totalRows > FREE_ROW_LIMIT
  const rowsToImport = limitedRows ? preview.slice(0, FREE_ROW_LIMIT) : preview

  function handleConfirmImport() {
    onImport({ rows: rowsToImport, mode: importMode })
    setStep('done')
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Import CSV</div>
            <div className={styles.modalSub}>
              {step === 'upload'  && 'Upload a CSV file to import budget data'}
              {step === 'map'     && 'Map your columns to budget fields'}
              {step === 'preview' && 'Review what will be imported'}
              {step === 'done'    && 'Import complete'}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Steps indicator */}
        <div className={styles.steps}>
          {['Upload','Map','Preview','Done'].map((s, i) => {
            const stepIds = ['upload','map','preview','done']
            const active  = stepIds.indexOf(step) >= i
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
              <div
                className={styles.dropZone}
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const fake = { target: { files: [f] } }; handleFile(fake) } }}
              >
                <div className={styles.dropIcon}>↑</div>
                <div className={styles.dropTitle}>Click to upload or drag & drop</div>
                <div className={styles.dropSub}>CSV files only</div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
              </div>

              <div className={styles.templateSection}>
                <div className={styles.templateTitle}>Don't have a CSV?</div>
                <div className={styles.templateDesc}>Download our template, fill it in, and import it back.</div>
                <button className={styles.templateBtn} onClick={downloadTemplate}>Download template</button>
              </div>
            </div>
          )}

          {/* STEP 2 — Map */}
          {step === 'map' && parsed && (
            <div className={styles.mapStep}>
              <div className={styles.mapInfo}>
                Found <strong>{parsed.rows.length} rows</strong> and <strong>{parsed.headers.length} columns</strong> in {file?.name}
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
                        <option value="entry_type">Type (income/expense)</option>
                        <option value="category">Category</option>
                        <option value="frequency">Frequency</option>
                      </select>
                    </div>
                    <div className={styles.mapSample}>{parsed.rows[0]?.[h] || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Global type override */}
              <div className={styles.globalType}>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={useGlobalType} onChange={e => setUseGlobalType(e.target.checked)} />
                  <span>Set all rows to one type</span>
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

              {/* Import mode */}
              <div className={styles.importMode}>
                <div className={styles.importModeTitle}>How should we handle existing data?</div>
                <div className={styles.importModeOptions}>
                  <label className={`${styles.modeOption} ${importMode === 'add' ? styles.modeOptionOn : ''}`}>
                    <input type="radio" name="mode" value="add" checked={importMode === 'add'} onChange={() => setImportMode('add')} />
                    <div>
                      <div className={styles.modeLabel}>Add to existing</div>
                      <div className={styles.modeDesc}>Keep current entries, add imported rows alongside them</div>
                    </div>
                  </label>
                  <label className={`${styles.modeOption} ${importMode === 'replace' ? styles.modeOptionOn : ''}`}>
                    <input type="radio" name="mode" value="replace" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
                    <div>
                      <div className={styles.modeLabel}>Replace existing</div>
                      <div className={styles.modeDesc}>Delete current month's data and replace with import</div>
                    </div>
                  </label>
                </div>
              </div>

              <button
                className={styles.primaryBtn}
                onClick={buildPreview}
                disabled={!Object.values(mapping).includes('description') || !Object.values(mapping).includes('amount')}
              >
                Preview import →
              </button>
            </div>
          )}

          {/* STEP 3 — Preview */}
          {step === 'preview' && (
            <div className={styles.previewStep}>
              {limitedRows && (
                <div className={styles.limitWarning}>
                  Your file has <strong>{totalRows} rows</strong>. Free plan is limited to {FREE_ROW_LIMIT} rows.
                  Only the first {FREE_ROW_LIMIT} will be imported.
                  <button className={styles.upgradeInline} onClick={onClose}>Upgrade to import all →</button>
                </div>
              )}

              <div className={styles.previewInfo}>
                Importing <strong>{rowsToImport.length} rows</strong> as <strong>{importMode === 'replace' ? 'replacement' : 'addition'}</strong> to {month}
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
                      <tr key={i}>
                        <td>{r.description}</td>
                        <td><span className={`${styles.typePill} ${styles['t_' + r.entry_type]}`}>{r.entry_type}</span></td>
                        <td>{r.category}</td>
                        <td style={{ textTransform: 'capitalize' }}>{r.frequency}</td>
                        <td><strong>${Number(r.amount).toLocaleString()}</strong></td>
                      </tr>
                    ))}
                    {limitedRows && (
                      <tr className={styles.truncatedRow}>
                        <td colSpan={5}>+ {totalRows - FREE_ROW_LIMIT} more rows not imported (upgrade to include all)</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.previewActions}>
                <button className={styles.backBtn} onClick={() => setStep('map')}>Back</button>
                <button className={styles.primaryBtn} onClick={handleConfirmImport} disabled={importing}>
                  {importing ? 'Importing...' : `Import ${rowsToImport.length} rows`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — Done */}
          {step === 'done' && (
            <div className={styles.doneStep}>
              <div className={styles.doneIcon}>✓</div>
              <h3>Import complete</h3>
              <p>{rowsToImport.length} rows imported successfully to your budget.</p>
              <button className={styles.primaryBtn} onClick={onClose}>View budget</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
