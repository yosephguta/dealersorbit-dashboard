// Small shared UI primitives used across the admin screens.
import { useEffect } from 'react'

export function Modal({ title, onClose, children, footer, maxWidth }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="x-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Notice({ kind = 'info', children }) {
  if (!children) return null
  return <div className={`notice notice-${kind}`}>{children}</div>
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function StatusBadge({ status }) {
  const map = {
    active: 'badge-green',
    trial: 'badge-blue',
    past_due: 'badge-amber',
    cancelled: 'badge-red',
    inactive: 'badge-red',
    pending_review: 'badge-amber',
    rejected: 'badge-red',
  }
  return <span className={`badge ${map[status] || ''}`}>{status || '—'}</span>
}

export function Spinner({ label = 'Loading…' }) {
  return <div className="center-note">{label}</div>
}

// Turns an ApiError (or any error) into a readable string, incl. FastAPI 422 arrays.
export function errText(e) {
  if (!e) return ''
  const d = e.detail
  if (typeof d === 'string') return d
  if (d && typeof d.detail === 'string') return d.detail
  if (Array.isArray(d?.detail)) {
    return d.detail.map((x) => x.msg || JSON.stringify(x)).join('; ')
  }
  return e.message || 'Something went wrong.'
}

export function fmtDate(s) {
  if (!s) return '—'
  // Backend datetimes are naive UTC (no Z). Append Z so the browser reads them as UTC,
  // then render the UTC calendar date — NOT the viewer's local date. Otherwise a
  // midnight-UTC value (e.g. a Monday week boundary) shows as the previous day in a
  // negative-offset timezone. Everything in this app is UTC, so display it as UTC.
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`
  const d = new Date(iso)
  if (isNaN(d)) return s
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
