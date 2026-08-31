import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../../api'
import { Modal, Notice, Field, Spinner, StatusBadge, errText, fmtDate } from '../../components/ui'
import { useDealerships } from '../../components/shared'

// Two views:
//  • Requests — dealer-config REQUESTS from users (what populates the queue).
//    Click one to open the Config Generator.
//  • Configs  — the generated DealerPlatform rows (pending/active/rejected) with
//    approve / reject / assign-to-dealership / assign-to-salesperson.
const REQ_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: '', label: 'All' },
]
const CFG_TABS = [
  { key: 'pending_review', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
]

export default function ReviewQueue() {
  const [view, setView] = useState('requests')
  return (
    <div className="stack">
      <div className="tabs">
        <button className={`tab${view === 'requests' ? ' active' : ''}`} onClick={() => setView('requests')}>Requests</button>
        <button className={`tab${view === 'configs' ? ' active' : ''}`} onClick={() => setView('configs')}>Configs</button>
      </div>
      {view === 'requests' ? <RequestsView /> : <ConfigsView />}
    </div>
  )
}

// ── Requests view ─────────────────────────────────────────────
function RequestsView() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (status) => {
    setLoading(true); setErr(null)
    try { setData(await adminApi.dealerConfigRequests(status)) }
    catch (e) { setErr(errText(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load(tab) }, [tab, load])

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="tabs">
          {REQ_TABS.map((t) => (
            <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" disabled={loading} onClick={() => load(tab)}>↻ Refresh</button>
      </div>
      <Notice kind="error">{err}</Notice>
      <div className="card">
        <table>
          <thead>
            <tr><th>Requester</th><th>Dealership</th><th>Site domain</th><th>Requested</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6}><Spinner /></td></tr>}
            {!loading && data?.requests?.map((r) => (
              <tr key={r.user_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/config-generator/${r.user_id}`)}>
                <td><strong>{r.full_name || '—'}</strong><div className="muted" style={{ marginTop: 2 }}>{r.email}</div></td>
                <td>{r.dealership_name || <span className="muted">—</span>}</td>
                <td className="mono" style={{ wordBreak: 'break-all' }}>{r.config_domain || r.dealership_url || <span className="muted">—</span>}</td>
                <td className="muted">{fmtDate(r.requested_at)}</td>
                <td>
                  {r.resolved_to_active_config
                    ? <span className="badge badge-green">config live</span>
                    : r.generation_in_progress
                      ? <span className="badge badge-blue">generation in progress</span>
                      : <span className="badge badge-amber">needs config</span>}
                </td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/admin/config-generator/${r.user_id}`) }}>Open Generator →</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && data?.requests?.length === 0 && (
              <tr><td colSpan={6}><div className="empty">No {tab || ''} dealer-config requests.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Configs view ──────────────────────────────────────────────
function ConfigsView() {
  const navigate = useNavigate()
  const { dealerships } = useDealerships()
  const [tab, setTab] = useState('pending_review')
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [flash, setFlash] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [assignDeal, setAssignDeal] = useState(null)
  const [assignSales, setAssignSales] = useState(null)

  const load = useCallback(async (status) => {
    setLoading(true); setErr(null)
    try { setData(await adminApi.listPlatforms(status)) }
    catch (e) { setErr(errText(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load(tab) }, [tab, load])

  async function approve(p) {
    setBusyId(p.id); setErr(null); setFlash(null)
    try {
      // Full approve (activates + maps domain), same as the generator page.
      const res = await adminApi.approveGeneratedConfig(p.id, {})
      setFlash(res.message || `Config #${p.id} approved.`)
      await load(tab)
    } catch (e) { setErr(errText(e)) }
    finally { setBusyId(null) }
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="tabs">
          {CFG_TABS.map((t) => (
            <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" disabled={loading} onClick={() => load(tab)}>↻ Refresh</button>
      </div>
      <Notice kind="error">{err}</Notice>
      <Notice kind="success">{flash}</Notice>
      <div className="card">
        <table>
          <thead>
            <tr><th>Config</th><th>Platform</th><th>Source</th><th>Status</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6}><Spinner /></td></tr>}
            {!loading && data?.platforms?.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>#{p.id} {p.name || p.platform_slug || '—'}</strong>
                  {p.warnings?.length > 0 && <div className="badge badge-amber" style={{ marginTop: 4 }}>{p.warnings.length} warning{p.warnings.length === 1 ? '' : 's'}</div>}
                </td>
                <td>{p.config_preview?.platform || p.platform_slug || <span className="muted">—</span>}</td>
                <td style={{ maxWidth: 220 }}>
                  {p.source_url
                    ? <a href={p.source_url} target="_blank" rel="noreferrer" className="mono" style={{ wordBreak: 'break-all' }}>{p.source_url}</a>
                    : <span className="muted">—</span>}
                </td>
                <td><StatusBadge status={p.status} /></td>
                <td className="muted">{fmtDate(p.created_at)}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                    {(p.status === 'pending_review' || p.status === 'active') && (
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/config-generator/platform/${p.id}`)}>Edit</button>
                    )}
                    {p.status === 'pending_review' && (
                      <>
                        <button className="btn btn-primary btn-sm" disabled={busyId === p.id} onClick={() => approve(p)}>{busyId === p.id ? '…' : 'Approve'}</button>
                        <button className="btn btn-danger btn-sm" disabled={busyId === p.id} onClick={() => setRejecting(p)}>Reject</button>
                      </>
                    )}
                    {(p.status === 'pending_review' || p.status === 'active') && (
                      <>
                        <button className="btn btn-navy btn-sm" onClick={() => setAssignSales(p)}>Assign to Salesperson</button>
                        {p.status === 'active' && (
                          <button className="btn btn-navy btn-sm" onClick={() => setAssignDeal(p)}>Assign to Dealership</button>
                        )}
                      </>
                    )}
                    {p.status === 'rejected' && <span className="muted" style={{ fontSize: 12 }}>—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && data?.platforms?.length === 0 && (
              <tr><td colSpan={6}><div className="empty">No configs {tab ? `with status “${tab}”` : ''}.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {rejecting && <RejectModal platform={rejecting} onClose={() => setRejecting(null)} onDone={(m) => { setRejecting(null); setFlash(m); load(tab) }} onError={setErr} />}
      {assignDeal && <AssignDealershipModal platform={assignDeal} dealerships={dealerships} onClose={() => setAssignDeal(null)} onDone={(m) => { setAssignDeal(null); setFlash(m); load(tab) }} />}
      {assignSales && <AssignSalespersonModal platform={assignSales} onClose={() => setAssignSales(null)} onDone={(m) => { setAssignSales(null); setFlash(m); load(tab) }} />}
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
    } catch (e) { const m = errText(e); setErr(m); onError?.(m); setBusy(false) }
  }
  return (
    <Modal title={`Reject Config #${platform.id}`} onClose={onClose} maxWidth={440}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" onClick={submit} disabled={busy}>{busy ? 'Rejecting…' : 'Reject Config'}</button>
      </>}>
      <div className="modal-body">
        <Notice kind="error">{err}</Notice>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Optional — appended to the config's notes.</p>
        <Field label="Reason (optional)">
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. price selector grabs MSRP" autoFocus />
        </Field>
      </div>
    </Modal>
  )
}

function AssignDealershipModal({ platform, dealerships, onClose, onDone }) {
  const [dealershipId, setDealershipId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function submit() {
    setBusy(true); setErr(null)
    try {
      const res = await adminApi.assignPlatform(platform.id, Number(dealershipId))
      onDone(res.message || `Config #${platform.id} assigned.`)
    } catch (e) { setErr(errText(e)); setBusy(false) }
  }
  return (
    <Modal title={`Assign Config #${platform.id} to a Dealership`} onClose={onClose} maxWidth={460}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !dealershipId}>{busy ? 'Assigning…' : 'Assign'}</button>
      </>}>
      <div className="modal-body">
        <Notice kind="error">{err}</Notice>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Links this active config to a dealership. Only active configs can be assigned.</p>
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

function AssignSalespersonModal({ platform, onClose, onDone }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function submit() {
    setBusy(true); setErr(null)
    try {
      const res = await adminApi.assignPlatformToSalesperson(platform.id, email.trim())
      onDone(res.message || `Config #${platform.id} assigned to ${email}.`)
    } catch (e) { setErr(errText(e)); setBusy(false) }
  }
  return (
    <Modal title={`Assign Config #${platform.id} to a Salesperson`} onClose={onClose} maxWidth={460}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !email.trim()}>{busy ? 'Assigning…' : 'Assign'}</button>
      </>}>
      <div className="modal-body">
        <Notice kind="error">{err}</Notice>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Serves this config in that person's extension (sets their site domain to{' '}
          <span className="mono">{platform.source_url}</span>'s domain).
          {platform.status === 'pending_review' && ' A pending config is activated as part of assigning.'}
        </p>
        <Field label="Salesperson email">
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@dealer.com" autoFocus />
        </Field>
      </div>
    </Modal>
  )
}
