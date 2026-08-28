import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../../api'
import { Modal, Notice, Field, Spinner, StatusBadge, errText, fmtDate } from '../../components/ui'
import { PLANS, STATUSES, ROLES, useDealerships } from '../../components/shared'

const PAGE = 50

export default function Users() {
  const nav = useNavigate()
  const { dealerships } = useDealerships()
  const [filters, setFilters] = useState({ dealership_id: '', role: '', email: '' })
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState(null)   // {total, users, ...}
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [granting, setGranting] = useState(null)  // user row

  const load = useCallback(async (f, off) => {
    setLoading(true); setErr(null)
    try {
      const res = await adminApi.listUsers({ ...f, limit: PAGE, offset: off })
      setData(res)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced reload whenever filters change (resets to page 0).
  useEffect(() => {
    const t = setTimeout(() => { setOffset(0); load(filters, 0) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const dealerName = (id) => dealerships.find((d) => d.id === id)?.dealership_name

  function goPage(off) { setOffset(off); load(filters, off) }

  function patchRow(u) {
    setData((prev) => prev ? { ...prev, users: prev.users.map((x) => x.id === u.id ? u : x) } : prev)
  }

  const total = data?.total ?? 0
  const showingTo = Math.min(offset + PAGE, total)

  return (
    <div className="stack">
      <div className="row-between">
        <div className="row">
          <div style={{ width: 200 }}>
            <select className="select" value={filters.dealership_id}
              onChange={(e) => setFilters((f) => ({ ...f, dealership_id: e.target.value }))}>
              <option value="">All dealerships</option>
              {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealership_name}</option>)}
            </select>
          </div>
          <div style={{ width: 150 }}>
            <select className="select" value={filters.role}
              onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ width: 220 }}>
            <input className="input" placeholder="Search email…" value={filters.email}
              onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Create User</button>
      </div>

      <Notice kind="error">{err}</Notice>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Dealership</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7}><Spinner /></td></tr>}
            {!loading && data?.users?.map((u) => (
              <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/admin/users/${u.id}`)}>
                <td>
                  <div>{u.full_name || '—'}</div>
                  <div className="muted mono">{u.email}</div>
                </td>
                <td><span className="badge">{u.role}</span></td>
                <td>{u.dealership_id ? (dealerName(u.dealership_id) || `#${u.dealership_id}`) : <span className="muted">—</span>}</td>
                <td>{u.purchased_plan || <span className="muted">—</span>}</td>
                <td><StatusBadge status={u.subscription_status} /></td>
                <td className="muted">{fmtDate(u.created_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  {/* stopPropagation so the plan button doesn't also trigger the row → detail nav */}
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setGranting(u) }}>Grant Plan</button>
                </td>
              </tr>
            ))}
            {!loading && data?.users?.length === 0 && (
              <tr><td colSpan={7}><div className="empty">No users match these filters.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="row-between">
        <div className="muted">
          {total === 0 ? 'No results' : `Showing ${offset + 1}–${showingTo} of ${total}`}
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" disabled={offset === 0 || loading} onClick={() => goPage(Math.max(0, offset - PAGE))}>← Prev</button>
          <button className="btn btn-ghost btn-sm" disabled={showingTo >= total || loading} onClick={() => goPage(offset + PAGE)}>Next →</button>
        </div>
      </div>

      {creating && (
        <CreateUser
          dealerships={dealerships}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); setOffset(0); load(filters, 0) }}
        />
      )}
      {granting && (
        <GrantPlan
          user={granting}
          onClose={() => setGranting(null)}
          onSaved={(u) => { patchRow(u); setGranting(null) }}
        />
      )}
    </div>
  )
}

const BLANK_USER = {
  first_name: '', last_name: '', email: '', password: '',
  dealership_id: '', purchased_plan: '', subscription_status: '',
}

function CreateUser({ dealerships, onClose, onCreated }) {
  const [f, setF] = useState(BLANK_USER)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  async function submit() {
    setErr(null); setBusy(true)
    try {
      const payload = {
        email: f.email.trim().toLowerCase(),
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        full_name: `${f.first_name.trim()} ${f.last_name.trim()}`.trim(),
        password: f.password,
        dealership_id: f.dealership_id ? Number(f.dealership_id) : null,
        purchased_plan: f.purchased_plan || null,
        subscription_status: f.subscription_status || null,
      }
      await adminApi.createUser(payload)
      onCreated()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const valid = f.first_name.trim() && f.last_name.trim() && f.email.trim() && f.password.length >= 8

  return (
    <Modal
      title="Create User"
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !valid}>{busy ? 'Creating…' : 'Create'}</button>
      </>}
    >
      <div className="modal-body">
        <Notice kind="error">{err}</Notice>
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          Creates a verified salesperson account (skips the email-verification flow). Promote to manager separately from Dealerships.
        </p>
        <div className="grid-2">
          <Field label="First name *"><input name="first_name" className="input" value={f.first_name} onChange={set('first_name')} autoFocus /></Field>
          <Field label="Last name *"><input name="last_name" className="input" value={f.last_name} onChange={set('last_name')} /></Field>
        </div>
        <Field label="Email *"><input name="email" className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Password * (min 8 chars)"><input name="password" className="input" type="text" value={f.password} onChange={set('password')} /></Field>
        <Field label="Dealership">
          <select name="dealership_id" className="select" value={f.dealership_id} onChange={set('dealership_id')}>
            <option value="">— none —</option>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealership_name}</option>)}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="Plan (optional)">
            <select className="select" value={f.purchased_plan} onChange={set('purchased_plan')}>
              <option value="">— none —</option>
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Status (optional)">
            <select className="select" value={f.subscription_status} onChange={set('subscription_status')}>
              <option value="">— default —</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
          Status default: <strong>active</strong> if a plan is set, else <strong>trial</strong> (7-day window).
        </p>
      </div>
    </Modal>
  )
}

function GrantPlan({ user, onClose, onSaved }) {
  const [plan, setPlan] = useState(user.purchased_plan || '')
  const [status, setStatus] = useState(user.subscription_status || '')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setErr(null); setBusy(true)
    try {
      // Send only fields that are set; the endpoint patches both optionally.
      const payload = {}
      if (plan) payload.purchased_plan = plan
      if (status) payload.subscription_status = status
      const u = await adminApi.grantPlan(user.id, payload)
      onSaved(u)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Grant Plan — ${user.full_name || user.email}`}
      onClose={onClose}
      maxWidth={420}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || (!plan && !status)}>{busy ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <div className="modal-body">
        <Notice kind="error">{err}</Notice>
        <div className="kv"><span className="muted">Current plan</span><span>{user.purchased_plan || '—'}</span></div>
        <div className="kv" style={{ marginBottom: 12 }}><span className="muted">Current status</span><span>{user.subscription_status}</span></div>
        <Field label="Purchased plan">
          <select className="select" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">— leave unchanged —</option>
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Subscription status">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">— leave unchanged —</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}
