import { useState } from 'react'
import { adminApi } from '../../api'
import { Notice, Field, errText } from '../../components/ui'
import { PLANS, STATUSES, useDealerships } from '../../components/shared'

// Splits a pasted blob on newlines OR commas, trims, drops blanks.
function parseEmails(text) {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function BulkAssign() {
  const { dealerships } = useDealerships()
  const [dealershipId, setDealershipId] = useState('')
  const [raw, setRaw] = useState('')
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')
  const [result, setResult] = useState(null)   // API response
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const emails = parseEmails(raw)

  async function submit() {
    setErr(null); setResult(null); setBusy(true)
    try {
      const payload = {
        emails,
        purchased_plan: plan || null,
        subscription_status: status || null,
      }
      const res = await adminApi.bulkAssign(Number(dealershipId), payload)
      setResult(res)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const chosen = dealerships.find((d) => String(d.id) === String(dealershipId))

  return (
    <div className="stack">
      <div className="grid-2">
        <div className="card card-pad">
          <h2 className="section-title">Bulk assign salespeople</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Assign already-registered users to a dealership and graduate them off trial. Role is never changed — this is for team members, not managers.
          </p>
          <Notice kind="error">{err}</Notice>

          <Field label="Dealership *">
            <select name="dealership_id" className="select" value={dealershipId} onChange={(e) => setDealershipId(e.target.value)}>
              <option value="">— select a dealership —</option>
              {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealership_name}</option>)}
            </select>
          </Field>

          <Field label={`Emails (newline or comma separated) — ${emails.length} detected`}>
            <textarea className="input" rows={8} value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"alice@shop.com\nbob@shop.com, carol@shop.com"} />
          </Field>

          <div className="grid-2">
            <Field label="Plan (optional)">
              <select name="plan" className="select" value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="">— leave unchanged —</option>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Status (optional)">
              <select name="status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">— leave unchanged —</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <button className="btn btn-primary" disabled={busy || !dealershipId || emails.length === 0} onClick={submit}>
            {busy ? 'Assigning…' : `Assign ${emails.length || ''} to ${chosen?.dealership_name || 'dealership'}`}
          </button>
        </div>

        <div className="card card-pad">
          <h2 className="section-title">Results</h2>
          {!result && <div className="empty">Submit to see per-email results here.</div>}
          {result && (
            <>
              <div className="row" style={{ marginBottom: 12 }}>
                <span className="badge badge-green">{result.assigned} assigned</span>
                <span className="badge badge-red">{result.not_found} not found</span>
              </div>
              <div className="card">
                <table>
                  <thead><tr><th>Email</th><th>Result</th></tr></thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{r.email}</td>
                        <td>
                          {r.status === 'assigned'
                            ? <span className="badge badge-green">assigned · #{r.user_id}</span>
                            : <span className="badge badge-red">not found</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
