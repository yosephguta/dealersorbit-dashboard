import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '../../api'
import { Modal, Notice, Field, Spinner, StatusBadge, errText, fmtDate } from '../../components/ui'
import { useDealerships } from '../../components/shared'

const TABS = [
  { key: 'pending_review', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
]

export default function ReviewQueue() {
  const { dealerships } = useDealerships()
  const [tab, setTab] = useState('pending_review')
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)  // platform row
  const [assigning, setAssigning] = useState(null)  // platform row
  const [flash, setFlash] = useState(null)

  const load = useCallback(async (status) => {
    setLoading(true); setErr(null)
    try {
      setData(await adminApi.listPlatforms(status))
    } catch (e) {
      setErr(errText(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  async function approve(p) {
    setBusyId(p.id); setErr(null); setFlash(null)
    try {
      await adminApi.approvePlatform(p.id)
      setFlash(`Config #${p.id} approved — now active.`)
      await load(tab)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="stack">
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <Notice kind="error">{err}</Notice>
      <Notice kind="success">{flash}</Notice>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Config</th>
              <th>Platform</th>
              <th>Source</th>
              <th>Status</th>
              <th>Tokens</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7}><Spinner /></td></tr>}
            {!loading && data?.platforms?.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>#{p.id} {p.name || p.platform_slug || '—'}</strong>
                  <div className="muted mono" style={{ marginTop: 2 }}>
                    cards: {p.config_preview?.vehicle_cards || '—'}
                  </div>
                  {p.warnings?.length > 0 && (
                    <div className="badge badge-amber" style={{ marginTop: 4 }}>{p.warnings.length} warning{p.warnings.length === 1 ? '' : 's'}</div>
                  )}
                </td>
                <td>{p.config_preview?.platform || p.platform_slug || <span className="muted">—</span>}</td>
                <td style={{ maxWidth: 200 }}>
                  {p.source_url
                    ? <a href={p.source_url} target="_blank" rel="noreferrer" className="mono" style={{ wordBreak: 'break-all' }}>{p.source_url}</a>
                    : <span className="muted">—</span>}
                </td>
                <td><StatusBadge status={p.status} /></td>
                <td className="mono">{(p.input_tokens || 0)}/{(p.output_tokens || 0)}</td>
                <td className="muted">{fmtDate(p.created_at)}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                    {p.status === 'pending_review' && (
                      <>
                        <button className="btn btn-primary btn-sm" disabled={busyId === p.id} onClick={() => approve(p)}>
                          {busyId === p.id ? '…' : 'Approve'}
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={busyId === p.id} onClick={() => setRejecting(p)}>Reject</button>
                      </>
                    )}
                    {p.status === 'active' && (
                      <button className="btn btn-navy btn-sm" onClick={() => setAssigning(p)}>Assign to Dealership</button>
                    )}
                    {p.status === 'rejected' && <span className="muted" style={{ fontSize: 12 }}>—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && data?.platforms?.length === 0 && (
              <tr><td colSpan={7}><div className="empty">No configs {tab ? `with status “${tab}”` : ''}.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <RejectModal
          platform={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(msg) => { setRejecting(null); setFlash(msg); load(tab) }}
          onError={(m) => setErr(m)}
        />
      )}
      {assigning && (
        <AssignModal
          platform={assigning}
          dealerships={dealerships}
          onClose={() => setAssigning(null)}
          onDone={(msg) => { setAssigning(null); setFlash(msg); load(tab) }}
        />
      )}
    </div>
  )
}

function RejectModal({ platform, onClose, onDone, onError }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function submit() {
    setBusy(true); setErr(null)
    try {
      const res = await adminApi.rejectPlatform(platform.id, reason.trim())
      onDone(res.message || `Config #${platform.id} rejected.`)
    } catch (e) {
      const m = errText(e)
      setErr(m); onError?.(m); setBusy(false)
    }
  }

  return (
    <Modal
      title={`Reject Config #${platform.id}`}
      onClose={onClose}
      maxWidth={440}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" onClick={submit} disabled={busy}>{busy ? 'Rejecting…' : 'Reject Config'}</button>
      </>}
    >
      <div className="modal-body">
        <Notice kind="error">{err}</Notice>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Optional — the reason is appended to the config's notes (there is no dedicated reason column).
        </p>
        <Field label="Reason (optional)">
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. price selector grabs MSRP, not final price" autoFocus />
        </Field>
      </div>
    </Modal>
  )
}

function AssignModal({ platform, dealerships, onClose, onDone }) {
  const [dealershipId, setDealershipId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function submit() {
    setBusy(true); setErr(null)
    try {
      const res = await adminApi.assignPlatform(platform.id, Number(dealershipId))
      onDone(res.message || `Config #${platform.id} assigned.`)
    } catch (e) {
      // Backend returns 409 when the config isn't 'active' — show its message, don't dump raw JSON.
      setErr(errText(e)); setBusy(false)
    }
  }

  return (
    <Modal
      title={`Assign Config #${platform.id} to a Dealership`}
      onClose={onClose}
      maxWidth={460}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !dealershipId}>{busy ? 'Assigning…' : 'Assign'}</button>
      </>}
    >
      <div className="modal-body">
        <Notice kind="error">{err}</Notice>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Links this active config to a dealership (sets its scraping platform). Only active configs can be assigned.
        </p>
        <Field label="Dealership">
          <select name="assign_dealership" className="select" value={dealershipId} onChange={(e) => setDealershipId(e.target.value)} autoFocus>
            <option value="">— select a dealership —</option>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealership_name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}
