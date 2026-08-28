import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { managerApi } from '../../api'
import { Notice, Spinner, errText, fmtDate } from '../../components/ui'

// STEP 1 — Manager landing screen: the team roster.
// Counts are lifetime (all-time), sourced from GET /manager/team. The manager
// themselves is intentionally excluded server-side (see manager.py) — we render
// exactly what the endpoint returns.
export default function TeamRoster() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    managerApi.team()
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setErr(errText(e)) })
    return () => { cancelled = true }
  }, [])

  if (data === null && !err) return <Spinner />

  return (
    <div className="stack">
      <div className="row-between">
        <div className="muted">
          {data?.count ?? 0} {data?.count === 1 ? 'salesperson' : 'salespeople'} · lifetime activity
        </div>
      </div>

      <Notice kind="error">{err}</Notice>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Salesperson</th>
              <th style={{ textAlign: 'right' }}>Generated</th>
              <th style={{ textAlign: 'right' }}>Posted</th>
              <th>Last active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.team?.map((u) => (
              <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/manager/team/${u.id}`)}>
                <td>
                  <strong>{u.full_name || '—'}</strong>
                  <div className="muted mono">{u.email}</div>
                </td>
                <td style={{ textAlign: 'right' }}>{u.generated}</td>
                <td style={{ textAlign: 'right' }}>{u.posted}</td>
                <td className="muted">{u.last_active ? fmtDate(u.last_active) : '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="muted" aria-hidden>›</span>
                </td>
              </tr>
            ))}
            {data?.team?.length === 0 && (
              <tr><td colSpan={5}><div className="empty">No salespeople in this dealership yet.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
