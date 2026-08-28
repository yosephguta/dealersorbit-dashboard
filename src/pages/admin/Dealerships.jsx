import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '../../api'
import { Modal, Notice, Field, Spinner, errText, fmtDate } from '../../components/ui'

const BLANK = {
  dealer_group: '',
  dealership_name: '',
  location: '',
  website_url: '',
  required_tagline: '',
  required_tagline_es: '',
}

export default function Dealerships() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [editing, setEditing] = useState(null)   // {mode:'create'|'edit', data}
  const [assigning, setAssigning] = useState(null) // dealership row

  const load = useCallback(async () => {
    setErr(null)
    try {
      setRows(await adminApi.listDealerships())
    } catch (e) {
      setErr(errText(e))
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Replace one row in place from an API response (no full refetch needed).
  function upsertRow(row) {
    setRows((prev) => {
      if (!prev) return [row]
      const i = prev.findIndex((d) => d.id === row.id)
      if (i === -1) return [row, ...prev]
      const next = prev.slice()
      next[i] = row
      return next
    })
  }

  if (rows === null && !err) return <Spinner />

  return (
    <div className="stack">
      <div className="row-between">
        <div className="muted">{rows?.length ?? 0} dealership{rows?.length === 1 ? '' : 's'}</div>
        <button className="btn btn-primary" onClick={() => setEditing({ mode: 'create', data: { ...BLANK } })}>
          + New Dealership
        </button>
      </div>

      <Notice kind="error">{err}</Notice>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Dealership</th>
              <th>Group</th>
              <th>Location</th>
              <th>Manager</th>
              <th>Salespeople</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.dealership_name}</strong>
                  {d.required_tagline && <div className="muted mono" style={{ marginTop: 2 }}>“{d.required_tagline}”</div>}
                </td>
                <td>{d.dealer_group}</td>
                <td>{d.location || <span className="muted">—</span>}</td>
                <td>
                  {d.manager
                    ? <span title={d.manager.email}>{d.manager.full_name || d.manager.email}</span>
                    : <span className="muted">Unassigned</span>}
                </td>
                <td>{d.salesperson_count}</td>
                <td className="muted">{fmtDate(d.created_at)}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ mode: 'edit', data: { ...BLANK, ...d } })}>Edit</button>
                    <button className="btn btn-navy btn-sm" onClick={() => setAssigning(d)}>Manager</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr><td colSpan={7}><div className="empty">No dealerships yet. Create the first one.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <DealershipForm
          mode={editing.mode}
          initial={editing.data}
          onClose={() => setEditing(null)}
          onSaved={(row) => { upsertRow(row); setEditing(null) }}
        />
      )}

      {assigning && (
        <AssignManager
          dealership={assigning}
          onClose={() => setAssigning(null)}
          onAssigned={(row) => { upsertRow(row); setAssigning(null) }}
        />
      )}
    </div>
  )
}

function DealershipForm({ mode, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  async function submit() {
    setErr(null); setBusy(true)
    try {
      // Only send fields the form owns; empty strings → null for optional cols.
      const payload = {
        dealer_group: f.dealer_group.trim(),
        dealership_name: f.dealership_name.trim(),
        location: f.location?.trim() || null,
        website_url: f.website_url?.trim() || null,
        required_tagline: f.required_tagline?.trim() || null,
        required_tagline_es: f.required_tagline_es?.trim() || null,
      }
      const row = mode === 'create'
        ? await adminApi.createDealership(payload)
        : await adminApi.updateDealership(initial.id, payload)
      onSaved(row)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const valid = f.dealer_group.trim() && f.dealership_name.trim()

  return (
    <Modal
      title={mode === 'create' ? 'New Dealership' : `Edit — ${initial.dealership_name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !valid}>
            {busy ? 'Saving…' : mode === 'create' ? 'Create' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="modal-body">
        <Notice kind="error">{err}</Notice>
        <Field label="Dealer group *"><input className="input" value={f.dealer_group} onChange={set('dealer_group')} autoFocus /></Field>
        <Field label="Dealership name *"><input className="input" value={f.dealership_name} onChange={set('dealership_name')} /></Field>
        <Field label="Location"><input className="input" value={f.location || ''} onChange={set('location')} placeholder="City, ST" /></Field>
        <Field label="Website URL"><input className="input" value={f.website_url || ''} onChange={set('website_url')} placeholder="https://…" /></Field>
        <Field label="Required tagline (EN)"><input className="input" value={f.required_tagline || ''} onChange={set('required_tagline')} /></Field>
        <Field label="Required tagline (ES)"><input className="input" value={f.required_tagline_es || ''} onChange={set('required_tagline_es')} /></Field>
      </div>
    </Modal>
  )
}

function AssignManager({ dealership, onClose, onAssigned }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState(null)
  const [busyId, setBusyId] = useState(null)

  // Debounced email search against GET /admin/users?email=
  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults([]); return }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const data = await adminApi.listUsers({ email: term, limit: 10 })
        if (!cancelled) setResults(data.users || [])
      } catch (e) {
        if (!cancelled) setErr(errText(e))
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  async function assign(user) {
    setErr(null); setBusyId(user.id)
    try {
      const row = await adminApi.assignManager(dealership.id, user.id)
      onAssigned(row)
    } catch (e) {
      setErr(errText(e)); setBusyId(null)
    }
  }

  return (
    <Modal title={`Assign Manager — ${dealership.dealership_name}`} onClose={onClose}>
      <div className="modal-body">
        <Notice kind="error">{err}</Notice>
        {dealership.manager && (
          <p className="muted" style={{ marginTop: 0 }}>
            Current manager: <strong>{dealership.manager.full_name || dealership.manager.email}</strong>. Assigning a new one replaces them.
          </p>
        )}
        <Field label="Search users by email">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="type an email…" autoFocus />
        </Field>
        {searching && <div className="muted" style={{ fontSize: 12 }}>Searching…</div>}
        <div className="card" style={{ marginTop: 8 }}>
          <table>
            <tbody>
              {results.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div>{u.full_name || '—'}</div>
                    <div className="muted mono">{u.email}</div>
                  </td>
                  <td><span className="badge">{u.role}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-primary btn-sm" disabled={busyId === u.id} onClick={() => assign(u)}>
                      {busyId === u.id ? 'Assigning…' : 'Make Manager'}
                    </button>
                  </td>
                </tr>
              ))}
              {!searching && q.trim() && results.length === 0 && (
                <tr><td><div className="empty">No users match “{q.trim()}”.</div></td></tr>
              )}
              {!q.trim() && (
                <tr><td><div className="empty">Start typing to find a user.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
