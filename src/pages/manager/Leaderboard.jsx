import { useEffect, useState } from 'react'
import { managerApi } from '../../api'
import { Notice, Spinner, errText, fmtDate } from '../../components/ui'

// STEP 3 — Live leaderboard (GET /manager/leaderboard).
// Defaults to the current in-progress week (the backend's `since` default). Rows
// arrive already ranked (sort key = posted desc, matching the emailed report);
// we render them in the order returned and use the server's `rank` — never
// re-sort client-side, so this can't silently drift from the backend's ranking.
// Counts are for the window (this week), which genuinely differ from lifetime.
// The manager appears here like anyone else (intentional — unlike the roster);
// no filtering or special badge.
export default function Leaderboard() {
  const [since, setSince] = useState('')   // '' → backend default = current week
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    managerApi.leaderboard(since || undefined)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setErr(errText(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [since])

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="row-between">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Window</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>
              {data ? `${fmtDate(data.week_start)} → ${fmtDate(data.week_end)}` : '—'}
              {!since && <span className="badge badge-blue" style={{ marginLeft: 8 }}>this week</span>}
            </div>
          </div>
          <div className="row">
            <div>
              <span className="muted" style={{ fontSize: 12, marginRight: 8 }}>Since</span>
              <input className="input" type="date" style={{ width: 160, display: 'inline-block' }}
                value={since} onChange={(e) => setSince(e.target.value)} />
            </div>
            {since && <button className="btn btn-ghost btn-sm" onClick={() => setSince('')}>Current week</button>}
          </div>
        </div>
      </div>

      <Notice kind="error">{err}</Notice>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 56 }}>Rank</th>
              <th>Salesperson</th>
              <th style={{ textAlign: 'right' }}>Generated</th>
              <th style={{ textAlign: 'right' }}>Posted</th>
              <th style={{ textAlign: 'right' }}>Post rate</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5}><Spinner /></td></tr>}
            {!loading && data?.leaderboard?.map((r) => (
              <tr key={r.user_id}>
                <td>
                  <span className="badge" style={r.rank === 1 ? { background: 'var(--orange)', color: 'var(--navy)', borderColor: 'var(--orange)' } : undefined}>
                    #{r.rank}
                  </span>
                </td>
                <td>
                  <strong>{r.full_name || '—'}</strong>
                  <div className="muted mono">{r.email}</div>
                </td>
                <td style={{ textAlign: 'right' }}>{r.generated}</td>
                <td style={{ textAlign: 'right' }}>{r.posted}</td>
                <td style={{ textAlign: 'right' }} className="muted">{r.post_rate_pct}%</td>
              </tr>
            ))}
            {!loading && data?.leaderboard?.length === 0 && (
              <tr><td colSpan={5}><div className="empty">No activity in this window.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
